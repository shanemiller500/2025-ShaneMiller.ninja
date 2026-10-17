"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { onSinglePointerDrag } from "./orbitGuard";
import type { PointCloud } from "@/utils/geo/ept";

/* ------------------------------------------------------------------ */
/*  <PointCloudView> — real lidar returns in 3D. "Strip" lifts every   */
/*  non-ground return (trees, buildings, unclassified clutter) up and  */
/*  away, leaving only the laser hits that reached the ground — the    */
/*  bare-earth surface the maps are made from.                         */
/* ------------------------------------------------------------------ */

export type CloudColor = "class" | "height" | "intensity";

export interface PointCloudViewProps {
  cloud: PointCloud;
  color: CloudColor;
  strip: boolean;
  exaggeration: number;
  autoRotate: boolean;
  /** The person dragged the view — the page should turn autoRotate off (zooming doesn't count) */
  onAutoRotateStop?: () => void;
  className?: string;
}

const MODE: Record<CloudColor, number> = { class: 0, height: 1, intensity: 2 };

const vertexShader = /* glsl */ `
  attribute float cls;
  attribute float inten;
  uniform float uStrip, uMode, uZMax, uExag, uSize, uPixelRatio;
  varying vec3 vColor;
  varying float vAlpha;

  float hash(float n) { return fract(sin(n) * 43758.5453); }

  // compact "turbo"-like ramp
  vec3 ramp(float t) {
    t = clamp(t, 0.0, 1.0);
    return clamp(vec3(
      1.6 * t - 0.25 + 0.6 * sin(3.1 * t),
      sin(3.1416 * t) * 1.05,
      1.0 - 1.4 * t + 0.4 * sin(6.0 * t)
    ), 0.0, 1.0);
  }

  void main() {
    float c = cls;
    bool ground = (c == 2.0 || c == 9.0 || c == 20.0);
    float h = position.y / max(uZMax, 1.0);
    vec3 col;
    if (uMode < 0.5) {
      if (c == 2.0 || c == 20.0) col = mix(vec3(0.42, 0.33, 0.22), vec3(0.95, 0.82, 0.55), h);       // ground: earth tones
      else if (c == 9.0) col = vec3(0.2, 0.55, 0.95);                                                // water
      else if (c == 6.0) col = vec3(1.0, 0.45, 0.25);                                                // buildings
      else if (c == 17.0) col = vec3(0.75, 0.55, 1.0);                                               // bridges
      else col = mix(vec3(0.08, 0.38, 0.18), vec3(0.55, 0.95, 0.45), h);                             // vegetation / unclassified
    } else if (uMode < 1.5) {
      col = ramp(h);
    } else {
      col = vec3(0.15 + 0.85 * inten);
    }
    // stripped ground: fine contour bands every metre make low mounds and ditches readable
    if (ground && uStrip > 0.0) {
      float band = 1.0 - smoothstep(0.0, 0.12, abs(fract(position.y) - 0.5) * 2.0 - 0.88);
      col = mix(col, col * 0.62 + vec3(0.05, 0.12, 0.08), band * 0.55 * uStrip);
    }
    vec3 p = position;
    p.y *= uExag;
    float lift = ground ? 0.0 : uStrip;
    float r = hash(float(gl_VertexID));
    p.y += lift * lift * (60.0 + 140.0 * r);
    vAlpha = ground ? 1.0 : 1.0 - smoothstep(0.15, 0.85, uStrip + r * 0.15);
    vColor = col;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(uSize * uPixelRatio * (220.0 / -mv.z), 1.0, 7.0);
  }`;

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    if (vAlpha < 0.02) discard;
    vec2 d = gl_PointCoord - 0.5;
    if (dot(d, d) > 0.25) discard;
    gl_FragColor = vec4(vColor, vAlpha);
  }`;

export function PointCloudView({ cloud, color, strip, exaggeration, autoRotate, onAutoRotateStop, className = "" }: PointCloudViewProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const live = useRef({ color, strip, exaggeration, autoRotate, onAutoRotateStop });
  live.current = { color, strip, exaggeration, autoRotate, onAutoRotateStop };

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    const dpr = Math.min(window.devicePixelRatio, 1.5);
    renderer.setPixelRatio(dpr);
    renderer.setClearColor(0x020604);
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020604, 0.6 / (cloud.halfSize * 4));
    const camera = new THREE.PerspectiveCamera(50, 1, 1, cloud.halfSize * 20);

    // lidar x east / y north / z up → three x / -z / y
    const n = cloud.count;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = cloud.positions[i * 3];
      pos[i * 3 + 1] = cloud.positions[i * 3 + 2];
      pos[i * 3 + 2] = -cloud.positions[i * 3 + 1];
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("cls", new THREE.BufferAttribute(Float32Array.from(cloud.classes), 1));
    geo.setAttribute("inten", new THREE.BufferAttribute(cloud.intensity, 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: true,
      uniforms: {
        uStrip: { value: 0 },
        uMode: { value: MODE[live.current.color] },
        uZMax: { value: cloud.zRange[1] },
        uExag: { value: live.current.exaggeration },
        uSize: { value: 1.4 },
        uPixelRatio: { value: dpr },
      },
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    scene.add(points);

    // a faint frame marking the area that was loaded
    const s = cloud.halfSize;
    const frame = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.PlaneGeometry(s * 2, s * 2).rotateX(-Math.PI / 2)),
      new THREE.LineBasicMaterial({ color: 0x84cc16, transparent: true, opacity: 0.25 })
    );
    scene.add(frame);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.minDistance = s * 0.15;
    controls.maxDistance = s * 5;
    controls.autoRotateSpeed = 0.6;
    camera.position.set(s * 0.55, s * 0.9, s * 1.35);
    controls.target.set(0, cloud.zRange[1] * 0.3, 0);
    // zooming keeps it turning; dragging to look around stops it
    const stopGuard = onSinglePointerDrag(renderer.domElement, () => {
      live.current.autoRotate = false;
      live.current.onAutoRotateStop?.();
    });

    const resize = () => {
      renderer.setSize(el.clientWidth, el.clientHeight, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      camera.aspect = el.clientWidth / Math.max(1, el.clientHeight);
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    let raf = 0;
    let stripT = 0;
    let exag = live.current.exaggeration;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const L = live.current;
      // ease the strip so the trees float away instead of blinking out
      stripT += ((L.strip ? 1 : 0) - stripT) * (reduce ? 1 : 0.045);
      exag += (L.exaggeration - exag) * (reduce ? 1 : 0.1);
      mat.uniforms.uStrip.value = stripT < 0.001 ? 0 : stripT;
      mat.uniforms.uExag.value = exag;
      mat.uniforms.uMode.value = MODE[L.color];
      controls.autoRotate = L.autoRotate && !reduce;
      controls.update();
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      stopGuard();
      controls.dispose();
      geo.dispose();
      mat.dispose();
      frame.geometry.dispose();
      (frame.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [cloud]);

  return <div ref={mountRef} className={`overflow-hidden ${className}`} />;
}

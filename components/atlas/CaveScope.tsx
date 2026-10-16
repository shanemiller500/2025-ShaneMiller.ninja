"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { generateCave, PK, type CaveModel, type CaveSpec } from "./caveGen";
import { loadElevation, loadImageryColors, toLngLat, type BBox } from "./groundData";

/* ------------------------------------------------------------------ */
/*  <CaveScope> — a cave rendered as a glowing LiDAR-style point       */
/*  cloud. Orbit the whole system from outside, or fly the passage     */
/*  from the entrance down. A scan plane sweeps through the rock,      */
/*  rivers flow, crystals glint. Shared by any atlas project that      */
/*  goes underground. Geometry comes from caveGen (illustrative).      */
/* ------------------------------------------------------------------ */

export type CaveView = "orbit" | "fly";

export interface CaveTelemetry {
  /** metres below the surface (0 when above) */
  depth: number;
  /** 0–1 along the flight path */
  progress: number;
  maxDepth: number;
}

interface CaveScopeProps {
  spec: CaveSpec;
  /** the cave's real location — the ground becomes real terrain + imagery there */
  site?: { lng: number; lat: number } | null;
  view: CaveView;
  playing: boolean;
  /** flight speed multiplier */
  speed?: number;
  /** LiDAR scan sweep on/off */
  scan?: boolean;
  onTelemetry?: (t: CaveTelemetry) => void;
  /** fly-through reached the end */
  onFlightEnd?: () => void;
  /** real ground loaded (true) or unavailable (false) */
  onGround?: (ok: boolean) => void;
  /** the scan plane just started a new sweep (for a sonar ping) */
  onSweep?: () => void;
  /** show the real ground in its true colours instead of as a glowing scan */
  daylight?: boolean;
  className?: string;
}

const VERT = /* glsl */ `
  attribute vec3 color;
  attribute float size;
  attribute float kind;
  attribute float along;
  uniform float uTime;
  uniform float uScanY;
  uniform float uScanOn;
  uniform float uPixel;
  uniform float uFar;
  uniform float uGain;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float dist = max(0.5, -mv.z);
    vec3 c = color;
    // LiDAR sweep: a bright band slides down through the rock
    float band = exp(-pow((position.y - uScanY) / 1.6, 2.0)) * uScanOn;
    c += vec3(0.35, 0.95, 1.0) * band * 1.4;
    if (kind > 1.5 && kind < 2.5) {
      // water: ripples running downstream
      float f = 0.5 + 0.5 * sin(along * 1.7 - uTime * 4.0 + position.x * 0.7);
      c = vec3(0.2, 0.65, 1.0) * (0.5 + 1.1 * f);
    } else if (kind > 2.5 && kind < 3.5) {
      // calcite crystals glint
      float tw = pow(0.5 + 0.5 * sin(uTime * 5.0 + position.x * 13.1 + position.z * 7.7 + position.y * 3.3), 6.0);
      c = c * (0.35 + 2.6 * tw);
    } else if (kind > 4.5) {
      // light beams shimmer
      c *= 0.7 + 0.3 * sin(uTime * 2.0 + position.y * 0.4);
    }
    float fog = clamp(1.0 - dist / uFar, 0.0, 1.0);
    vAlpha = fog * fog;
    vColor = c * uGain;
    gl_PointSize = clamp(size * uPixel / dist * (uGain > 1.0 ? 1.7 : 1.0), 1.0, 16.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = dot(d, d);
    if (r > 0.25) discard;
    float soft = 1.0 - r * 4.0;
    gl_FragColor = vec4(vColor * soft, vAlpha * soft);
  }
`;

export function CaveScope({ spec, site = null, view, playing, speed = 1, scan = true, daylight = false, onTelemetry, onFlightEnd, onGround, onSweep, className = "" }: CaveScopeProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const live = useRef({ view, playing, speed, scan, daylight, onTelemetry, onFlightEnd, onGround, onSweep });
  live.current = { view, playing, speed, scan, daylight, onTelemetry, onFlightEnd, onGround, onSweep };
  const specKey = JSON.stringify({ spec, site });
  // set by the scene effect so the view effect can switch camera modes
  const switchView = useRef<(v: CaveView) => void>(() => undefined);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    // with a real site, the real terrain replaces the synthetic ground grid
    const model: CaveModel = generateCave({ ...spec, surface: !site });
    let disposed = false;

    /* points */
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(model.positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(model.colors, 3));
    geo.setAttribute("size", new THREE.BufferAttribute(model.sizes, 1));
    geo.setAttribute("kind", new THREE.BufferAttribute(model.kinds, 1));
    geo.setAttribute("along", new THREE.BufferAttribute(model.along, 1));
    const size = model.bounds.getSize(new THREE.Vector3());
    const extent = Math.max(size.x, size.y, size.z);
    const uniforms = {
      uTime: { value: 0 },
      uScanY: { value: 0 },
      uScanOn: { value: 1 },
      uPixel: { value: 260 },
      uFar: { value: extent * 3 },
      uGain: { value: 1 },
    };
    const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const points = new THREE.Points(geo, mat);
    const scene = new THREE.Scene();
    scene.add(points);

    /* renderer + bloom */
    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: "high-performance" });
    const dpr = Math.min(window.devicePixelRatio, 1.75);
    renderer.setPixelRatio(dpr);
    renderer.setClearColor(0x02030a, 1);
    host.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "none";

    const camera = new THREE.PerspectiveCamera(62, 1, 0.1, extent * 8);
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.85, 0.55, 0.05);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    /* orbit */
    const centre = model.bounds.getCenter(new THREE.Vector3());
    const Y = new THREE.Vector3(0, 1, 0);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    // honour the OS "reduce motion" setting: no auto-spin, no sweeping scan
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    controls.autoRotate = !reduceMotion;
    controls.autoRotateSpeed = 0.35;
    controls.minDistance = 8;
    controls.maxDistance = extent * 4;
    const toOrbit = () => {
      controls.enabled = true;
      // aim a little below centre so the deepest rooms clear the controls at the bottom of the screen
      controls.target.set(centre.x, centre.y - extent * 0.08, centre.z);
      camera.position.set(centre.x + extent * 0.95, centre.y + extent * 0.5, centre.z + extent * 1.05);
      camera.near = 0.5;
      camera.updateProjectionMatrix();
      uniforms.uFar.value = extent * 3;
      uniforms.uPixel.value = 260;
      controls.update();
    };

    /* fly */
    let curve = new THREE.CatmullRomCurve3(model.path, false, "centripetal", 0.4);
    let flightLength = curve.getLength();
    let s = 0;
    const look = new THREE.Vector3();
    const pointer = new THREE.Vector2();
    const toFly = () => {
      controls.enabled = false;
      camera.near = 0.1;
      camera.updateProjectionMatrix();
      uniforms.uFar.value = 120;
      uniforms.uPixel.value = 200;
      s = 0;
    };
    switchView.current = (v) => (v === "fly" ? toFly() : toOrbit());
    if (live.current.view === "fly") toFly();
    else toOrbit();

    /* real ground: terrain + imagery around the cave's location, as a scan of points */
    let groundGeo: THREE.BufferGeometry | null = null;
    let groundPoints: THREE.Points | null = null;
    // daylight ground: true colours, normal blending (no glow)
    // shares the live uniforms (time, scan, fog) but draws brighter and bigger
    const dayMat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { ...uniforms, uGain: { value: 1.8 } }, transparent: true, depthWrite: true, blending: THREE.NormalBlending });
    let heightAt: ((x: number, z: number) => number) | null = null;
    if (site) {
      (async () => {
        const b = model.bounds;
        // a square around the entrance big enough for any rotation of the cave
        const R = Math.max(Math.abs(b.min.x), Math.abs(b.max.x), Math.abs(b.min.z), Math.abs(b.max.z)) + 90;
        const [w, n] = toLngLat(site, -R, -R);
        const [e, s2] = toLngLat(site, R, R);
        const bbox: BBox = [w, s2, e, n];
        const [elev, rgb] = await Promise.all([loadElevation(bbox), loadImageryColors(bbox).catch(() => null)]);
        if (disposed) return;
        const e0 = elev(site.lng, site.lat);
        const hAt = (x: number, z: number) => {
          const [lng, lat] = toLngLat(site, x, z);
          return elev(lng, lat) - e0;
        };

        // turn the cave so its passages run under the real hills, not out into the air
        const pos = model.positions;
        const kinds = model.kinds;
        const sample: number[] = [];
        for (let i = 0; i < model.count; i += Math.max(1, Math.floor(model.count / 2500))) if (kinds[i] !== PK.beam) sample.push(i);
        let best = 0;
        let bestScore = -1;
        for (let k = 0; k < 12; k++) {
          const th = (k / 12) * Math.PI * 2;
          const c = Math.cos(th);
          const sn = Math.sin(th);
          let score = 0;
          for (const i of sample) {
            const x = pos[i * 3];
            const z = pos[i * 3 + 2];
            // rotation about +Y: x' = x cos + z sin, z' = -x sin + z cos
            if (pos[i * 3 + 1] < hAt(x * c + z * sn, -x * sn + z * c) - 2) score++;
          }
          if (score > bestScore) {
            bestScore = score;
            best = th;
          }
        }
        points.rotation.y = best;
        const path = model.path.map((p) => p.clone().applyAxisAngle(Y, best));
        // keep the drop-in approach above the real ground
        for (let i = 0; i < 2 && i < path.length; i++) path[i].y = Math.max(path[i].y, hAt(path[i].x, path[i].z) + 14);
        curve = new THREE.CatmullRomCurve3(path, false, "centripetal", 0.4);
        flightLength = curve.getLength();
        centre.applyAxisAngle(Y, best);

        // ground points: imagery colour, true height, contour glints every 5 m
        const step = Math.max(2, (2 * R) / 260);
        const P: number[] = [];
        const C: number[] = [];
        const col = new THREE.Color();
        for (let x = -R; x <= R; x += step)
          for (let z = -R; z <= R; z += step) {
            const jx = x + (Math.random() - 0.5) * step * 0.6;
            const jz = z + (Math.random() - 0.5) * step * 0.6;
            const h = hAt(jx, jz);
            P.push(jx, h, jz);
            const [lng, lat] = toLngLat(site, jx, jz);
            if (rgb) {
              const [r, g, bl] = rgb(lng, lat);
              col.setRGB(r, g, bl).multiplyScalar(1.05);
            } else col.set("#1e3a5f");
            if (Math.abs(((h / 5) % 1 + 1) % 1) < 0.07) col.lerp(new THREE.Color("#67e8f9"), 0.6);
            C.push(col.r, col.g, col.b);
          }
        const n3 = P.length / 3;
        groundGeo = new THREE.BufferGeometry();
        groundGeo.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
        groundGeo.setAttribute("color", new THREE.Float32BufferAttribute(C, 3));
        groundGeo.setAttribute("size", new THREE.Float32BufferAttribute(new Array(n3).fill(1.35), 1));
        groundGeo.setAttribute("kind", new THREE.Float32BufferAttribute(new Array(n3).fill(PK.surface), 1));
        groundGeo.setAttribute("along", new THREE.Float32BufferAttribute(new Array(n3).fill(0), 1));
        groundPoints = new THREE.Points(groundGeo, live.current.daylight ? dayMat : mat);
        scene.add(groundPoints);
        heightAt = hAt;
        if (live.current.view === "orbit") toOrbit();
        live.current.onGround?.(true);
      })().catch(() => {
        if (!disposed) live.current.onGround?.(false);
      });
    }

    const onPointer = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1);
    };
    renderer.domElement.addEventListener("pointermove", onPointer);

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = host;
      if (!w || !h) return;
      renderer.setSize(w, h);
      composer.setSize(w, h);
      bloom.setSize(w * dpr, h * dpr);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    /* loop */
    let raf = 0;
    let last = performance.now();
    let lastTele = 0;
    let lastCycle = -1;
    let bloomOn = true;
    let qualityStep = 0;
    let frames = 0;
    let sampleStart = 0;
    const top = model.bounds.max.y + 4;
    const bottom = model.bounds.min.y - 4;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (document.visibilityState !== "visible") return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const L = live.current;
      uniforms.uTime.value = now / 1000;
      uniforms.uScanOn.value = L.scan && !reduceMotion ? 1 : 0;
      if (groundPoints) groundPoints.material = L.daylight ? dayMat : mat;
      // a new sweep starts every 7 s
      const cycle = Math.floor(now / 7000);
      if (cycle !== lastCycle) {
        if (lastCycle >= 0 && L.scan && !reduceMotion) L.onSweep?.();
        lastCycle = cycle;
      }
      // the scan plane sweeps top → bottom every ~7 s
      uniforms.uScanY.value = top - (((now / 7000) % 1) * (top - bottom));

      if (L.view === "fly") {
        if (L.playing && s < 1) {
          s = Math.min(1, s + (dt * 16 * L.speed) / flightLength);
          if (s >= 1) L.onFlightEnd?.();
        }
        const p = curve.getPointAt(s);
        curve.getPointAt(Math.min(1, s + 7 / flightLength), look);
        // gentle look-around with the pointer
        look.x += pointer.x * 4;
        look.y -= pointer.y * 2.5;
        camera.position.lerp(p, 0.25);
        camera.lookAt(look);
      } else {
        controls.update();
      }
      if (bloomOn) composer.render();
      else renderer.render(scene, camera);

      // adaptive quality: if the first ~2 s run slowly, drop the bloom, then the pixel density
      if (qualityStep < 2) {
        frames++;
        if (!sampleStart) sampleStart = now;
        if (now - sampleStart > 2000) {
          const fps = (frames * 1000) / (now - sampleStart);
          if (fps < 32) {
            if (qualityStep === 0) bloomOn = false;
            else renderer.setPixelRatio(1);
            qualityStep++;
          } else qualityStep = 2;
          frames = 0;
          sampleStart = now;
        }
      }

      if (L.onTelemetry && now - lastTele > 200) {
        lastTele = now;
        // depth below the real ground directly overhead when we have it, else below the entrance
        const above = heightAt ? heightAt(camera.position.x, camera.position.z) : 0;
        L.onTelemetry({ depth: Math.max(0, Math.round(above - camera.position.y)), progress: L.view === "fly" ? s : 0, maxDepth: model.maxDepth });
      }
    };
    raf = requestAnimationFrame(loop);

    return () => {
      disposed = true;
      groundGeo?.dispose();
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointermove", onPointer);
      controls.dispose();
      geo.dispose();
      mat.dispose();
      dayMat.dispose();
      composer.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      switchView.current = () => undefined;
    };
    // rebuilt only when the cave itself changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specKey]);

  useEffect(() => {
    switchView.current(view);
  }, [view]);

  return <div ref={hostRef} className={`relative h-full w-full ${className}`} />;
}

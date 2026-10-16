"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { loadElevation, loadImageryColors } from "./groundData";
import { buildBasin, geometryBBox, padBBox, zoomForBBox, type Basin, type LakeGeometry } from "./basinGrid";

/* ------------------------------------------------------------------ */
/*  <BasinFill> — refill an Ice Age lake. Real ground (Terrarium       */
/*  elevation + Esri imagery) as a 3D relief, a ghost line at the old  */
/*  shoreline, and water that rises inside the mapped lake to `level`  */
/*  (0 = dry floor, 1 = the highstand shoreline).                      */
/* ------------------------------------------------------------------ */

export interface BasinFillProps {
  geometry: LakeGeometry;
  /** 0 → dry, 1 → shoreline */
  level: number;
  onReady?: (b: Basin | null, error?: string) => void;
  className?: string;
}

/** Scene units: 1 = 1 km horizontally; heights exaggerated so a broad basin still reads. */
export function BasinFill({ geometry, level, onReady, className = "" }: BasinFillProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const levelRef = useRef(level);
  levelRef.current = level;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    let disposed = false;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x03020a);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x03020a, 0.0011);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 6000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI * 0.47;
    controls.autoRotate = !reduce;
    controls.autoRotateSpeed = 0.35;
    renderer.domElement.addEventListener("pointerdown", () => (controls.autoRotate = false), { once: true });

    scene.add(new THREE.HemisphereLight(0xdbeafe, 0x1e1b4b, 0.9));
    const sun = new THREE.DirectionalLight(0xfff4e0, 1.6);
    sun.position.set(-0.6, 1, 0.4);
    scene.add(sun);

    const disposables: { dispose(): void }[] = [];
    let water: THREE.ShaderMaterial | null = null;
    let toY = (h: number) => h;
    let basin: Basin | null = null;

    (async () => {
      const bbox = padBBox(geometryBBox(geometry), 0.08);
      const [elevation, color] = await Promise.all([loadElevation(bbox, zoomForBBox(bbox)), loadImageryColors(bbox, 1024)]);
      if (disposed) return;
      const b = buildBasin(geometry, bbox, elevation, 256);
      basin = b;
      const [w, s, e, n] = bbox;
      const spanX = b.cellKmX * (b.cols - 1);
      const spanZ = b.cellKmY * (b.rows - 1);
      // exaggerate so the basin's relief is ~7% of its width
      let lo = Infinity, hi = -Infinity;
      for (let k = 0; k < b.heights.length; k++) {
        const h = b.heights[k];
        if (h < lo) lo = h;
        if (h > hi) hi = h;
      }
      const exag = Math.min(40, Math.max(3, (0.07 * Math.max(spanX, spanZ)) / Math.max(0.05, (hi - lo) / 1000)));
      toY = (h: number) => ((h - b.floor) / 1000) * exag;

      /* ground */
      const geo = new THREE.PlaneGeometry(spanX, spanZ, b.cols - 1, b.rows - 1);
      geo.rotateX(-Math.PI / 2);
      const pos = geo.attributes.position as THREE.BufferAttribute;
      const colors = new Float32Array(pos.count * 3);
      const hAttr = new Float32Array(pos.count);
      const inAttr = new Float32Array(pos.count);
      for (let i = 0; i < pos.count; i++) {
        // PlaneGeometry vertices run row by row from the north-west corner — same as the grid
        const r = Math.floor(i / b.cols);
        const c = i % b.cols;
        const h = b.heights[i];
        pos.setY(i, toY(h));
        hAttr[i] = h;
        inAttr[i] = b.inside[i];
        const [cr, cg, cb] = color(w + (c / (b.cols - 1)) * (e - w), n - (r / (b.rows - 1)) * (n - s));
        // imagery is already sRGB; convert so the renderer's output encoding doesn't wash it out
        colors[i * 3] = Math.pow(cr, 2.2);
        colors[i * 3 + 1] = Math.pow(cg, 2.2);
        colors[i * 3 + 2] = Math.pow(cb, 2.2);
      }
      geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      geo.computeVertexNormals();
      const groundMat = new THREE.MeshLambertMaterial({ vertexColors: true });
      scene.add(new THREE.Mesh(geo, groundMat));
      disposables.push(geo, groundMat);

      /* water: the same grid, flattened to the level, drawn only inside the lake and below the surface */
      const wgeo = new THREE.PlaneGeometry(spanX, spanZ, b.cols - 1, b.rows - 1);
      wgeo.rotateX(-Math.PI / 2);
      wgeo.setAttribute("ground", new THREE.BufferAttribute(hAttr, 1));
      wgeo.setAttribute("inLake", new THREE.BufferAttribute(inAttr, 1));
      water = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uLevel: { value: b.floor }, uY: { value: 0 }, uTime: { value: 0 } },
        vertexShader: `
          attribute float ground; attribute float inLake;
          uniform float uY;
          varying float vDepth; varying float vIn; varying vec2 vXZ;
          uniform float uLevel;
          void main() {
            vDepth = uLevel - ground; vIn = inLake; vXZ = position.xz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position.x, uY, position.z, 1.0);
          }`,
        fragmentShader: `
          uniform float uTime;
          varying float vDepth; varying float vIn; varying vec2 vXZ;
          void main() {
            if (vIn < 0.5 || vDepth <= 0.0) discard;
            float d = clamp(vDepth / 250.0, 0.0, 1.0);
            vec3 shallow = vec3(0.36, 0.86, 0.85);
            vec3 deep = vec3(0.02, 0.18, 0.36);
            vec3 col = mix(shallow, deep, sqrt(d));
            // a bright lip where the water meets the land
            col += vec3(0.6, 0.9, 1.0) * (1.0 - smoothstep(0.0, 6.0, vDepth)) * 0.6;
            col += 0.04 * sin(vXZ.x * 0.35 + uTime) * sin(vXZ.y * 0.31 - uTime * 0.8);
            gl_FragColor = vec4(col, mix(0.55, 0.88, d));
          }`,
      });
      const wmesh = new THREE.Mesh(wgeo, water);
      wmesh.renderOrder = 2;
      scene.add(wmesh);
      disposables.push(wgeo, water);

      /* ghost shoreline at the highstand */
      const lineMat = new THREE.LineBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.75 });
      const toXZ = (lng: number, lat: number): [number, number] => [((lng - w) / (e - w) - 0.5) * spanX, ((n - lat) / (n - s) - 0.5) * spanZ];
      const rings = geometry.type === "Polygon" ? [geometry.coordinates[0]] : geometry.coordinates.map((p) => p[0]);
      for (const ring of rings) {
        const pts = ring.map(([lng, lat]) => {
          const [x, z] = toXZ(lng, lat);
          return new THREE.Vector3(x, toY(b.shoreline) + 0.15, z);
        });
        const lg = new THREE.BufferGeometry().setFromPoints(pts);
        scene.add(new THREE.Line(lg, lineMat));
        disposables.push(lg);
      }
      disposables.push(lineMat);

      /* camera: from the south, looking across the basin */
      const span = Math.max(spanX, spanZ);
      camera.position.set(-span * 0.15, span * 0.55, span * 0.75);
      controls.target.set(0, toY(b.shoreline) * 0.4, 0);
      controls.minDistance = span * 0.08;
      controls.maxDistance = span * 2.2;
      scene.fog = new THREE.FogExp2(0x03020a, 0.55 / span);
      camera.far = span * 6;
      camera.updateProjectionMatrix();
      onReadyRef.current?.(b);
    })().catch((err) => {
      if (!disposed) onReadyRef.current?.(null, (err as Error).message);
    });

    /* loop */
    const resize = () => {
      const { clientWidth: cw, clientHeight: ch } = el;
      renderer.setSize(cw, ch, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      camera.aspect = cw / Math.max(1, ch);
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();
    let raf = 0;
    let shown = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      controls.update();
      if (water && basin) {
        // ease toward the requested level so slider jumps glide
        shown += (levelRef.current - shown) * (reduce ? 1 : 0.12);
        const lvl = basin.floor + shown * (basin.shoreline - basin.floor);
        water.uniforms.uLevel.value = lvl;
        water.uniforms.uY.value = toY(lvl);
        water.uniforms.uTime.value = now / 1000;
      }
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      for (const d of disposables) d.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [geometry]);

  return <div ref={mountRef} className={`overflow-hidden ${className}`} />;
}

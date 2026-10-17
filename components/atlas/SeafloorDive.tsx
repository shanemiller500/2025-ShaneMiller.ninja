"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { loadElevation } from "./groundData";
import { zoomForBBox, type BBox } from "./basinGrid";
import { inEmodnet, loadEmodnetDem, loadNceiDem, sampleGrid, type DemGrid } from "./nceiDem";

/* ------------------------------------------------------------------ */
/*  <SeafloorDive> — sink from the surface down to a wreck. The        */
/*  seafloor is real bathymetry: EMODnet in European seas (~115 m),    */
/*  else NOAA NCEI's DEM mosaic (coastal DEMs as fine as ~3 m along    */
/*  U.S. shores, GEBCO offshore), falling back to AWS Terrarium. Heights are exaggerated at most 6× so relief     */
/*  reads without turning a flat sand bottom into mountains. The wreck */
/*  is a sonar-style marker at its position — we know where wrecks    */
/*  are, not their shape.                                              */
/* ------------------------------------------------------------------ */

export type SeafloorSource = "emodnet" | "ncei" | "terrarium";

export interface DiveTelemetry {
  /** current depth below the surface, metres (real, not exaggerated) */
  depth: number;
  /** 0–1 through the descent */
  progress: number;
  /** modelled seafloor depth under the wreck, metres */
  floor: number;
  /** vertical exaggeration used for the scene */
  exaggeration: number;
  /** which bathymetry the scene is built from */
  source: SeafloorSource;
  ready: boolean;
}

export interface SeafloorDiveProps {
  center: [number, number];
  /** charted / published depth of the wreck (m); falls back to the modelled seafloor */
  depth?: number | null;
  playing: boolean;
  /** bump to restart the descent */
  restart?: number;
  onTelemetry?: (t: DiveTelemetry) => void;
  onError?: (message: string) => void;
  className?: string;
}

/** Water colour by real depth (sRGB): clear turquoise shallows → twilight blue → black. */
const WATER: [number, number][] = [
  [0, 0x1aa3b8],
  [25, 0x0b7390],
  [120, 0x06405e],
  [400, 0x041d33],
  [1200, 0x010a16],
  [4000, 0x000207],
];
function waterColor(d: number, out = new THREE.Color()) {
  for (let i = 1; i < WATER.length; i++) {
    if (d <= WATER[i][0] || i === WATER.length - 1) {
      const [d0, c0] = WATER[i - 1];
      const [d1, c1] = WATER[i];
      const t = Math.min(1, Math.max(0, (d - d0) / (d1 - d0)));
      return out.set(c0).lerp(new THREE.Color(c1), t);
    }
  }
  return out.set(WATER[WATER.length - 1][1]);
}

/* A tileable, procedurally drawn sand/silt texture: ripples + grain. */
function sandTexture() {
  const S = 512;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(S, S);
  // tileable value noise on wrapped lattices
  const lattice = (n: number, seed: number) => {
    const a = new Float32Array(n * n);
    let s = seed;
    for (let i = 0; i < a.length; i++) {
      s = (s * 16807) % 2147483647;
      a[i] = s / 2147483647;
    }
    return (x: number, y: number) => {
      const gx = (x / S) * n;
      const gy = (y / S) * n;
      const x0 = Math.floor(gx);
      const y0 = Math.floor(gy);
      const fx = gx - x0;
      const fy = gy - y0;
      const sx = fx * fx * (3 - 2 * fx);
      const sy = fy * fy * (3 - 2 * fy);
      const v = (i: number, j: number) => a[((j + n) % n) * n + ((i + n) % n)];
      return (v(x0, y0) * (1 - sx) + v(x0 + 1, y0) * sx) * (1 - sy) + (v(x0, y0 + 1) * (1 - sx) + v(x0 + 1, y0 + 1) * sx) * sy;
    };
  };
  const big = lattice(6, 7);
  const mid = lattice(24, 99);
  const fine = lattice(128, 1234);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      // sand ripples, bent by low-frequency noise (12 crests per tile keeps it tileable)
      const warp = big(x, y) * 2.2;
      const ripple = 0.5 + 0.5 * Math.sin(((x + y * 0.35) / S) * Math.PI * 2 * 12 + warp * 3);
      const v = 0.72 + 0.12 * ripple + 0.1 * mid(x, y) + 0.08 * fine(x, y) - 0.06 * big(x, y);
      const o = (y * S + x) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = Math.max(0, Math.min(255, v * 255));
      img.data[o + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/* Soft vertical light ray: bright, narrow core fading out sideways and downward. */
function rayTexture() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(64, 256);
  for (let y = 0; y < 256; y++)
    for (let x = 0; x < 64; x++) {
      const side = Math.exp(-Math.pow((x - 31.5) / 12, 2));
      const down = Math.pow(1 - y / 255, 1.6) * Math.min(1, y / 18);
      const o = (y * 64 + x) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = 255;
      img.data[o + 3] = 255 * side * down;
    }
  ctx.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(c);
}

/* Round, soft particle for marine snow and the marker halo. */
function dotTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/** Classic tileable water-caustic pattern (after Dave Hoskins), 0…~1. */
const CAUSTIC_GLSL = /* glsl */ `
float causticPattern(vec2 uv, float t) {
  vec2 p = mod(uv * 6.28318, 6.28318) - 250.0;
  vec2 i = p;
  float c = 1.0;
  float inten = 0.005;
  for (int n = 0; n < 5; n++) {
    float tt = t * (1.0 - (3.5 / float(n + 1)));
    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
  }
  c /= 5.0;
  c = 1.17 - pow(c, 1.4);
  return clamp(pow(abs(c), 8.0), 0.0, 1.5);
}
`;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function SeafloorDive({ center, depth, playing, restart = 0, onTelemetry, onError, className = "" }: SeafloorDiveProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const live = useRef({ playing, onTelemetry, onError });
  live.current = { playing, onTelemetry, onError };

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    let disposed = false;
    const ctl = new AbortController();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const small = window.innerWidth < 700;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const fog = new THREE.FogExp2(0x1aa3b8, 0.002);
    scene.fog = fog;
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 80000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enabled = false;
    const hemi = new THREE.HemisphereLight(0xa5f3fc, 0x1e293b, 1.1);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xf0f9ff, 2);
    sun.position.set(0.35, 1, 0.25);
    scene.add(sun);
    // the "ROV" lamp, switched on once the sunlight is gone
    const lamp = new THREE.SpotLight(0xfff3d0, 0, 0, 0.42, 0.85, 0);
    scene.add(lamp, lamp.target);
    const disposables: { dispose(): void }[] = [];
    const uTime = { value: 0 };

    const state = {
      ready: false,
      exag: 1,
      floor: 0,
      target: 0,
      t0: 0,
      duration: 12,
      paused: 0,
      lastPlaying: true,
      source: "ncei" as SeafloorSource,
      halfM: 1000,
      wreckY: 0,
      snow: null as THREE.Points | null,
      surface: null as THREE.Mesh | null,
      surfaceMat: null as THREE.ShaderMaterial | null,
      backdrop: null as THREE.Mesh | null,
      rays: [] as THREE.Mesh[],
      rayMat: null as THREE.MeshBasicMaterial | null,
      ring: null as THREE.Mesh | null,
      ping: null as THREE.Mesh | null,
      floorAt: (_x: number, _z: number) => 0,
    };

    (async () => {
      const [lng, lat] = center;
      // area sized to the dive: ±250 m for a reef-top wreck, up to ±9 km for the Titanic
      const guess = Math.max(4, depth ?? 60);
      const halfM = clamp(guess * 4, 250, 9000);
      state.halfM = halfM;
      const dLng = halfM / (111_320 * Math.cos((lat * Math.PI) / 180));
      const dLat = halfM / 110_574;
      const bbox: BBox = [lng - dLng, lat - dLat, lng + dLng, lat + dLat];

      /* bathymetry: NOAA's best, else Terrarium (ocean depths only to z10) */
      const N = small ? 224 : 384;
      let grid: DemGrid;
      try {
        // European seas: EMODnet's DTM beats the global mosaic (GEBCO there)
        if (!inEmodnet(center)) throw new Error("outside EMODnet");
        grid = await loadEmodnetDem(bbox, ctl.signal);
        state.source = "emodnet";
      } catch {
        if (disposed) return;
        try {
          grid = await loadNceiDem(bbox, N, ctl.signal);
          state.source = "ncei";
        } catch (e) {
        if (disposed) return;
        state.source = "terrarium";
        const elev = await loadElevation(bbox, zoomForBBox(bbox, 16, 10));
        const data = new Float32Array(N * N);
        for (let r = 0; r < N; r++)
          for (let c = 0; c < N; c++) data[r * N + c] = elev(lng - dLng + (c / (N - 1)) * 2 * dLng, lat + dLat - (r / (N - 1)) * 2 * dLat);
        grid = { width: N, height: N, data };
        void e;
        }
      }
      if (disposed) return;
      const heightAt = (c: number, r: number) => {
        const h = sampleGrid(grid, (c / (N - 1)) * (grid.width - 1), (r / (N - 1)) * (grid.height - 1));
        return Number.isNaN(h) ? 0 : h;
      };
      const heights = new Float32Array(N * N);
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) heights[r * N + c] = heightAt(c, r);
      const modelFloor = Math.max(0.5, -heightAt((N - 1) / 2, (N - 1) / 2));
      const target = depth != null && depth > 0 ? depth : modelFloor;
      state.floor = modelFloor;
      state.target = target;
      let deepest = 1;
      for (let k = 0; k < heights.length; k++) if (-heights[k] > deepest) deepest = -heights[k];
      // exaggerate so the dive spans ~quarter of the area's width — but never more than 6×
      const exag = clamp((0.5 * halfM) / Math.max(deepest, target), 1, 6);
      state.exag = exag;

      /* seafloor mesh */
      const geo = new THREE.PlaneGeometry(2 * halfM, 2 * halfM, N - 1, N - 1);
      geo.rotateX(-Math.PI / 2);
      const pos = geo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const h = heights[i];
        pos.setY(i, h >= 0 ? Math.min(h, 40) * exag * 0.6 : h * exag);
      }
      geo.computeVertexNormals();
      const nrm = geo.attributes.normal as THREE.BufferAttribute;
      const colors = new Float32Array(pos.count * 3);
      const col = new THREE.Color();
      const sand = new THREE.Color(0xe9dbb5);
      const mid = new THREE.Color(0x9a8f78);
      const silt = new THREE.Color(0x4a5060);
      const ooze = new THREE.Color(0x46505f);
      const rock = new THREE.Color(0x5e554b);
      const land = new THREE.Color(0x5f7a3a);
      for (let i = 0; i < pos.count; i++) {
        const h = heights[i];
        if (h >= 0) col.copy(land);
        else {
          const d = -h;
          col.copy(sand).lerp(mid, clamp(d / 40, 0, 1)).lerp(silt, clamp((d - 40) / 400, 0, 1)).lerp(ooze, clamp((d - 400) / 2500, 0, 1));
          // steep ground is bare rock
          col.lerp(rock, clamp((1 - nrm.getY(i)) * 2.5, 0, 0.75));
        }
        colors.set([col.r, col.g, col.b], i * 3);
      }
      geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      const sandTex = sandTexture();
      // a sand tile every ~6 m in the shallows, coarser over the deep floor
      const tile = clamp(halfM / 40, 6, 400);
      sandTex.repeat.set((2 * halfM) / tile, (2 * halfM) / tile);
      const floorMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: sandTex, bumpMap: sandTex, bumpScale: 0.6, roughness: 0.96, metalness: 0 });
      // sunlight caustics dancing on the bottom, fading out by ~40 m
      floorMat.onBeforeCompile = (sh) => {
        sh.uniforms.uTime = uTime;
        sh.uniforms.uExag = { value: exag };
        sh.uniforms.uScale = { value: 1 / clamp(halfM / 60, 3, 60) };
        sh.vertexShader = sh.vertexShader
          .replace("#include <common>", "#include <common>\nvarying vec3 vWPos;")
          .replace("#include <project_vertex>", "#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;");
        sh.fragmentShader = sh.fragmentShader
          .replace("#include <common>", `#include <common>\nvarying vec3 vWPos;\nuniform float uTime;\nuniform float uExag;\nuniform float uScale;\n${CAUSTIC_GLSL}`)
          .replace(
            "#include <tonemapping_fragment>",
            `float realD = max(0.0, -vWPos.y / uExag);
             float cK = 0.85 * exp(-realD / 14.0);
             if (cK > 0.002) {
               float ca = causticPattern(vWPos.xz * uScale, uTime * 0.45);
               float cb = causticPattern(vWPos.xz * uScale * 1.37 + 3.1, uTime * 0.38);
               gl_FragColor.rgb += vec3(0.78, 0.96, 1.0) * (ca * 0.65 + cb * 0.35) * cK;
             }
             #include <tonemapping_fragment>`
          );
      };
      const floorMesh = new THREE.Mesh(geo, floorMat);
      scene.add(floorMesh);
      disposables.push(geo, floorMat, sandTex);

      /* a seabed skirt beyond the surveyed square, so the floor fades into the water instead of ending */
      let edgeSum = 0;
      let edgeN = 0;
      let edgeR = 0;
      let edgeG = 0;
      let edgeB = 0;
      for (let k = 0; k < N; k++)
        for (const i of [k, (N - 1) * N + k, k * N, k * N + N - 1]) {
          edgeSum += pos.getY(i);
          edgeR += colors[i * 3];
          edgeG += colors[i * 3 + 1];
          edgeB += colors[i * 3 + 2];
          edgeN++;
        }
      const skirtGeo = new THREE.RingGeometry(halfM * 0.98, halfM * 10, 96, 1).rotateX(-Math.PI / 2);
      const skirtMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(edgeR / edgeN, edgeG / edgeN, edgeB / edgeN), map: sandTex, roughness: 1 });
      const skirt = new THREE.Mesh(skirtGeo, skirtMat);
      skirt.position.y = edgeSum / edgeN - halfM * 0.01;
      scene.add(skirt);
      disposables.push(skirtGeo, skirtMat);
      // floor height (scene units) under any point — keeps the camera out of the hills
      state.floorAt = (x, z) => {
        const c = ((x + halfM) / (2 * halfM)) * (N - 1);
        const r = ((z + halfM) / (2 * halfM)) * (N - 1);
        const h = sampleGrid({ width: N, height: N, data: heights }, c, r);
        return Number.isNaN(h) ? -target * exag : h >= 0 ? Math.min(h, 40) * exag * 0.6 : h * exag;
      };

      /* the water surface, seen from below: rippled and bright */
      const sGeo = new THREE.PlaneGeometry(4 * halfM, 4 * halfM, 1, 1).rotateX(-Math.PI / 2);
      const sMat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: { uTime, uScale: { value: 1 / clamp(halfM / 40, 4, 120) }, uOpacity: { value: 0.75 }, uFogColor: { value: fog.color }, uFogDensity: { value: 0.002 } },
        vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
        fragmentShader: `varying vec3 vW; uniform float uTime; uniform float uScale; uniform float uOpacity; uniform vec3 uFogColor; uniform float uFogDensity; ${CAUSTIC_GLSL}
          void main(){
            float d = length(vW - cameraPosition);
            float near = exp(-d * uFogDensity * 1.8);
            float c = causticPattern(vW.xz * uScale, uTime * 0.6) * near;
            vec3 col = mix(vec3(0.16, 0.62, 0.70), vec3(0.85, 0.98, 1.0), clamp(c * 0.9 + 0.2 * near, 0.0, 1.0));
            float f = 1.0 - exp(-pow(d * uFogDensity, 2.0));
            gl_FragColor = vec4(mix(col, uFogColor, f), uOpacity * (1.0 - 0.6 * f));
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      });
      state.surface = new THREE.Mesh(sGeo, sMat);
      state.surfaceMat = sMat;
      scene.add(state.surface);
      disposables.push(sGeo, sMat);

      /* the far water: a fogged, tone-mapped backdrop so the horizon matches the fogged floor exactly
         (the renderer's clear colour skips tone mapping and would show as a band) */
      const bgGeo = new THREE.SphereGeometry(halfM * 7, 32, 16);
      const bgMat = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide, depthWrite: false });
      state.backdrop = new THREE.Mesh(bgGeo, bgMat);
      state.backdrop.renderOrder = -1;
      scene.add(state.backdrop);
      disposables.push(bgGeo, bgMat);

      /* light rays from the surface, only where sunlight reaches */
      const rayTex = rayTexture();
      const rayMat = new THREE.MeshBasicMaterial({ map: rayTex, color: 0xd9f6ff, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
      state.rayMat = rayMat;
      const rayLen = Math.min(target, 70) * exag * 1.1 + halfM * 0.1;
      const rayGeo = new THREE.PlaneGeometry(1, 1).translate(0, -0.5, 0);
      let seed = 11;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let k = 0; k < 18; k++) {
        const m = new THREE.Mesh(rayGeo, rayMat);
        const r = halfM * (0.08 + 0.55 * rnd());
        const a = rnd() * Math.PI * 2;
        m.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
        m.scale.set(halfM * (0.02 + 0.05 * rnd()), rayLen * (0.6 + 0.5 * rnd()), 1);
        m.userData.phase = rnd() * 10;
        m.renderOrder = 2;
        scene.add(m);
        state.rays.push(m);
      }
      disposables.push(rayTex, rayMat, rayGeo);

      /* the wreck: a sonar contact on the seabed — position, not shape */
      // never bury the marker: the published depth can sit a little below the model floor
      const wreckY = -Math.min(target, modelFloor) * exag;
      state.wreckY = wreckY;
      const ringR = halfM * 0.035;
      const ringGeo = new THREE.RingGeometry(ringR * 0.92, ringR, 96).rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.85, depthWrite: false, fog: false });
      state.ring = new THREE.Mesh(ringGeo, ringMat);
      state.ring.position.set(0, wreckY + halfM * 0.002, 0);
      scene.add(state.ring);
      const pingMat = ringMat.clone();
      state.ping = new THREE.Mesh(ringGeo, pingMat);
      state.ping.position.copy(state.ring.position);
      scene.add(state.ping);
      const beamGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, wreckY, 0), new THREE.Vector3(0, wreckY + Math.max(halfM * 0.12, -wreckY * 0.35), 0)]);
      const beamMat = new THREE.LineBasicMaterial({ color: 0xfde68a, transparent: true, opacity: 0.7, fog: false });
      scene.add(new THREE.Line(beamGeo, beamMat));
      const dotTex = dotTexture();
      const haloMat = new THREE.SpriteMaterial({ map: dotTex, color: 0xfde68a, transparent: true, opacity: 0.65, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
      const halo = new THREE.Sprite(haloMat);
      halo.scale.setScalar(halfM * 0.007);
      halo.position.set(0, wreckY + halfM * 0.004, 0);
      scene.add(halo);
      disposables.push(ringGeo, ringMat, pingMat, beamGeo, beamMat, haloMat);

      /* marine snow around the camera */
      const S = small ? 1500 : 3000;
      const snowPos = new Float32Array(S * 3);
      for (let i = 0; i < S; i++) snowPos.set([rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1], i * 3);
      const snowGeo = new THREE.BufferGeometry();
      snowGeo.setAttribute("position", new THREE.BufferAttribute(snowPos, 3));
      const snowMat = new THREE.PointsMaterial({ map: dotTex, color: 0xe0f2fe, size: halfM * 0.0011, sizeAttenuation: true, transparent: true, opacity: 0.5, depthWrite: false });
      state.snow = new THREE.Points(snowGeo, snowMat);
      state.snow.frustumCulled = false;
      scene.add(state.snow);
      disposables.push(snowGeo, snowMat, dotTex);

      // light that reaches the bottom fades with depth
      sun.intensity = 0.25 + 2.2 * Math.exp(-target / 90);
      hemi.intensity = 0.35 + 0.9 * Math.exp(-target / 150);

      // longer descents for deeper wrecks (Titanic takes ~30 s)
      state.duration = Math.min(32, 9 + Math.sqrt(target) * 0.4);
      state.t0 = performance.now();
      state.ready = true;
    })().catch((e) => !disposed && live.current.onError?.((e as Error).message));

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
    let lastTele = 0;
    const tmp = new THREE.Color();
    const look = new THREE.Vector3();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      uTime.value = now / 1000;
      if (!state.ready) {
        renderer.setClearColor(0x0b7390);
        renderer.render(scene, camera);
        return;
      }
      const { playing: isPlaying } = live.current;
      // pause: hold the clock
      if (!isPlaying && state.lastPlaying) state.paused = now;
      if (isPlaying && !state.lastPlaying && state.paused) state.t0 += now - state.paused;
      state.lastPlaying = isPlaying;
      const elapsed = ((isPlaying ? now : state.paused || now) - state.t0) / 1000;
      const p = reduce ? 1 : Math.min(1, elapsed / state.duration);
      const { halfM, exag, target, wreckY } = state;
      // ease in-out, and stop a little above the wreck
      const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      const stopAbove = Math.min(target * 0.3, 40);
      const realDepth = e * Math.max(0, target - stopAbove);
      if (p < 1 || !controls.enabled) {
        const a = elapsed * 0.1 + 0.6;
        const radius = halfM * (0.42 - 0.27 * e);
        const x = Math.cos(a) * radius;
        const z = Math.sin(a) * radius;
        // never inside a hill
        const y = Math.max(-realDepth * exag + halfM * 0.04 * (1 - e), state.floorAt(x, z) + halfM * 0.015);
        camera.position.set(x, y, z);
        look.set(0, THREE.MathUtils.lerp(y - halfM * 0.6, wreckY, Math.min(1, e * 1.3)), 0);
        camera.lookAt(look);
        if (p >= 1) {
          controls.target.set(0, wreckY, 0);
          controls.minDistance = halfM * 0.03;
          controls.maxDistance = halfM * 0.9;
          controls.maxPolarAngle = Math.PI * 0.49;
          controls.enabled = true;
        }
      }
      // (only once free: update() re-aims the camera at the controls' target)
      if (controls.enabled) controls.update();
      // keep the free camera out of the seabed too
      const fy = state.floorAt(camera.position.x, camera.position.z) + halfM * 0.008;
      if (camera.position.y < fy) camera.position.y = fy;

      // the deeper, the darker
      const camDepth = Math.max(0, -camera.position.y / exag);
      waterColor(camDepth, tmp);
      renderer.setClearColor(tmp);
      fog.color.copy(tmp);
      fog.density = (3.2 + Math.min(2.5, camDepth / 500)) / (halfM * 1.35);
      if (state.surfaceMat) state.surfaceMat.uniforms.uFogDensity.value = fog.density;
      if (state.backdrop) state.backdrop.position.copy(camera.position);
      // the ROV lamp: on once the sunlight is gone, aimed where the camera looks
      lamp.intensity = camDepth > 150 ? Math.min(7, (camDepth - 150) / 80) : 0;
      lamp.position.copy(camera.position);
      camera.getWorldDirection(look);
      lamp.target.position.copy(camera.position).addScaledVector(look, halfM * 0.2);

      const sunlit = Math.max(0, 1 - camDepth / 180);
      if (state.surfaceMat) state.surfaceMat.uniforms.uOpacity.value = 0.75 * sunlit;
      if (state.surface) state.surface.visible = sunlit > 0.01;
      if (state.rayMat) state.rayMat.opacity = 0.13 * sunlit;
      for (const r of state.rays) {
        r.visible = sunlit > 0.01;
        // billboard around the vertical axis, with a slow sway
        r.rotation.set(0, Math.atan2(camera.position.x - r.position.x, camera.position.z - r.position.z), 0.06 * Math.sin(now / 2600 + r.userData.phase));
      }
      if (state.ring && state.ping) {
        const k = (now / 2200) % 1;
        state.ping.scale.set(1 + 2.2 * k, 1, 1 + 2.2 * k);
        (state.ping.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - k);
      }
      if (state.snow) {
        state.snow.position.copy(camera.position);
        state.snow.scale.setScalar(halfM * 0.07);
        state.snow.rotation.y += 0.0003;
        state.snow.position.y += Math.sin(now / 3000) * halfM * 0.002;
      }
      renderer.render(scene, camera);
      if (now - lastTele > 120) {
        lastTele = now;
        live.current.onTelemetry?.({ depth: Math.round(camDepth), progress: p, floor: Math.round(state.floor * 10) / 10, exaggeration: Math.round(exag * 10) / 10, source: state.source, ready: true });
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      ctl.abort();
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      for (const d of disposables) d.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
    // rebuild per wreck (and on restart)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center[0], center[1], depth, restart]);

  return <div ref={mountRef} className={`overflow-hidden ${className}`} />;
}

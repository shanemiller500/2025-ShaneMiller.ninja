"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { esriExport, loadImage } from "./groundData";

/* ------------------------------------------------------------------ */
/*  <DepthView> — a block of crust you can orbit: imagery on top,      */
/*  points placed at their true depth below it. Shared by any atlas    */
/*  project with things underground (quakes now; caves, wells, mines   */
/*  later). Geometry is km-true horizontally; depth is exaggerated     */
/*  (and labelled) so thin crustal features stay readable.             */
/* ------------------------------------------------------------------ */

export interface DepthPoint {
  id: string;
  lng: number;
  lat: number;
  /** km below the surface */
  depth: number;
  /** drives the sphere size */
  mag: number;
  color: string;
  label?: string;
}

export interface DepthLine {
  coords: [number, number][];
  color: string;
}

interface DepthViewProps {
  /** [west, south, east, north]; west > east crosses the antimeridian */
  bbox: [number, number, number, number];
  points: DepthPoint[];
  lines?: DepthLine[];
  /** Drape satellite imagery on the top surface */
  imagery?: boolean;
  selectedId?: string | null;
  onPick?: (id: string | null) => void;
  dark: boolean;
  /** Vertical exaggeration — auto when omitted */
  exaggeration?: number;
  className?: string;
}

const SIZE = 100; // the longer horizontal side, in scene units

/**
 * Satellite texture for a bbox. Esri returns black east of 180°, so a box that
 * crosses the antimeridian is fetched as two halves and stitched on a canvas.
 */
export async function imageryTexture([w, s, e, n]: [number, number, number, number], px = 1024) {
  const E = e < w ? e + 360 : e;
  const aspect = (E - w) / (n - s);
  const width = aspect >= 1 ? px : Math.round(px * aspect);
  const height = aspect >= 1 ? Math.round(px / aspect) : px;
  let tex: THREE.Texture;
  if (E <= 180) {
    tex = new THREE.Texture(await loadImage(esriExport(w, s, E, n, width, height)));
  } else {
    const leftW = Math.max(1, Math.round((width * (180 - w)) / (E - w)));
    const [a, b] = await Promise.all([
      loadImage(esriExport(w, s, 180, n, leftW, height)),
      loadImage(esriExport(-180, s, E - 360, n, Math.max(1, width - leftW), height)),
    ]);
    const c = document.createElement("canvas");
    c.width = width;
    c.height = height;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(a, 0, 0);
    ctx.drawImage(b, leftW, 0);
    tex = new THREE.CanvasTexture(c);
  }
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function textSprite(text: string, color: string, scale: number) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext("2d")!;
  ctx.font = "600 34px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.fillText(text, 8, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(scale * 4, scale, 1);
  return sprite;
}

export function DepthView({ bbox, points, lines = [], imagery = true, selectedId, onPick, dark, exaggeration, className = "" }: DepthViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const [vexShown, setVexShown] = useState(1);
  const sceneRef = useRef<{ scene: THREE.Scene; place: (p: DepthPoint) => THREE.Vector3; radius: (m: number) => number; index: Map<string, DepthPoint> } | null>(null);
  const selRef = useRef<THREE.Object3D | null>(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  const bboxKey = bbox.join(",");

  /* ── build the scene ─────────────────────────────────────────────── */
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const [w, s, e, n] = bbox;
    const crosses = e < w;
    const E = crosses ? e + 360 : e;
    const cLng = (w + E) / 2;
    const cLat = (s + n) / 2;
    const kx = 111.32 * Math.cos((cLat * Math.PI) / 180);
    const ky = 110.57;
    const widthKm = (E - w) * kx;
    const heightKm = (n - s) * ky;
    const U = SIZE / Math.max(widthKm, heightKm);
    const W = widthKm * U;
    const H = heightKm * U;

    const deepest = points.reduce((m, p) => Math.max(m, p.depth), 0);
    const step = deepest <= 120 ? 20 : deepest <= 300 ? 50 : 100;
    const maxDepth = Math.max(step * 2, Math.ceil(deepest / step) * step);
    const vex = exaggeration ?? Math.min(8, Math.max(1, (0.42 * Math.max(widthKm, heightKm)) / maxDepth));
    setVexShown(Math.round(vex * 10) / 10);
    const D = maxDepth * U * vex;

    const normLng = (lng: number) => (crosses && lng < w ? lng + 360 : lng);
    const place = (p: { lng: number; lat: number; depth: number }) =>
      new THREE.Vector3((normLng(p.lng) - cLng) * kx * U, -p.depth * U * vex, -(p.lat - cLat) * ky * U);
    const radius = (mag: number) => 0.22 + 0.13 * 1.55 ** (mag - 3);

    const ink = dark ? "#cbd5e1" : "#334155";
    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.position.set(60, 120, 80);
    scene.add(sun);

    /* surface — see-through, so what's beneath stays visible from above */
    const surfMat = new THREE.MeshBasicMaterial({ color: dark ? 0x1e293b : 0xcbd5e1, transparent: true, opacity: 0.62, side: THREE.DoubleSide, depthWrite: false });
    const surface = new THREE.Mesh(new THREE.PlaneGeometry(W, H), surfMat);
    surface.rotation.x = -Math.PI / 2;
    scene.add(surface);
    let disposed = false;
    if (imagery) {
      imageryTexture(bbox)
        .then((tex) => {
          if (disposed) return tex.dispose();
          surfMat.map = tex;
          surfMat.color.set(0xffffff);
          surfMat.needsUpdate = true;
        })
        .catch(() => undefined); // keep the plain surface
    }

    /* walls: faint back + left + floor so the volume reads as a block */
    const wallMat = new THREE.MeshBasicMaterial({ color: dark ? 0x94a3b8 : 0x64748b, transparent: true, opacity: dark ? 0.06 : 0.08, side: THREE.DoubleSide, depthWrite: false });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(W, D), wallMat);
    back.position.set(0, -D / 2, -H / 2);
    const left = new THREE.Mesh(new THREE.PlaneGeometry(H, D), wallMat);
    left.rotation.y = Math.PI / 2;
    left.position.set(-W / 2, -D / 2, 0);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, H), wallMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -D;
    scene.add(back, left, floor);

    /* box edges + depth gridlines */
    const lineMat = new THREE.LineBasicMaterial({ color: dark ? 0x475569 : 0x94a3b8, transparent: true, opacity: 0.7 });
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(W, D, H)), lineMat);
    edges.position.y = -D / 2;
    scene.add(edges);
    const gridMat = new THREE.LineBasicMaterial({ color: dark ? 0x334155 : 0xcbd5e1, transparent: true, opacity: 0.8 });
    const labelScale = SIZE * 0.022;
    for (let d = step; d <= maxDepth; d += step) {
      const y = -d * U * vex;
      const loop = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(-W / 2, y, -H / 2),
          new THREE.Vector3(W / 2, y, -H / 2),
          new THREE.Vector3(W / 2, y, H / 2),
          new THREE.Vector3(-W / 2, y, H / 2),
        ]),
        gridMat
      );
      scene.add(loop);
      const label = textSprite(`${d} km`, ink, labelScale);
      label.position.set(-W / 2 - labelScale * 2.3, y, H / 2);
      scene.add(label);
    }
    const north = textSprite("N ↑", ink, labelScale * 1.2);
    north.position.set(0, labelScale, -H / 2 - labelScale * 1.5);
    scene.add(north);

    /* surface lines (plate boundaries…), clipped to the box */
    for (const l of lines) {
      let run: THREE.Vector3[] = [];
      const flush = () => {
        if (run.length > 1) {
          const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints(run), new THREE.LineBasicMaterial({ color: l.color, linewidth: 2 }));
          scene.add(ln);
        }
        run = [];
      };
      for (const [lng, lat] of l.coords) {
        const x = normLng(lng);
        if (x < w || x > E || lat < s || lat > n) {
          flush();
          continue;
        }
        const v = place({ lng, lat, depth: 0 });
        v.y = 0.08;
        run.push(v);
      }
      flush();
    }

    /* points */
    const index = new Map<string, DepthPoint>();
    const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.05 }), Math.max(1, points.length));
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const color = new THREE.Color();
    points.forEach((p, i) => {
      index.set(p.id, p);
      const r = radius(p.mag);
      m4.compose(place(p), q, new THREE.Vector3(r, r, r));
      mesh.setMatrixAt(i, m4);
      mesh.setColorAt(i, color.set(p.color));
    });
    mesh.count = points.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    scene.add(mesh);
    sceneRef.current = { scene, place, radius, index };

    /* renderer, camera, controls */
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 3000);
    // low, three-quarter view from the south-east: the slab reads as a sheet diving into the block
    camera.position.set(SIZE * 1.1, SIZE * 0.3 + D * 0.1, SIZE * 1.15);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, -D * 0.45, 0);
    controls.enableDamping = true;
    controls.minDistance = SIZE * 0.25;
    controls.maxDistance = SIZE * 4;
    controls.update();

    const resize = () => {
      const { clientWidth: cw, clientHeight: ch } = host;
      if (!cw || !ch) return;
      renderer.setSize(cw, ch);
      camera.aspect = cw / ch;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    /* picking + hover */
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const hit = (ev: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const h = ray.intersectObject(mesh, false)[0];
      return h?.instanceId != null ? points[h.instanceId] : undefined;
    };
    let down: { x: number; y: number } | null = null;
    const onDown = (ev: PointerEvent) => (down = { x: ev.clientX, y: ev.clientY });
    const onUp = (ev: PointerEvent) => {
      if (!down || Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 5) return;
      pickRef.current?.(hit(ev)?.id ?? null);
    };
    let hoverRaf = 0;
    const onMove = (ev: PointerEvent) => {
      if (ev.buttons) return setTip(null);
      cancelAnimationFrame(hoverRaf);
      hoverRaf = requestAnimationFrame(() => {
        const p = hit(ev);
        renderer.domElement.style.cursor = p ? "pointer" : "grab";
        const r = host.getBoundingClientRect();
        setTip(p ? { x: ev.clientX - r.left, y: ev.clientY - r.top, text: p.label ?? `M${p.mag.toFixed(1)} · ${p.depth} km` } : null);
      });
    };
    const onLeave = () => setTip(null);
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerleave", onLeave);

    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (document.visibilityState !== "visible") return;
      controls.update();
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cancelAnimationFrame(hoverRaf);
      ro.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerleave", onLeave);
      scene.traverse((o) => {
        const obj = o as THREE.Mesh;
        obj.geometry?.dispose?.();
        const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
        for (const m of mats) {
          (m as THREE.MeshBasicMaterial).map?.dispose();
          m.dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
      sceneRef.current = null;
      selRef.current = null;
    };
    // bbox is compared by value via bboxKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bboxKey, points, lines, imagery, dark, exaggeration]);

  /* ── selection: halo + drop line to the surface ──────────────────── */
  useEffect(() => {
    const ctx = sceneRef.current;
    if (!ctx) return;
    if (selRef.current) {
      ctx.scene.remove(selRef.current);
      selRef.current.traverse((o) => {
        (o as THREE.Mesh).geometry?.dispose();
        ((o as THREE.Mesh).material as THREE.Material | undefined)?.dispose();
      });
      selRef.current = null;
    }
    const p = selectedId ? ctx.index.get(selectedId) : undefined;
    if (!p) return;
    const pos = ctx.place(p);
    const g = new THREE.Group();
    const halo = new THREE.Mesh(new THREE.SphereGeometry(ctx.radius(p.mag) * 2.1, 20, 14), new THREE.MeshBasicMaterial({ color: 0x6366f1, transparent: true, opacity: 0.35, depthWrite: false }));
    halo.position.copy(pos);
    const drop = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(pos.x, 0.1, pos.z), pos]),
      new THREE.LineBasicMaterial({ color: 0x6366f1 })
    );
    g.add(halo, drop);
    ctx.scene.add(g);
    selRef.current = g;
  }, [selectedId, bboxKey, points]);

  return (
    <div className={`relative h-full w-full ${className}`}>
      <div ref={hostRef} className="absolute inset-0" />
      {tip && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg bg-white/95 px-2 py-1 text-[12px] font-semibold text-slate-900 shadow-lg dark:bg-slate-900/95 dark:text-slate-100"
          style={{ left: tip.x + 12, top: tip.y + 12 }}
        >
          {tip.text}
        </div>
      )}
      <p className="pointer-events-none absolute bottom-2 left-3 font-mono text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Depth ×{vexShown} · drag to orbit · scroll to zoom · right-drag to pan
      </p>
    </div>
  );
}

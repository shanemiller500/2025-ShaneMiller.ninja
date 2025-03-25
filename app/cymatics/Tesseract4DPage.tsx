'use client';

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { trackEvent } from "@/utils/mixpanel";

interface Vector4 {
  x: number;
  y: number;
  z: number;
  w: number;
}

const MetatronsCube4DPage: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    trackEvent("MetatronsCube4D Page Viewed", { page: "MetatronsCube4DPage" });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!containerRef.current) return;

    // Setup basic Three.js scene, camera, and renderer.
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      45,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 5);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(
      containerRef.current.clientWidth,
      containerRef.current.clientHeight
    );
    containerRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    // Define 13 vertices for Metatron's Cube in 4D.
    // The structure is based on the typical 2D Metatron's Cube:
    // • One center point.
    // • 6 vertices of a hexagon (here assigned w = 1).
    // • 6 midpoints of the hexagon’s edges (assigned w = -1).
    // All points initially lie in the x-y plane (with z = 0).
    const metatronVertices: Vector4[] = [];
    // Center at (0,0,0) with w = 0.
    metatronVertices.push({ x: 0, y: 0, z: 0, w: 0 });
    // 6 hexagon vertices.
    for (let i = 0; i < 6; i++) {
      const angle = i * (Math.PI / 3);
      metatronVertices.push({
        x: Math.cos(angle),
        y: Math.sin(angle),
        z: 0,
        w: 1,
      });
    }
    // 6 midpoints of the hexagon edges.
    for (let i = 0; i < 6; i++) {
      const angle = i * (Math.PI / 3) + Math.PI / 6;
      metatronVertices.push({
        x: Math.cos(angle) * 0.866025,
        y: Math.sin(angle) * 0.866025,
        z: 0,
        w: -1,
      });
    }

    // Create edges connecting every unique pair of vertices (complete graph).
    const edges: [number, number][] = [];
    for (let i = 0; i < metatronVertices.length; i++) {
      for (let j = i + 1; j < metatronVertices.length; j++) {
        edges.push([i, j]);
      }
    }

    // Prepare the BufferGeometry to draw line segments.
    const lineGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(edges.length * 2 * 3);
    lineGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
    const lineSegments = new THREE.LineSegments(lineGeometry, lineMaterial);
    scene.add(lineSegments);

    // 4D rotation function.
    function rotate4D(v: Vector4, angle: number, plane: "xw" | "yw" | "zw"): Vector4 {
      const sin = Math.sin(angle);
      const cos = Math.cos(angle);
      const { x, y, z, w } = v;
      switch (plane) {
        case "xw":
          return { x: x * cos - w * sin, y, z, w: x * sin + w * cos };
        case "yw":
          return { x, y: y * cos - w * sin, z, w: y * sin + w * cos };
        case "zw":
          return { x, y, z: z * cos - w * sin, w: z * sin + w * cos };
        default:
          return v;
      }
    }

    // Project a 4D point into 3D using perspective projection.
    function project4Dto3(v: Vector4, projectionDistance: number): THREE.Vector3 {
      const factor = projectionDistance / (projectionDistance - v.w);
      return new THREE.Vector3(v.x * factor, v.y * factor, v.z * factor);
    }

    let angle = 0;
    const projectionDistance = 3;
    let lastTime = performance.now();

    // Animation loop.
    const animate = () => {
      requestAnimationFrame(animate);
      const now = performance.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      angle += dt;

      // Apply 4D rotations to each vertex.
      const rotatedVertices = metatronVertices.map(v => {
        let rv = rotate4D(v, angle, "xw");
        rv = rotate4D(rv, angle * 0.5, "yw");
        // Optionally, uncomment to add a rotation in the zw-plane:
        // rv = rotate4D(rv, angle * 0.3, "zw");
        return rv;
      });

      // Project from 4D to 3D.
      const projected = rotatedVertices.map(v => project4Dto3(v, projectionDistance));

      // Update line segment positions.
      for (let i = 0; i < edges.length; i++) {
        const [a, b] = edges[i];
        const pa = projected[a];
        const pb = projected[b];
        positions[6 * i] = pa.x;
        positions[6 * i + 1] = pa.y;
        positions[6 * i + 2] = pa.z;
        positions[6 * i + 3] = pb.x;
        positions[6 * i + 4] = pb.y;
        positions[6 * i + 5] = pb.z;
      }
      lineGeometry.attributes.position.needsUpdate = true;

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Handle window resize.
    const onWindowResize = () => {
      if (containerRef.current) {
        camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(
          containerRef.current.clientWidth,
          containerRef.current.clientHeight
        );
      }
    };
    window.addEventListener("resize", onWindowResize, false);

    return () => {
      window.removeEventListener("resize", onWindowResize);
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, [loading]);

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <div ref={containerRef} className="w-full h-full" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-50">
          <svg className="animate-spin h-12 w-12 text-white" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8H4z"
            />
          </svg>
        </div>
      )}
    </div>
  );
};

export default MetatronsCube4DPage;

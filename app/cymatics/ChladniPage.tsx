'use client';

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { trackEvent } from "@/utils/mixpanel";

const ChladniPage: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [frequency, setFrequency] = useState<number>(178);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    trackEvent("Chladni Page Viewed", { page: "ChladniPage" });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!containerRef.current) return;

    const simulationParams: any = {
      frequency: frequency,
      boardAmplitude: 5,
      damping: 0.95,
      k: 0.1,
      forceScale: 100,
      numParticles: 5000,
      plateShape: "square",
      plateSize: 80,
      plateRadius: 50,
      boardColor: "#333333",
      particleColor: "#ffd700",
    };

    let scene: THREE.Scene,
      camera: THREE.PerspectiveCamera,
      renderer: THREE.WebGLRenderer,
      controls: OrbitControls;
    let particleSystem: THREE.Points;
    let positions: Float32Array;
    let particles: { x: number; z: number; vx: number; vz: number }[] = [];
    let boardMesh: THREE.Mesh;
    let boardGeometry: THREE.BufferGeometry;
    let boardMaterial: THREE.MeshStandardMaterial;
    let particleMaterial: THREE.PointsMaterial;
    let time = 0;
    let lastTime = performance.now();
    let animationId: number;
    let omega = 2 * Math.PI * (simulationParams.frequency / 1000);
    let pointLight: THREE.PointLight;
    let audioCtx: AudioContext | null = null;
    let oscillator: OscillatorNode | null = null;

    const startSound = (freq: number) => {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (oscillator) {
        oscillator.stop();
        oscillator.disconnect();
      }
      oscillator = audioCtx.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
      oscillator.connect(audioCtx.destination);
      oscillator.start();
      trackEvent("Sound Played", { frequency: freq });
    };

    const stopSound = () => {
      if (oscillator) {
        oscillator.stop();
        oscillator.disconnect();
        oscillator = null;
        trackEvent("Sound Stopped");
      }
    };

    const initBoard = () => {
      if (boardMesh) {
        scene.remove(boardMesh);
      }
      if (simulationParams.plateShape === "circle") {
        boardGeometry = new THREE.CircleGeometry(simulationParams.plateRadius, 256);
        const vertices: THREE.Vector3[] = [];
        const posAttr = boardGeometry.attributes.position;
        for (let i = 0; i < posAttr.count; i++) {
          vertices.push(new THREE.Vector3(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i)));
        }
        boardGeometry = new THREE.BufferGeometry().setFromPoints(vertices);
      } else {
        boardGeometry = new THREE.PlaneGeometry(
          simulationParams.plateSize,
          simulationParams.plateSize,
          256,
          256
        );
      }
      boardMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(simulationParams.boardColor),
        side: THREE.DoubleSide,
        flatShading: true,
      });
      boardMesh = new THREE.Mesh(boardGeometry, boardMaterial);
      boardMesh.rotation.x = -Math.PI / 2;
      scene.add(boardMesh);
    };

    const initParticles = () => {
      particles = [];
      const geometry = new THREE.BufferGeometry();
      positions = new Float32Array(simulationParams.numParticles * 3);
      for (let i = 0; i < simulationParams.numParticles; i++) {
        let x = 0, z = 0;
        if (simulationParams.plateShape === "circle") {
          const r = simulationParams.plateRadius * Math.sqrt(Math.random());
          const angle = Math.random() * Math.PI * 2;
          x = r * Math.cos(angle);
          z = r * Math.sin(angle);
        } else {
          x = (Math.random() - 0.5) * simulationParams.plateSize;
          z = (Math.random() - 0.5) * simulationParams.plateSize;
        }
        particles.push({ x, z, vx: 0, vz: 0 });
        positions[3 * i] = x;
        positions[3 * i + 1] = 0.6;
        positions[3 * i + 2] = z;
      }
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      if (particleSystem) scene.remove(particleSystem);
      particleMaterial = new THREE.PointsMaterial({
        color: new THREE.Color(simulationParams.particleColor),
        size: 1.5
      });
      particleSystem = new THREE.Points(geometry, particleMaterial);
      scene.add(particleSystem);
    };

    const updateBoard = () => {
      const posAttr = boardGeometry.attributes.position;
      const vertex = new THREE.Vector3();
      for (let i = 0; i < posAttr.count; i++) {
        vertex.fromBufferAttribute(posAttr, i);
        let newY = 0;
        if (simulationParams.plateShape === "circle") {
          const r = Math.sqrt(vertex.x * vertex.x + vertex.z * vertex.z);
          newY = simulationParams.boardAmplitude * Math.cos(omega * time) * Math.cos(simulationParams.k * r);
        } else {
          newY = simulationParams.boardAmplitude * Math.cos(omega * time) *
            Math.cos(simulationParams.k * vertex.x) *
            Math.cos(simulationParams.k * vertex.z);
        }
        posAttr.setY(i, newY);
      }
      posAttr.needsUpdate = true;
    };

    const updateParticles = (dt: number) => {
      const temporalFactor = Math.cos(omega * time);

      for (let i = 0; i < simulationParams.numParticles; i++) {
        const p = particles[i];

        let ax = 0;
        let az = 0;

        if (simulationParams.plateShape === "circle") {
          let r = Math.sqrt(p.x * p.x + p.z * p.z);
          if (r < 0.0001) r = 0.0001;
          const du_dr = -simulationParams.boardAmplitude * temporalFactor *
            simulationParams.k * Math.sin(simulationParams.k * r);
          ax = -simulationParams.forceScale * du_dr * (p.x / r);
          az = -simulationParams.forceScale * du_dr * (p.z / r);
        } else {
          const du_dx = -simulationParams.boardAmplitude * temporalFactor *
            simulationParams.k * Math.sin(simulationParams.k * p.x) * Math.cos(simulationParams.k * p.z);
          const du_dz = -simulationParams.boardAmplitude * temporalFactor *
            simulationParams.k * Math.cos(simulationParams.k * p.x) * Math.sin(simulationParams.k * p.z);
          ax = -simulationParams.forceScale * du_dx;
          az = -simulationParams.forceScale * du_dz;
        }

        p.vx += ax * dt;
        p.vz += az * dt;
        p.vx *= simulationParams.damping;
        p.vz *= simulationParams.damping;
        p.x += p.vx * dt;
        p.z += p.vz * dt;

        if (simulationParams.plateShape === "circle") {
          let r = Math.sqrt(p.x * p.x + p.z * p.z);
          if (r > simulationParams.plateRadius) {
            const nx = p.x / r;
            const nz = p.z / r;
            const dot = p.vx * nx + p.vz * nz;
            p.vx -= 2 * dot * nx;
            p.vz -= 2 * dot * nz;
            p.x = nx * simulationParams.plateRadius;
            p.z = nz * simulationParams.plateRadius;
          }
        } else {
          const half = simulationParams.plateSize / 2;
          if (Math.abs(p.x) > half) {
            p.vx = -p.vx;
            p.x = Math.sign(p.x) * half;
          }
          if (Math.abs(p.z) > half) {
            p.vz = -p.vz;
            p.z = Math.sign(p.z) * half;
          }
        }

        positions[3 * i] = p.x;
        positions[3 * i + 1] = 0.6;
        positions[3 * i + 2] = p.z;
      }
      (particleSystem.geometry as THREE.BufferGeometry).attributes.position.needsUpdate = true;
    };

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      controls.update();
      const now = performance.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      time += dt;
      omega = 2 * Math.PI * (simulationParams.frequency / 1000);
      updateBoard();
      updateParticles(dt);
      renderer.render(scene, camera);
    };

    const initScene = () => {
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(
        45,
        containerRef.current!.clientWidth / containerRef.current!.clientHeight,
        0.1,
        1000
      );
      camera.position.set(0, 100, 150);

      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(containerRef.current!.clientWidth, containerRef.current!.clientHeight);
      containerRef.current!.appendChild(renderer.domElement);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.enablePan = true;
      controls.screenSpacePanning = true;
      controls.panSpeed = 0.5;

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
      scene.add(ambientLight);
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(50, 100, 50);
      scene.add(directionalLight);

      pointLight = new THREE.PointLight(0xffffff, 1, 500);
      pointLight.position.set(0, 100, 0);
      scene.add(pointLight);

      initBoard();
      initParticles();

      window.addEventListener("resize", onWindowResize, false);
      animate();
    };

    const onWindowResize = () => {
      if (containerRef.current) {
        camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
      }
    };

    import("dat.gui").then(({ GUI }) => {
      if (GUI && GUI.prototype) {
        GUI.prototype.destroy = function () {
          if (this.domElement) {
            this.domElement.style.display = "none";
          }
        };
      }
      const gui = new GUI();

      gui.add(simulationParams, "frequency", 1, 10000)
        .name("Frequency (Hz)")
        .onChange((value: number) => {
          simulationParams.frequency = value;
          omega = 2 * Math.PI * (simulationParams.frequency / 1000);
          trackEvent("Frequency Changed", { value });
        });
      gui.add(simulationParams, "boardAmplitude", 0, 20)
        .name("Amplitude")
        .onChange((value: number) => {
          simulationParams.boardAmplitude = value;
          trackEvent("Amplitude Changed", { value });
        });
      gui.add(simulationParams, "k", 0.01, 1)
        .name("Wave Number")
        .onChange((value: number) => {
          simulationParams.k = value;
          trackEvent("Wave Number Changed", { value });
        });
      gui.add(simulationParams, "forceScale", 1, 300)
        .name("Force Scale")
        .onChange((value: number) => {
          simulationParams.forceScale = value;
          trackEvent("Force Scale Changed", { value });
        });
      gui.add(simulationParams, "damping", 0.5, 1)
        .name("Damping")
        .onChange((value: number) => {
          simulationParams.damping = value;
          trackEvent("Damping Changed", { value });
        });
      gui.add(simulationParams, "numParticles", 1000, 20000).step(1000)
        .name("Num Particles")
        .onFinishChange((value: number) => {
          simulationParams.numParticles = value;
          initParticles();
          trackEvent("Num Particles Changed", { value });
        });
      gui.add(simulationParams, "plateShape", { Square: "square", Circle: "circle" })
        .name("Plate Shape")
        .onChange((value: string) => {
          simulationParams.plateShape = value;
          initBoard();
          initParticles();
          trackEvent("Plate Shape Changed", { value });
        });
      gui.add(simulationParams, "plateSize", 10, 200)
        .name("Square Size")
        .onFinishChange((value: number) => {
          simulationParams.plateSize = value;
          if (simulationParams.plateShape === "square") {
            initBoard();
            initParticles();
            trackEvent("Square Size Changed", { value });
          }
        });
      gui.add(simulationParams, "plateRadius", 10, 200)
        .name("Plate Radius")
        .onFinishChange((value: number) => {
          simulationParams.plateRadius = value;
          if (simulationParams.plateShape === "circle") {
            initBoard();
            initParticles();
            trackEvent("Plate Radius Changed", { value });
          }
        });
      gui.addColor(simulationParams, "boardColor")
        .name("Board Color")
        .onFinishChange((value: string) => {
          simulationParams.boardColor = value;
          if (boardMaterial) {
            boardMaterial.color.set(value);
          }
          trackEvent("Board Color Changed", { value });
        });
      gui.addColor(simulationParams, "particleColor")
        .name("Particle Color")
        .onFinishChange((value: string) => {
          simulationParams.particleColor = value;
          if (particleMaterial) {
            particleMaterial.color.set(value);
          }
          trackEvent("Particle Color Changed", { value });
        });
      gui.add({ playSound: () => { startSound(simulationParams.frequency); } }, "playSound")
        .name("Play Sound");
      gui.add({ stopSound: () => { stopSound(); } }, "stopSound")
        .name("Stop Sound");

      const guiContainer = document.getElementById("datgui-container");
      if (guiContainer) {
        gui.domElement.style.position = "static";
        guiContainer.appendChild(gui.domElement);
      }
    });

    initScene();

    return () => {
      window.removeEventListener("resize", onWindowResize);
      cancelAnimationFrame(animationId);
      if (
        containerRef.current &&
        renderer &&
        renderer.domElement &&
        containerRef.current.contains(renderer.domElement)
      ) {
        containerRef.current.removeChild(renderer.domElement);
      }
      if (oscillator) {
        oscillator.stop();
        oscillator.disconnect();
      }
    };
  }, [loading, frequency]);

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <div ref={containerRef} className="w-full h-full" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-50">
          <svg className="animate-spin h-12 w-12 text-white" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
      )}
      <div className="absolute top-0 left-0 z-10 p-4">
        <div id="datgui-container"></div>
      </div>
    </div>
  );
};

export default ChladniPage;

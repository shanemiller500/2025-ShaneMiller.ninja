'use client';

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { trackEvent } from "@/utils/mixpanel";

const CymaticPage: React.FC = () => {
  // A ref for the container that will hold the Three.js canvas.
  const containerRef = useRef<HTMLDivElement>(null);
  // State for the simulation frequency and a loading flag.
  const [frequency, setFrequency] = useState<number>(178);
  const [loading, setLoading] = useState<boolean>(true);

  // Track page view.
  useEffect(() => {
    trackEvent("Cymatics Page Viewed", { page: "CymaticPage" });
  }, []);

  // Show the spinner for 2 seconds then remove it.
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Main simulation effect.
  useEffect(() => {
    if (loading) return;
    if (!containerRef.current) return;

    // ======================================================================
    // Define simulation parameters.
    // ======================================================================
    const simulationParams: any = {
      frequency: frequency,         // Hz – used for simulation & sound.
      boardAmplitude: 5,            // Vertical displacement amplitude.
      damping: 1,                   // Particle damping.
      k: 0.34,                      // Wave number.
      forceScale: 300,              // How strongly the board vibration pushes the sand.
      randomFactor: 100,            // Extra multiplier for random perturbations.
      numSand: 10000,               // Number of sand particles.
      plateRadius: 50,              // For circle board.
      plateShape: "circle",         // "circle" or "square".
      plateSize: 100,               // For square board.
      boardColor: "#333333",        // Initial board color.
      particleColor: "#ffd700",     // Initial particle color.
      boardCycle: false,            // Cycle board color.
      particleCycle: false,         // Cycle particle color.
      colorSpeed: 0.1               // Speed of color cycling.
    };

    // ======================================================================
    // Three.js and simulation variables.
    // ======================================================================
    let scene: THREE.Scene,
      camera: THREE.PerspectiveCamera,
      renderer: THREE.WebGLRenderer,
      controls: OrbitControls;
    let particleSystem: THREE.Points;
    let positions: Float32Array;
    let sandParticles: { x: number; z: number; vx: number; vz: number }[] = [];
    const BOARD_SEGMENTS = 256;
    let boardMesh: THREE.Mesh;
    let boardGeometry: THREE.BufferGeometry;
    let boardMaterial: THREE.MeshStandardMaterial;
    let particleMaterial: THREE.PointsMaterial;
    let time = 0;
    let lastTime = performance.now();
    let animationId: number;
    // Scale simulation frequency (omega) by dividing Hz by 1000.
    let omega = 2 * Math.PI * (simulationParams.frequency / 1000);

    // A trippy additional light.
    let pointLight: THREE.PointLight;

    // Audio variables.
    let audioCtx: AudioContext | null = null;
    let oscillator: OscillatorNode | null = null;

    // ------------------------------
    // Audio Control Functions
    // ------------------------------
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
      // Use the simulation frequency (Hz) directly for sound.
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

    // ------------------------------
    // Board Mesh Initialization
    // ------------------------------
    const initBoard = () => {
      if (boardMesh) {
        scene.remove(boardMesh);
      }
      if (simulationParams.plateShape === "circle") {
        boardGeometry = new THREE.CircleGeometry(simulationParams.plateRadius, BOARD_SEGMENTS);
        // Convert to BufferGeometry for vertex manipulation.
        const vertices: THREE.Vector3[] = [];
        const posAttr = boardGeometry.attributes.position;
        for (let i = 0; i < posAttr.count; i++) {
          vertices.push(new THREE.Vector3(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i)));
        }
        boardGeometry = new THREE.BufferGeometry().setFromPoints(vertices);
      } else if (simulationParams.plateShape === "square") {
        boardGeometry = new THREE.PlaneGeometry(simulationParams.plateSize, simulationParams.plateSize, BOARD_SEGMENTS, BOARD_SEGMENTS);
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

    // ------------------------------
    // Particle System Initialization
    // ------------------------------
    const initParticles = () => {
      sandParticles = [];
      const geometry = new THREE.BufferGeometry();
      positions = new Float32Array(simulationParams.numSand * 3);
      for (let i = 0; i < simulationParams.numSand; i++) {
        let x = 0, z = 0;
        if (simulationParams.plateShape === "circle") {
          const r = simulationParams.plateRadius * Math.sqrt(Math.random());
          const angle = Math.random() * Math.PI * 2;
          x = r * Math.cos(angle);
          z = r * Math.sin(angle);
        } else if (simulationParams.plateShape === "square") {
          x = (Math.random() - 0.5) * simulationParams.plateSize;
          z = (Math.random() - 0.5) * simulationParams.plateSize;
        }
        sandParticles.push({ x, z, vx: (Math.random() - 0.5) * 2, vz: (Math.random() - 0.5) * 2 });
        positions[3 * i] = x;
        positions[3 * i + 1] = 0.5; // fixed y so sand "sits" on the board
        positions[3 * i + 2] = z;
      }
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      if (particleSystem) scene.remove(particleSystem);
      particleMaterial = new THREE.PointsMaterial({
        color: new THREE.Color(simulationParams.particleColor),
        size: 1.2
      });
      particleSystem = new THREE.Points(geometry, particleMaterial);
      scene.add(particleSystem);
    };

    // ------------------------------
    // Particle Update Function
    // ------------------------------
    const updateParticles = (dt: number) => {
      for (let i = 0; i < simulationParams.numSand; i++) {
        const p = sandParticles[i];
        if (simulationParams.plateShape === "circle") {
          let r = Math.sqrt(p.x * p.x + p.z * p.z);
          if (r < 0.0001) r = 0.0001;
          const waveDerivative = simulationParams.k * Math.cos(simulationParams.k * r - omega * time);
          const ax = -simulationParams.forceScale * waveDerivative * (p.x / r);
          const az = -simulationParams.forceScale * waveDerivative * (p.z / r);
          p.vx += ax * dt;
          p.vz += az * dt;
          const randomPerturb = (simulationParams.frequency / 100) * (Math.random() - 0.5) * simulationParams.randomFactor;
          p.vx += randomPerturb * dt;
          p.vz += randomPerturb * dt;
          p.vx *= simulationParams.damping;
          p.vz *= simulationParams.damping;
          p.x += p.vx * dt;
          p.z += p.vz * dt;
          r = Math.sqrt(p.x * p.x + p.z * p.z);
          if (r > simulationParams.plateRadius) {
            const nx = p.x / r;
            const nz = p.z / r;
            const dot = p.vx * nx + p.vz * nz;
            p.vx = p.vx - 2 * dot * nx;
            p.vz = p.vz - 2 * dot * nz;
            p.vx += (Math.random() - 0.5) * 2;
            p.vz += (Math.random() - 0.5) * 2;
            p.x = nx * simulationParams.plateRadius;
            p.z = nz * simulationParams.plateRadius;
          }
        } else if (simulationParams.plateShape === "square") {
          const half = simulationParams.plateSize / 2;
          const waveDerivativeX = simulationParams.k * Math.cos(simulationParams.k * Math.abs(p.x) - omega * time);
          const waveDerivativeZ = simulationParams.k * Math.cos(simulationParams.k * Math.abs(p.z) - omega * time);
          const ax = -simulationParams.forceScale * waveDerivativeX * Math.sign(p.x);
          const az = -simulationParams.forceScale * waveDerivativeZ * Math.sign(p.z);
          p.vx += ax * dt;
          p.vz += az * dt;
          const randomPerturb = (simulationParams.frequency / 100) * (Math.random() - 0.5) * simulationParams.randomFactor;
          p.vx += randomPerturb * dt;
          p.vz += randomPerturb * dt;
          p.vx *= simulationParams.damping;
          p.vz *= simulationParams.damping;
          p.x += p.vx * dt;
          p.z += p.vz * dt;
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
        positions[3 * i + 1] = 0.5;
        positions[3 * i + 2] = p.z;
      }
      (particleSystem.geometry as THREE.BufferGeometry).attributes.position.needsUpdate = true;
    };

    // ------------------------------
    // Board Update Function
    // ------------------------------
    const updateBoard = () => {
      const posAttr = boardGeometry.attributes.position;
      const vertex = new THREE.Vector3();
      for (let i = 0; i < posAttr.count; i++) {
        vertex.fromBufferAttribute(posAttr, i);
        const rCorrected = Math.sqrt(vertex.x * vertex.x + (vertex.z || 0) * (vertex.z || 0));
        const newY = simulationParams.boardAmplitude * Math.sin(simulationParams.k * rCorrected - omega * time);
        posAttr.setY(i, newY);
      }
      posAttr.needsUpdate = true;
    };

    // ------------------------------
    // Animation Loop
    // ------------------------------
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      controls.update();
      const now = performance.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      time += dt;
      // Update omega from the current frequency.
      omega = 2 * Math.PI * (simulationParams.frequency / 1000);

      // --------------------------
      // Update Color Cycling for a Trippy Effect
      // --------------------------
      if (boardMaterial) {
        if (simulationParams.boardCycle) {
          const hsl = { h: 0, s: 0, l: 0 };
          boardMaterial.color.getHSL(hsl);
          hsl.h = (hsl.h + simulationParams.colorSpeed * dt) % 1;
          boardMaterial.color.setHSL(hsl.h, hsl.s, hsl.l);
        } else {
          boardMaterial.color.set(simulationParams.boardColor);
        }
      }
      if (particleMaterial) {
        if (simulationParams.particleCycle) {
          const hsl = { h: 0, s: 0, l: 0 };
          particleMaterial.color.getHSL(hsl);
          hsl.h = (hsl.h + simulationParams.colorSpeed * dt) % 1;
          particleMaterial.color.setHSL(hsl.h, hsl.s, hsl.l);
        } else {
          particleMaterial.color.set(simulationParams.particleColor);
        }
      }
      if (pointLight) {
        const hsl = { h: 0, s: 0, l: 0 };
        pointLight.color.getHSL(hsl);
        hsl.h = (hsl.h + simulationParams.colorSpeed * dt) % 1;
        pointLight.color.setHSL(hsl.h, hsl.s, hsl.l);
      }

      updateParticles(dt);
      updateBoard();
      renderer.render(scene, camera);
    };

    // ------------------------------
    // Scene Setup & Initialization
    // ------------------------------
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

      // Lighting.
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
      scene.add(ambientLight);
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(50, 100, 50);
      scene.add(directionalLight);

      // Additional trippy 3D effect: a point light that cycles colors.
      pointLight = new THREE.PointLight(0xffffff, 1, 500);
      pointLight.position.set(0, 100, 0);
      scene.add(pointLight);

      // Initialize the board and particle system.
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

    // ------------------------------
    // Dynamically import and set up dat.gui (client only)
    // ------------------------------
    import("dat.gui").then(({ GUI }) => {
      if (GUI && GUI.prototype) {
        // PATCH dat.gui's destroy() method to not remove its DOM element.
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
          initParticles();
          trackEvent("Frequency Changed", { value });
        });
      gui.add(simulationParams, "boardAmplitude", 0, 5)
        .name("Board Amplitude")
        .onChange((value: number) => {
          simulationParams.boardAmplitude = value;
          trackEvent("Board Amplitude Changed", { value });
        });
      gui.add(simulationParams, "damping", 0.8, 1)
        .name("Damping")
        .onChange((value: number) => {
          simulationParams.damping = value;
          trackEvent("Damping Changed", { value });
        });
      gui.add(simulationParams, "k", 0.1, 1)
        .name("Wave Number")
        .onChange((value: number) => {
          simulationParams.k = value;
          trackEvent("Wave Number Changed", { value });
        });
      gui.add(simulationParams, "forceScale", 10, 300)
        .name("Force Scale")
        .onChange((value: number) => {
          simulationParams.forceScale = value;
          trackEvent("Force Scale Changed", { value });
        });
      gui.add(simulationParams, "randomFactor", 1, 10)
        .name("Random Factor")
        .onChange((value: number) => {
          simulationParams.randomFactor = value;
          trackEvent("Random Factor Changed", { value });
        });
      gui.add(simulationParams, "numSand", 1000, 50000).step(1000)
        .name("Num Sand")
        .onFinishChange((value: number) => {
          simulationParams.numSand = value;
          initParticles();
          trackEvent("Num Sand Changed", { value });
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
      gui.add(simulationParams, "plateShape", { Circle: "circle", Square: "square" })
        .name("Plate Shape")
        .onChange((value: string) => {
          simulationParams.plateShape = value;
          initBoard();
          initParticles();
          trackEvent("Plate Shape Changed", { value });
        });
      gui.addColor(simulationParams, "boardColor")
        .name("Board Color")
        .onFinishChange((value: string) => {
          simulationParams.boardColor = value;
          if (!simulationParams.boardCycle && boardMaterial) {
            boardMaterial.color.set(value);
          }
          trackEvent("Board Color Changed", { value });
        });
      gui.addColor(simulationParams, "particleColor")
        .name("Particle Color")
        .onFinishChange((value: string) => {
          simulationParams.particleColor = value;
          if (!simulationParams.particleCycle && particleMaterial) {
            particleMaterial.color.set(value);
          }
          trackEvent("Particle Color Changed", { value });
        });
      gui.add(simulationParams, "boardCycle")
        .name("Board Cycle")
        .onChange((value: boolean) => {
          simulationParams.boardCycle = value;
          trackEvent("Board Cycle Toggled", { value });
        });
      gui.add(simulationParams, "particleCycle")
        .name("Particle Cycle")
        .onChange((value: boolean) => {
          simulationParams.particleCycle = value;
          trackEvent("Particle Cycle Toggled", { value });
        });
      gui.add(simulationParams, "colorSpeed", 0, 1)
        .name("Color Speed")
        .onChange((value: number) => {
          simulationParams.colorSpeed = value;
          trackEvent("Color Speed Changed", { value });
        });
      // Add buttons to play and stop sound.
      gui.add({ playSound: () => { startSound(simulationParams.frequency); } }, "playSound")
        .name("Play Sound");
      gui.add({ stopSound: () => { stopSound(); } }, "stopSound")
        .name("Stop Sound");

      // Optionally reparent the GUI's DOM element.
      const guiContainer = document.getElementById("datgui-container");
      if (guiContainer) {
        gui.domElement.style.position = "static";
        guiContainer.appendChild(gui.domElement);
      }
    });

    // Initialize the scene.
    initScene();

    // ------------------------------
    // Cleanup function.
    // ------------------------------
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
      // (The dynamically imported dat.gui instance will be cleaned up via its own destroy method.)
    };
  }, [loading, frequency]);

  return (
    <div className="relative w-1200 h-screen overflow-hidden">
      {/* Container for the Three.js canvas */}
      <div ref={containerRef} className="w-full h-full" />
      {/* Spinner overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-50">
          <svg className="animate-spin h-12 w-12 text-white" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
      )}
      {/* Container for dat.gui controls */}
      <div className="absolute top-0 z-10 rounded text-black">
        <div id="datgui-container" className="mt-4"></div>
      </div>
    </div>
  );
};

export default CymaticPage;

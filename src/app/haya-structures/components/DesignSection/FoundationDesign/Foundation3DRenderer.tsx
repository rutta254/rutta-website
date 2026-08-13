'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FoundationDesignResult } from '@/lib/structural/foundation';

interface Foundation3DRendererProps {
  result: FoundationDesignResult;
}

export function Foundation3DRenderer({ result }: Foundation3DRendererProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const [showRebar, setShowRebar] = useState<boolean>(true);
  const [showConcrete, setShowConcrete] = useState<boolean>(true);

  const createTextSprite = (text: string, color = '#38bdf8') => {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = color;
      ctx.font = 'Bold 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 128, 64);
    }
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(1.2, 0.6, 1);
    return sprite;
  };

  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth || 600;
    const height = 400;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0f172a');

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(width, height);
    rendererRef.current = renderer;

    mountRef.current.innerHTML = '';
    mountRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(10, 20, 15);
    scene.add(dirLight);

    const { footingBox, columnBox, piles, rebars3D } = result.geometry3D;

    // Camera Framing
    camera.position.set(footingBox.width * 2.5, footingBox.height * 2.5 + 2, footingBox.depth * 2.5);
    controls.target.set(0, 0, 0);
    controls.update();

    // Ground Grid
    const grid = new THREE.GridHelper(Math.max(footingBox.width, footingBox.depth) * 4, 20, 0x38bdf8, 0x334155);
    grid.position.set(0, -footingBox.height, 0);
    scene.add(grid);

    // 1. Concrete Footing Block Mesh
    if (showConcrete) {
      const footingGeo = new THREE.BoxGeometry(footingBox.width, footingBox.height, footingBox.depth);
      const footingMat = new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        transparent: true,
        opacity: 0.45,
        wireframe: false,
      });
      const footingMesh = new THREE.Mesh(footingGeo, footingMat);
      footingMesh.position.set(footingBox.position.x, footingBox.position.y, footingBox.position.z);
      scene.add(footingMesh);

      // Concrete Wireframe Edges
      const wireGeo = new THREE.EdgesGeometry(footingGeo);
      const wireMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2 });
      const wireLines = new THREE.LineSegments(wireGeo, wireMat);
      wireLines.position.copy(footingMesh.position);
      scene.add(wireLines);

      // Column Stub Mesh
      const colGeo = new THREE.BoxGeometry(columnBox.width, columnBox.height, columnBox.depth);
      const colMat = new THREE.MeshStandardMaterial({ color: 0x64748b, transparent: true, opacity: 0.8 });
      const colMesh = new THREE.Mesh(colGeo, colMat);
      colMesh.position.set(columnBox.position.x, columnBox.position.y, columnBox.position.z);
      scene.add(colMesh);
    }

    // 2. Deep Foundation Piles Render
    if (piles && piles.length > 0) {
      piles.forEach((p) => {
        const pileGeo = new THREE.CylinderGeometry(p.diameter / 2, p.diameter / 2, p.length, 16);
        const pileMat = new THREE.MeshStandardMaterial({ color: 0x475569 });
        const pileMesh = new THREE.Mesh(pileGeo, pileMat);
        pileMesh.position.set(p.position.x, p.position.y, p.position.z);
        scene.add(pileMesh);
      });
    }

    // 3. 3D Rebar Cage Mesh
    if (showRebar && rebars3D) {
      rebars3D.forEach((rebar) => {
        const points = rebar.points.map((p) => new THREE.Vector3(p.x, p.y, p.z));
        const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.1);
        const tubeGeo = new THREE.TubeGeometry(curve, 32, (rebar.barDiameter / 1000) / 2, 8, false);
        const tubeMat = new THREE.MeshStandardMaterial({ color: rebar.color, metalness: 0.8, roughness: 0.2 });
        const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
        scene.add(tubeMesh);
      });
    }

    // Annotations Sprite
    const dimLabel = createTextSprite(`${result.geometry.B}x${result.geometry.L}x${result.geometry.D} mm`, '#38bdf8');
    dimLabel.position.set(0, footingBox.height / 2 + 0.4, 0);
    scene.add(dimLabel);

    // Render Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
    };
  }, [result, showRebar, showConcrete]);

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center bg-slate-950 p-2.5 rounded-t-xl border border-slate-800">
        <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
          <span>🧊</span> Interactive 3D Rebar & Spatial Mesh Renderer
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setShowConcrete(!showConcrete)}
            className={`px-2.5 py-1 text-[11px] font-bold rounded border transition ${
              showConcrete ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40' : 'bg-slate-900 text-slate-500 border-slate-800'
            }`}
          >
            Concrete Vol: {showConcrete ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={() => setShowRebar(!showRebar)}
            className={`px-2.5 py-1 text-[11px] font-bold rounded border transition ${
              showRebar ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-slate-900 text-slate-500 border-slate-800'
            }`}
          >
            3D Rebar Cage: {showRebar ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>
      <div ref={mountRef} className="w-full h-96 rounded-b-xl border border-slate-800 overflow-hidden" />
    </div>
  );
}
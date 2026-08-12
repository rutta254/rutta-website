'use client';

import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type DimensionMode = '2D' | '3D';
type DesignCode = 'AISC360' | 'EC3' | 'BS5950';

type Topology2D = 'pratt' | 'howe' | 'warren' | 'fink' | 'scissors' | 'portal_frame';
type Topology3D = 'space_grid' | 'space_tower' | 'triangular_prism';

interface NodeStruct {
  id: number;
  x: number;
  y: number;
  z: number;
  fixX: boolean;
  fixY: boolean;
  fixZ: boolean;
  fx: number;
  fy: number;
  fz: number;
}

interface MemberStruct {
  id: number;
  startNode: number;
  endNode: number;
  area: number; // mm²
  ry: number; // mm
}

interface MemberResult {
  id: number;
  length: number; // m
  axialForce: number; // kN
  state: 'TENSION' | 'COMPRESSION' | 'ZERO';
  slenderness: number;
  capacity: number; // kN
  dcr: number;
  status: 'PASS' | 'FAIL';
}

interface AnalysisResult {
  dimMode: DimensionMode;
  code: DesignCode;
  displacements: { node: number; ux: number; uy: number; uz: number }[];
  reactions: { node: number; rx: number; ry: number; rz: number }[];
  memberResults: MemberResult[];
  maxDcr: number;
  overallStatus: 'SAFE' | 'OVERSTRESSED';
  governingMember: number;
}

export default function UnifiedTrussTool() {
  const [dimMode, setDimMode] = useState<DimensionMode>('2D');
  const [designCode, setDesignCode] = useState<DesignCode>('AISC360');

  // Topologies
  const [topology2D, setTopology2D] = useState<Topology2D>('pratt');
  const [topology3D, setTopology3D] = useState<Topology3D>('space_grid');

  // Spatial / Planar Geometry Dimensions
  const [spanX, setSpanX] = useState<number>(12); // m
  const [spanY, setSpanY] = useState<number>(6);  // m (used in 3D)
  const [trussHeight, setTrussHeight] = useState<number>(2.5); // m
  const [baysX, setBaysX] = useState<number>(4);
  const [baysY, setBaysY] = useState<number>(2);
  const [towerLevels, setTowerLevels] = useState<number>(4);

  // Section & Material Properties
  const [sectionArea, setSectionArea] = useState<number>(1850); // mm²
  const [radiusGyration, setRadiusGyration] = useState<number>(35.2); // mm
  const [fy, setFy] = useState<number>(355); // MPa
  const [modulusE, setModulusE] = useState<number>(210000); // MPa

  // Applied Loads
  const [pointLoadY, setPointLoadY] = useState<number>(-25); // kN (2D vertical load)
  const [pointLoadZ, setPointLoadZ] = useState<number>(-20); // kN (3D vertical load)

  // Structural Model State
  const [nodes, setNodes] = useState<NodeStruct[]>([]);
  const [members, setMembers] = useState<MemberStruct[]>([]);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState<boolean>(false);

  // Canvas Viewport Reference
  const mountRef = useRef<HTMLDivElement>(null);

  // --- UNIFIED PARAMETRIC GEOMETRY GENERATOR ---
  useEffect(() => {
    const newNodes: NodeStruct[] = [];
    const newMembers: MemberStruct[] = [];

    const Lx = Math.max(spanX, 1);
    const Ly = Math.max(spanY, 1);
    const H = Math.max(trussHeight, 0.5);
    const Nx = Math.max(baysX, 1);
    const Ny = Math.max(baysY, 1);
    const Levels = Math.max(towerLevels, 1);

    if (dimMode === '2D') {
      // ---------------- 2D PLANAR TOPOLOGIES (Z = 0) ----------------
      const stepX = Lx / Nx;

      // Bottom Chord Nodes
      for (let i = 0; i <= Nx; i++) {
        newNodes.push({
          id: i + 1,
          x: Number((i * stepX).toFixed(2)),
          y: 0,
          z: 0,
          fixX: i === 0, // Pin left
          fixY: i === 0 || i === Nx, // Pin/Roller supports
          fixZ: true, // Always constrain Z in 2D mode
          fx: 0,
          fy: 0,
          fz: 0,
        });
      }

      // Top Chord Nodes
      for (let i = 0; i <= Nx; i++) {
        let nodeY = H;
        if (topology2D === 'pratt' || topology2D === 'howe' || topology2D === 'warren') {
          nodeY = H;
        } else if (topology2D === 'fink' || topology2D === 'scissors') {
          nodeY = (1 - Math.abs((i - Nx / 2) / (Nx / 2))) * H;
        }

        const isJointLoad = i > 0 && i < Nx;
        newNodes.push({
          id: Nx + 1 + i + 1,
          x: Number((i * stepX).toFixed(2)),
          y: Number(nodeY.toFixed(2)),
          z: 0,
          fixX: false,
          fixY: false,
          fixZ: true, // Constrain Z
          fx: 0,
          fy: isJointLoad ? pointLoadY : 0,
          fz: 0,
        });
      }

      let mId = 0;
      // Bottom & Top Chords
      for (let i = 0; i < Nx; i++) {
        newMembers.push({ id: ++mId, startNode: i + 1, endNode: i + 2, area: sectionArea, ry: radiusGyration });
        newMembers.push({ id: ++mId, startNode: Nx + 2 + i, endNode: Nx + 3 + i, area: sectionArea, ry: radiusGyration });
      }

      // Vertical & Diagonal Web Members
      for (let i = 0; i <= Nx; i++) {
        const bNode = i + 1;
        const tNode = Nx + 2 + i;
        newMembers.push({ id: ++mId, startNode: bNode, endNode: tNode, area: sectionArea, ry: radiusGyration });

        if (i < Nx) {
          if (topology2D === 'pratt') {
            // Diagonals slant towards center
            if (i < Nx / 2) newMembers.push({ id: ++mId, startNode: bNode, endNode: tNode + 1, area: sectionArea, ry: radiusGyration });
            else newMembers.push({ id: ++mId, startNode: bNode + 1, endNode: tNode, area: sectionArea, ry: radiusGyration });
          } else if (topology2D === 'howe') {
            // Diagonals slant away from center
            if (i < Nx / 2) newMembers.push({ id: ++mId, startNode: bNode + 1, endNode: tNode, area: sectionArea, ry: radiusGyration });
            else newMembers.push({ id: ++mId, startNode: bNode, endNode: tNode + 1, area: sectionArea, ry: radiusGyration });
          } else {
            // Warren / Default Diagonals
            newMembers.push({ id: ++mId, startNode: bNode, endNode: tNode + 1, area: sectionArea, ry: radiusGyration });
          }
        }
      }
    } else {
      // ---------------- 3D SPATIAL TOPOLOGIES ----------------
      if (topology3D === 'space_grid') {
        const stepX = Lx / Nx;
        const stepY = Ly / Ny;

        let nId = 0;
        // Bottom Layer Nodes (Z = 0)
        for (let i = 0; i <= Nx; i++) {
          for (let j = 0; j <= Ny; j++) {
            const isCorner = (i === 0 || i === Nx) && (j === 0 || j === Ny);
            newNodes.push({
              id: ++nId,
              x: Number((i * stepX).toFixed(2)),
              y: Number((j * stepY).toFixed(2)),
              z: 0,
              fixX: isCorner,
              fixY: isCorner,
              fixZ: isCorner,
              fx: 0,
              fy: 0,
              fz: 0,
            });
          }
        }
        const numBottomNodes = newNodes.length;

        // Top Layer Nodes (Z = H)
        for (let i = 0; i < Nx; i++) {
          for (let j = 0; j < Ny; j++) {
            newNodes.push({
              id: ++nId,
              x: Number(((i + 0.5) * stepX).toFixed(2)),
              y: Number(((j + 0.5) * stepY).toFixed(2)),
              z: H,
              fixX: false,
              fixY: false,
              fixZ: false,
              fx: 0,
              fy: 0,
              fz: pointLoadZ,
            });
          }
        }

        let mId = 0;
        const getNodeIdx = (i: number, j: number) => i * (Ny + 1) + j + 1;

        // Bottom Chord Members
        for (let i = 0; i <= Nx; i++) {
          for (let j = 0; j <= Ny; j++) {
            if (i < Nx) newMembers.push({ id: ++mId, startNode: getNodeIdx(i, j), endNode: getNodeIdx(i + 1, j), area: sectionArea, ry: radiusGyration });
            if (j < Ny) newMembers.push({ id: ++mId, startNode: getNodeIdx(i, j), endNode: getNodeIdx(i, j + 1), area: sectionArea, ry: radiusGyration });
          }
        }

        // Web Diagonals
        let topStartId = numBottomNodes + 1;
        for (let i = 0; i < Nx; i++) {
          for (let j = 0; j < Ny; j++) {
            const topId = topStartId++;
            const b1 = getNodeIdx(i, j);
            const b2 = getNodeIdx(i + 1, j);
            const b3 = getNodeIdx(i + 1, j + 1);
            const b4 = getNodeIdx(i, j + 1);

            newMembers.push({ id: ++mId, startNode: b1, endNode: topId, area: sectionArea, ry: radiusGyration });
            newMembers.push({ id: ++mId, startNode: b2, endNode: topId, area: sectionArea, ry: radiusGyration });
            newMembers.push({ id: ++mId, startNode: b3, endNode: topId, area: sectionArea, ry: radiusGyration });
            newMembers.push({ id: ++mId, startNode: b4, endNode: topId, area: sectionArea, ry: radiusGyration });
          }
        }
      } else {
        // 3D Spatial Transmission Tower
        let nId = 0;
        const dz = H / Levels;

        for (let k = 0; k <= Levels; k++) {
          const factor = 1 - (k / Levels) * 0.45;
          const w = (Lx / 2) * factor;
          const h = (Ly / 2) * factor;
          const z = Number((k * dz).toFixed(2));

          newNodes.push({ id: ++nId, x: -w, y: -h, z, fixX: k === 0, fixY: k === 0, fixZ: k === 0, fx: 0, fy: 0, fz: k === Levels ? pointLoadZ : 0 });
          newNodes.push({ id: ++nId, x: w, y: -h, z, fixX: k === 0, fixY: k === 0, fixZ: k === 0, fx: 0, fy: 0, fz: k === Levels ? pointLoadZ : 0 });
          newNodes.push({ id: ++nId, x: w, y: h, z, fixX: k === 0, fixY: k === 0, fixZ: k === 0, fx: 0, fy: 0, fz: k === Levels ? pointLoadZ : 0 });
          newNodes.push({ id: ++nId, x: -w, y: h, z, fixX: k === 0, fixY: k === 0, fixZ: k === 0, fx: 0, fy: 0, fz: k === Levels ? pointLoadZ : 0 });
        }

        let mId = 0;
        for (let k = 0; k < Levels; k++) {
          const base = k * 4;
          for (let i = 0; i < 4; i++) {
            newMembers.push({ id: ++mId, startNode: base + i + 1, endNode: base + i + 5, area: sectionArea, ry: radiusGyration });
            newMembers.push({ id: ++mId, startNode: base + i + 1, endNode: base + ((i + 1) % 4) + 1, area: sectionArea, ry: radiusGyration });
          }
          newMembers.push({ id: ++mId, startNode: base + 1, endNode: base + 6, area: sectionArea, ry: radiusGyration });
          newMembers.push({ id: ++mId, startNode: base + 2, endNode: base + 5, area: sectionArea, ry: radiusGyration });
        }
      }
    }

    setNodes(newNodes);
    setMembers(newMembers);
  }, [dimMode, topology2D, topology3D, spanX, spanY, trussHeight, baysX, baysY, towerLevels, sectionArea, radiusGyration, pointLoadY, pointLoadZ]);

  // --- ADAPTIVE THREE.JS CANVAS RENDERER ---
  useEffect(() => {
    if (!mountRef.current || nodes.length === 0) return;

    const width = mountRef.current.clientWidth || 450;
    const height = 280;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0f172a');

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);

    mountRef.current.innerHTML = '';
    mountRef.current.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(20, 40, 30);
    scene.add(dirLight);

    const cx = nodes.reduce((s, n) => s + n.x, 0) / nodes.length;
    const cy = nodes.reduce((s, n) => s + n.y, 0) / nodes.length;
    const cz = nodes.reduce((s, n) => s + n.z, 0) / nodes.length;

    if (dimMode === '2D') {
      // Orthographic Front Elevation Locking for 2D Mode
      camera.position.set(cx, cy + 0.5, spanX * 1.6);
      camera.lookAt(cx, cy, 0);
    } else {
      // Perspective Spatial View for 3D Mode
      camera.position.set(cx + spanX * 1.5, cy + spanY * 1.5, cz + trussHeight * 2);
      camera.lookAt(cx, cy, cz);
    }

    // Node Spheres
    const nodeGeo = new THREE.SphereGeometry(0.16, 16, 16);
    const nodeMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b });
    nodes.forEach((n) => {
      const sphere = new THREE.Mesh(nodeGeo, nodeMat);
      sphere.position.set(n.x, n.y, n.z);
      scene.add(sphere);
    });

    // Member Cylinders with Force Color Coding
    members.forEach((mem) => {
      const n1 = nodes.find((n) => n.id === mem.startNode);
      const n2 = nodes.find((n) => n.id === mem.endNode);
      if (!n1 || !n2) return;

      const p1 = new THREE.Vector3(n1.x, n1.y, n1.z);
      const p2 = new THREE.Vector3(n2.x, n2.y, n2.z);
      const dist = p1.distanceTo(p2);

      const res = result?.memberResults.find((m) => m.id === mem.id);
      let color = 0x64748b;
      if (res) color = res.state === 'TENSION' ? 0x38bdf8 : res.state === 'COMPRESSION' ? 0xef4444 : 0x94a3b8;

      const cylinderGeo = new THREE.CylinderGeometry(0.04, 0.04, dist, 8);
      const cylinderMat = new THREE.MeshStandardMaterial({ color });
      const cylinder = new THREE.Mesh(cylinderGeo, cylinderMat);

      const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      cylinder.position.copy(mid);
      cylinder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p2.clone().sub(p1).normalize());
      scene.add(cylinder);
    });

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (dimMode === '3D') scene.rotation.z += 0.003; // Rotate scene only in 3D mode
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      renderer.dispose();
    };
  }, [nodes, members, result, dimMode, spanX, spanY, trussHeight]);

  // --- UNIFIED ADAPTIVE STIFFNESS MATRIX SOLVER ---
  const handleRunAnalysis = () => {
    setAnalyzing(true);
    try {
      const totalDof = nodes.length * 3;
      const K_global = Array.from({ length: totalDof }, () => new Array(totalDof).fill(0));
      const F_global = new Array(totalDof).fill(0);

      // Assemble Nodal Loads
      nodes.forEach((node, idx) => {
        F_global[3 * idx] = node.fx;
        F_global[3 * idx + 1] = node.fy;
        F_global[3 * idx + 2] = node.fz;
      });

      // Assemble Global Stiffness Matrix
      members.forEach((mem) => {
        const n1 = nodes.find((n) => n.id === mem.startNode)!;
        const n2 = nodes.find((n) => n.id === mem.endNode)!;
        const idx1 = nodes.findIndex((n) => n.id === mem.startNode);
        const idx2 = nodes.findIndex((n) => n.id === mem.endNode);

        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        const dz = n2.z - n1.z;
        const L = Math.max(Math.sqrt(dx * dx + dy * dy + dz * dz), 0.001);

        const Cx = dx / L;
        const Cy = dy / L;
        const Cz = dz / L;

        const k_axial = (modulusE * mem.area) / (L * 1000);
        const C = [Cx, Cy, Cz, -Cx, -Cy, -Cz];
        const dofs = [3 * idx1, 3 * idx1 + 1, 3 * idx1 + 2, 3 * idx2, 3 * idx2 + 1, 3 * idx2 + 2];

        for (let r = 0; r < 6; r++) {
          for (let c = 0; c < 6; c++) K_global[dofs[r]][dofs[c]] += k_axial * C[r] * C[c];
        }
      });

      // Apply Boundary Penalties (Enforcing fixZ = true in 2D prevents Z singularity)
      const K_bounded = K_global.map((row) => [...row]);
      const F_bounded = [...F_global];

      nodes.forEach((node, idx) => {
        if (node.fixX) { K_bounded[3 * idx][3 * idx] += 1e12; F_bounded[3 * idx] = 0; }
        if (node.fixY) { K_bounded[3 * idx + 1][3 * idx + 1] += 1e12; F_bounded[3 * idx + 1] = 0; }
        if (node.fixZ || dimMode === '2D') { K_bounded[3 * idx + 2][3 * idx + 2] += 1e12; F_bounded[3 * idx + 2] = 0; }
      });

      const U = solveMatrix(K_bounded, F_bounded);

      // Compute Member Results & Capacities
      const memberResults: MemberResult[] = members.map((mem) => {
        const n1 = nodes.find((n) => n.id === mem.startNode)!;
        const n2 = nodes.find((n) => n.id === mem.endNode)!;
        const idx1 = nodes.findIndex((n) => n.id === mem.startNode);
        const idx2 = nodes.findIndex((n) => n.id === mem.endNode);

        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        const dz = n2.z - n1.z;
        const L = Math.max(Math.sqrt(dx * dx + dy * dy + dz * dz), 0.001);

        const Cx = dx / L;
        const Cy = dy / L;
        const Cz = dz / L;

        const u1 = U[3 * idx1]; const v1 = U[3 * idx1 + 1]; const w1 = U[3 * idx1 + 2];
        const u2 = U[3 * idx2]; const v2 = U[3 * idx2 + 1]; const w2 = U[3 * idx2 + 2];

        const axial = ((modulusE * mem.area) / (L * 1000)) * ((u2 - u1) * Cx + (v2 - v1) * Cy + (w2 - w1) * Cz);
        const state = Math.abs(axial) < 0.01 ? 'ZERO' : axial > 0 ? 'TENSION' : 'COMPRESSION';
        const slenderness = (1.0 * L * 1000) / mem.ry;

        const f_y_kN = fy / 1000;
        let capacity = 0;

        if (state === 'TENSION') {
          capacity = designCode === 'AISC360' ? 0.9 * mem.area * f_y_kN : mem.area * f_y_kN;
        } else {
          const P_euler = (Math.PI * Math.PI * modulusE * (mem.area * mem.ry * mem.ry)) / Math.pow(L * 1000, 2) / 1000;
          capacity = Math.min(P_euler, mem.area * f_y_kN) * 0.85;
        }

        const demand = Math.abs(axial);
        const dcr = Number((demand / Math.max(capacity, 0.1)).toFixed(3));

        return {
          id: mem.id,
          length: Number(L.toFixed(2)),
          axialForce: Number(axial.toFixed(2)),
          state,
          slenderness: Number(slenderness.toFixed(1)),
          capacity: Number(capacity.toFixed(1)),
          dcr,
          status: dcr <= 1.0 ? 'PASS' : 'FAIL',
        };
      });

      const maxDcr = Math.max(...memberResults.map((m) => m.dcr));
      const govMem = memberResults.find((m) => m.dcr === maxDcr)?.id || 1;

      const displArray = nodes.map((n, idx) => ({
        node: n.id,
        ux: Number((U[3 * idx] * 1000).toFixed(2)),
        uy: Number((U[3 * idx + 1] * 1000).toFixed(2)),
        uz: Number((U[3 * idx + 2] * 1000).toFixed(2)),
      }));

      const reactArray = nodes.map((n, idx) => ({
        node: n.id,
        rx: n.fixX ? Number((-1 * F_bounded[3 * idx]).toFixed(1)) : 0,
        ry: n.fixY ? Number((-1 * F_bounded[3 * idx + 1]).toFixed(1)) : 0,
        rz: n.fixZ ? Number((-1 * F_bounded[3 * idx + 2]).toFixed(1)) : 0,
      }));

      setResult({
        dimMode,
        code: designCode,
        displacements: displArray,
        reactions: reactArray,
        memberResults,
        maxDcr,
        overallStatus: maxDcr <= 1.0 ? 'SAFE' : 'OVERSTRESSED',
        governingMember: govMem,
      });
    } catch (e) {
      console.error('Unified matrix calculation error:', e);
      alert('Error calculating matrix system.');
    } finally {
      setAnalyzing(false);
    }
  };

  const solveMatrix = (A: number[][], b: number[]): number[] => {
    const n = A.length;
    const M = A.map((row, i) => [...row, b[i]]);

    for (let i = 0; i < n; i++) {
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) maxRow = k;
      }
      [M[i], M[maxRow]] = [M[maxRow], M[i]];

      if (Math.abs(M[i][i]) < 1e-12) continue;

      for (let k = i + 1; k < n; k++) {
        const c = M[k][i] / M[i][i];
        for (let j = i; j <= n; j++) M[k][j] -= c * M[i][j];
      }
    }

    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let sum = M[i][n];
      for (let j = i + 1; j < n; j++) sum -= M[i][j] * x[j];
      x[i] = Math.abs(M[i][i]) > 1e-12 ? sum / M[i][i] : 0;
    }
    return x;
  };

  // PDF Export Tool
  const handleExportPDF = () => {
    if (!result) return;
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(`Structural Analysis Report (${result.dimMode} Mode)`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Design Code: ${result.code} | Status: ${result.overallStatus} | Max DCR: ${result.maxDcr}`, 14, 22);

    const tableData = result.memberResults.map((m) => [
      `M${m.id}`,
      `${m.length} m`,
      `${m.axialForce} kN`,
      m.state,
      `${m.capacity} kN`,
      m.dcr,
      m.status,
    ]);

    autoTable(doc, {
      startY: 28,
      head: [['Member', 'Length', 'Axial Force', 'State', 'Capacity', 'DCR', 'Status']],
      body: tableData,
    });

    doc.save(`Truss_Report_${result.dimMode}.pdf`);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 font-sans">
      {/* Control Configuration Panel */}
      <div className="lg:col-span-5 space-y-4 bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-xl">
        {/* Dimension Mode & Code Selection */}
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <div className="flex space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setDimMode('2D')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition ${dimMode === '2D' ? 'bg-cyan-500 text-slate-950 shadow' : 'text-slate-400 hover:text-slate-200'}`}
            >
              2D Planar Mode
            </button>
            <button
              onClick={() => setDimMode('3D')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition ${dimMode === '3D' ? 'bg-cyan-500 text-slate-950 shadow' : 'text-slate-400 hover:text-slate-200'}`}
            >
              3D Spatial Mode
            </button>
          </div>

          <select
            value={designCode}
            onChange={(e) => setDesignCode(e.target.value as DesignCode)}
            className="bg-cyan-500/10 text-cyan-400 font-bold border border-cyan-500/30 rounded px-2 py-1 text-xs"
          >
            <option value="AISC360">AISC 360-16</option>
            <option value="EC3">Eurocode 3</option>
            <option value="BS5950">BS 5950</option>
          </select>
        </div>

        {/* Dynamic Topology Selection */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">
            {dimMode === '2D' ? '2D Truss Topology' : '3D Spatial Topology'}
          </label>
          {dimMode === '2D' ? (
            <select
              value={topology2D}
              onChange={(e) => setTopology2D(e.target.value as Topology2D)}
              className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-medium"
            >
              <option value="pratt">Pratt Roof Truss</option>
              <option value="howe">Howe Roof Truss</option>
              <option value="warren">Warren Parallel Truss</option>
              <option value="fink">Fink Gable Truss</option>
              <option value="scissors">Scissors Vaulted Truss</option>
            </select>
          ) : (
            <select
              value={topology3D}
              onChange={(e) => setTopology3D(e.target.value as Topology3D)}
              className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-medium"
            >
              <option value="space_grid">Double-Layer Roof Space Grid</option>
              <option value="space_tower">4-Legged Spatial Transmission Tower</option>
            </select>
          )}
        </div>

        {/* Dynamic Spatial Dimensions */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Span X (m)</label>
            <input
              type="number"
              value={spanX}
              onChange={(e) => setSpanX(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Span Y (m)</label>
            <input
              type="number"
              disabled={dimMode === '2D'}
              value={spanY}
              onChange={(e) => setSpanY(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-mono disabled:opacity-30"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Height (m)</label>
            <input
              type="number"
              value={trussHeight}
              onChange={(e) => setTrussHeight(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-mono"
            />
          </div>
        </div>

        {/* Member Counts & Divisions */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800">
          <div>
            <label className="block text-xs text-cyan-400 mb-1">Bays in X (Nx)</label>
            <input
              type="number"
              value={baysX}
              onChange={(e) => setBaysX(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-cyan-400 mb-1">Bays in Y (Ny)</label>
            <input
              type="number"
              disabled={dimMode === '2D' || topology3D === 'space_tower'}
              value={baysY}
              onChange={(e) => setBaysY(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-mono disabled:opacity-30"
            />
          </div>
          <div>
            <label className="block text-xs text-cyan-400 mb-1">Tower Levels</label>
            <input
              type="number"
              disabled={dimMode === '2D' || topology3D === 'space_grid'}
              value={towerLevels}
              onChange={(e) => setTowerLevels(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-mono disabled:opacity-30"
            />
          </div>
        </div>

        {/* Cross-Section & Load Controls */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Section Area (mm²)</label>
            <input
              type="number"
              value={sectionArea}
              onChange={(e) => setSectionArea(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              {dimMode === '2D' ? 'Joint Load Fy (kN)' : 'Top Joint Load Fz (kN)'}
            </label>
            <input
              type="number"
              value={dimMode === '2D' ? pointLoadY : pointLoadZ}
              onChange={(e) => dimMode === '2D' ? setPointLoadY(Number(e.target.value)) : setPointLoadZ(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-mono"
            />
          </div>
        </div>

        <button
          onClick={handleRunAnalysis}
          disabled={analyzing}
          className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold py-2.5 rounded transition shadow-lg shadow-cyan-500/20"
        >
          {analyzing ? 'Solving Structural Matrix...' : `Run ${dimMode} Structural Analysis`}
        </button>
      </div>

      {/* Three.js Adaptive Viewport & Results Output */}
      <div className="lg:col-span-7 space-y-6">
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
          <h4 className="text-xs font-bold text-slate-300 mb-2 border-b border-slate-800 pb-1 flex justify-between">
            <span>THREE.JS CANVAS ({dimMode} VIEWPORT)</span>
            <span className="text-cyan-400">Nodes: {nodes.length} | Members: {members.length}</span>
          </h4>
          <div ref={mountRef} className="bg-slate-950 rounded border border-slate-800 overflow-hidden flex justify-center" />
        </div>

        {/* Results Output Matrix */}
        {result && (
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                {dimMode} Axial Forces & Capacity Matrix
              </h4>
              <div className="flex items-center space-x-2">
                <span className={`text-xs px-2 py-0.5 rounded font-bold ${result.overallStatus === 'SAFE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                  {result.overallStatus}
                </span>
                <button
                  onClick={handleExportPDF}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-2.5 py-1 rounded border border-slate-700 font-medium"
                >
                  Export PDF
                </button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-52">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-2 font-semibold">Mem</th>
                    <th className="pb-2 font-semibold">Length</th>
                    <th className="pb-2 font-semibold">Axial Force</th>
                    <th className="pb-2 font-semibold">Capacity</th>
                    <th className="pb-2 font-semibold">DCR</th>
                    <th className="pb-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-slate-300">
                  {result.memberResults.map((m) => (
                    <tr key={`res-unif-${m.id}`}>
                      <td className="py-1.5 font-bold">M{m.id}</td>
                      <td className="py-1.5">{m.length} m</td>
                      <td className={`py-1.5 font-bold ${m.state === 'TENSION' ? 'text-cyan-400' : m.state === 'COMPRESSION' ? 'text-rose-400' : 'text-slate-400'}`}>
                        {m.axialForce} kN
                      </td>
                      <td className="py-1.5">{m.capacity} kN</td>
                      <td className={`py-1.5 font-bold ${m.dcr <= 1.0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {m.dcr}
                      </td>
                      <td className="py-1.5 font-bold">
                        <span className={m.dcr <= 1.0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {m.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
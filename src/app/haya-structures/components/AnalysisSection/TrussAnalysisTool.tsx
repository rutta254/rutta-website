'use client';

import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type DimensionMode = '2D' | '3D';
type DesignCode = 'AISC360' | 'EC3' | 'BS5950';
type Topology2D = 'pratt' | 'howe' | 'warren' | 'fink' | 'scissors' | 'king_post' | 'ktruss';
type Topology3D = 'space_grid' | 'space_tower' | 'triangular_prism';
type SectionType = 'RHS' | 'CHS' | 'IBEAM' | 'ANGLE' | 'RECT_SOLID';
type SupportType = 'PINNED' | 'ROLLER_X' | 'ROLLER_Y' | 'FREE';

interface NodeStruct {
  id: number;
  x: number;
  y: number;
  z: number;
  support: SupportType;
  fx: number; // kN
  fy: number; // kN
  fz: number; // kN
}

interface MemberStruct {
  id: number;
  startNode: number;
  endNode: number;
}

interface SectionProps {
  type: SectionType;
  b: number; // mm
  h: number; // mm
  t: number; // mm
  tw: number; // mm (for I-beam)
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

  // Dimensions & Counts
  const [spanX, setSpanX] = useState<number>(12); // m
  const [spanY, setSpanY] = useState<number>(6);  // m
  const [trussHeight, setTrussHeight] = useState<number>(2.5); // m
  const [baysX, setBaysX] = useState<number>(4);
  const [baysY, setBaysY] = useState<number>(2);
  const [towerLevels, setTowerLevels] = useState<number>(4);

  // Section Geometry Inputs
  const [secType, setSecType] = useState<SectionType>('RHS');
  const [dimB, setDimB] = useState<number>(100); // mm
  const [dimH, setDimH] = useState<number>(100); // mm
  const [dimT, setDimT] = useState<number>(5);   // mm
  const [dimTw, setDimTw] = useState<number>(5); // mm
  const [fy, setFy] = useState<number>(355);     // MPa
  const [modulusE, setModulusE] = useState<number>(210000); // MPa

  // Computed Section Properties
  const [sectionProps, setSectionProps] = useState<SectionProps>({
    type: 'RHS', b: 100, h: 100, t: 5, tw: 5, area: 1800, ry: 38.7
  });

  // Global Loading Defaults
  const [globalLoadY, setGlobalLoadY] = useState<number>(-25); // kN
  const [globalLoadZ, setGlobalLoadZ] = useState<number>(-20); // kN

  // Selected Node for Custom Loads/Supports
  const [selectedNodeId, setSelectedNodeId] = useState<number>(1);

  // Structural State
  const [nodes, setNodes] = useState<NodeStruct[]>([]);
  const [members, setMembers] = useState<MemberStruct[]>([]);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState<boolean>(false);

  const mountRef = useRef<HTMLDivElement>(null);

  // --- AUTOMATIC SECTION PROPERTY CALCULATOR ---
  useEffect(() => {
    let area = 0;
    let ry = 1;

    if (secType === 'RHS') {
      const b = dimB; const h = dimH; const t = dimT;
      const bi = b - 2 * t; const hi = h - 2 * t;
      area = b * h - (bi > 0 && hi > 0 ? bi * hi : 0);
      const Ix = (b * Math.pow(h, 3) - (bi > 0 && hi > 0 ? bi * Math.pow(hi, 3) : 0)) / 12;
      ry = Math.sqrt(Math.max(Ix / area, 0.1));
    } else if (secType === 'CHS') {
      const D = dimH; const t = dimT; const d = D - 2 * t;
      area = (Math.PI / 4) * (D * D - (d > 0 ? d * d : 0));
      const Ix = (Math.PI / 64) * (Math.pow(D, 4) - (d > 0 ? Math.pow(d, 4) : 0));
      ry = Math.sqrt(Math.max(Ix / area, 0.1));
    } else if (secType === 'IBEAM') {
      const b = dimB; const h = dimH; const tf = dimT; const tw = dimTw;
      area = 2 * b * tf + (h - 2 * tf) * tw;
      const Ix = (b * Math.pow(h, 3) - (b - tw) * Math.pow(h - 2 * tf, 3)) / 12;
      ry = Math.sqrt(Math.max(Ix / area, 0.1));
    } else if (secType === 'ANGLE') {
      const b = dimB; const h = dimH; const t = dimT;
      area = t * (b + h - t);
      ry = Math.min(b, h) * 0.28;
    } else {
      // Solid Rectangle
      area = dimB * dimH;
      const Ix = (dimB * Math.pow(dimH, 3)) / 12;
      ry = Math.sqrt(Math.max(Ix / area, 0.1));
    }

    setSectionProps({
      type: secType,
      b: dimB,
      h: dimH,
      t: dimT,
      tw: dimTw,
      area: Math.round(area),
      ry: Number(ry.toFixed(2)),
    });
  }, [secType, dimB, dimH, dimT, dimTw]);

  // --- PARAMETRIC GEOMETRY & NODE/MEMBER GENERATOR ---
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
      const stepX = Lx / Nx;

      // Bottom Chord
      for (let i = 0; i <= Nx; i++) {
        let supp: SupportType = 'FREE';
        if (i === 0) supp = 'PINNED';
        if (i === Nx) supp = 'ROLLER_X';

        newNodes.push({
          id: i + 1,
          x: Number((i * stepX).toFixed(2)),
          y: 0,
          z: 0,
          support: supp,
          fx: 0, fy: 0, fz: 0,
        });
      }

      // Top Chord
      for (let i = 0; i <= Nx; i++) {
        let nodeY = H;
        if (topology2D === 'fink' || topology2D === 'scissors' || topology2D === 'king_post') {
          nodeY = (1 - Math.abs((i - Nx / 2) / (Nx / 2))) * H;
        }

        const isJointLoad = i > 0 && i < Nx;
        newNodes.push({
          id: Nx + 1 + i + 1,
          x: Number((i * stepX).toFixed(2)),
          y: Number(nodeY.toFixed(2)),
          z: 0,
          support: 'FREE',
          fx: 0,
          fy: isJointLoad ? globalLoadY : 0,
          fz: 0,
        });
      }

      let mId = 0;
      // Chords
      for (let i = 0; i < Nx; i++) {
        newMembers.push({ id: ++mId, startNode: i + 1, endNode: i + 2 });
        newMembers.push({ id: ++mId, startNode: Nx + 2 + i, endNode: Nx + 3 + i });
      }

      // Web Members
      for (let i = 0; i <= Nx; i++) {
        const bNode = i + 1;
        const tNode = Nx + 2 + i;
        newMembers.push({ id: ++mId, startNode: bNode, endNode: tNode });

        if (i < Nx) {
          if (topology2D === 'pratt') {
            if (i < Nx / 2) newMembers.push({ id: ++mId, startNode: bNode, endNode: tNode + 1 });
            else newMembers.push({ id: ++mId, startNode: bNode + 1, endNode: tNode });
          } else if (topology2D === 'howe') {
            if (i < Nx / 2) newMembers.push({ id: ++mId, startNode: bNode + 1, endNode: tNode });
            else newMembers.push({ id: ++mId, startNode: bNode, endNode: tNode + 1 });
          } else if (topology2D === 'ktruss') {
            newMembers.push({ id: ++mId, startNode: bNode, endNode: tNode + 1 });
            newMembers.push({ id: ++mId, startNode: bNode + 1, endNode: tNode });
          } else {
            // Warren / Fink / Default
            newMembers.push({ id: ++mId, startNode: bNode, endNode: tNode + 1 });
          }
        }
      }
    } else {
      // 3D Mode
      if (topology3D === 'space_grid') {
        const stepX = Lx / Nx;
        const stepY = Ly / Ny;
        let nId = 0;

        // Bottom Nodes
        for (let i = 0; i <= Nx; i++) {
          for (let j = 0; j <= Ny; j++) {
            const isCorner = (i === 0 || i === Nx) && (j === 0 || j === Ny);
            newNodes.push({
              id: ++nId,
              x: Number((i * stepX).toFixed(2)),
              y: Number((j * stepY).toFixed(2)),
              z: 0,
              support: isCorner ? 'PINNED' : 'FREE',
              fx: 0, fy: 0, fz: 0,
            });
          }
        }
        const numBottomNodes = newNodes.length;

        // Top Nodes
        for (let i = 0; i < Nx; i++) {
          for (let j = 0; j < Ny; j++) {
            newNodes.push({
              id: ++nId,
              x: Number(((i + 0.5) * stepX).toFixed(2)),
              y: Number(((j + 0.5) * stepY).toFixed(2)),
              z: H,
              support: 'FREE',
              fx: 0, fy: 0, fz: globalLoadZ,
            });
          }
        }

        let mId = 0;
        const getNodeIdx = (i: number, j: number) => i * (Ny + 1) + j + 1;

        for (let i = 0; i <= Nx; i++) {
          for (let j = 0; j <= Ny; j++) {
            if (i < Nx) newMembers.push({ id: ++mId, startNode: getNodeIdx(i, j), endNode: getNodeIdx(i + 1, j) });
            if (j < Ny) newMembers.push({ id: ++mId, startNode: getNodeIdx(i, j), endNode: getNodeIdx(i, j + 1) });
          }
        }

        let topStartId = numBottomNodes + 1;
        for (let i = 0; i < Nx; i++) {
          for (let j = 0; j < Ny; j++) {
            const topId = topStartId++;
            const b1 = getNodeIdx(i, j);
            const b2 = getNodeIdx(i + 1, j);
            const b3 = getNodeIdx(i + 1, j + 1);
            const b4 = getNodeIdx(i, j + 1);

            newMembers.push({ id: ++mId, startNode: b1, endNode: topId });
            newMembers.push({ id: ++mId, startNode: b2, endNode: topId });
            newMembers.push({ id: ++mId, startNode: b3, endNode: topId });
            newMembers.push({ id: ++mId, startNode: b4, endNode: topId });
          }
        }
      } else {
        // Transmission Tower
        let nId = 0;
        const dz = H / Levels;

        for (let k = 0; k <= Levels; k++) {
          const factor = 1 - (k / Levels) * 0.45;
          const w = (Lx / 2) * factor;
          const h = (Ly / 2) * factor;
          const z = Number((k * dz).toFixed(2));

          newNodes.push({ id: ++nId, x: -w, y: -h, z, support: k === 0 ? 'PINNED' : 'FREE', fx: 0, fy: 0, fz: k === Levels ? globalLoadZ : 0 });
          newNodes.push({ id: ++nId, x: w, y: -h, z, support: k === 0 ? 'PINNED' : 'FREE', fx: 0, fy: 0, fz: k === Levels ? globalLoadZ : 0 });
          newNodes.push({ id: ++nId, x: w, y: h, z, support: k === 0 ? 'PINNED' : 'FREE', fx: 0, fy: 0, fz: k === Levels ? globalLoadZ : 0 });
          newNodes.push({ id: ++nId, x: -w, y: h, z, support: k === 0 ? 'PINNED' : 'FREE', fx: 0, fy: 0, fz: k === Levels ? globalLoadZ : 0 });
        }

        let mId = 0;
        for (let k = 0; k < Levels; k++) {
          const base = k * 4;
          for (let i = 0; i < 4; i++) {
            newMembers.push({ id: ++mId, startNode: base + i + 1, endNode: base + i + 5 });
            newMembers.push({ id: ++mId, startNode: base + i + 1, endNode: base + ((i + 1) % 4) + 1 });
          }
          newMembers.push({ id: ++mId, startNode: base + 1, endNode: base + 6 });
          newMembers.push({ id: ++mId, startNode: base + 2, endNode: base + 5 });
        }
      }
    }

    setNodes(newNodes);
    setMembers(newMembers);
    if (newNodes.length > 0) setSelectedNodeId(newNodes[0].id);
  }, [dimMode, topology2D, topology3D, spanX, spanY, trussHeight, baysX, baysY, towerLevels, globalLoadY, globalLoadZ]);

  // --- MANUAL OVERRIDES FOR SELECTED NODE ---
  const updateNodeSupport = (supp: SupportType) => {
    setNodes(prev => prev.map(n => n.id === selectedNodeId ? { ...n, support: supp } : n));
  };

  const updateNodeLoad = (fx: number, fy: number, fz: number) => {
    setNodes(prev => prev.map(n => n.id === selectedNodeId ? { ...n, fx, fy, fz } : n));
  };

  // --- THREE.JS CANVAS RENDERER WITH ARROWS & SUPPORTS ---
  useEffect(() => {
    if (!mountRef.current || nodes.length === 0) return;

    const width = mountRef.current.clientWidth || 450;
    const height = 300;

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
      camera.position.set(cx, cy + 0.5, spanX * 1.6);
      camera.lookAt(cx, cy, 0);
    } else {
      camera.position.set(cx + spanX * 1.5, cy + spanY * 1.5, cz + trussHeight * 2);
      camera.lookAt(cx, cy, cz);
    }

    // Render Nodes & Support Indicators
    nodes.forEach((n) => {
      const isSelected = n.id === selectedNodeId;
      const nodeGeo = new THREE.SphereGeometry(isSelected ? 0.25 : 0.16, 16, 16);
      const nodeMat = new THREE.MeshStandardMaterial({ color: isSelected ? 0x38bdf8 : 0xf59e0b });
      const sphere = new THREE.Mesh(nodeGeo, nodeMat);
      sphere.position.set(n.x, n.y, n.z);
      scene.add(sphere);

      // Support Geometry Icons
      if (n.support === 'PINNED') {
        const coneGeo = new THREE.ConeGeometry(0.2, 0.4, 8);
        const coneMat = new THREE.MeshStandardMaterial({ color: 0x10b981 }); // Green
        const cone = new THREE.Mesh(coneGeo, coneMat);
        cone.position.set(n.x, n.y - 0.2, n.z);
        scene.add(cone);
      } else if (n.support === 'ROLLER_X' || n.support === 'ROLLER_Y') {
        const rollerGeo = new THREE.SphereGeometry(0.15, 8, 8);
        const rollerMat = new THREE.MeshStandardMaterial({ color: 0xfacc15 }); // Yellow
        const roller = new THREE.Mesh(rollerGeo, rollerMat);
        roller.position.set(n.x, n.y - 0.15, n.z);
        scene.add(roller);
      }

      // Load Arrows Rendering
      const loadVec = new THREE.Vector3(n.fx, n.fy, n.fz);
      const loadMag = loadVec.length();
      if (loadMag > 0) {
        const dir = loadVec.clone().normalize();
        const arrow = new THREE.ArrowHelper(dir, new THREE.Vector3(n.x, n.y, n.z), Math.min(loadMag * 0.05, 1.5), 0xef4444, 0.3, 0.2);
        scene.add(arrow);
      }
    });

    // Render Members
    members.forEach((mem) => {
      const n1 = nodes.find((n) => n.id === mem.startNode);
      const n2 = nodes.find((n) => n.id === mem.endNode);
      if (!n1 || !n2) return;

      const p1 = new THREE.Vector3(n1.x, n1.y, n1.z);
      const p2 = new THREE.Vector3(n2.x, n2.y, n2.z);
      const dist = p1.distanceTo(p2);

      const res = result?.memberResults.find((m) => m.id === mem.id);
      let color = 0x64748b;
      if (res) {
        if (res.dcr > 1.0) color = 0xef4444; // Fail (Red)
        else if (res.dcr > 0.7) color = 0xfacc15; // Warning (Yellow)
        else color = res.state === 'TENSION' ? 0x38bdf8 : 0x10b981; // Safe (Cyan/Green)
      }

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
      if (dimMode === '3D') scene.rotation.z += 0.002;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      renderer.dispose();
    };
  }, [nodes, members, result, dimMode, spanX, spanY, trussHeight, selectedNodeId]);

  // --- SOLVER ENGINE ---
  const handleRunAnalysis = () => {
    setAnalyzing(true);
    try {
      const totalDof = nodes.length * 3;
      const K_global = Array.from({ length: totalDof }, () => new Array(totalDof).fill(0));
      const F_global = new Array(totalDof).fill(0);

      nodes.forEach((node, idx) => {
        F_global[3 * idx] = node.fx;
        F_global[3 * idx + 1] = node.fy;
        F_global[3 * idx + 2] = node.fz;
      });

      members.forEach((mem) => {
        const n1 = nodes.find((n) => n.id === mem.startNode)!;
        const n2 = nodes.find((n) => n.id === mem.endNode)!;
        const idx1 = nodes.findIndex((n) => n.id === mem.startNode);
        const idx2 = nodes.findIndex((n) => n.id === mem.endNode);

        const dx = n2.x - n1.x; const dy = n2.y - n1.y; const dz = n2.z - n1.z;
        const L = Math.max(Math.sqrt(dx * dx + dy * dy + dz * dz), 0.001);

        const Cx = dx / L; const Cy = dy / L; const Cz = dz / L;
        const k_axial = (modulusE * sectionProps.area) / (L * 1000);

        const C = [Cx, Cy, Cz, -Cx, -Cy, -Cz];
        const dofs = [3 * idx1, 3 * idx1 + 1, 3 * idx1 + 2, 3 * idx2, 3 * idx2 + 1, 3 * idx2 + 2];

        for (let r = 0; r < 6; r++) {
          for (let c = 0; c < 6; c++) K_global[dofs[r]][dofs[c]] += k_axial * C[r] * C[c];
        }
      });

      const K_bounded = K_global.map((row) => [...row]);
      const F_bounded = [...F_global];

      nodes.forEach((node, idx) => {
        const fixX = node.support === 'PINNED' || node.support === 'ROLLER_Y';
        const fixY = node.support === 'PINNED' || node.support === 'ROLLER_X';
        const fixZ = node.support === 'PINNED' || dimMode === '2D';

        if (fixX) { K_bounded[3 * idx][3 * idx] += 1e12; F_bounded[3 * idx] = 0; }
        if (fixY) { K_bounded[3 * idx + 1][3 * idx + 1] += 1e12; F_bounded[3 * idx + 1] = 0; }
        if (fixZ) { K_bounded[3 * idx + 2][3 * idx + 2] += 1e12; F_bounded[3 * idx + 2] = 0; }
      });

      const U = solveMatrix(K_bounded, F_bounded);

      const memberResults: MemberResult[] = members.map((mem) => {
        const n1 = nodes.find((n) => n.id === mem.startNode)!;
        const n2 = nodes.find((n) => n.id === mem.endNode)!;
        const idx1 = nodes.findIndex((n) => n.id === mem.startNode);
        const idx2 = nodes.findIndex((n) => n.id === mem.endNode);

        const dx = n2.x - n1.x; const dy = n2.y - n1.y; const dz = n2.z - n1.z;
        const L = Math.max(Math.sqrt(dx * dx + dy * dy + dz * dz), 0.001);

        const Cx = dx / L; const Cy = dy / L; const Cz = dz / L;

        const u1 = U[3 * idx1]; const v1 = U[3 * idx1 + 1]; const w1 = U[3 * idx1 + 2];
        const u2 = U[3 * idx2]; const v2 = U[3 * idx2 + 1]; const w2 = U[3 * idx2 + 2];

        const axial = ((modulusE * sectionProps.area) / (L * 1000)) * ((u2 - u1) * Cx + (v2 - v1) * Cy + (w2 - w1) * Cz);
        const state = Math.abs(axial) < 0.01 ? 'ZERO' : axial > 0 ? 'TENSION' : 'COMPRESSION';
        const slenderness = (1.0 * L * 1000) / sectionProps.ry;

        const f_y_kN = fy / 1000;
        let capacity = 0;

        if (state === 'TENSION') {
          capacity = designCode === 'AISC360' ? 0.9 * sectionProps.area * f_y_kN : sectionProps.area * f_y_kN;
        } else {
          const P_euler = (Math.PI * Math.PI * modulusE * (sectionProps.area * sectionProps.ry * sectionProps.ry)) / Math.pow(L * 1000, 2) / 1000;
          capacity = Math.min(P_euler, sectionProps.area * f_y_kN) * 0.85;
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
        rx: Number((-1 * F_bounded[3 * idx]).toFixed(1)),
        ry: Number((-1 * F_bounded[3 * idx + 1]).toFixed(1)),
        rz: Number((-1 * F_bounded[3 * idx + 2]).toFixed(1)),
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
      console.error('Solver error:', e);
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

  // --- PERFECT FIT PDF EXPORTER ---
  const handleExportPDF = () => {
    if (!result) return;
    const doc = new jsPDF('portrait', 'mm', 'a4');

    // Header Title
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 210, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text('Structural Truss Analysis Report', 14, 15);

    // Metadata Block
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(9);
    doc.text(`Dimension Mode: ${result.dimMode}`, 14, 32);
    doc.text(`Design Standard: ${result.code}`, 14, 37);
    doc.text(`Section Profile: ${sectionProps.type} (${sectionProps.b}x${sectionProps.h}x${sectionProps.t} mm)`, 14, 42);
    doc.text(`Section Area: ${sectionProps.area} mm² | Radius of Gyration: ${sectionProps.ry} mm`, 14, 47);

    doc.setFontSize(10);
    doc.text(`Overall Status: ${result.overallStatus}`, 130, 32);
    doc.text(`Max Demand-Capacity Ratio (DCR): ${result.maxDcr}`, 130, 37);
    doc.text(`Governing Member: Member ${result.governingMember}`, 130, 42);

    // Table 1: Member Analysis Results
    const memberRows = result.memberResults.map((m) => [
      `M${m.id}`,
      `${m.length} m`,
      `${m.axialForce} kN`,
      m.state,
      `${m.capacity} kN`,
      `${m.slenderness}`,
      `${m.dcr}`,
      m.status,
    ]);

    autoTable(doc, {
      startY: 52,
      margin: { left: 14, right: 14 },
      head: [['Member', 'Length', 'Axial Force', 'State', 'Capacity', 'KL/r', 'DCR', 'Status']],
      body: memberRows,
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [15, 23, 42] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      didDrawPage: (data) => {
        // Footer Page Numbering
        const pageCount = (doc as any).internal.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text(`Page ${data.pageNumber} of ${pageCount}`, 180, 287);
      },
    });

    doc.save(`Truss_Analysis_Report_${result.dimMode}.pdf`);
  };

  const activeNode = nodes.find(n => n.id === selectedNodeId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 font-sans text-slate-200">
      {/* Control Configuration Panel */}
      <div className="lg:col-span-5 space-y-4 bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-xl">
        {/* Mode Switcher */}
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <div className="flex space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setDimMode('2D')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition ${dimMode === '2D' ? 'bg-cyan-500 text-slate-950 shadow' : 'text-slate-400 hover:text-slate-200'}`}
            >
              2D Planar
            </button>
            <button
              onClick={() => setDimMode('3D')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition ${dimMode === '3D' ? 'bg-cyan-500 text-slate-950 shadow' : 'text-slate-400 hover:text-slate-200'}`}
            >
              3D Spatial
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

        {/* Topologies */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">
            {dimMode === '2D' ? '2D Truss Topology' : '3D Spatial Topology'}
          </label>
          {dimMode === '2D' ? (
            <select
              value={topology2D}
              onChange={(e) => setTopology2D(e.target.value as Topology2D)}
              className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs font-medium"
            >
              <option value="pratt">Pratt Roof Truss</option>
              <option value="howe">Howe Roof Truss</option>
              <option value="warren">Warren Parallel Truss</option>
              <option value="fink">Fink Gable Truss</option>
              <option value="scissors">Scissors Vaulted Truss</option>
              <option value="king_post">King Post Truss</option>
              <option value="ktruss">K-Truss Topology</option>
            </select>
          ) : (
            <select
              value={topology3D}
              onChange={(e) => setTopology3D(e.target.value as Topology3D)}
              className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs font-medium"
            >
              <option value="space_grid">Double-Layer Space Grid Roof</option>
              <option value="space_tower">4-Legged Spatial Transmission Tower</option>
            </select>
          )}
        </div>

        {/* Section Profile Calculator Inputs */}
        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-cyan-400">Section Profile Calculator</span>
            <select
              value={secType}
              onChange={(e) => setSecType(e.target.value as SectionType)}
              className="bg-slate-900 border border-slate-800 text-xs rounded px-2 py-0.5"
            >
              <option value="RHS">RHS / SHS Box</option>
              <option value="CHS">CHS Pipe</option>
              <option value="IBEAM">I-Beam / Wide Flange</option>
              <option value="ANGLE">Angle / V-Section</option>
              <option value="RECT_SOLID">Solid Rectangle</option>
            </select>
          </div>

          <div className="grid grid-cols-4 gap-2 text-xs font-mono">
            <div>
              <span className="text-slate-400 block text-[10px]">b (mm)</span>
              <input type="number" value={dimB} onChange={e => setDimB(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded p-1" />
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">h (mm)</span>
              <input type="number" value={dimH} onChange={e => setDimH(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded p-1" />
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">t (mm)</span>
              <input type="number" value={dimT} onChange={e => setDimT(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded p-1" />
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Area (mm²)</span>
              <div className="p-1 bg-slate-900 rounded font-bold text-emerald-400">{sectionProps.area}</div>
            </div>
          </div>
        </div>

        {/* Selected Node Supports & Load Customization */}
        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-amber-400">Node Customization</span>
            <select
              value={selectedNodeId}
              onChange={(e) => setSelectedNodeId(Number(e.target.value))}
              className="bg-slate-900 border border-slate-800 text-xs rounded px-2 py-0.5 font-mono"
            >
              {nodes.map(n => <option key={`node-opt-${n.id}`} value={n.id}>Node {n.id}</option>)}
            </select>
          </div>

          {activeNode && (
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div>
                <span className="text-slate-400 block text-[10px]">Support Condition</span>
                <select
                  value={activeNode.support}
                  onChange={(e) => updateNodeSupport(e.target.value as SupportType)}
                  className="w-full bg-slate-900 border border-slate-800 rounded p-1 text-xs"
                >
                  <option value="FREE">Free Node</option>
                  <option value="PINNED">Pinned (Restrain X,Y,Z)</option>
                  <option value="ROLLER_X">Roller X (Restrain Y,Z)</option>
                  <option value="ROLLER_Y">Roller Y (Restrain X,Z)</option>
                </select>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Applied Fy Load (kN)</span>
                <input
                  type="number"
                  value={activeNode.fy}
                  onChange={(e) => updateNodeLoad(activeNode.fx, Number(e.target.value), activeNode.fz)}
                  className="w-full bg-slate-900 border border-slate-800 rounded p-1 text-xs"
                />
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleRunAnalysis}
          disabled={analyzing}
          className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold py-2.5 rounded transition shadow-lg shadow-cyan-500/20"
        >
          {analyzing ? 'Solving Structural Matrix...' : `Run ${dimMode} Structural Analysis`}
        </button>
      </div>

      {/* Canvas Viewport & Dynamic Output Table */}
      <div className="lg:col-span-7 space-y-6">
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
          <h4 className="text-xs font-bold text-slate-300 mb-2 border-b border-slate-800 pb-1 flex justify-between">
            <span>THREE.JS CANVAS VIEWPORT</span>
            <span className="text-cyan-400">Nodes: {nodes.length} | Members: {members.length}</span>
          </h4>
          <div ref={mountRef} className="bg-slate-950 rounded border border-slate-800 overflow-hidden flex justify-center" />
        </div>

        {result && (
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Member Capacity Results
              </h4>
              <div className="flex items-center space-x-2">
                <span className={`text-xs px-2 py-0.5 rounded font-bold ${result.overallStatus === 'SAFE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                  {result.overallStatus}
                </span>
                <button
                  onClick={handleExportPDF}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-2.5 py-1 rounded border border-slate-700 font-medium"
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
                    <tr key={`res-row-${m.id}`}>
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
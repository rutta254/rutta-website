'use client';

import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type DimensionMode = '2D' | '3D';
type DesignCode = 'AISC360' | 'EC3' | 'BS5950';

type Topology2D =
  | 'pratt'
  | 'howe'
  | 'warren'
  | 'fink'
  | 'scissors'
  | 'king_post'
  | 'queen_post'
  | 'gambrel'
  | 'ktruss'
  | 'bowstring';

type Topology3D =
  | 'flat_grid'
  | 'pyramidal'
  | 'prismatic'
  | 'barrel_vault'
  | 'spherical_dome';

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
  chordType?: 'TOP' | 'BOTTOM' | 'WEB' | 'APEX';
}

interface MemberStruct {
  id: number;
  startNode: number;
  endNode: number;
}

interface SectionProps {
  type: SectionType;
  b: number;
  h: number;
  t: number;
  tw: number;
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
  const [topology3D, setTopology3D] = useState<Topology3D>('flat_grid');

  // Dimensions & Subdivisions
  const [spanX, setSpanX] = useState<number>(12); // Span L (m)
  const [spanY, setSpanY] = useState<number>(6);  // Width W (m)
  const [trussHeight, setTrussHeight] = useState<number>(2.5); // Depth / Height H (m)
  const [baysX, setBaysX] = useState<number>(6);
  const [baysY, setBaysY] = useState<number>(3);
  const [domeRings, setDomeRings] = useState<number>(4);

  // Loading Patterns (UDL & Point Loads)
  const [udlTopChord, setUdlTopChord] = useState<number>(8.5); // kN/m
  const [udlBottomChord, setUdlBottomChord] = useState<number>(2.0); // kN/m
  const [windLoadX, setWindLoadX] = useState<number>(5.0); // kN horizontal
  const [pointLoadZ, setPointLoadZ] = useState<number>(-15.0); // kN for 3D grids

  // Visualization Options
  const [showNodeLabels, setShowNodeLabels] = useState<boolean>(true);
  const [showMemberLabels, setShowMemberLabels] = useState<boolean>(false);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [autoRotate, setAutoRotate] = useState<boolean>(false);

  // Section Geometry Inputs
  const [secType, setSecType] = useState<SectionType>('RHS');
  const [dimB, setDimB] = useState<number>(100);
  const [dimH, setDimH] = useState<number>(100);
  const [dimT, setDimT] = useState<number>(5);
  const [dimTw, setDimTw] = useState<number>(5);
  const [fy, setFy] = useState<number>(355); // MPa
  const [modulusE, setModulusE] = useState<number>(210000); // MPa

  const [sectionProps, setSectionProps] = useState<SectionProps>({
    type: 'RHS', b: 100, h: 100, t: 5, tw: 5, area: 1800, ry: 38.7
  });

  const [selectedNodeId, setSelectedNodeId] = useState<number>(1);
  const [nodes, setNodes] = useState<NodeStruct[]>([]);
  const [members, setMembers] = useState<MemberStruct[]>([]);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState<boolean>(false);

  const mountRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

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
      area = dimB * dimH;
      const Ix = (dimB * Math.pow(dimH, 3)) / 12;
      ry = Math.sqrt(Math.max(Ix / area, 0.1));
    }

    setSectionProps({
      type: secType, b: dimB, h: dimH, t: dimT, tw: dimTw,
      area: Math.round(area), ry: Number(ry.toFixed(2)),
    });
  }, [secType, dimB, dimH, dimT, dimTw]);

  // --- PARAMETRIC GEOMETRY GENERATOR & UDL CONVERTER ---
  useEffect(() => {
    const newNodes: NodeStruct[] = [];
    const newMembers: MemberStruct[] = [];

    const Lx = Math.max(spanX, 1);
    const Ly = Math.max(spanY, 1);
    const H = Math.max(trussHeight, 0.5);
    const Nx = Math.max(baysX, 1);
    const Ny = Math.max(baysY, 1);
    const Rings = Math.max(domeRings, 2);

    if (dimMode === '2D') {
      // ---------------- 2D EXPANDED TOPOLOGIES & CHORD UDL ----------------
      const dx = Lx / Nx;

      // Bottom Chord Nodes
      for (let i = 0; i <= Nx; i++) {
        let supp: SupportType = 'FREE';
        if (i === 0) supp = 'PINNED';
        if (i === Nx) supp = 'ROLLER_X';

        newNodes.push({
          id: i + 1,
          x: Number((i * dx).toFixed(2)),
          y: 0,
          z: 0,
          support: supp,
          fx: i === 0 ? windLoadX : 0,
          fy: 0,
          fz: 0,
          chordType: 'BOTTOM',
        });
      }

      // Top Chord Nodes
      for (let i = 0; i <= Nx; i++) {
        const ratio = i / Nx;
        let nodeY = H;

        if (topology2D === 'fink' || topology2D === 'scissors' || topology2D === 'king_post' || topology2D === 'queen_post') {
          nodeY = (1 - Math.abs((i - Nx / 2) / (Nx / 2))) * H;
          if (topology2D === 'scissors') nodeY += H * 0.25;
        } else if (topology2D === 'gambrel') {
          const absX = Math.abs(ratio - 0.5);
          nodeY = absX > 0.25 ? H * (1 - (absX - 0.25) * 2.5) : H;
        } else if (topology2D === 'bowstring') {
          nodeY = 4 * H * ratio * (1 - ratio); // Parabolic Arch
        }

        newNodes.push({
          id: Nx + 1 + i + 1,
          x: Number((i * dx).toFixed(2)),
          y: Number(nodeY.toFixed(2)),
          z: 0,
          support: 'FREE',
          fx: 0,
          fy: 0,
          fz: 0,
          chordType: 'TOP',
        });
      }

      // Apply Statically Equivalent Nodal Loads from UDLs
      for (let i = 0; i <= Nx; i++) {
        let tribLen = dx;
        if (i === 0 || i === Nx) tribLen = dx / 2;

        // Bottom Chord Node UDL load
        newNodes[i].fy -= udlBottomChord * tribLen;

        // Top Chord Node UDL load
        newNodes[Nx + 1 + i].fy -= udlTopChord * tribLen;
      }

      // Connect Members
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
            // Warren, Fink, Bowstring, Scissors
            newMembers.push({ id: ++mId, startNode: bNode, endNode: tNode + 1 });
          }
        }
      }
    } else {
      // ---------------- 3D SPATIAL TOPOLOGIES ----------------
      let nId = 0;
      let mId = 0;

      if (topology3D === 'flat_grid') {
        // 1. FLAT SPACE GRID (Double-Layer)
        const stepX = Lx / Nx;
        const stepY = Ly / Ny;

        // Bottom Grid (Z = 0)
        for (let i = 0; i <= Nx; i++) {
          for (let j = 0; j <= Ny; j++) {
            const isCorner = (i === 0 || i === Nx) && (j === 0 || j === Ny);
            newNodes.push({
              id: ++nId,
              x: Number((i * stepX).toFixed(2)),
              y: Number((j * stepY).toFixed(2)),
              z: 0,
              support: isCorner ? 'PINNED' : 'FREE',
              fx: 0, fy: 0, fz: 0, chordType: 'BOTTOM',
            });
          }
        }
        const numBottom = newNodes.length;

        // Top Grid (Z = H)
        for (let i = 0; i < Nx; i++) {
          for (let j = 0; j < Ny; j++) {
            newNodes.push({
              id: ++nId,
              x: Number(((i + 0.5) * stepX).toFixed(2)),
              y: Number(((j + 0.5) * stepY).toFixed(2)),
              z: H,
              support: 'FREE',
              fx: 0, fy: 0, fz: pointLoadZ, chordType: 'TOP',
            });
          }
        }

        const getNodeIdx = (i: number, j: number) => i * (Ny + 1) + j + 1;
        // Bottom Chord Members
        for (let i = 0; i <= Nx; i++) {
          for (let j = 0; j <= Ny; j++) {
            if (i < Nx) newMembers.push({ id: ++mId, startNode: getNodeIdx(i, j), endNode: getNodeIdx(i + 1, j) });
            if (j < Ny) newMembers.push({ id: ++mId, startNode: getNodeIdx(i, j), endNode: getNodeIdx(i, j + 1) });
          }
        }

        // Web Diagonals to Top Grid
        let topIdCounter = numBottom + 1;
        for (let i = 0; i < Nx; i++) {
          for (let j = 0; j < Ny; j++) {
            const topId = topIdCounter++;
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
      } else if (topology3D === 'pyramidal') {
        // 2. PYRAMIDAL SPACE TRUSS
        const stepX = Lx / Nx;
        const stepY = Ly / Ny;

        for (let i = 0; i <= Nx; i++) {
          for (let j = 0; j <= Ny; j++) {
            const isBound = i === 0 || i === Nx || j === 0 || j === Ny;
            newNodes.push({
              id: ++nId,
              x: Number((i * stepX).toFixed(2)),
              y: Number((j * stepY).toFixed(2)),
              z: 0,
              support: isBound ? 'PINNED' : 'FREE',
              fx: 0, fy: 0, fz: 0, chordType: 'BOTTOM',
            });
          }
        }
        const numBase = newNodes.length;

        // Pyramid Apex Nodes
        for (let i = 0; i < Nx; i++) {
          for (let j = 0; j < Ny; j++) {
            newNodes.push({
              id: ++nId,
              x: Number(((i + 0.5) * stepX).toFixed(2)),
              y: Number(((j + 0.5) * stepY).toFixed(2)),
              z: H,
              support: 'FREE',
              fx: 0, fy: 0, fz: pointLoadZ, chordType: 'APEX',
            });
          }
        }

        const getBaseIdx = (i: number, j: number) => i * (Ny + 1) + j + 1;
        let apexCounter = numBase + 1;

        for (let i = 0; i < Nx; i++) {
          for (let j = 0; j < Ny; j++) {
            const apexId = apexCounter++;
            const b1 = getBaseIdx(i, j);
            const b2 = getBaseIdx(i + 1, j);
            const b3 = getBaseIdx(i + 1, j + 1);
            const b4 = getBaseIdx(i, j + 1);

            // Pyramid Base Edges
            newMembers.push({ id: ++mId, startNode: b1, endNode: b2 });
            newMembers.push({ id: ++mId, startNode: b2, endNode: b3 });
            newMembers.push({ id: ++mId, startNode: b3, endNode: b4 });
            newMembers.push({ id: ++mId, startNode: b4, endNode: b1 });

            // Pyramid Diagonal Legs
            newMembers.push({ id: ++mId, startNode: b1, endNode: apexId });
            newMembers.push({ id: ++mId, startNode: b2, endNode: apexId });
            newMembers.push({ id: ++mId, startNode: b3, endNode: apexId });
            newMembers.push({ id: ++mId, startNode: b4, endNode: apexId });
          }
        }
      } else if (topology3D === 'prismatic') {
        // 3. PRISMATIC SPACE TRUSS (Triangular Cross-Section Beam)
        const stepX = Lx / Nx;

        for (let i = 0; i <= Nx; i++) {
          const x = Number((i * stepX).toFixed(2));
          const isEnd = i === 0 || i === Nx;

          // Bottom Left
          newNodes.push({ id: ++nId, x, y: -Ly / 2, z: 0, support: isEnd ? 'PINNED' : 'FREE', fx: 0, fy: 0, fz: 0, chordType: 'BOTTOM' });
          // Bottom Right
          newNodes.push({ id: ++nId, x, y: Ly / 2, z: 0, support: isEnd ? 'PINNED' : 'FREE', fx: 0, fy: 0, fz: 0, chordType: 'BOTTOM' });
          // Top Apex
          newNodes.push({ id: ++nId, x, y: 0, z: H, support: 'FREE', fx: 0, fy: 0, fz: pointLoadZ, chordType: 'TOP' });
        }

        for (let i = 0; i < Nx; i++) {
          const b1 = i * 3 + 1;
          const b2 = i * 3 + 2;
          const t1 = i * 3 + 3;

          const b1_next = (i + 1) * 3 + 1;
          const b2_next = (i + 1) * 3 + 2;
          const t1_next = (i + 1) * 3 + 3;

          // Longitudinal Chords
          newMembers.push({ id: ++mId, startNode: b1, endNode: b1_next });
          newMembers.push({ id: ++mId, startNode: b2, endNode: b2_next });
          newMembers.push({ id: ++mId, startNode: t1, endNode: t1_next });

          // Cross Triangles
          newMembers.push({ id: ++mId, startNode: b1, endNode: b2 });
          newMembers.push({ id: ++mId, startNode: b1, endNode: t1 });
          newMembers.push({ id: ++mId, startNode: b2, endNode: t1 });

          // Space Diagonals
          newMembers.push({ id: ++mId, startNode: b1, endNode: t1_next });
          newMembers.push({ id: ++mId, startNode: b2, endNode: t1_next });
        }
      } else if (topology3D === 'barrel_vault') {
        // 4. BARREL VAULT SPACE TRUSS
        const stepY = Ly / Ny;

        for (let j = 0; j <= Ny; j++) {
          const y = Number((j * stepY).toFixed(2));

          for (let i = 0; i <= Nx; i++) {
            const theta = (i / Nx) * Math.PI;
            const rx = (Lx / 2) * Math.cos(theta);
            const rz = H * Math.sin(theta);
            const isBound = i === 0 || i === Nx;

            // Inner Arch Shell
            newNodes.push({
              id: ++nId, x: Number(rx.toFixed(2)), y, z: Number(rz.toFixed(2)),
              support: isBound ? 'PINNED' : 'FREE', fx: 0, fy: 0, fz: 0, chordType: 'BOTTOM'
            });

            // Outer Arch Shell
            newNodes.push({
              id: ++nId, x: Number((rx * 1.15).toFixed(2)), y, z: Number((rz * 1.15).toFixed(2)),
              support: 'FREE', fx: 0, fy: 0, fz: pointLoadZ / 2, chordType: 'TOP'
            });
          }
        }

        const nodesPerRing = (Nx + 1) * 2;
        for (let j = 0; j < Ny; j++) {
          for (let i = 0; i <= Nx; i++) {
            const nCurrInner = j * nodesPerRing + i * 2 + 1;
            const nCurrOuter = nCurrInner + 1;
            const nNextInner = (j + 1) * nodesPerRing + i * 2 + 1;
            const nNextOuter = nNextInner + 1;

            // Shell & Web Links
            newMembers.push({ id: ++mId, startNode: nCurrInner, endNode: nCurrOuter });
            newMembers.push({ id: ++mId, startNode: nCurrInner, endNode: nNextInner });
            newMembers.push({ id: ++mId, startNode: nCurrOuter, endNode: nNextOuter });
            newMembers.push({ id: ++mId, startNode: nCurrInner, endNode: nNextOuter });
          }
        }
      } else {
        // 5. SPHERICAL DOME TRUSS
        const R = Lx / 2;

        // Top Apex Joint
        newNodes.push({ id: ++nId, x: 0, y: 0, z: H, support: 'FREE', fx: 0, fy: 0, fz: pointLoadZ, chordType: 'APEX' });

        for (let r = 1; r <= Rings; r++) {
          const phi = (r / Rings) * (Math.PI / 2.2);
          const ringRadius = R * Math.sin(phi);
          const ringZ = H * Math.cos(phi);
          const isBaseRing = r === Rings;

          const ringNodesCount = 6 * r;
          for (let k = 0; k < ringNodesCount; k++) {
            const alpha = (k / ringNodesCount) * 2 * Math.PI;
            const rx = ringRadius * Math.cos(alpha);
            const ry = ringRadius * Math.sin(alpha);

            newNodes.push({
              id: ++nId, x: Number(rx.toFixed(2)), y: Number(ry.toFixed(2)), z: Number(ringZ.toFixed(2)),
              support: isBaseRing ? 'PINNED' : 'FREE', fx: 0, fy: 0, fz: isBaseRing ? 0 : pointLoadZ / 2, chordType: 'TOP'
            });
          }
        }

        // Connect Apex to First Ring
        for (let i = 2; i <= 7; i++) {
          newMembers.push({ id: ++mId, startNode: 1, endNode: i });
          newMembers.push({ id: ++mId, startNode: i, endNode: i === 7 ? 2 : i + 1 });
        }
      }
    }

    setNodes(newNodes);
    setMembers(newMembers);
    if (newNodes.length > 0) setSelectedNodeId(newNodes[0].id);
  }, [dimMode, topology2D, topology3D, spanX, spanY, trussHeight, baysX, baysY, domeRings, udlTopChord, udlBottomChord, windLoadX, pointLoadZ]);

  const createTextSprite = (text: string, color = '#38bdf8') => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = color;
      ctx.font = 'Bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 64, 32);
    }
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(0.7, 0.35, 1);
    return sprite;
  };

  // --- THREE.JS ENGINE WITH ORBIT CONTROLS ---
  useEffect(() => {
    if (!mountRef.current || nodes.length === 0) return;

    const width = mountRef.current.clientWidth || 500;
    const height = 340;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0f172a');

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);

    mountRef.current.innerHTML = '';
    mountRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;

    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(20, 40, 30);
    scene.add(dirLight);

    const cx = nodes.reduce((s, n) => s + n.x, 0) / nodes.length;
    const cy = nodes.reduce((s, n) => s + n.y, 0) / nodes.length;
    const cz = nodes.reduce((s, n) => s + n.z, 0) / nodes.length;

    if (dimMode === '2D') {
      camera.position.set(cx, cy + 0.2, spanX * 1.5);
      controls.target.set(cx, cy, 0);
    } else {
      camera.position.set(cx + spanX * 1.4, cy + spanY * 1.4, cz + trussHeight * 2);
      controls.target.set(cx, cy, cz);
    }
    controls.update();

    if (showGrid) {
      const grid = new THREE.GridHelper(Math.max(spanX, spanY) * 2.5, 20, 0x38bdf8, 0x334155);
      grid.position.set(cx, 0, cz);
      if (dimMode === '2D') grid.rotation.x = Math.PI / 2;
      scene.add(grid);

      const axes = new THREE.AxesHelper(2);
      scene.add(axes);
    }

    // Render Nodes & Support Indicators
    nodes.forEach((n) => {
      const isSelected = n.id === selectedNodeId;
      const nodeGeo = new THREE.SphereGeometry(isSelected ? 0.22 : 0.15, 16, 16);
      const nodeMat = new THREE.MeshStandardMaterial({ color: isSelected ? 0x38bdf8 : 0xf59e0b });
      const sphere = new THREE.Mesh(nodeGeo, nodeMat);
      sphere.position.set(n.x, n.y, n.z);
      scene.add(sphere);

      if (showNodeLabels) {
        const label = createTextSprite(`N${n.id}`, isSelected ? '#38bdf8' : '#f8fafc');
        label.position.set(n.x, n.y + 0.35, n.z);
        scene.add(label);
      }

      if (n.support === 'PINNED') {
        const coneGeo = new THREE.ConeGeometry(0.22, 0.45, 8);
        const coneMat = new THREE.MeshStandardMaterial({ color: 0x10b981 });
        const cone = new THREE.Mesh(coneGeo, coneMat);
        cone.position.set(n.x, n.y - 0.22, n.z);
        scene.add(cone);
      } else if (n.support === 'ROLLER_X' || n.support === 'ROLLER_Y') {
        const rollerGroup = new THREE.Group();
        const pyramid = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.35, 4), new THREE.MeshStandardMaterial({ color: 0xfacc15 }));
        pyramid.position.set(n.x, n.y - 0.17, n.z);
        rollerGroup.add(pyramid);

        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.3, 8), new THREE.MeshStandardMaterial({ color: 0x94a3b8 }));
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(n.x, n.y - 0.38, n.z);
        rollerGroup.add(wheel);

        scene.add(rollerGroup);
      }

      const loadVec = new THREE.Vector3(n.fx, n.fy, n.fz);
      const loadMag = loadVec.length();
      if (loadMag > 0) {
        const dir = loadVec.clone().normalize();
        const arrow = new THREE.ArrowHelper(dir, new THREE.Vector3(n.x, n.y, n.z), Math.min(loadMag * 0.04, 1.8), 0xef4444, 0.35, 0.25);
        scene.add(arrow);
      }
    });

    // Render Members & Member Stress Coloring
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
        if (res.dcr > 1.0) color = 0xef4444;
        else if (res.dcr > 0.7) color = 0xfacc15;
        else color = res.state === 'TENSION' ? 0x38bdf8 : 0x10b981;
      }

      const cylinderGeo = new THREE.CylinderGeometry(0.045, 0.045, dist, 8);
      const cylinderMat = new THREE.MeshStandardMaterial({ color });
      const cylinder = new THREE.Mesh(cylinderGeo, cylinderMat);

      const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      cylinder.position.copy(mid);
      cylinder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p2.clone().sub(p1).normalize());
      scene.add(cylinder);

      if (showMemberLabels) {
        const memLabel = createTextSprite(`M${mem.id}`, '#cbd5e1');
        memLabel.position.copy(mid).add(new THREE.Vector3(0, 0.2, 0));
        scene.add(memLabel);
      }
    });

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (autoRotate && dimMode === '3D') scene.rotation.z += 0.003;
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      renderer.dispose();
    };
  }, [nodes, members, result, dimMode, spanX, spanY, trussHeight, selectedNodeId, showNodeLabels, showMemberLabels, showGrid, autoRotate]);

  const setCameraView = (view: 'FRONT' | 'TOP' | 'ISO') => {
    if (!cameraRef.current || !controlsRef.current || nodes.length === 0) return;
    const cx = nodes.reduce((s, n) => s + n.x, 0) / nodes.length;
    const cy = nodes.reduce((s, n) => s + n.y, 0) / nodes.length;
    const cz = nodes.reduce((s, n) => s + n.z, 0) / nodes.length;

    if (view === 'FRONT') {
      cameraRef.current.position.set(cx, cy, spanX * 1.6);
    } else if (view === 'TOP') {
      cameraRef.current.position.set(cx, cy + spanX * 1.5, 0.1);
    } else {
      cameraRef.current.position.set(cx + spanX * 1.2, cy + spanY * 1.2, cz + trussHeight * 1.8);
    }
    controlsRef.current.target.set(cx, cy, cz);
    controlsRef.current.update();
  };

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
        dimMode, code: designCode, displacements: displArray, reactions: reactArray,
        memberResults, maxDcr, overallStatus: maxDcr <= 1.0 ? 'SAFE' : 'OVERSTRESSED', governingMember: govMem,
      });
    } catch (e) {
      console.error(e);
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

  const handleExportPDF = () => {
    if (!result) return;
    const doc = new jsPDF('portrait', 'mm', 'a4');

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text('Structural Space Truss Analysis Report', 14, 15);

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(9);
    doc.text(`Dimension Mode: ${result.dimMode}`, 14, 32);
    doc.text(`Topology: ${dimMode === '2D' ? topology2D : topology3D}`, 14, 37);
    doc.text(`Design Standard: ${result.code}`, 14, 42);
    doc.text(`Section Profile: ${sectionProps.type} (${sectionProps.b}x${sectionProps.h}x${sectionProps.t} mm)`, 14, 47);

    doc.setFontSize(10);
    doc.text(`Overall Status: ${result.overallStatus}`, 130, 32);
    doc.text(`Max DCR: ${result.maxDcr}`, 130, 37);

    const memberRows = result.memberResults.map((m) => [
      `M${m.id}`, `${m.length} m`, `${m.axialForce} kN`, m.state, `${m.capacity} kN`, `${m.slenderness}`, `${m.dcr}`, m.status,
    ]);

    autoTable(doc, {
      startY: 52,
      margin: { left: 14, right: 14 },
      head: [['Member', 'Length', 'Axial Force', 'State', 'Capacity', 'KL/r', 'DCR', 'Status']],
      body: memberRows,
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [15, 23, 42] },
    });

    doc.save(`Truss_Report_${result.dimMode}.pdf`);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 font-sans text-slate-200">
      {/* Controls Panel */}
      <div className="lg:col-span-5 space-y-4 bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-xl">
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
            {dimMode === '2D' ? '2D Truss Presets' : '3D Spatial Presets'}
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
              <option value="queen_post">Queen Post Truss</option>
              <option value="gambrel">Gambrel Barn Truss</option>
              <option value="ktruss">K-Truss Topology</option>
              <option value="bowstring">Bowstring (Parabolic Arch)</option>
            </select>
          ) : (
            <select
              value={topology3D}
              onChange={(e) => setTopology3D(e.target.value as Topology3D)}
              className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs font-medium text-cyan-400"
            >
              <option value="flat_grid">Flat Space Grid / Frame</option>
              <option value="pyramidal">Pyramidal Space Frame</option>
              <option value="prismatic">Prismatic Triangular Truss</option>
              <option value="barrel_vault">Barrel Vault Space Truss</option>
              <option value="spherical_dome">Spherical Dome Truss</option>
            </select>
          )}
        </div>

        {/* Loading Configuration Panel */}
        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
          <span className="text-xs font-bold text-amber-400 block">Targeted Loading Engine</span>
          {dimMode === '2D' ? (
            <div className="grid grid-cols-3 gap-2 text-xs font-mono">
              <div>
                <span className="text-slate-400 block text-[10px]">Top UDL (kN/m)</span>
                <input type="number" value={udlTopChord} onChange={e => setUdlTopChord(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded p-1" />
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Bot UDL (kN/m)</span>
                <input type="number" value={udlBottomChord} onChange={e => setUdlBottomChord(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded p-1" />
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Wind Fx (kN)</span>
                <input type="number" value={windLoadX} onChange={e => setWindLoadX(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded p-1" />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div>
                <span className="text-slate-400 block text-[10px]">Top Joint Load Fz (kN)</span>
                <input type="number" value={pointLoadZ} onChange={e => setPointLoadZ(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded p-1" />
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Dome Rings</span>
                <input type="number" value={domeRings} onChange={e => setDomeRings(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded p-1" />
              </div>
            </div>
          )}
        </div>

        {/* Section Profile Calculator */}
        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-cyan-400">Section Profile Calculator</span>
            <select
              value={secType}
              onChange={(e) => setSecType(e.target.value as SectionType)}
              className="bg-slate-900 border border-slate-800 text-xs rounded px-2 py-0.5"
            >
              <option value="RHS">RHS Box</option>
              <option value="CHS">CHS Pipe</option>
              <option value="IBEAM">I-Beam</option>
              <option value="ANGLE">Angle</option>
              <option value="RECT_SOLID">Solid Rect</option>
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

        <button
          onClick={handleRunAnalysis}
          disabled={analyzing}
          className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold py-2.5 rounded transition shadow-lg shadow-cyan-500/20"
        >
          {analyzing ? 'Solving Structural Matrix...' : `Run ${dimMode} Structural Analysis`}
        </button>
      </div>

      {/* Canvas Viewport & Results Output */}
      <div className="lg:col-span-7 space-y-6">
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
          <div className="flex justify-between items-center mb-2 border-b border-slate-800 pb-2">
            <h4 className="text-xs font-bold text-slate-300">
              THREE.JS VIEWPORT (DRAG TO ORBIT)
            </h4>
            <div className="flex space-x-1">
              <button onClick={() => setCameraView('FRONT')} className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold rounded">Front</button>
              <button onClick={() => setCameraView('TOP')} className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold rounded">Top</button>
              <button onClick={() => setCameraView('ISO')} className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold rounded">ISO</button>
            </div>
          </div>
          <div ref={mountRef} className="bg-slate-950 rounded border border-slate-800 overflow-hidden flex justify-center cursor-grab active:cursor-grabbing" />
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
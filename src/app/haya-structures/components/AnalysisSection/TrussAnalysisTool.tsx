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
  fx: number;
  fy: number;
  fz: number;
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
  ry: number;   // mm
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

interface NodalDisplacement {
  node: number;
  ux: number;
  uy: number;
  uz: number;
  uTotal: number;
}

interface AnalysisResult {
  dimMode: DimensionMode;
  code: DesignCode;
  displacements: NodalDisplacement[];
  maxDisplacement: number;
  maxDispNode: number;
  reactions: { node: number; rx: number; ry: number; rz: number }[];
  memberResults: MemberResult[];
  maxDcr: number;
  overallStatus: 'SAFE' | 'OVERSTRESSED';
  governingMember: number;
  totalWeightKg: number;
}

interface BaySweepResult {
  bays: number;
  bayWidth: number;
  maxDcr: number;
  maxDeflectionMm: number;
  totalWeightKg: number;
  status: 'SAFE' | 'OVERSTRESSED';
  isOptimal?: boolean;
}

interface CustomNodeLoad {
  fx: number;
  fy: number;
  fz: number;
}

export default function UnifiedTrussTool() {
  const [dimMode, setDimMode] = useState<DimensionMode>('2D');
  const [designCode, setDesignCode] = useState<DesignCode>('AISC360');

  // Topologies
  const [topology2D, setTopology2D] = useState<Topology2D>('pratt');
  const [topology3D, setTopology3D] = useState<Topology3D>('flat_grid');

  // Geometry Parameters
  const [spanX, setSpanX] = useState<number>(18);
  const [spanY, setSpanY] = useState<number>(6);
  const [trussHeight, setTrussHeight] = useState<number>(2.5);
  const [baysX, setBaysX] = useState<number>(6);
  const [baysY, setBaysY] = useState<number>(3);
  const [domeRings, setDomeRings] = useState<number>(4);

  // Bay Iteration Sweep Controls
  const [sweepMinBays, setSweepMinBays] = useState<number>(2);
  const [sweepMaxBays, setSweepMaxBays] = useState<number>(12);
  const [sweepResults, setSweepResults] = useState<BaySweepResult[]>([]);
  const [isSweeping, setIsSweeping] = useState<boolean>(false);

  // UDL Loading Patterns
  const [udlTopChord, setUdlTopChord] = useState<number>(8.5);
  const [udlBottomChord, setUdlBottomChord] = useState<number>(2.0);

  // Selective Node Loading
  const [targetLoadNodeId, setTargetLoadNodeId] = useState<number>(1);
  const [customFx, setCustomFx] = useState<number>(0);
  const [customFy, setCustomFy] = useState<number>(-10);
  const [customFz, setCustomFz] = useState<number>(0);
  const [customNodeLoads, setCustomNodeLoads] = useState<Record<number, CustomNodeLoad>>({});

  // Deflected Shape Visualization
  const [showDeformation, setShowDeformation] = useState<boolean>(false);
  const [defScale, setDefScale] = useState<number>(100);

  // Visual Controls
  const [showNodeLabels, setShowNodeLabels] = useState<boolean>(true);
  const [showMemberLabels, setShowMemberLabels] = useState<boolean>(false);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [activeResultTab, setActiveResultTab] = useState<'members' | 'displacements'>('members');

  // Section Properties
  const [secType, setSecType] = useState<SectionType>('RHS');
  const [dimB, setDimB] = useState<number>(100);
  const [dimH, setDimH] = useState<number>(100);
  const [dimT, setDimT] = useState<number>(5);
  const [dimTw, setDimTw] = useState<number>(5);
  const [fy, setFy] = useState<number>(355);
  const [modulusE, setModulusE] = useState<number>(210000);

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
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  // Section Calculator
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

  // Parametric Geometry Generator (Corrected Y-UP Coordinate System)
  const generateTrussGeometry = (
    currentSpanX: number,
    currentSpanY: number,
    currentHeight: number,
    currentBaysX: number,
    currentBaysY: number,
    currentRings: number
  ) => {
    const newNodes: NodeStruct[] = [];
    const newMembers: MemberStruct[] = [];

    const Lx = Math.max(currentSpanX, 1);
    const Ly = Math.max(currentSpanY, 1);
    const H = Math.max(currentHeight, 0.2);
    const Nx = Math.max(currentBaysX, 1);
    const Ny = Math.max(currentBaysY, 1);
    const Rings = Math.max(currentRings, 2);

    if (dimMode === '2D') {
      const dx = Lx / Nx;

      // Bottom Chord Nodes (Y = 0)
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
          fx: 0,
          fy: 0,
          fz: 0,
          chordType: 'BOTTOM',
        });
      }

      // Top Chord Nodes (Y = Height)
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
          nodeY = 4 * H * ratio * (1 - ratio);
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

      // Apply UDL loads
      for (let i = 0; i <= Nx; i++) {
        let tribLen = dx;
        if (i === 0 || i === Nx) tribLen = dx / 2;

        newNodes[i].fy -= udlBottomChord * tribLen;
        newNodes[Nx + 1 + i].fy -= udlTopChord * tribLen;
      }

      // Member Connectivity
      let mId = 0;
      for (let i = 0; i < Nx; i++) {
        newMembers.push({ id: ++mId, startNode: i + 1, endNode: i + 2 });
        newMembers.push({ id: ++mId, startNode: Nx + 2 + i, endNode: Nx + 3 + i });
      }

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
            newMembers.push({ id: ++mId, startNode: bNode, endNode: tNode + 1 });
          }
        }
      }
    } else {
      // 3D Spatial Topologies (Mapped with Y = Vertical Elevation, X/Z = Ground Plane)
      let nId = 0;
      let mId = 0;

      if (topology3D === 'flat_grid') {
        const stepX = Lx / Nx;
        const stepZ = Ly / Ny;

        for (let i = 0; i <= Nx; i++) {
          for (let j = 0; j <= Ny; j++) {
            const isCorner = (i === 0 || i === Nx) && (j === 0 || j === Ny);
            newNodes.push({
              id: ++nId,
              x: Number((i * stepX).toFixed(2)),
              y: 0,
              z: Number((j * stepZ - Ly / 2).toFixed(2)),
              support: isCorner ? 'PINNED' : 'FREE', fx: 0, fy: 0, fz: 0, chordType: 'BOTTOM'
            });
          }
        }
        const numBottom = newNodes.length;

        for (let i = 0; i < Nx; i++) {
          for (let j = 0; j < Ny; j++) {
            newNodes.push({
              id: ++nId,
              x: Number(((i + 0.5) * stepX).toFixed(2)),
              y: H,
              z: Number(((j + 0.5) * stepZ - Ly / 2).toFixed(2)),
              support: 'FREE', fx: 0, fy: 0, fz: 0, chordType: 'TOP'
            });
          }
        }

        const getNodeIdx = (i: number, j: number) => i * (Ny + 1) + j + 1;
        for (let i = 0; i <= Nx; i++) {
          for (let j = 0; j <= Ny; j++) {
            if (i < Nx) newMembers.push({ id: ++mId, startNode: getNodeIdx(i, j), endNode: getNodeIdx(i + 1, j) });
            if (j < Ny) newMembers.push({ id: ++mId, startNode: getNodeIdx(i, j), endNode: getNodeIdx(i, j + 1) });
          }
        }

        let topIdCounter = numBottom + 1;
        for (let i = 0; i < Nx; i++) {
          for (let j = 0; j < Ny; j++) {
            const topId = topIdCounter++;
            const b1 = getNodeIdx(i, j); const b2 = getNodeIdx(i + 1, j);
            const b3 = getNodeIdx(i + 1, j + 1); const b4 = getNodeIdx(i, j + 1);
            newMembers.push({ id: ++mId, startNode: b1, endNode: topId });
            newMembers.push({ id: ++mId, startNode: b2, endNode: topId });
            newMembers.push({ id: ++mId, startNode: b3, endNode: topId });
            newMembers.push({ id: ++mId, startNode: b4, endNode: topId });
          }
        }
      } else if (topology3D === 'pyramidal') {
        const stepX = Lx / Nx;
        const stepZ = Ly / Ny;

        for (let i = 0; i <= Nx; i++) {
          for (let j = 0; j <= Ny; j++) {
            const isBound = i === 0 || i === Nx || j === 0 || j === Ny;
            newNodes.push({
              id: ++nId,
              x: Number((i * stepX).toFixed(2)),
              y: 0,
              z: Number((j * stepZ - Ly / 2).toFixed(2)),
              support: isBound ? 'PINNED' : 'FREE', fx: 0, fy: 0, fz: 0, chordType: 'BOTTOM'
            });
          }
        }
        const numBase = newNodes.length;

        for (let i = 0; i < Nx; i++) {
          for (let j = 0; j < Ny; j++) {
            newNodes.push({
              id: ++nId,
              x: Number(((i + 0.5) * stepX).toFixed(2)),
              y: H,
              z: Number(((j + 0.5) * stepZ - Ly / 2).toFixed(2)),
              support: 'FREE', fx: 0, fy: 0, fz: 0, chordType: 'APEX'
            });
          }
        }

        const getBaseIdx = (i: number, j: number) => i * (Ny + 1) + j + 1;
        let apexCounter = numBase + 1;

        for (let i = 0; i < Nx; i++) {
          for (let j = 0; j < Ny; j++) {
            const apexId = apexCounter++;
            const b1 = getBaseIdx(i, j); const b2 = getBaseIdx(i + 1, j);
            const b3 = getBaseIdx(i + 1, j + 1); const b4 = getBaseIdx(i, j + 1);

            newMembers.push({ id: ++mId, startNode: b1, endNode: b2 });
            newMembers.push({ id: ++mId, startNode: b2, endNode: b3 });
            newMembers.push({ id: ++mId, startNode: b3, endNode: b4 });
            newMembers.push({ id: ++mId, startNode: b4, endNode: b1 });

            newMembers.push({ id: ++mId, startNode: b1, endNode: apexId });
            newMembers.push({ id: ++mId, startNode: b2, endNode: apexId });
            newMembers.push({ id: ++mId, startNode: b3, endNode: apexId });
            newMembers.push({ id: ++mId, startNode: b4, endNode: apexId });
          }
        }
      } else if (topology3D === 'prismatic') {
        const stepX = Lx / Nx;

        for (let i = 0; i <= Nx; i++) {
          const x = Number((i * stepX).toFixed(2));
          const isEnd = i === 0 || i === Nx;
          newNodes.push({ id: ++nId, x, y: 0, z: -Ly / 2, support: isEnd ? 'PINNED' : 'FREE', fx: 0, fy: 0, fz: 0, chordType: 'BOTTOM' });
          newNodes.push({ id: ++nId, x, y: 0, z: Ly / 2, support: isEnd ? 'PINNED' : 'FREE', fx: 0, fy: 0, fz: 0, chordType: 'BOTTOM' });
          newNodes.push({ id: ++nId, x, y: H, z: 0, support: 'FREE', fx: 0, fy: 0, fz: 0, chordType: 'TOP' });
        }

        for (let i = 0; i < Nx; i++) {
          const b1 = i * 3 + 1; const b2 = i * 3 + 2; const t1 = i * 3 + 3;
          const b1_next = (i + 1) * 3 + 1; const b2_next = (i + 1) * 3 + 2; const t1_next = (i + 1) * 3 + 3;

          newMembers.push({ id: ++mId, startNode: b1, endNode: b1_next });
          newMembers.push({ id: ++mId, startNode: b2, endNode: b2_next });
          newMembers.push({ id: ++mId, startNode: t1, endNode: t1_next });

          newMembers.push({ id: ++mId, startNode: b1, endNode: b2 });
          newMembers.push({ id: ++mId, startNode: b1, endNode: t1 });
          newMembers.push({ id: ++mId, startNode: b2, endNode: t1 });

          newMembers.push({ id: ++mId, startNode: b1, endNode: t1_next });
          newMembers.push({ id: ++mId, startNode: b2, endNode: t1_next });
        }
      } else if (topology3D === 'barrel_vault') {
        const stepZ = Ly / Ny;

        for (let j = 0; j <= Ny; j++) {
          const z = Number((j * stepZ - Ly / 2).toFixed(2));
          for (let i = 0; i <= Nx; i++) {
            const theta = (i / Nx) * Math.PI;
            const rx = (Lx / 2) * Math.cos(theta);
            const ry = H * Math.sin(theta);
            const isBound = i === 0 || i === Nx;

            newNodes.push({ id: ++nId, x: Number(rx.toFixed(2)), y: Number(ry.toFixed(2)), z, support: isBound ? 'PINNED' : 'FREE', fx: 0, fy: 0, fz: 0, chordType: 'BOTTOM' });
            newNodes.push({ id: ++nId, x: Number((rx * 1.15).toFixed(2)), y: Number((ry * 1.15).toFixed(2)), z, support: 'FREE', fx: 0, fy: 0, fz: 0, chordType: 'TOP' });
          }
        }

        const nodesPerRing = (Nx + 1) * 2;
        for (let j = 0; j < Ny; j++) {
          for (let i = 0; i <= Nx; i++) {
            const nCurrInner = j * nodesPerRing + i * 2 + 1;
            const nCurrOuter = nCurrInner + 1;
            const nNextInner = (j + 1) * nodesPerRing + i * 2 + 1;
            const nNextOuter = nNextInner + 1;

            newMembers.push({ id: ++mId, startNode: nCurrInner, endNode: nCurrOuter });
            newMembers.push({ id: ++mId, startNode: nCurrInner, endNode: nNextInner });
            newMembers.push({ id: ++mId, startNode: nCurrOuter, endNode: nNextOuter });
            newMembers.push({ id: ++mId, startNode: nCurrInner, endNode: nNextOuter });
          }
        }
      } else {
        // Spherical Dome
        const R = Lx / 2;
        newNodes.push({ id: ++nId, x: 0, y: H, z: 0, support: 'FREE', fx: 0, fy: 0, fz: 0, chordType: 'APEX' });

        for (let r = 1; r <= Rings; r++) {
          const phi = (r / Rings) * (Math.PI / 2.2);
          const ringRadius = R * Math.sin(phi);
          const ringY = H * Math.cos(phi);
          const isBaseRing = r === Rings;

          const ringNodesCount = 6 * r;
          for (let k = 0; k < ringNodesCount; k++) {
            const alpha = (k / ringNodesCount) * 2 * Math.PI;
            newNodes.push({
              id: ++nId,
              x: Number((ringRadius * Math.cos(alpha)).toFixed(2)),
              y: Number(ringY.toFixed(2)),
              z: Number((ringRadius * Math.sin(alpha)).toFixed(2)),
              support: isBaseRing ? 'PINNED' : 'FREE',
              fx: 0, fy: 0, fz: 0,
              chordType: 'TOP'
            });
          }
        }

        for (let i = 2; i <= 7; i++) {
          newMembers.push({ id: ++mId, startNode: 1, endNode: i });
          newMembers.push({ id: ++mId, startNode: i, endNode: i === 7 ? 2 : i + 1 });
        }
      }
    }

    // Apply Custom Selective Loads
    newNodes.forEach((node) => {
      const custom = customNodeLoads[node.id];
      if (custom) {
        node.fx += custom.fx;
        node.fy += custom.fy;
        node.fz += custom.fz;
      }
    });

    return { newNodes, newMembers };
  };

  useEffect(() => {
    const { newNodes, newMembers } = generateTrussGeometry(spanX, spanY, trussHeight, baysX, baysY, domeRings);
    setNodes(newNodes);
    setMembers(newMembers);
    if (newNodes.length > 0 && !targetLoadNodeId) setTargetLoadNodeId(newNodes[0].id);
  }, [dimMode, topology2D, topology3D, spanX, spanY, trussHeight, baysX, baysY, domeRings, udlTopChord, udlBottomChord, customNodeLoads]);

  const handleApplyCustomNodeLoad = () => {
    setCustomNodeLoads((prev) => ({
      ...prev,
      [targetLoadNodeId]: { fx: customFx, fy: customFy, fz: customFz },
    }));
  };

  const handleClearNodeLoad = (nodeId: number) => {
    setCustomNodeLoads((prev) => {
      const next = { ...prev };
      delete next[nodeId];
      return next;
    });
  };

  const handleResetAllNodeLoads = () => {
    setCustomNodeLoads({});
  };

  // Solver Engine
  const solveTrussSystem = (targetNodes: NodeStruct[], targetMembers: MemberStruct[]): AnalysisResult => {
    const totalDof = targetNodes.length * 3;
    const K_global = Array.from({ length: totalDof }, () => new Array(totalDof).fill(0));
    const F_global = new Array(totalDof).fill(0);

    targetNodes.forEach((node, idx) => {
      F_global[3 * idx] = node.fx;
      F_global[3 * idx + 1] = node.fy;
      F_global[3 * idx + 2] = node.fz;
    });

    let totalLengthM = 0;

    targetMembers.forEach((mem) => {
      const n1 = targetNodes.find((n) => n.id === mem.startNode)!;
      const n2 = targetNodes.find((n) => n.id === mem.endNode)!;
      const idx1 = targetNodes.findIndex((n) => n.id === mem.startNode);
      const idx2 = targetNodes.findIndex((n) => n.id === mem.endNode);

      const dx = n2.x - n1.x; const dy = n2.y - n1.y; const dz = n2.z - n1.z;
      const L = Math.max(Math.sqrt(dx * dx + dy * dy + dz * dz), 0.001);
      totalLengthM += L;

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

    targetNodes.forEach((node, idx) => {
      const fixX = node.support === 'PINNED' || node.support === 'ROLLER_Y';
      const fixY = node.support === 'PINNED' || node.support === 'ROLLER_X';
      const fixZ = node.support === 'PINNED' || dimMode === '2D';

      if (fixX) { K_bounded[3 * idx][3 * idx] += 1e12; F_bounded[3 * idx] = 0; }
      if (fixY) { K_bounded[3 * idx + 1][3 * idx + 1] += 1e12; F_bounded[3 * idx + 1] = 0; }
      if (fixZ) { K_bounded[3 * idx + 2][3 * idx + 2] += 1e12; F_bounded[3 * idx + 2] = 0; }
    });

    const U = solveMatrix(K_bounded, F_bounded);

    const memberResults: MemberResult[] = targetMembers.map((mem) => {
      const n1 = targetNodes.find((n) => n.id === mem.startNode)!;
      const n2 = targetNodes.find((n) => n.id === mem.endNode)!;
      const idx1 = targetNodes.findIndex((n) => n.id === mem.startNode);
      const idx2 = targetNodes.findIndex((n) => n.id === mem.endNode);

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

    const totalVolumeM3 = (sectionProps.area / 1e6) * totalLengthM;
    const totalWeightKg = Number((totalVolumeM3 * 7850).toFixed(1));

    let maxDispVal = 0;
    let maxDispNodeId = 1;

    const displArray: NodalDisplacement[] = targetNodes.map((n, idx) => {
      const ux = U[3 * idx] * 1000;
      const uy = U[3 * idx + 1] * 1000;
      const uz = U[3 * idx + 2] * 1000;
      const uTotal = Math.sqrt(ux * ux + uy * uy + uz * uz);

      if (uTotal > maxDispVal) {
        maxDispVal = uTotal;
        maxDispNodeId = n.id;
      }

      return {
        node: n.id,
        ux: Number(ux.toFixed(2)),
        uy: Number(uy.toFixed(2)),
        uz: Number(uz.toFixed(2)),
        uTotal: Number(uTotal.toFixed(2)),
      };
    });

    const reactArray = targetNodes.map((n, idx) => ({
      node: n.id,
      rx: Number((-1 * F_bounded[3 * idx]).toFixed(1)),
      ry: Number((-1 * F_bounded[3 * idx + 1]).toFixed(1)),
      rz: Number((-1 * F_bounded[3 * idx + 2]).toFixed(1)),
    }));

    return {
      dimMode,
      code: designCode,
      displacements: displArray,
      maxDisplacement: Number(maxDispVal.toFixed(2)),
      maxDispNode: maxDispNodeId,
      reactions: reactArray,
      memberResults,
      maxDcr,
      overallStatus: maxDcr <= 1.0 ? 'SAFE' : 'OVERSTRESSED',
      governingMember: govMem,
      totalWeightKg,
    };
  };

  const handleRunSingleAnalysis = () => {
    setAnalyzing(true);
    try {
      const res = solveTrussSystem(nodes, members);
      setResult(res);
    } catch (e) {
      console.error(e);
      alert('Error calculating structural matrix.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleRunBayOptimizationSweep = () => {
    setIsSweeping(true);
    const results: BaySweepResult[] = [];

    const minB = Math.max(2, sweepMinBays);
    const maxB = Math.max(minB + 1, sweepMaxBays);

    for (let b = minB; b <= maxB; b++) {
      const { newNodes, newMembers } = generateTrussGeometry(spanX, spanY, trussHeight, b, baysY, domeRings);
      try {
        const res = solveTrussSystem(newNodes, newMembers);
        results.push({
          bays: b,
          bayWidth: Number((spanX / b).toFixed(2)),
          maxDcr: res.maxDcr,
          maxDeflectionMm: res.maxDisplacement,
          totalWeightKg: res.totalWeightKg,
          status: res.overallStatus,
        });
      } catch (e) {
        console.error(`Error solving for ${b} bays:`, e);
      }
    }

    const safeResults = results.filter((r) => r.status === 'SAFE');
    if (safeResults.length > 0) {
      const minWeight = Math.min(...safeResults.map((r) => r.totalWeightKg));
      const opt = safeResults.find((r) => r.totalWeightKg === minWeight);
      if (opt) opt.isOptimal = true;
    }

    setSweepResults(results);
    setIsSweeping(false);
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

  // PDF Export
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
    doc.text(`Dimension Mode: ${result.dimMode}`, 14, 31);
    doc.text(`Topology: ${dimMode === '2D' ? topology2D : topology3D}`, 14, 36);
    doc.text(`Design Standard: ${result.code}`, 14, 41);
    doc.text(`Section Profile: ${sectionProps.type} (${sectionProps.b}x${sectionProps.h}x${sectionProps.t} mm)`, 14, 46);

    doc.setFontSize(10);
    doc.text(`Overall Status: ${result.overallStatus}`, 130, 31);
    doc.text(`Max DCR: ${result.maxDcr}`, 130, 36);
    doc.text(`Max Deflection: ${result.maxDisplacement} mm (N${result.maxDispNode})`, 130, 41);
    doc.text(`Total Mass: ${result.totalWeightKg} kg`, 130, 46);

    let startTableY = 52;

    if (rendererRef.current) {
      try {
        const canvasImgData = rendererRef.current.domElement.toDataURL('image/png');
        doc.setFontSize(10);
        doc.text('Structural Geometry & Heatmap Visualization:', 14, 53);
        doc.addImage(canvasImgData, 'PNG', 14, 56, 182, 80);
        startTableY = 142;
      } catch (err) {
        console.error('Error rendering viewport canvas snapshot to PDF:', err);
      }
    }

    const memberRows = result.memberResults.map((m) => [
      `M${m.id}`, `${m.length} m`, `${m.axialForce} kN`, m.state, `${m.capacity} kN`, `${m.slenderness}`, `${m.dcr}`, m.status,
    ]);

    autoTable(doc, {
      startY: startTableY,
      margin: { left: 14, right: 14 },
      head: [['Member', 'Length', 'Axial Force', 'State', 'Capacity', 'KL/r', 'DCR', 'Status']],
      body: memberRows,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [15, 23, 42] },
    });

    const dispRows = result.displacements.map((d) => [
      `N${d.node}`, `${d.ux} mm`, `${d.uy} mm`, `${d.uz} mm`, `${d.uTotal} mm`,
    ]);

    doc.addPage();
    doc.setFontSize(12);
    doc.text('Nodal Displacements & Resultant Deflections', 14, 15);

    autoTable(doc, {
      startY: 20,
      margin: { left: 14, right: 14 },
      head: [['Node', 'ux (mm)', 'uy (mm)', 'uz (mm)', 'Resultant Total δ (mm)']],
      body: dispRows,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [15, 23, 42] },
    });

    doc.save(`Truss_Report_${result.dimMode}_${topology2D || topology3D}.pdf`);
  };

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

  const getNodePos = (node: NodeStruct): THREE.Vector3 => {
    if (!showDeformation || !result) {
      return new THREE.Vector3(node.x, node.y, node.z);
    }

    const disp = result.displacements.find((d) => d.node === node.id);
    if (!disp) return new THREE.Vector3(node.x, node.y, node.z);

    const dx = (disp.ux / 1000) * defScale;
    const dy = (disp.uy / 1000) * defScale;
    const dz = (disp.uz / 1000) * defScale;

    return new THREE.Vector3(node.x + dx, node.y + dy, node.z + dz);
  };

  // Three.js Scene Setup (Upright Viewport Orientation)
  useEffect(() => {
    if (!mountRef.current || nodes.length === 0) return;

    const width = mountRef.current.clientWidth || 500;
    const height = 340;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0f172a');

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(width, height);
    rendererRef.current = renderer;

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
      camera.position.set(cx, cy + trussHeight / 2, Math.max(spanX, trussHeight) * 1.5);
      controls.target.set(cx, cy + trussHeight / 2, 0);
    } else {
      camera.position.set(cx + spanX * 1.2, cy + trussHeight * 1.5, cz + spanY * 1.5);
      controls.target.set(cx, cy, cz);
    }
    controls.update();

    if (showGrid) {
      const grid = new THREE.GridHelper(Math.max(spanX, spanY) * 2.5, 20, 0x38bdf8, 0x334155);
      grid.position.set(cx, 0, cz); // Horizontal ground plane at Y = 0
      scene.add(grid);
    }

    if (showDeformation && result) {
      members.forEach((mem) => {
        const n1 = nodes.find((n) => n.id === mem.startNode);
        const n2 = nodes.find((n) => n.id === mem.endNode);
        if (!n1 || !n2) return;

        const points = [new THREE.Vector3(n1.x, n1.y, n1.z), new THREE.Vector3(n2.x, n2.y, n2.z)];
        const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
        const lineMat = new THREE.LineDashedMaterial({
          color: 0x475569,
          dashSize: 0.2,
          gapSize: 0.1,
          transparent: true,
          opacity: 0.5,
        });
        const line = new THREE.Line(lineGeo, lineMat);
        line.computeLineDistances();
        scene.add(line);
      });
    }

    nodes.forEach((n) => {
      const pos = getNodePos(n);
      const isSelected = n.id === selectedNodeId;
      const hasCustomLoad = !!customNodeLoads[n.id];
      const isMaxDisp = result && result.maxDispNode === n.id;

      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(isSelected ? 0.22 : 0.15, 16, 16),
        new THREE.MeshStandardMaterial({
          color: isMaxDisp ? 0xf43f5e : isSelected ? 0x38bdf8 : hasCustomLoad ? 0xef4444 : 0xf59e0b
        })
      );
      sphere.position.copy(pos);
      scene.add(sphere);

      if (showNodeLabels) {
        const label = createTextSprite(`N${n.id}`, isMaxDisp ? '#f43f5e' : hasCustomLoad ? '#f87171' : isSelected ? '#38bdf8' : '#f8fafc');
        label.position.set(pos.x, pos.y + 0.35, pos.z);
        scene.add(label);
      }

      // Supports correctly positioned vertically beneath nodes (Y = 0)
      if (n.support === 'PINNED') {
        const cone = new THREE.Mesh(
          new THREE.ConeGeometry(0.22, 0.45, 8),
          new THREE.MeshStandardMaterial({ color: 0x10b981 })
        );
        cone.position.set(n.x, n.y - 0.22, n.z);
        scene.add(cone);
      } else if (n.support === 'ROLLER_X' || n.support === 'ROLLER_Y') {
        const rollerGroup = new THREE.Group();
        const pyramid = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.35, 4), new THREE.MeshStandardMaterial({ color: 0xfacc15 }));
        pyramid.position.set(n.x, n.y - 0.17, n.z);
        rollerGroup.add(pyramid);
        scene.add(rollerGroup);
      }

      const loadVec = new THREE.Vector3(n.fx, n.fy, n.fz);
      const loadMag = loadVec.length();
      if (loadMag > 0) {
        const dir = loadVec.clone().normalize();
        const arrow = new THREE.ArrowHelper(dir, pos, Math.min(loadMag * 0.04, 1.8), 0xef4444, 0.35, 0.25);
        scene.add(arrow);
      }
    });

    members.forEach((mem) => {
      const n1 = nodes.find((n) => n.id === mem.startNode);
      const n2 = nodes.find((n) => n.id === mem.endNode);
      if (!n1 || !n2) return;

      const p1 = getNodePos(n1);
      const p2 = getNodePos(n2);
      const dist = p1.distanceTo(p2);

      const res = result?.memberResults.find((m) => m.id === mem.id);
      let color = 0x64748b;
      if (res) {
        if (res.dcr > 1.0) color = 0xef4444;
        else if (res.dcr > 0.7) color = 0xfacc15;
        else color = res.state === 'TENSION' ? 0x38bdf8 : 0x10b981;
      }

      const cylinder = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.045, dist, 8),
        new THREE.MeshStandardMaterial({ color })
      );
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
      if (autoRotate && dimMode === '3D') scene.rotation.y += 0.003;
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      renderer.dispose();
    };
  }, [nodes, members, result, dimMode, spanX, spanY, trussHeight, selectedNodeId, showNodeLabels, showMemberLabels, showGrid, autoRotate, customNodeLoads, showDeformation, defScale]);

  const serviceabilityLimit = Number(((spanX * 1000) / 360).toFixed(1));

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

        {/* Deflection / Deformation Toggle */}
        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-amber-400">Exaggerated Deflected Shape</span>
            <button
              onClick={() => setShowDeformation(!showDeformation)}
              disabled={!result}
              className={`px-2 py-0.5 rounded text-xs font-bold border transition ${
                !result
                  ? 'opacity-50 cursor-not-allowed bg-slate-900 border-slate-800 text-slate-500'
                  : showDeformation
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              {showDeformation ? 'DEFORMED' : 'UNDEFORMED'}
            </button>
          </div>

          {showDeformation && result && (
            <div>
              <div className="flex justify-between text-xs text-slate-300 font-mono mb-1">
                <span>Exaggeration Scale:</span>
                <span className="font-bold text-amber-400">{defScale}x</span>
              </div>
              <input
                type="range"
                min={1}
                max={500}
                step={5}
                value={defScale}
                onChange={(e) => setDefScale(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>
          )}
        </div>

        {/* Selective Load Manager */}
        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-rose-400">Selective Node Load Manager</span>
            {Object.keys(customNodeLoads).length > 0 && (
              <button onClick={handleResetAllNodeLoads} className="text-[10px] text-rose-400 hover:underline font-bold">
                Reset All
              </button>
            )}
          </div>

          <div className="grid grid-cols-4 gap-2 text-xs font-mono">
            <div>
              <span className="text-slate-400 block text-[10px]">Target Node</span>
              <select
                value={targetLoadNodeId}
                onChange={(e) => setTargetLoadNodeId(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-800 rounded p-1 font-bold text-cyan-400"
              >
                {nodes.map((n) => (
                  <option key={`node-opt-${n.id}`} value={n.id}>
                    N{n.id}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Fx (kN)</span>
              <input type="number" value={customFx} onChange={(e) => setCustomFx(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded p-1" />
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Fy (kN)</span>
              <input type="number" value={customFy} onChange={(e) => setCustomFy(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded p-1" />
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Fz (kN)</span>
              <input type="number" value={customFz} onChange={(e) => setCustomFz(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded p-1" />
            </div>
          </div>

          <button
            onClick={handleApplyCustomNodeLoad}
            className="w-full bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-bold py-1 rounded text-xs transition"
          >
            Apply Load to Node N{targetLoadNodeId}
          </button>

          {Object.keys(customNodeLoads).length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {Object.entries(customNodeLoads).map(([nId, load]) => (
                <span key={`badge-${nId}`} className="inline-flex items-center space-x-1 bg-rose-950/60 border border-rose-800 text-rose-300 px-2 py-0.5 rounded text-[10px] font-mono">
                  <span>N{nId}: [{load.fx},{load.fy},{load.fz}]kN</span>
                  <button onClick={() => handleClearNodeLoad(Number(nId))} className="ml-1 text-rose-400 hover:text-white font-bold">×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Parametric Geometry */}
        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
          <span className="text-xs font-bold text-cyan-400 block uppercase tracking-wider">
            Parametric Span & Height Controls
          </span>

          <div>
            <div className="flex justify-between text-xs text-slate-300 font-mono mb-1">
              <span>Truss Span / Length (Lx):</span>
              <span className="font-bold text-cyan-400">{spanX} m</span>
            </div>
            <input
              type="range" min={4} max={60} step={0.5} value={spanX}
              onChange={(e) => setSpanX(Number(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-300 font-mono mb-1">
              <span>Truss Height / Depth (H):</span>
              <span className="font-bold text-cyan-400">{trussHeight} m</span>
            </div>
            <input
              type="range" min={0.5} max={10} step={0.1} value={trussHeight}
              onChange={(e) => setTrussHeight(Number(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-300 font-mono mb-1">
              <span>Current Bays (Nx):</span>
              <span className="font-bold text-cyan-400">{baysX} Bays ({(spanX / baysX).toFixed(2)}m/bay)</span>
            </div>
            <input
              type="range" min={2} max={20} step={1} value={baysX}
              onChange={(e) => setBaysX(Number(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer"
            />
          </div>
        </div>

        {/* Bay Sweep Controls */}
        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
          <span className="text-xs font-bold text-emerald-400 block uppercase tracking-wider">
            Automated Bay Iteration Engine
          </span>
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div>
              <span className="text-slate-400 block text-[10px]">Min Bays</span>
              <input type="number" value={sweepMinBays} onChange={(e) => setSweepMinBays(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded p-1" />
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Max Bays</span>
              <input type="number" value={sweepMaxBays} onChange={(e) => setSweepMaxBays(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded p-1" />
            </div>
          </div>
          <button
            onClick={handleRunBayOptimizationSweep}
            disabled={isSweeping}
            className="w-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 font-bold py-1.5 rounded text-xs transition"
          >
            {isSweeping ? 'Iterating Bays...' : 'Run Bay Optimization Sweep'}
          </button>
        </div>

        {/* Section Profile Calculator */}
        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-cyan-400">Section Profile</span>
            <select
              value={secType}
              onChange={(e) => setSecType(e.target.value as SectionType)}
              className="bg-slate-900 border border-slate-800 text-xs rounded px-2 py-0.5"
            >
              <option value="RHS">RHS Box</option>
              <option value="CHS">CHS Pipe</option>
              <option value="IBEAM">I-Beam</option>
              <option value="ANGLE">Angle</option>
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
          onClick={handleRunSingleAnalysis}
          disabled={analyzing}
          className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold py-2.5 rounded transition shadow-lg shadow-cyan-500/20"
        >
          {analyzing ? 'Solving Structural Matrix...' : `Run Structural Analysis (${baysX} Bays)`}
        </button>
      </div>

      {/* Viewport & Results Panel */}
      <div className="lg:col-span-7 space-y-6">
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
          <div className="flex justify-between items-center mb-2 border-b border-slate-800 pb-2">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              THREE.JS VIEWPORT ({spanX}m Span / {baysX} Bays)
            </h4>
            {showDeformation && (
              <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-mono font-bold">
                DEFORMED STATE ({defScale}x)
              </span>
            )}
          </div>
          <div ref={mountRef} className="bg-slate-950 rounded border border-slate-800 overflow-hidden flex justify-center cursor-grab active:cursor-grabbing" />
        </div>

        {/* Sweep Comparison Table */}
        {sweepResults.length > 0 && (
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider border-b border-slate-800 pb-2">
              Bay Iteration Sweep Results ({spanX}m Span)
            </h4>
            <div className="overflow-x-auto max-h-48">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-2 font-semibold">Bays</th>
                    <th className="pb-2 font-semibold">Bay Width</th>
                    <th className="pb-2 font-semibold">Steel Mass</th>
                    <th className="pb-2 font-semibold">Max Defl.</th>
                    <th className="pb-2 font-semibold">Max DCR</th>
                    <th className="pb-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-slate-300">
                  {sweepResults.map((r) => (
                    <tr
                      key={`sweep-row-${r.bays}`}
                      className={r.isOptimal ? 'bg-emerald-500/10 font-bold text-emerald-400' : ''}
                    >
                      <td className="py-1.5">{r.bays} {r.isOptimal && '(OPTIMAL)'}</td>
                      <td className="py-1.5">{r.bayWidth} m</td>
                      <td className="py-1.5">{r.totalWeightKg} kg</td>
                      <td className="py-1.5 text-amber-400">{r.maxDeflectionMm} mm</td>
                      <td className={`py-1.5 ${r.maxDcr <= 1.0 ? 'text-emerald-400' : 'text-rose-400'}`}>{r.maxDcr}</td>
                      <td className="py-1.5">
                        <span className={r.status === 'SAFE' ? 'text-emerald-400' : 'text-rose-400'}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Results Tabbed Panel */}
        {result && (
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <div className="flex space-x-2">
                <button
                  onClick={() => setActiveResultTab('members')}
                  className={`text-xs font-bold px-3 py-1 rounded transition ${
                    activeResultTab === 'members'
                      ? 'bg-cyan-500 text-slate-950 shadow'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Member Capacities
                </button>
                <button
                  onClick={() => setActiveResultTab('displacements')}
                  className={`text-xs font-bold px-3 py-1 rounded transition ${
                    activeResultTab === 'displacements'
                      ? 'bg-cyan-500 text-slate-950 shadow'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Nodal Displacements & Deflection
                </button>
              </div>

              <div className="flex items-center space-x-2">
                <span className={`text-xs px-2 py-0.5 rounded font-bold ${result.overallStatus === 'SAFE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                  {result.overallStatus} ({result.totalWeightKg} kg)
                </span>
                <button
                  onClick={handleExportPDF}
                  className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold text-xs px-3 py-1 rounded shadow transition"
                >
                  Export PDF
                </button>
              </div>
            </div>

            {/* TAB 1: Member Capacity Table */}
            {activeResultTab === 'members' && (
              <div className="overflow-x-auto max-h-56">
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
                        <td className="py-1 font-bold">M{m.id}</td>
                        <td className="py-1">{m.length} m</td>
                        <td className={`py-1 font-bold ${m.state === 'TENSION' ? 'text-cyan-400' : m.state === 'COMPRESSION' ? 'text-rose-400' : 'text-slate-400'}`}>
                          {m.axialForce} kN
                        </td>
                        <td className="py-1">{m.capacity} kN</td>
                        <td className={`py-1 font-bold ${m.dcr <= 1.0 ? 'text-emerald-400' : 'text-rose-400'}`}>{m.dcr}</td>
                        <td className="py-1 font-bold">
                          <span className={m.dcr <= 1.0 ? 'text-emerald-400' : 'text-rose-400'}>
                            {m.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB 2: Nodal Displacements Table */}
            {activeResultTab === 'displacements' && (
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs font-mono bg-slate-950 p-2.5 rounded border border-slate-800">
                  <div>
                    <span className="text-slate-400 block text-[10px]">PEAK RESULTANT DEFLECTION (δ max)</span>
                    <span className="text-rose-400 font-bold text-sm">
                      {result.maxDisplacement} mm <span className="text-xs text-slate-400">(Node N{result.maxDispNode})</span>
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block text-[10px]">SERVICEABILITY LIMIT (L/360)</span>
                    <span className={`font-bold text-sm ${result.maxDisplacement <= serviceabilityLimit ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {serviceabilityLimit} mm ({result.maxDisplacement <= serviceabilityLimit ? 'PASS' : 'EXCEEDED'})
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-56">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="pb-2 font-semibold">Node</th>
                        <th className="pb-2 font-semibold">ux (mm)</th>
                        <th className="pb-2 font-semibold">uy (mm)</th>
                        <th className="pb-2 font-semibold">uz (mm)</th>
                        <th className="pb-2 font-semibold text-amber-400">Total δ (mm)</th>
                        <th className="pb-2 font-semibold">Remark</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50 text-slate-300">
                      {result.displacements.map((d) => {
                        const isMax = d.node === result.maxDispNode;
                        return (
                          <tr key={`disp-row-${d.node}`} className={isMax ? 'bg-rose-950/30 font-bold' : ''}>
                            <td className="py-1 font-bold text-cyan-400">N{d.node}</td>
                            <td className="py-1">{d.ux}</td>
                            <td className="py-1">{d.uy}</td>
                            <td className="py-1">{d.uz}</td>
                            <td className={`py-1 font-bold ${isMax ? 'text-rose-400' : 'text-amber-400'}`}>
                              {d.uTotal} mm
                            </td>
                            <td className="py-1">
                              {isMax && (
                                <span className="bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                  MAX DEFLECTION
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
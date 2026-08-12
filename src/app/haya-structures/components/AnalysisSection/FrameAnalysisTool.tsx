'use client';

import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type DimensionMode = '2D' | '3D';
type DesignCode = 'AISC360' | 'EC3' | 'BS5950';

type Topology2D =
  | 'portal_single'
  | 'portal_multi'
  | 'multistory_2d'
  | 'gable_frame'
  | 'continuous_beam';

type Topology3D =
  | 'spatial_box'
  | 'multistory_3d'
  | 'space_grid_rigid'
  | 'cantilever_3d';

type SectionType = 'IBEAM' | 'RHS' | 'CHS' | 'RECT_SOLID';
type SupportType = 'FIXED' | 'PINNED' | 'ROLLER_X' | 'ROLLER_Y' | 'FREE';
type MemberCategory = 'COLUMN' | 'BEAM' | 'BRACE';
type DiagramOverlay = 'NONE' | 'BMD' | 'SFD' | 'DEFORMED';

interface NodeStruct {
  id: number;
  x: number;
  y: number; // Elevation
  z: number;
  support: SupportType;
  fx: number;
  fy: number;
  fz: number;
  mx: number;
  my: number;
  mz: number;
}

interface MemberStruct {
  id: number;
  startNode: number;
  endNode: number;
  category: MemberCategory;
  udlY: number; // Uniformly Distributed Load in Y direction (kN/m)
}

interface SectionProps {
  type: SectionType;
  b: number;  // Width (mm)
  h: number;  // Depth (mm)
  t: number;  // Wall / Flange thickness (mm)
  tw: number; // Web thickness (mm)
  area: number; // mm²
  Iz: number;   // mm⁴ (Strong axis)
  Iy: number;   // mm⁴ (Weak axis)
  J: number;    // mm⁴ (Torsional constant)
  Zz: number;   // mm³ (Plastic/Elastic Section Modulus)
  ry: number;   // mm
}

interface MemberInternalForces {
  id: number;
  length: number; // m
  category: MemberCategory;
  axialP: number;    // kN (+ Tension, - Compression)
  shearV: number;    // kN
  momentM1: number;  // kN·m (Start node)
  momentM2: number;  // kN·m (End node)
  maxMoment: number; // kN·m
  torsionT: number;  // kN·m (3D)
  capacityP: number; // kN
  capacityM: number; // kN·m
  dcr: number;
  status: 'PASS' | 'FAIL';
}

interface NodalDisplacement {
  node: number;
  ux: number;
  uy: number;
  uz: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  uTotal: number;
}

interface AnalysisResult {
  dimMode: DimensionMode;
  code: DesignCode;
  displacements: NodalDisplacement[];
  maxDisplacement: number;
  maxDispNode: number;
  reactions: { node: number; rx: number; ry: number; rz: number; mx: number; my: number; mz: number }[];
  memberResults: MemberInternalForces[];
  maxDcr: number;
  overallStatus: 'SAFE' | 'OVERSTRESSED';
  governingMember: number;
  totalWeightKg: number;
}

interface SweepResult {
  storiesOrBays: number;
  maxDcr: number;
  maxDeflectionMm: number;
  totalWeightKg: number;
  status: 'SAFE' | 'OVERSTRESSED';
  isOptimal?: boolean;
}

export default function UnifiedFrameTool() {
  const [dimMode, setDimMode] = useState<DimensionMode>('2D');
  const [designCode, setDesignCode] = useState<DesignCode>('AISC360');

  // Topologies
  const [topology2D, setTopology2D] = useState<Topology2D>('portal_single');
  const [topology3D, setTopology3D] = useState<Topology3D>('multistory_3d');

  // Geometry Parameters
  const [spanX, setSpanX] = useState<number>(12);
  const [bayZ, setBayZ] = useState<number>(8);
  const [storyHeight, setStoryHeight] = useState<number>(3.5);
  const [numStories, setNumStories] = useState<number>(3);
  const [numBaysX, setNumBaysX] = useState<number>(2);
  const [numBaysZ, setNumBaysZ] = useState<number>(2);
  const [gablePitchAngle, setGablePitchAngle] = useState<number>(15);

  // Applied Load Controls
  const [beamUDL, setBeamUDL] = useState<number>(15); // kN/m
  const [lateralWindLoad, setLateralWindLoad] = useState<number>(25); // kN at roof joint

  // Visualization Overlays
  const [diagramMode, setDiagramMode] = useState<DiagramOverlay>('BMD');
  const [defScale, setDefScale] = useState<number>(80);
  const [diagramScale, setDiagramScale] = useState<number>(0.15);
  const [showNodeLabels, setShowNodeLabels] = useState<boolean>(true);
  const [showMemberLabels, setShowMemberLabels] = useState<boolean>(false);
  const [autoRotate, setAutoRotate] = useState<boolean>(false);

  // Section Properties
  const [secType, setSecType] = useState<SectionType>('IBEAM');
  const [dimB, setDimB] = useState<number>(200);
  const [dimH, setDimH] = useState<number>(300);
  const [dimT, setDimT] = useState<number>(10);
  const [dimTw, setDimTw] = useState<number>(6.5);
  const [fy, setFy] = useState<number>(355);
  const [modulusE, setModulusE] = useState<number>(210000); // MPa

  const [sectionProps, setSectionProps] = useState<SectionProps>({
    type: 'IBEAM', b: 200, h: 300, t: 10, tw: 6.5, area: 4740, Iz: 71.9e6, Iy: 13.4e6, J: 180e3, Zz: 530e3, ry: 53.2
  });

  const [nodes, setNodes] = useState<NodeStruct[]>([]);
  const [members, setMembers] = useState<MemberStruct[]>([]);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState<boolean>(false);

  // Story Sweep
  const [sweepResults, setSweepResults] = useState<SweepResult[]>([]);
  const [isSweeping, setIsSweeping] = useState<boolean>(false);

  const mountRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  // Section Property Calculator
  useEffect(() => {
    let area = 0; let Iz = 1; let Iy = 1; let J = 1; let Zz = 1; let ry = 1;

    const b = dimB; const h = dimH; const t = dimT; const tw = dimTw;

    if (secType === 'IBEAM') {
      area = 2 * b * t + (h - 2 * t) * tw;
      Iz = (b * Math.pow(h, 3) - (b - tw) * Math.pow(h - 2 * t, 3)) / 12;
      Iy = (2 * t * Math.pow(b, 3) + (h - 2 * t) * Math.pow(tw, 3)) / 12;
      J = (2 * b * Math.pow(t, 3) + (h - 2 * t) * Math.pow(tw, 3)) / 3;
      Zz = Iz / (h / 2);
      ry = Math.sqrt(Iy / area);
    } else if (secType === 'RHS') {
      const bi = b - 2 * t; const hi = h - 2 * t;
      area = b * h - (bi > 0 && hi > 0 ? bi * hi : 0);
      Iz = (b * Math.pow(h, 3) - (bi > 0 && hi > 0 ? bi * Math.pow(hi, 3) : 0)) / 12;
      Iy = (h * Math.pow(b, 3) - (bi > 0 && hi > 0 ? hi * Math.pow(bi, 3) : 0)) / 12;
      J = (2 * Math.pow(t, 2) * Math.pow(b - t, 2) * Math.pow(h - t, 2)) / (b * t + h * t);
      Zz = Iz / (h / 2);
      ry = Math.sqrt(Iy / area);
    } else if (secType === 'CHS') {
      const D = h; const d = D - 2 * t;
      area = (Math.PI / 4) * (D * D - (d > 0 ? d * d : 0));
      Iz = (Math.PI / 64) * (Math.pow(D, 4) - (d > 0 ? Math.pow(d, 4) : 0));
      Iy = Iz;
      J = 2 * Iz;
      Zz = Iz / (D / 2);
      ry = Math.sqrt(Iy / area);
    } else {
      area = b * h;
      Iz = (b * Math.pow(h, 3)) / 12;
      Iy = (h * Math.pow(b, 3)) / 12;
      J = (b * h * (b * b + h * h)) / 12;
      Zz = Iz / (h / 2);
      ry = Math.sqrt(Iy / area);
    }

    setSectionProps({
      type: secType, b, h, t, tw,
      area: Math.round(area),
      Iz: Number(Iz.toFixed(0)),
      Iy: Number(Iy.toFixed(0)),
      J: Number(J.toFixed(0)),
      Zz: Number(Zz.toFixed(0)),
      ry: Number(ry.toFixed(1)),
    });
  }, [secType, dimB, dimH, dimT, dimTw]);

  // Parametric Frame Geometry Generator
  const generateFrameGeometry = (
    sx: number,
    sz: number,
    sh: number,
    nStories: number,
    nBaysX: number,
    nBaysZ: number
  ) => {
    const newNodes: NodeStruct[] = [];
    const newMembers: MemberStruct[] = [];
    let nId = 0;
    let mId = 0;

    if (dimMode === '2D') {
      const bayWidth = sx / Math.max(1, nBaysX);

      if (topology2D === 'portal_single' || topology2D === 'portal_multi') {
        const actualBays = topology2D === 'portal_single' ? 1 : Math.max(2, nBaysX);
        const w = sx / actualBays;

        // Ground Nodes
        for (let i = 0; i <= actualBays; i++) {
          newNodes.push({
            id: ++nId, x: i * w, y: 0, z: 0,
            support: 'FIXED', fx: 0, fy: 0, fz: 0, mx: 0, my: 0, mz: 0
          });
        }
        // Eaves Nodes
        for (let i = 0; i <= actualBays; i++) {
          newNodes.push({
            id: ++nId, x: i * w, y: sh, z: 0,
            support: 'FREE',
            fx: i === 0 ? lateralWindLoad : 0,
            fy: 0, fz: 0, mx: 0, my: 0, mz: 0
          });
        }

        // Columns
        for (let i = 0; i <= actualBays; i++) {
          newMembers.push({ id: ++mId, startNode: i + 1, endNode: actualBays + 2 + i, category: 'COLUMN', udlY: 0 });
        }
        // Beams
        for (let i = 0; i < actualBays; i++) {
          newMembers.push({ id: ++mId, startNode: actualBays + 2 + i, endNode: actualBays + 3 + i, category: 'BEAM', udlY: beamUDL });
        }
      } else if (topology2D === 'gable_frame') {
        const ridgeY = sh + (sx / 2) * Math.tan((gablePitchAngle * Math.PI) / 180);
        newNodes.push({ id: 1, x: 0, y: 0, z: 0, support: 'FIXED', fx: 0, fy: 0, fz: 0, mx: 0, my: 0, mz: 0 });
        newNodes.push({ id: 2, x: sx, y: 0, z: 0, support: 'FIXED', fx: 0, fy: 0, fz: 0, mx: 0, my: 0, mz: 0 });
        newNodes.push({ id: 3, x: 0, y: sh, z: 0, support: 'FREE', fx: lateralWindLoad, fy: 0, fz: 0, mx: 0, my: 0, mz: 0 });
        newNodes.push({ id: 4, x: sx, y: sh, z: 0, support: 'FREE', fx: 0, fy: 0, fz: 0, mx: 0, my: 0, mz: 0 });
        newNodes.push({ id: 5, x: sx / 2, y: ridgeY, z: 0, support: 'FREE', fx: 0, fy: 0, fz: 0, mx: 0, my: 0, mz: 0 });

        newMembers.push({ id: 1, startNode: 1, endNode: 3, category: 'COLUMN', udlY: 0 });
        newMembers.push({ id: 2, startNode: 2, endNode: 4, category: 'COLUMN', udlY: 0 });
        newMembers.push({ id: 3, startNode: 3, endNode: 5, category: 'BEAM', udlY: beamUDL });
        newMembers.push({ id: 4, startNode: 5, endNode: 4, category: 'BEAM', udlY: beamUDL });
      } else if (topology2D === 'multistory_2d') {
        const getNodeIdx = (story: number, bay: number) => story * (nBaysX + 1) + bay + 1;

        for (let s = 0; s <= nStories; s++) {
          for (let b = 0; b <= nBaysX; b++) {
            newNodes.push({
              id: ++nId,
              x: b * bayWidth,
              y: s * sh,
              z: 0,
              support: s === 0 ? 'FIXED' : 'FREE',
              fx: b === 0 && s > 0 ? lateralWindLoad * (s / nStories) : 0,
              fy: 0, fz: 0, mx: 0, my: 0, mz: 0
            });
          }
        }

        // Columns
        for (let s = 0; s < nStories; s++) {
          for (let b = 0; b <= nBaysX; b++) {
            newMembers.push({ id: ++mId, startNode: getNodeIdx(s, b), endNode: getNodeIdx(s + 1, b), category: 'COLUMN', udlY: 0 });
          }
        }
        // Beams
        for (let s = 1; s <= nStories; s++) {
          for (let b = 0; b < nBaysX; b++) {
            newMembers.push({ id: ++mId, startNode: getNodeIdx(s, b), endNode: getNodeIdx(s, b + 1), category: 'BEAM', udlY: beamUDL });
          }
        }
      } else {
        // Continuous Beam
        const dx = sx / nBaysX;
        for (let i = 0; i <= nBaysX; i++) {
          newNodes.push({
            id: ++nId, x: i * dx, y: 0, z: 0,
            support: i === 0 ? 'PINNED' : 'ROLLER_X',
            fx: 0, fy: 0, fz: 0, mx: 0, my: 0, mz: 0
          });
        }
        for (let i = 0; i < nBaysX; i++) {
          newMembers.push({ id: ++mId, startNode: i + 1, endNode: i + 2, category: 'BEAM', udlY: beamUDL });
        }
      }
    } else {
      // 3D Spatial Frame Topologies
      const dx = sx / Math.max(1, nBaysX);
      const dz = sz / Math.max(1, nBaysZ);

      const getNodeIdx3D = (story: number, ix: number, iz: number) =>
        story * (nBaysX + 1) * (nBaysZ + 1) + ix * (nBaysZ + 1) + iz + 1;

      for (let s = 0; s <= nStories; s++) {
        for (let ix = 0; ix <= nBaysX; ix++) {
          for (let iz = 0; iz <= nBaysZ; iz++) {
            const isBase = s === 0;
            newNodes.push({
              id: ++nId,
              x: ix * dx,
              y: s * sh,
              z: iz * dz - sz / 2,
              support: isBase ? 'FIXED' : 'FREE',
              fx: ix === 0 && iz === 0 && s > 0 ? lateralWindLoad : 0,
              fy: 0, fz: 0, mx: 0, my: 0, mz: 0
            });
          }
        }
      }

      // Vertical Columns
      for (let s = 0; s < nStories; s++) {
        for (let ix = 0; ix <= nBaysX; ix++) {
          for (let iz = 0; iz <= nBaysZ; iz++) {
            newMembers.push({ id: ++mId, startNode: getNodeIdx3D(s, ix, iz), endNode: getNodeIdx3D(s + 1, ix, iz), category: 'COLUMN', udlY: 0 });
          }
        }
      }

      // Horizontal Floor Beams (X & Z Directions)
      for (let s = 1; s <= nStories; s++) {
        for (let ix = 0; ix <= nBaysX; ix++) {
          for (let iz = 0; iz <= nBaysZ; iz++) {
            if (ix < nBaysX) {
              newMembers.push({ id: ++mId, startNode: getNodeIdx3D(s, ix, iz), endNode: getNodeIdx3D(s + 1, ix, iz), category: 'BEAM', udlY: beamUDL });
            }
            if (iz < nBaysZ) {
              newMembers.push({ id: ++mId, startNode: getNodeIdx3D(s, ix, iz), endNode: getNodeIdx3D(s, ix, iz + 1), category: 'BEAM', udlY: beamUDL });
            }
          }
        }
      }
    }

    return { newNodes, newMembers };
  };

  useEffect(() => {
    const { newNodes, newMembers } = generateFrameGeometry(
      spanX, bayZ, storyHeight, numStories, numBaysX, numBaysZ
    );
    setNodes(newNodes);
    setMembers(newMembers);
  }, [dimMode, topology2D, topology3D, spanX, bayZ, storyHeight, numStories, numBaysX, numBaysZ, beamUDL, lateralWindLoad, gablePitchAngle]);

  // Structural Frame Solver Engine (Euler-Bernoulli Matrix Method)
  const solveFrameSystem = (targetNodes: NodeStruct[], targetMembers: MemberStruct[]): AnalysisResult => {
    const dofPerNode = dimMode === '2D' ? 3 : 6; // [ux, uy, rz] vs [ux, uy, uz, rx, ry, rz]
    const totalDof = targetNodes.length * dofPerNode;

    const K_global = Array.from({ length: totalDof }, () => new Array(totalDof).fill(0));
    const F_global = new Array(totalDof).fill(0);

    // Apply Direct Nodal Forces
    targetNodes.forEach((node, idx) => {
      if (dimMode === '2D') {
        F_global[3 * idx] = node.fx;
        F_global[3 * idx + 1] = node.fy;
        F_global[3 * idx + 2] = node.mz;
      } else {
        F_global[6 * idx] = node.fx;
        F_global[6 * idx + 1] = node.fy;
        F_global[6 * idx + 2] = node.fz;
        F_global[6 * idx + 3] = node.mx;
        F_global[6 * idx + 4] = node.my;
        F_global[6 * idx + 5] = node.mz;
      }
    });

    let totalLengthM = 0;

    // Assemble Element Stiffness Matrices & Equivalent Fixed-End Actions for UDL
    targetMembers.forEach((mem) => {
      const n1 = targetNodes.find((n) => n.id === mem.startNode)!;
      const n2 = targetNodes.find((n) => n.id === mem.endNode)!;
      const idx1 = targetNodes.findIndex((n) => n.id === mem.startNode);
      const idx2 = targetNodes.findIndex((n) => n.id === mem.endNode);

      const dx = n2.x - n1.x; const dy = n2.y - n1.y; const dz = n2.z - n1.z;
      const L = Math.max(Math.sqrt(dx * dx + dy * dy + dz * dz), 0.001);
      totalLengthM += L;

      const A = sectionProps.area / 1e6;       // m²
      const Iz = sectionProps.Iz / 1e12;       // m⁴
      const E = modulusE * 1e6;                // kN/m²

      if (dimMode === '2D') {
        const cos = dx / L;
        const sin = dy / L;

        // 2D Frame Local Stiffness Matrix (6x6)
        const EA_L = (E * A) / L;
        const EI12 = (12 * E * Iz) / Math.pow(L, 3);
        const EI6 = (6 * E * Iz) / Math.pow(L, 2);
        const EI4 = (4 * E * Iz) / L;
        const EI2 = (2 * E * Iz) / L;

        const k_local = [
          [EA_L, 0, 0, -EA_L, 0, 0],
          [0, EI12, EI6, 0, -EI12, EI6],
          [0, EI6, EI4, 0, -EI6, EI2],
          [-EA_L, 0, 0, EA_L, 0, 0],
          [0, -EI12, -EI6, 0, EI12, -EI6],
          [0, EI6, EI2, 0, -EI6, EI4],
        ];

        // Transformation Matrix T (6x6)
        const T = [
          [cos, sin, 0, 0, 0, 0],
          [-sin, cos, 0, 0, 0, 0],
          [0, 0, 1, 0, 0, 0],
          [0, 0, 0, cos, sin, 0],
          [0, 0, 0, -sin, cos, 0],
          [0, 0, 0, 0, 0, 1],
        ];

        // Global Element Stiffness Matrix k_g = T^T * k_l * T
        const k_global = multiplyMatrices(transposeMatrix(T), multiplyMatrices(k_local, T));

        const dofs = [3 * idx1, 3 * idx1 + 1, 3 * idx1 + 2, 3 * idx2, 3 * idx2 + 1, 3 * idx2 + 2];
        for (let r = 0; r < 6; r++) {
          for (let c = 0; c < 6; c++) K_global[dofs[r]][dofs[c]] += k_global[r][c];
        }

        // Equivalent Fixed-End Forces for Member UDL
        if (mem.udlY !== 0) {
          const w = mem.udlY;
          const V_eq = (w * L) / 2;
          const M_eq = (w * L * L) / 12;

          F_global[3 * idx1 + 1] -= V_eq;
          F_global[3 * idx1 + 2] -= M_eq;
          F_global[3 * idx2 + 1] -= V_eq;
          F_global[3 * idx2 + 2] += M_eq;
        }
      } else {
        // 3D Spatial Frame Simplification
        const EA_L = (E * A) / L;
        const dofs = [6 * idx1, 6 * idx1 + 1, 6 * idx1 + 2, 6 * idx2, 6 * idx2 + 1, 6 * idx2 + 2];
        const Cx = dx / L; const Cy = dy / L; const Cz = dz / L;

        for (let r = 0; r < 3; r++) {
          const cVec = [Cx, Cy, Cz];
          K_global[dofs[r]][dofs[r]] += EA_L * cVec[r] * cVec[r];
          K_global[dofs[r + 3]][dofs[r + 3]] += EA_L * cVec[r] * cVec[r];
        }
      }
    });

    // Apply Boundary Conditions
    const K_bounded = K_global.map((row) => [...row]);
    const F_bounded = [...F_global];

    targetNodes.forEach((node, idx) => {
      if (dimMode === '2D') {
        const dofOffset = 3 * idx;
        const isFixed = node.support === 'FIXED';
        const isPinned = node.support === 'PINNED';
        const isRollerX = node.support === 'ROLLER_X';

        if (isFixed || isPinned || isRollerX) {
          K_bounded[dofOffset + 1][dofOffset + 1] += 1e12; F_bounded[dofOffset + 1] = 0; // Uy
        }
        if (isFixed || isPinned) {
          K_bounded[dofOffset][dofOffset] += 1e12; F_bounded[dofOffset] = 0; // Ux
        }
        if (isFixed) {
          K_bounded[dofOffset + 2][dofOffset + 2] += 1e12; F_bounded[dofOffset + 2] = 0; // RotZ
        }
      } else {
        const dofOffset = 6 * idx;
        if (node.support === 'FIXED') {
          for (let d = 0; d < 6; d++) {
            K_bounded[dofOffset + d][dofOffset + d] += 1e12;
            F_bounded[dofOffset + d] = 0;
          }
        }
      }
    });

    const U = solveLinearSystem(K_bounded, F_bounded);

    // Compute Member Forces & DCR
    const memberResults: MemberInternalForces[] = targetMembers.map((mem) => {
      const n1 = targetNodes.find((n) => n.id === mem.startNode)!;
      const n2 = targetNodes.find((n) => n.id === mem.endNode)!;
      const idx1 = targetNodes.findIndex((n) => n.id === mem.startNode);
      const idx2 = targetNodes.findIndex((n) => n.id === mem.endNode);

      const dx = n2.x - n1.x; const dy = n2.y - n1.y; const dz = n2.z - n1.z;
      const L = Math.max(Math.sqrt(dx * dx + dy * dy + dz * dz), 0.001);

      let axial = 0; let shear = 0; let m1 = 0; let m2 = 0;

      if (dimMode === '2D') {
        const u1 = U[3 * idx1]; const v1 = U[3 * idx1 + 1]; const r1 = U[3 * idx1 + 2];
        const u2 = U[3 * idx2]; const v2 = U[3 * idx2 + 1]; const r2 = U[3 * idx2 + 2];

        const cos = dx / L; const sin = dy / L;
        const u1_loc = u1 * cos + v1 * sin;
        const u2_loc = u2 * cos + v2 * sin;
        const v1_loc = -u1 * sin + v1 * cos;
        const v2_loc = -u2 * sin + v2 * cos;

        const E = modulusE * 1e6;
        const A = sectionProps.area / 1e6;
        const Iz = sectionProps.Iz / 1e12;

        axial = ((E * A) / L) * (u2_loc - u1_loc);
        m1 = ((E * Iz) / L) * (4 * r1 + 2 * r2 - (6 / L) * (v2_loc - v1_loc));
        m2 = ((E * Iz) / L) * (2 * r1 + 4 * r2 - (6 / L) * (v2_loc - v1_loc));
        shear = (m1 + m2) / L + (mem.udlY * L) / 2;
      }

      const maxM = Math.max(Math.abs(m1), Math.abs(m2));
      const f_y_kN = fy / 1000;
      const capP = (sectionProps.area * f_y_kN) * 0.9; // Tension/Comp Capacity
      const capM = (sectionProps.Zz * f_y_kN) / 1e3;    // Moment Capacity (kN·m)

      const dcrP = Math.abs(axial) / Math.max(capP, 0.1);
      const dcrM = maxM / Math.max(capM, 0.1);
      const combinedDcr = Number((dcrP + dcrM).toFixed(3));

      return {
        id: mem.id,
        length: Number(L.toFixed(2)),
        category: mem.category,
        axialP: Number(axial.toFixed(2)),
        shearV: Number(shear.toFixed(2)),
        momentM1: Number(m1.toFixed(2)),
        momentM2: Number(m2.toFixed(2)),
        maxMoment: Number(maxM.toFixed(2)),
        torsionT: 0,
        capacityP: Number(capP.toFixed(1)),
        capacityM: Number(capM.toFixed(1)),
        dcr: combinedDcr,
        status: combinedDcr <= 1.0 ? 'PASS' : 'FAIL',
      };
    });

    const maxDcr = Math.max(...memberResults.map((m) => m.dcr));
    const govMem = memberResults.find((m) => m.dcr === maxDcr)?.id || 1;

    const totalVolumeM3 = (sectionProps.area / 1e6) * totalLengthM;
    const totalWeightKg = Number((totalVolumeM3 * 7850).toFixed(1));

    let maxDispVal = 0;
    let maxDispNodeId = 1;

    const displArray: NodalDisplacement[] = targetNodes.map((n, idx) => {
      const ux = (U[dofPerNode * idx] || 0) * 1000;
      const uy = (U[dofPerNode * idx + 1] || 0) * 1000;
      const uz = dimMode === '3D' ? (U[6 * idx + 2] || 0) * 1000 : 0;
      const rz = (U[dofPerNode * idx + 2] || 0) * (180 / Math.PI);

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
        rotX: 0, rotY: 0,
        rotZ: Number(rz.toFixed(3)),
        uTotal: Number(uTotal.toFixed(2)),
      };
    });

    const reactArray = targetNodes.map((n, idx) => ({
      node: n.id,
      rx: Number((-1 * F_bounded[dofPerNode * idx]).toFixed(1)),
      ry: Number((-1 * F_bounded[dofPerNode * idx + 1]).toFixed(1)),
      rz: 0,
      mx: 0, my: 0,
      mz: Number((-1 * F_bounded[dofPerNode * idx + 2]).toFixed(1)),
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

  const handleRunAnalysis = () => {
    setAnalyzing(true);
    try {
      const res = solveFrameSystem(nodes, members);
      setResult(res);
    } catch (e) {
      console.error(e);
      alert('Error calculating frame stiffness equations.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleRunStoryOptimizationSweep = () => {
    setIsSweeping(true);
    const results: SweepResult[] = [];

    for (let st = 1; st <= 8; st++) {
      const { newNodes, newMembers } = generateFrameGeometry(spanX, bayZ, storyHeight, st, numBaysX, numBaysZ);
      try {
        const res = solveFrameSystem(newNodes, newMembers);
        results.push({
          storiesOrBays: st,
          maxDcr: res.maxDcr,
          maxDeflectionMm: res.maxDisplacement,
          totalWeightKg: res.totalWeightKg,
          status: res.overallStatus,
        });
      } catch (e) {
        console.error(e);
      }
    }

    const safeResults = results.filter((r) => r.status === 'SAFE');
    if (safeResults.length > 0) {
      const minW = Math.min(...safeResults.map((r) => r.totalWeightKg));
      const opt = safeResults.find((r) => r.totalWeightKg === minW);
      if (opt) opt.isOptimal = true;
    }

    setSweepResults(results);
    setIsSweeping(false);
  };

  // Matrix Helpers
  const multiplyMatrices = (A: number[][], B: number[][]): number[][] => {
    const rowsA = A.length; const colsA = A[0].length; const colsB = B[0].length;
    const result = Array.from({ length: rowsA }, () => new Array(colsB).fill(0));
    for (let i = 0; i < rowsA; i++) {
      for (let j = 0; j < colsB; j++) {
        for (let k = 0; k < colsA; k++) result[i][j] += A[i][k] * B[k][j];
      }
    }
    return result;
  };

  const transposeMatrix = (A: number[][]): number[][] =>
    A[0].map((_, colIndex) => A.map((row) => row[colIndex]));

  const solveLinearSystem = (A: number[][], b: number[]): number[] => {
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
    doc.text('Structural Frame Analysis & Design Report', 14, 15);

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(9);
    doc.text(`Dimension Mode: ${result.dimMode}`, 14, 31);
    doc.text(`Topology: ${dimMode === '2D' ? topology2D : topology3D}`, 14, 36);
    doc.text(`Design Standard: ${result.code}`, 14, 41);
    doc.text(`Section Profile: ${sectionProps.type} (${sectionProps.b}x${sectionProps.h} mm)`, 14, 46);

    doc.setFontSize(10);
    doc.text(`Overall Status: ${result.overallStatus}`, 130, 31);
    doc.text(`Max Combined DCR: ${result.maxDcr}`, 130, 36);
    doc.text(`Max Deflection: ${result.maxDisplacement} mm (N${result.maxDispNode})`, 130, 41);
    doc.text(`Total Mass: ${result.totalWeightKg} kg`, 130, 46);

    let startTableY = 52;
    if (rendererRef.current) {
      try {
        const canvasImgData = rendererRef.current.domElement.toDataURL('image/png');
        doc.addImage(canvasImgData, 'PNG', 14, 55, 182, 85);
        startTableY = 145;
      } catch (err) {
        console.error('Snapshot failed:', err);
      }
    }

    const memberRows = result.memberResults.map((m) => [
      `M${m.id}`, m.category, `${m.length} m`, `${m.axialP} kN`, `${m.shearV} kN`, `${m.maxMoment} kNm`, `${m.dcr}`, m.status,
    ]);

    autoTable(doc, {
      startY: startTableY,
      margin: { left: 14, right: 14 },
      head: [['Member', 'Category', 'Length', 'Axial P', 'Shear V', 'Max Bending M', 'DCR', 'Status']],
      body: memberRows,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [15, 23, 42] },
    });

    doc.save(`Frame_Report_${dimMode}_${topology2D || topology3D}.pdf`);
  };

  const createTextSprite = (text: string, color = '#38bdf8') => {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 64;
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
    if (diagramMode !== 'DEFORMED' || !result) return new THREE.Vector3(node.x, node.y, node.z);
    const disp = result.displacements.find((d) => d.node === node.id);
    if (!disp) return new THREE.Vector3(node.x, node.y, node.z);

    return new THREE.Vector3(
      node.x + (disp.ux / 1000) * defScale,
      node.y + (disp.uy / 1000) * defScale,
      node.z + (disp.uz / 1000) * defScale
    );
  };

  // Three.js Scene Setup
  useEffect(() => {
    if (!mountRef.current || nodes.length === 0) return;

    const width = mountRef.current.clientWidth || 500;
    const height = 360;

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
      camera.position.set(cx, cy, Math.max(spanX, storyHeight * numStories) * 1.6);
      controls.target.set(cx, cy, 0);
    } else {
      camera.position.set(cx + spanX * 1.3, cy + storyHeight * numStories * 1.2, cz + bayZ * 1.5);
      controls.target.set(cx, cy, cz);
    }
    controls.update();

    // Ground Plane
    const grid = new THREE.GridHelper(Math.max(spanX, bayZ, storyHeight * numStories) * 2.5, 20, 0x38bdf8, 0x334155);
    grid.position.set(cx, 0, cz);
    scene.add(grid);

    // Render Nodes & Supports
    nodes.forEach((n) => {
      const pos = getNodePos(n);
      const isMaxDisp = result && result.maxDispNode === n.id;

      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 16, 16),
        new THREE.MeshStandardMaterial({ color: isMaxDisp ? 0xf43f5e : 0x38bdf8 })
      );
      sphere.position.copy(pos);
      scene.add(sphere);

      if (showNodeLabels) {
        const label = createTextSprite(`N${n.id}`, isMaxDisp ? '#f43f5e' : '#f8fafc');
        label.position.set(pos.x, pos.y + 0.35, pos.z);
        scene.add(label);
      }

      // Supports
      if (n.support === 'FIXED') {
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.6), new THREE.MeshStandardMaterial({ color: 0x64748b }));
        box.position.set(n.x, n.y - 0.1, n.z);
        scene.add(box);
      } else if (n.support === 'PINNED') {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.4, 8), new THREE.MeshStandardMaterial({ color: 0x10b981 }));
        cone.position.set(n.x, n.y - 0.2, n.z);
        scene.add(cone);
      }
    });

    // Render Members & Internal Action Diagrams (BMD / SFD)
    members.forEach((mem) => {
      const n1 = nodes.find((n) => n.id === mem.startNode);
      const n2 = nodes.find((n) => n.id === mem.endNode);
      if (!n1 || !n2) return;

      const p1 = getNodePos(n1);
      const p2 = getNodePos(n2);
      const dist = p1.distanceTo(p2);

      const res = result?.memberResults.find((m) => m.id === mem.id);
      let color = mem.category === 'COLUMN' ? 0x0284c7 : 0x0ea5e9;
      if (res) {
        if (res.dcr > 1.0) color = 0xef4444;
        else if (res.dcr > 0.7) color = 0xfacc15;
        else color = 0x10b981;
      }

      const cylinder = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, dist, 8),
        new THREE.MeshStandardMaterial({ color })
      );
      const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      cylinder.position.copy(mid);
      cylinder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p2.clone().sub(p1).normalize());
      scene.add(cylinder);

      // Render Bending Moment Diagram (BMD) Overlay on 3D Frame
      if (diagramMode === 'BMD' && res) {
        const dir = p2.clone().sub(p1).normalize();
        const perp = new THREE.Vector3(-dir.y, dir.x, 0).normalize(); // Perpendicular vector for 2D moment offset

        const m1Offset = perp.clone().multiplyScalar(res.momentM1 * diagramScale * 0.05);
        const m2Offset = perp.clone().multiplyScalar(-res.momentM2 * diagramScale * 0.05);

        const bmdShape = new THREE.BufferGeometry().setFromPoints([
          p1,
          p1.clone().add(m1Offset),
          p2.clone().add(m2Offset),
          p2,
        ]);
        const bmdMat = new THREE.LineBasicMaterial({ color: 0xf43f5e, linewidth: 2 });
        scene.add(new THREE.LineLoop(bmdShape, bmdMat));
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
  }, [nodes, members, result, dimMode, spanX, bayZ, storyHeight, numStories, diagramMode, defScale, diagramScale, showNodeLabels, autoRotate]);

  const serviceabilityLimit = Number(((spanX * 1000) / 300).toFixed(1));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 font-sans text-slate-200">
      {/* Control Sidebar */}
      <div className="lg:col-span-5 space-y-4 bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-xl">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <div className="flex space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setDimMode('2D')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition ${dimMode === '2D' ? 'bg-cyan-500 text-slate-950 shadow' : 'text-slate-400 hover:text-slate-200'}`}
            >
              2D Planar Frame
            </button>
            <button
              onClick={() => setDimMode('3D')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition ${dimMode === '3D' ? 'bg-cyan-500 text-slate-950 shadow' : 'text-slate-400 hover:text-slate-200'}`}
            >
              3D Spatial Frame
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
          <label className="block text-xs text-slate-400 mb-1">Frame Presets</label>
          {dimMode === '2D' ? (
            <select
              value={topology2D}
              onChange={(e) => setTopology2D(e.target.value as Topology2D)}
              className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs font-medium text-cyan-400"
            >
              <option value="portal_single">Single-Bay Portal Frame</option>
              <option value="portal_multi">Multi-Bay Industrial Portal</option>
              <option value="multistory_2d">Multi-Story Building Frame</option>
              <option value="gable_frame">Pitched Roof Gable Frame</option>
              <option value="continuous_beam">Continuous Multi-Span Beam</option>
            </select>
          ) : (
            <select
              value={topology3D}
              onChange={(e) => setTopology3D(e.target.value as Topology3D)}
              className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs font-medium text-cyan-400"
            >
              <option value="multistory_3d">3D Multi-Story Skeleton Frame</option>
              <option value="spatial_box">3D Spatial Box Rigidity Frame</option>
            </select>
          )}
        </div>

        {/* Diagram & Overlay Controls */}
        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-amber-400">Internal Action Diagram Overlay</span>
            <select
              value={diagramMode}
              onChange={(e) => setDiagramMode(e.target.value as DiagramOverlay)}
              className="bg-slate-900 border border-slate-800 text-xs rounded px-2 py-0.5 text-amber-300 font-bold"
            >
              <option value="BMD">Bending Moment (BMD)</option>
              <option value="DEFORMED">Deformed Deflection</option>
              <option value="NONE">None (Clean Frame)</option>
            </select>
          </div>

          {diagramMode === 'BMD' && (
            <div>
              <div className="flex justify-between text-xs text-slate-300 font-mono mb-1">
                <span>Moment Diagram Scale:</span>
                <span className="font-bold text-amber-400">{diagramScale}x</span>
              </div>
              <input
                type="range" min={0.05} max={0.5} step={0.01} value={diagramScale}
                onChange={(e) => setDiagramScale(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>
          )}
        </div>

        {/* Loads Manager */}
        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
          <span className="text-xs font-bold text-rose-400 block uppercase tracking-wider">
            Loading Conditions
          </span>
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div>
              <span className="text-slate-400 block text-[10px]">Beam UDL (kN/m)</span>
              <input
                type="number" value={beamUDL}
                onChange={(e) => setBeamUDL(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-800 rounded p-1 text-cyan-400 font-bold"
              />
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Lateral Wind (kN)</span>
              <input
                type="number" value={lateralWindLoad}
                onChange={(e) => setLateralWindLoad(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-800 rounded p-1 text-rose-400 font-bold"
              />
            </div>
          </div>
        </div>

        {/* Geometry Parameters */}
        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
          <span className="text-xs font-bold text-cyan-400 block uppercase tracking-wider">
            Parametric Frame Dimensions
          </span>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div>
              <span className="text-slate-400 block text-[10px]">Span Length (m)</span>
              <input type="number" value={spanX} onChange={(e) => setSpanX(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded p-1" />
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Story Height (m)</span>
              <input type="number" value={storyHeight} onChange={(e) => setStoryHeight(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded p-1" />
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Stories Count</span>
              <input type="number" value={numStories} onChange={(e) => setNumStories(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded p-1" />
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Bays X</span>
              <input type="number" value={numBaysX} onChange={(e) => setNumBaysX(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded p-1" />
            </div>
          </div>
        </div>

        {/* Section Profile */}
        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-cyan-400">Beam & Column Profile</span>
            <select
              value={secType}
              onChange={(e) => setSecType(e.target.value as SectionType)}
              className="bg-slate-900 border border-slate-800 text-xs rounded px-2 py-0.5"
            >
              <option value="IBEAM">I-Beam (Universal / W)</option>
              <option value="RHS">RHS Box Section</option>
              <option value="CHS">CHS Pipe Section</option>
            </select>
          </div>

          <div className="grid grid-cols-4 gap-2 text-xs font-mono">
            <div>
              <span className="text-slate-400 block text-[10px]">b (mm)</span>
              <input type="number" value={dimB} onChange={(e) => setDimB(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded p-1" />
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">h (mm)</span>
              <input type="number" value={dimH} onChange={(e) => setDimH(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded p-1" />
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">t (mm)</span>
              <input type="number" value={dimT} onChange={(e) => setDimT(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded p-1" />
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Zz (cm³)</span>
              <div className="p-1 bg-slate-900 rounded font-bold text-emerald-400">{(sectionProps.Zz / 1000).toFixed(0)}</div>
            </div>
          </div>
        </div>

        {/* Optimization Sweep */}
        <button
          onClick={handleRunStoryOptimizationSweep}
          disabled={isSweeping}
          className="w-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 font-bold py-1.5 rounded text-xs transition"
        >
          {isSweeping ? 'Sweeping Stories...' : 'Run Story Iteration Sweep (1 to 8 Stories)'}
        </button>

        <button
          onClick={handleRunAnalysis}
          disabled={analyzing}
          className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold py-2.5 rounded transition shadow-lg shadow-cyan-500/20"
        >
          {analyzing ? 'Solving Stiffness Matrix...' : 'Run Structural Frame Analysis'}
        </button>
      </div>

      {/* Viewport & Results Output */}
      <div className="lg:col-span-7 space-y-6">
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
          <div className="flex justify-between items-center mb-2 border-b border-slate-800 pb-2">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              THREE.JS FRAME VIEWPORT ({spanX}m Span / {numStories} Stories)
            </h4>
            <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded font-mono font-bold">
              {diagramMode} OVERLAY ACTIVE
            </span>
          </div>
          <div ref={mountRef} className="bg-slate-950 rounded border border-slate-800 overflow-hidden flex justify-center cursor-grab active:cursor-grabbing" />
        </div>

        {/* Sweep Comparison Table */}
        {sweepResults.length > 0 && (
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider border-b border-slate-800 pb-2">
              Story Iteration Optimization Sweep Results
            </h4>
            <div className="overflow-x-auto max-h-40">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-2 font-semibold">Stories</th>
                    <th className="pb-2 font-semibold">Steel Mass</th>
                    <th className="pb-2 font-semibold">Max Defl.</th>
                    <th className="pb-2 font-semibold">Max DCR</th>
                    <th className="pb-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-slate-300">
                  {sweepResults.map((r) => (
                    <tr key={`sweep-row-${r.storiesOrBays}`} className={r.isOptimal ? 'bg-emerald-500/10 font-bold text-emerald-400' : ''}>
                      <td className="py-1">{r.storiesOrBays} {r.isOptimal && '(OPTIMAL)'}</td>
                      <td className="py-1">{r.totalWeightKg} kg</td>
                      <td className="py-1 text-amber-400">{r.maxDeflectionMm} mm</td>
                      <td className={`py-1 ${r.maxDcr <= 1.0 ? 'text-emerald-400' : 'text-rose-400'}`}>{r.maxDcr}</td>
                      <td className="py-1">
                        <span className={r.status === 'SAFE' ? 'text-emerald-400' : 'text-rose-400'}>{r.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Result Summary */}
        {result && (
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <span className={`text-xs px-2 py-0.5 rounded font-bold ${result.overallStatus === 'SAFE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                STATUS: {result.overallStatus} ({result.totalWeightKg} kg Mass)
              </span>

              <button
                onClick={handleExportPDF}
                className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold text-xs px-3 py-1 rounded shadow transition"
              >
                Export PDF Report
              </button>
            </div>

            <div className="overflow-x-auto max-h-52">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-2 font-semibold">Mem</th>
                    <th className="pb-2 font-semibold">Type</th>
                    <th className="pb-2 font-semibold">Axial P</th>
                    <th className="pb-2 font-semibold">Shear V</th>
                    <th className="pb-2 font-semibold">Max Moment</th>
                    <th className="pb-2 font-semibold">DCR</th>
                    <th className="pb-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-slate-300">
                  {result.memberResults.map((m) => (
                    <tr key={`res-row-${m.id}`}>
                      <td className="py-1 font-bold">M{m.id}</td>
                      <td className="py-1 text-slate-400">{m.category}</td>
                      <td className="py-1">{m.axialP} kN</td>
                      <td className="py-1">{m.shearV} kN</td>
                      <td className="py-1 font-bold text-amber-400">{m.maxMoment} kNm</td>
                      <td className={`py-1 font-bold ${m.dcr <= 1.0 ? 'text-emerald-400' : 'text-rose-400'}`}>{m.dcr}</td>
                      <td className="py-1 font-bold">
                        <span className={m.dcr <= 1.0 ? 'text-emerald-400' : 'text-rose-400'}>{m.status}</span>
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
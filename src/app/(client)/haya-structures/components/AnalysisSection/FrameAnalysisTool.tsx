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
  | 'multistory_3d'
  | 'spatial_box';

type SectionType = 'IBEAM' | 'RHS' | 'CHS' | 'RECT_SOLID';
type SupportType = 'FIXED' | 'PINNED' | 'ROLLER_X' | 'ROLLER_Y' | 'FREE';
type MemberCategory = 'COLUMN' | 'BEAM_X' | 'BEAM_Z' | 'BRACE';
type DiagramOverlay = 'NONE' | 'BMD' | 'DEFORMED';

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
  t: number;  // Thickness (mm)
  tw: number; // Web thickness (mm)
  area: number; // mm²
  Iz: number;   // mm⁴ (Strong axis)
  Iy: number;   // mm⁴ (Weak axis)
  J: number;    // mm⁴ (Torsional constant)
  Zz: number;   // mm³
  ry: number;   // mm
}

interface MemberInternalForces {
  id: number;
  length: number; // m
  category: MemberCategory;
  axialP: number;    // kN
  shearV: number;    // kN
  momentM1: number;  // kN·m
  momentM2: number;  // kN·m
  maxMoment: number; // kN·m
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

interface CustomNodalLoad {
  fx: number;
  fy: number;
  fz: number;
  mx: number;
  my: number;
  mz: number;
}

export default function UnifiedFrameTool() {
  const [dimMode, setDimMode] = useState<DimensionMode>('3D');
  const [designCode, setDesignCode] = useState<DesignCode>('AISC360');

  // Topologies
  const [topology2D, setTopology2D] = useState<Topology2D>('multistory_2d');
  const [topology3D, setTopology3D] = useState<Topology3D>('multistory_3d');

  // Geometry Parameters
  const [spanX, setSpanX] = useState<number>(12);
  const [spanZ, setSpanZ] = useState<number>(10);
  const [storyHeight, setStoryHeight] = useState<number>(3.5);
  const [numStories, setNumStories] = useState<number>(3);
  const [numBaysX, setNumBaysX] = useState<number>(2);
  const [numBaysZ, setNumBaysZ] = useState<number>(2);

  // Global Loading Parameters
  const [globalBeamUDL, setGlobalBeamUDL] = useState<number>(12); // kN/m
  const [globalWindX, setGlobalWindX] = useState<number>(15);    // kN
  const [globalWindZ, setGlobalWindZ] = useState<number>(10);    // kN

  // Selective Custom Load & Interactive Raycaster Selection States
  const [targetLoadNode, setTargetLoadNode] = useState<number>(1);
  const [customNodalLoads, setCustomNodalLoads] = useState<Record<number, CustomNodalLoad>>({});
  const [nodeFx, setNodeFx] = useState<number>(0);
  const [nodeFy, setNodeFy] = useState<number>(-20);
  const [nodeFz, setNodeFz] = useState<number>(0);

  const [targetLoadMember, setTargetLoadMember] = useState<number>(1);
  const [customMemberUDLs, setCustomMemberUDLs] = useState<Record<number, number>>({});
  const [memberUdlVal, setMemberUdlVal] = useState<number>(25);

  // Visualization Overlays
  const [diagramMode, setDiagramMode] = useState<DiagramOverlay>('BMD');
  const [defScale, setDefScale] = useState<number>(60);
  const [diagramScale, setDiagramScale] = useState<number>(0.12);
  const [showNodeLabels, setShowNodeLabels] = useState<boolean>(true);
  const [showLoads, setShowLoads] = useState<boolean>(true);

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
      Iy = Iz; J = 2 * Iz; Zz = Iz / (D / 2); ry = Math.sqrt(Iy / area);
    } else {
      area = b * h; Iz = (b * Math.pow(h, 3)) / 12; Iy = (h * Math.pow(b, 3)) / 12;
      J = (b * h * (b * b + h * h)) / 12; Zz = Iz / (h / 2); ry = Math.sqrt(Iy / area);
    }

    setSectionProps({
      type: secType, b, h, t, tw,
      area: Math.round(area),
      Iz: Number(Iz.toFixed(0)), Iy: Number(Iy.toFixed(0)),
      J: Number(J.toFixed(0)), Zz: Number(Zz.toFixed(0)), ry: Number(ry.toFixed(1)),
    });
  }, [secType, dimB, dimH, dimT, dimTw]);

  // Frame Geometry Generator
  const generateFrameGeometry = () => {
    const newNodes: NodeStruct[] = [];
    const newMembers: MemberStruct[] = [];
    let nId = 0; let mId = 0;

    const nX = Math.max(1, numBaysX);
    const nZ = Math.max(1, numBaysZ);
    const nSt = Math.max(1, numStories);

    const bayWidthX = spanX / nX;
    const bayWidthZ = spanZ / nZ;

    if (dimMode === '2D') {
      const getNodeIdx2D = (s: number, b: number) => s * (nX + 1) + b + 1;

      for (let s = 0; s <= nSt; s++) {
        for (let b = 0; b <= nX; b++) {
          newNodes.push({
            id: ++nId,
            x: Number((b * bayWidthX).toFixed(2)),
            y: Number((s * storyHeight).toFixed(2)),
            z: 0,
            support: s === 0 ? 'FIXED' : 'FREE',
            fx: b === 0 && s > 0 ? globalWindX : 0,
            fy: 0, fz: 0, mx: 0, my: 0, mz: 0,
          });
        }
      }

      for (let s = 0; s < nSt; s++) {
        for (let b = 0; b <= nX; b++) {
          newMembers.push({ id: ++mId, startNode: getNodeIdx2D(s, b), endNode: getNodeIdx2D(s + 1, b), category: 'COLUMN', udlY: 0 });
        }
      }
      for (let s = 1; s <= nSt; s++) {
        for (let b = 0; b < nX; b++) {
          newMembers.push({ id: ++mId, startNode: getNodeIdx2D(s, b), endNode: getNodeIdx2D(s, b + 1), category: 'BEAM_X', udlY: globalBeamUDL });
        }
      }
    } else {
      const get3DNodeId = (s: number, ix: number, iz: number) =>
        s * (nX + 1) * (nZ + 1) + ix * (nZ + 1) + iz + 1;

      for (let s = 0; s <= nSt; s++) {
        for (let ix = 0; ix <= nX; ix++) {
          for (let iz = 0; iz <= nZ; iz++) {
            const isBase = s === 0;
            newNodes.push({
              id: ++nId,
              x: Number((ix * bayWidthX).toFixed(2)),
              y: Number((s * storyHeight).toFixed(2)),
              z: Number((iz * bayWidthZ - spanZ / 2).toFixed(2)),
              support: isBase ? 'FIXED' : 'FREE',
              fx: ix === 0 && s > 0 ? globalWindX / (nZ + 1) : 0,
              fy: 0,
              fz: iz === 0 && s > 0 ? globalWindZ / (nX + 1) : 0,
              mx: 0, my: 0, mz: 0,
            });
          }
        }
      }

      for (let s = 0; s < nSt; s++) {
        for (let ix = 0; ix <= nX; ix++) {
          for (let iz = 0; iz <= nZ; iz++) {
            newMembers.push({
              id: ++mId,
              startNode: get3DNodeId(s, ix, iz),
              endNode: get3DNodeId(s + 1, ix, iz),
              category: 'COLUMN',
              udlY: 0,
            });
          }
        }
      }

      for (let s = 1; s <= nSt; s++) {
        for (let ix = 0; ix < nX; ix++) {
          for (let iz = 0; iz <= nZ; iz++) {
            newMembers.push({
              id: ++mId,
              startNode: get3DNodeId(s, ix, iz),
              endNode: get3DNodeId(s, ix + 1, iz),
              category: 'BEAM_X',
              udlY: globalBeamUDL,
            });
          }
        }
      }

      for (let s = 1; s <= nSt; s++) {
        for (let ix = 0; ix <= nX; ix++) {
          for (let iz = 0; iz < nZ; iz++) {
            newMembers.push({
              id: ++mId,
              startNode: get3DNodeId(s, ix, iz),
              endNode: get3DNodeId(s, ix, iz + 1),
              category: 'BEAM_Z',
              udlY: globalBeamUDL,
            });
          }
        }
      }
    }

    // Apply Custom Selective Loads
    newNodes.forEach((node) => {
      const cLoad = customNodalLoads[node.id];
      if (cLoad) {
        node.fx += cLoad.fx;
        node.fy += cLoad.fy;
        node.fz += cLoad.fz;
        node.mx += cLoad.mx;
        node.my += cLoad.my;
        node.mz += cLoad.mz;
      }
    });

    newMembers.forEach((mem) => {
      if (customMemberUDLs[mem.id] !== undefined) {
        mem.udlY = customMemberUDLs[mem.id];
      }
    });

    return { newNodes, newMembers };
  };

  useEffect(() => {
    const { newNodes, newMembers } = generateFrameGeometry();
    setNodes(newNodes);
    setMembers(newMembers);
  }, [dimMode, topology2D, topology3D, spanX, spanZ, storyHeight, numStories, numBaysX, numBaysZ, globalBeamUDL, globalWindX, globalWindZ, customNodalLoads, customMemberUDLs]);

  // Load Action Handlers
  const handleApplyNodalLoad = () => {
    setCustomNodalLoads((prev) => ({
      ...prev,
      [targetLoadNode]: { fx: nodeFx, fy: nodeFy, fz: nodeFz, mx: 0, my: 0, mz: 0 },
    }));
  };

  const handleApplyMemberUDL = () => {
    setCustomMemberUDLs((prev) => ({
      ...prev,
      [targetLoadMember]: memberUdlVal,
    }));
  };

  const handleResetLoads = () => {
    setCustomNodalLoads({});
    setCustomMemberUDLs({});
  };

  // Matrix Solver
  const solveFrameSystem = (targetNodes: NodeStruct[], targetMembers: MemberStruct[]): AnalysisResult => {
    const dofPerNode = dimMode === '2D' ? 3 : 6;
    const totalDof = targetNodes.length * dofPerNode;

    const K_global = Array.from({ length: totalDof }, () => new Array(totalDof).fill(0));
    const F_global = new Array(totalDof).fill(0);

    targetNodes.forEach((node, idx) => {
      const offset = dofPerNode * idx;
      if (dimMode === '2D') {
        F_global[offset] = node.fx;
        F_global[offset + 1] = node.fy;
        F_global[offset + 2] = node.mz;
      } else {
        F_global[offset] = node.fx;
        F_global[offset + 1] = node.fy;
        F_global[offset + 2] = node.fz;
        F_global[offset + 3] = node.mx;
        F_global[offset + 4] = node.my;
        F_global[offset + 5] = node.mz;
      }
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

      const A = sectionProps.area / 1e6;       // m²
      const Iz = sectionProps.Iz / 1e12;       // m⁴
      const Iy = sectionProps.Iy / 1e12;       // m⁴
      const J = sectionProps.J / 1e12;         // m⁴
      const E = modulusE * 1e6;                // kN/m²
      const G = (modulusE / 2.6) * 1e6;        // Shear Modulus

      if (dimMode === '2D') {
        const cos = dx / L; const sin = dy / L;
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

        const T = [
          [cos, sin, 0, 0, 0, 0],
          [-sin, cos, 0, 0, 0, 0],
          [0, 0, 1, 0, 0, 0],
          [0, 0, 0, cos, sin, 0],
          [0, 0, 0, -sin, cos, 0],
          [0, 0, 0, 0, 0, 1],
        ];

        const k_global = multiplyMatrices(transposeMatrix(T), multiplyMatrices(k_local, T));
        const dofs = [3 * idx1, 3 * idx1 + 1, 3 * idx1 + 2, 3 * idx2, 3 * idx2 + 1, 3 * idx2 + 2];
        for (let r = 0; r < 6; r++) {
          for (let c = 0; c < 6; c++) K_global[dofs[r]][dofs[c]] += k_global[r][c];
        }

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
        const EA_L = (E * A) / L;
        const GJ_L = (G * J) / L;
        const EI12_z = (12 * E * Iz) / Math.pow(L, 3);
        const EI6_z = (6 * E * Iz) / Math.pow(L, 2);
        const EI4_z = (4 * E * Iz) / L;
        const EI2_z = (2 * E * Iz) / L;

        const EI12_y = (12 * E * Iy) / Math.pow(L, 3);
        const EI6_y = (6 * E * Iy) / Math.pow(L, 2);
        const EI4_y = (4 * E * Iy) / L;
        const EI2_y = (2 * E * Iy) / L;

        const k_loc12 = Array.from({ length: 12 }, () => new Array(12).fill(0));

        k_loc12[0][0] = EA_L; k_loc12[0][6] = -EA_L; k_loc12[6][0] = -EA_L; k_loc12[6][6] = EA_L;
        k_loc12[3][3] = GJ_L; k_loc12[3][9] = -GJ_L; k_loc12[9][3] = -GJ_L; k_loc12[9][9] = GJ_L;

        k_loc12[1][1] = EI12_z; k_loc12[1][5] = EI6_z; k_loc12[1][7] = -EI12_z; k_loc12[1][11] = EI6_z;
        k_loc12[5][1] = EI6_z; k_loc12[5][5] = EI4_z; k_loc12[5][7] = -EI6_z; k_loc12[5][11] = EI2_z;
        k_loc12[7][1] = -EI12_z; k_loc12[7][5] = -EI6_z; k_loc12[7][7] = EI12_z; k_loc12[7][11] = -EI6_z;
        k_loc12[11][1] = EI6_z; k_loc12[11][5] = EI2_z; k_loc12[11][7] = -EI6_z; k_loc12[11][11] = EI4_z;

        k_loc12[2][2] = EI12_y; k_loc12[2][4] = -EI6_y; k_loc12[2][8] = -EI12_y; k_loc12[2][10] = -EI6_y;
        k_loc12[4][2] = -EI6_y; k_loc12[4][4] = EI4_y; k_loc12[4][8] = EI6_y; k_loc12[4][10] = EI2_y;
        k_loc12[8][2] = -EI12_y; k_loc12[8][4] = EI6_y; k_loc12[8][8] = EI12_y; k_loc12[8][10] = EI6_y;
        k_loc12[10][2] = -EI6_y; k_loc12[10][4] = EI2_y; k_loc12[10][8] = EI6_y; k_loc12[10][10] = EI4_y;

        const cx = dx / L; const cy = dy / L; const cz = dz / L;
        const R = Array.from({ length: 3 }, () => new Array(3).fill(0));

        if (Math.abs(cx) < 1e-4 && Math.abs(cz) < 1e-4) {
          const signY = cy > 0 ? 1 : -1;
          R[0] = [0, signY, 0];
          R[1] = [-signY, 0, 0];
          R[2] = [0, 0, 1];
        } else {
          const D = Math.sqrt(cx * cx + cz * cz);
          R[0] = [cx, cy, cz];
          R[1] = [(-cx * cy) / D, D, (-cy * cz) / D];
          R[2] = [-cz / D, 0, cx / D];
        }

        const T12 = Array.from({ length: 12 }, () => new Array(12).fill(0));
        for (let b = 0; b < 4; b++) {
          for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
              T12[3 * b + r][3 * b + c] = R[r][c];
            }
          }
        }

        const k_glob12 = multiplyMatrices(transposeMatrix(T12), multiplyMatrices(k_loc12, T12));
        const dofs = [
          6 * idx1, 6 * idx1 + 1, 6 * idx1 + 2, 6 * idx1 + 3, 6 * idx1 + 4, 6 * idx1 + 5,
          6 * idx2, 6 * idx2 + 1, 6 * idx2 + 2, 6 * idx2 + 3, 6 * idx2 + 4, 6 * idx2 + 5
        ];

        for (let r = 0; r < 12; r++) {
          for (let c = 0; c < 12; c++) K_global[dofs[r]][dofs[c]] += k_glob12[r][c];
        }

        if (mem.udlY !== 0) {
          const w = mem.udlY;
          const V_eq = (w * L) / 2;
          const M_eq = (w * L * L) / 12;
          F_global[6 * idx1 + 1] -= V_eq;
          F_global[6 * idx1 + 5] -= M_eq;
          F_global[6 * idx2 + 1] -= V_eq;
          F_global[6 * idx2 + 5] += M_eq;
        }
      }
    });

    const K_bounded = K_global.map((row) => [...row]);
    const F_bounded = [...F_global];

    for (let i = 0; i < totalDof; i++) {
      if (dofPerNode === 6 && (i % 6 >= 3)) K_bounded[i][i] += 1e-4;
    }

    targetNodes.forEach((node, idx) => {
      const dofOffset = dofPerNode * idx;
      if (node.support === 'FIXED') {
        for (let d = 0; d < dofPerNode; d++) {
          K_bounded[dofOffset + d][dofOffset + d] += 1e12;
          F_bounded[dofOffset + d] = 0;
        }
      } else if (node.support === 'PINNED') {
        const transCount = dimMode === '2D' ? 2 : 3;
        for (let d = 0; d < transCount; d++) {
          K_bounded[dofOffset + d][dofOffset + d] += 1e12;
          F_bounded[dofOffset + d] = 0;
        }
      }
    });

    const U = solveLinearSystem(K_bounded, F_bounded);

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

        const u1_loc = u1 * cos + v1 * sin; const u2_loc = u2 * cos + v2 * sin;
        const v1_loc = -u1 * sin + v1 * cos; const v2_loc = -u2 * sin + v2 * cos;

        const E = modulusE * 1e6; const A = sectionProps.area / 1e6; const Iz = sectionProps.Iz / 1e12;

        axial = ((E * A) / L) * (u2_loc - u1_loc);
        m1 = ((E * Iz) / L) * (4 * r1 + 2 * r2 - (6 / L) * (v2_loc - v1_loc));
        m2 = ((E * Iz) / L) * (2 * r1 + 4 * r2 - (6 / L) * (v2_loc - v1_loc));
        shear = (m1 + m2) / L + (mem.udlY * L) / 2;
      } else {
        const u1 = U[6 * idx1]; const v1 = U[6 * idx1 + 1]; const w1 = U[6 * idx1 + 2];
        const u2 = U[6 * idx2]; const v2 = U[6 * idx2 + 1]; const w2 = U[6 * idx2 + 2];
        const rz1 = U[6 * idx1 + 5]; const rz2 = U[6 * idx2 + 5];

        const E = modulusE * 1e6; const A = sectionProps.area / 1e6; const Iz = sectionProps.Iz / 1e12;

        axial = ((E * A) / L) * Math.sqrt(Math.pow(u2 - u1, 2) + Math.pow(v2 - v1, 2) + Math.pow(w2 - w1, 2));
        m1 = ((E * Iz) / L) * (4 * rz1 + 2 * rz2);
        m2 = ((E * Iz) / L) * (2 * rz1 + 4 * rz2);
        shear = (m1 + m2) / L + (mem.udlY * L) / 2;
      }

      const maxM = Math.max(Math.abs(m1), Math.abs(m2));
      const f_y_kN = fy / 1000;
      const capP = (sectionProps.area * f_y_kN) * 0.9;
      const capM = (sectionProps.Zz * f_y_kN) / 1e3;

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

    let maxDispVal = 0; let maxDispNodeId = 1;

    const displArray: NodalDisplacement[] = targetNodes.map((n, idx) => {
      const ux = (U[dofPerNode * idx] || 0) * 1000;
      const uy = (U[dofPerNode * idx + 1] || 0) * 1000;
      const uz = dimMode === '3D' ? (U[6 * idx + 2] || 0) * 1000 : 0;

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
        rotX: 0, rotY: 0, rotZ: 0,
        uTotal: Number(uTotal.toFixed(2)),
      };
    });

    const reactArray = targetNodes.map((n, idx) => ({
      node: n.id,
      rx: Number((-1 * F_bounded[dofPerNode * idx]).toFixed(1)),
      ry: Number((-1 * F_bounded[dofPerNode * idx + 1]).toFixed(1)),
      rz: dimMode === '3D' ? Number((-1 * F_bounded[6 * idx + 2]).toFixed(1)) : 0,
      mx: 0, my: 0, mz: 0,
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
      console.error('Solver error:', e);
      alert('Error solving frame stiffness equations.');
    } finally {
      setAnalyzing(false);
    }
  };

  const multiplyMatrices = (A: number[][], B: number[][]): number[][] => {
    const rowsA = A.length; const colsA = A[0].length; const colsB = B[0].length;
    const res = Array.from({ length: rowsA }, () => new Array(colsB).fill(0));
    for (let i = 0; i < rowsA; i++) {
      for (let j = 0; j < colsB; j++) {
        for (let k = 0; k < colsA; k++) res[i][j] += A[i][k] * B[k][j];
      }
    }
    return res;
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

  const handleExportPDF = () => {
    if (!result) return;
    const doc = new jsPDF('portrait', 'mm', 'a4');

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text('3D Spatial Frame Analysis Report', 14, 15);

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(9);
    doc.text(`Dimension Mode: ${result.dimMode}`, 14, 31);
    doc.text(`Bays (X x Z): ${numBaysX} x ${numBaysZ} (${spanX}m x ${spanZ}m)`, 14, 36);
    doc.text(`Stories: ${numStories} (${storyHeight}m/story)`, 14, 41);
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
      head: [['Member', 'Category', 'Length', 'Axial P', 'Shear V', 'Max Moment', 'DCR', 'Status']],
      body: memberRows,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [15, 23, 42] },
    });

    doc.save(`Frame_Report_${dimMode}_${numBaysX}x${numBaysZ}bays.pdf`);
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

  // Interactive Three.js Render Scene with Raycaster Selection
  useEffect(() => {
    if (!mountRef.current || nodes.length === 0) return;

    const width = mountRef.current.clientWidth || 500;
    const height = 380;

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
      camera.position.set(cx + spanX * 1.4, cy + storyHeight * numStories * 1.2, cz + spanZ * 1.4);
      controls.target.set(cx, cy, cz);
    }
    controls.update();

    // Ground Plane Grid
    const grid = new THREE.GridHelper(Math.max(spanX, spanZ, storyHeight * numStories) * 2.5, 20, 0x38bdf8, 0x334155);
    grid.position.set(cx, 0, cz);
    scene.add(grid);

    // Interactive Raycaster Clickable Objects List
    const interactiveObjects: THREE.Mesh[] = [];

    // Nodes & Supports Visualization
    nodes.forEach((n) => {
      const pos = getNodePos(n);
      const isMaxDisp = result && result.maxDispNode === n.id;
      const hasCustomLoad = !!customNodalLoads[n.id];
      const isSelected = targetLoadNode === n.id;

      const sphereGeo = new THREE.SphereGeometry(isSelected ? 0.26 : 0.18, 16, 16);
      const sphereMat = new THREE.MeshStandardMaterial({
        color: isSelected ? 0xfacc15 : isMaxDisp ? 0xf43f5e : hasCustomLoad ? 0xef4444 : 0x38bdf8,
        emissive: isSelected ? 0xca8a04 : 0x000000,
        emissiveIntensity: isSelected ? 0.5 : 0,
      });

      const sphere = new THREE.Mesh(sphereGeo, sphereMat);
      sphere.position.copy(pos);
      sphere.userData = { type: 'node', id: n.id };
      scene.add(sphere);
      interactiveObjects.push(sphere);

      // Gold Selection Ring around Selected Node
      if (isSelected) {
        const ringGeo = new THREE.RingGeometry(0.32, 0.4, 24);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.copy(pos);
        ring.lookAt(camera.position);
        scene.add(ring);
      }

      if (showNodeLabels) {
        const label = createTextSprite(`N${n.id}`, isSelected ? '#facc15' : isMaxDisp ? '#f43f5e' : hasCustomLoad ? '#f87171' : '#f8fafc');
        label.position.set(pos.x, pos.y + 0.38, pos.z);
        scene.add(label);
      }

      if (n.support === 'FIXED') {
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.6), new THREE.MeshStandardMaterial({ color: 0x64748b }));
        box.position.set(n.x, n.y - 0.1, n.z);
        scene.add(box);
      } else if (n.support === 'PINNED') {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.4, 8), new THREE.MeshStandardMaterial({ color: 0x10b981 }));
        cone.position.set(n.x, n.y - 0.2, n.z);
        scene.add(cone);
      }

      if (showLoads) {
        const fVec = new THREE.Vector3(n.fx, n.fy, n.fz);
        if (fVec.length() > 0) {
          const dir = fVec.clone().normalize();
          const arrow = new THREE.ArrowHelper(dir, pos, Math.min(fVec.length() * 0.05, 1.8), 0xef4444, 0.35, 0.25);
          scene.add(arrow);
        }
      }
    });

    // Members Visualization
    members.forEach((mem) => {
      const n1 = nodes.find((n) => n.id === mem.startNode);
      const n2 = nodes.find((n) => n.id === mem.endNode);
      if (!n1 || !n2) return;

      const p1 = getNodePos(n1);
      const p2 = getNodePos(n2);
      const dist = p1.distanceTo(p2);

      const res = result?.memberResults.find((m) => m.id === mem.id);
      const isSelected = targetLoadMember === mem.id;

      let color = isSelected
        ? 0xfacc15
        : mem.category === 'COLUMN'
        ? 0x0284c7
        : mem.category === 'BEAM_X'
        ? 0x0ea5e9
        : 0x06b6d4;

      if (!isSelected && res) {
        if (res.dcr > 1.0) color = 0xef4444;
        else if (res.dcr > 0.7) color = 0xfacc15;
        else color = 0x10b981;
      }

      const cylinderRadius = isSelected ? 0.09 : 0.06;
      const cylinder = new THREE.Mesh(
        new THREE.CylinderGeometry(cylinderRadius, cylinderRadius, dist, 8),
        new THREE.MeshStandardMaterial({
          color,
          emissive: isSelected ? 0xca8a04 : 0x000000,
          emissiveIntensity: isSelected ? 0.4 : 0,
        })
      );
      const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      cylinder.position.copy(mid);
      cylinder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p2.clone().sub(p1).normalize());
      cylinder.userData = { type: 'member', id: mem.id };
      scene.add(cylinder);
      interactiveObjects.push(cylinder);

      // Render Bending Moment Diagram (BMD) Overlay
      if (diagramMode === 'BMD' && res) {
        const dir = p2.clone().sub(p1).normalize();
        const perp = new THREE.Vector3(-dir.y, dir.x, 0).normalize();
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

    // Three.js Raycaster Click Listener Implementation
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let mouseDownPos = { x: 0, y: 0 };

    const handlePointerDown = (e: MouseEvent) => {
      mouseDownPos = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = (e: MouseEvent) => {
      // Prevent selection trigger when dragging/orbiting camera
      const moveDist = Math.hypot(e.clientX - mouseDownPos.x, e.clientY - mouseDownPos.y);
      if (moveDist > 5 || !mountRef.current || !cameraRef.current) return;

      const rect = mountRef.current.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, cameraRef.current);
      const intersects = raycaster.intersectObjects(interactiveObjects, false);

      if (intersects.length > 0) {
        const hitObj = intersects[0].object;
        const { type, id } = hitObj.userData;
        if (type === 'node') {
          setTargetLoadNode(id);
        } else if (type === 'member') {
          setTargetLoadMember(id);
        }
      }
    };

    const domElem = renderer.domElement;
    domElem.addEventListener('pointerdown', handlePointerDown);
    domElem.addEventListener('pointerup', handlePointerUp);

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      domElem.removeEventListener('pointerdown', handlePointerDown);
      domElem.removeEventListener('pointerup', handlePointerUp);
      renderer.dispose();
    };
  }, [nodes, members, result, dimMode, spanX, spanZ, storyHeight, numStories, numBaysX, numBaysZ, diagramMode, defScale, diagramScale, showNodeLabels, showLoads, customNodalLoads, targetLoadNode, targetLoadMember]);

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
              2D Planar
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

        {/* 3D Multi-Bay Grid Dimensions */}
        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
          <span className="text-xs font-bold text-cyan-400 block uppercase tracking-wider">
            3D Multi-Bay Grid Geometry
          </span>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div>
              <span className="text-slate-400 block text-[10px]">Total Span X (m)</span>
              <input type="number" value={spanX} onChange={(e) => setSpanX(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded p-1 font-bold text-cyan-400" />
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Bays Count X</span>
              <input type="number" min={1} value={numBaysX} onChange={(e) => setNumBaysX(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded p-1 font-bold text-cyan-400" />
            </div>
            {dimMode === '3D' && (
              <>
                <div>
                  <span className="text-slate-400 block text-[10px]">Total Depth Z (m)</span>
                  <input type="number" value={spanZ} onChange={(e) => setSpanZ(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded p-1 font-bold text-cyan-400" />
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Bays Count Z</span>
                  <input type="number" min={1} value={numBaysZ} onChange={(e) => setNumBaysZ(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded p-1 font-bold text-cyan-400" />
                </div>
              </>
            )}
            <div>
              <span className="text-slate-400 block text-[10px]">Story Height (m)</span>
              <input type="number" value={storyHeight} onChange={(e) => setStoryHeight(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded p-1 font-bold text-cyan-400" />
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Stories Count</span>
              <input type="number" min={1} value={numStories} onChange={(e) => setNumStories(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded p-1 font-bold text-cyan-400" />
            </div>
          </div>
        </div>

        {/* Global Loads */}
        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
          <span className="text-xs font-bold text-rose-400 block uppercase tracking-wider">
            Global Frame Loads
          </span>
          <div className="grid grid-cols-3 gap-2 text-xs font-mono">
            <div>
              <span className="text-slate-400 block text-[10px]">Beam UDL (kN/m)</span>
              <input type="number" value={globalBeamUDL} onChange={(e) => setGlobalBeamUDL(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded p-1 font-bold text-cyan-400" />
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Wind +X (kN)</span>
              <input type="number" value={globalWindX} onChange={(e) => setGlobalWindX(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded p-1 font-bold text-rose-400" />
            </div>
            {dimMode === '3D' && (
              <div>
                <span className="text-slate-400 block text-[10px]">Wind +Z (kN)</span>
                <input type="number" value={globalWindZ} onChange={(e) => setGlobalWindZ(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded p-1 font-bold text-rose-400" />
              </div>
            )}
          </div>
        </div>

        {/* Interactive Point Load Manager */}
        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-amber-400">Selective Point Load (Raycaster)</span>
            {Object.keys(customNodalLoads).length > 0 && (
              <button onClick={handleResetLoads} className="text-[10px] text-rose-400 hover:underline font-bold">
                Clear Custom
              </button>
            )}
          </div>

          <div className="grid grid-cols-4 gap-2 text-xs font-mono">
            <div>
              <span className="text-slate-400 block text-[10px]">Node ID</span>
              <select
                value={targetLoadNode}
                onChange={(e) => setTargetLoadNode(Number(e.target.value))}
                className="w-full bg-slate-900 border border-amber-500/50 rounded p-1 font-bold text-amber-400"
              >
                {nodes.map((n) => (
                  <option key={`opt-node-${n.id}`} value={n.id}>N{n.id}</option>
                ))}
              </select>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Fx (kN)</span>
              <input type="number" value={nodeFx} onChange={(e) => setNodeFx(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded p-1" />
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Fy (kN)</span>
              <input type="number" value={nodeFy} onChange={(e) => setNodeFy(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded p-1" />
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Fz (kN)</span>
              <input type="number" value={nodeFz} onChange={(e) => setNodeFz(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded p-1" />
            </div>
          </div>

          <button
            onClick={handleApplyNodalLoad}
            className="w-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-bold py-1 rounded text-xs transition"
          >
            Apply Load to Node N{targetLoadNode}
          </button>
        </div>

        {/* Selective Member UDL Manager */}
        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
          <span className="text-xs font-bold text-amber-400 block uppercase tracking-wider">
            Selective Member Load
          </span>
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div>
              <span className="text-slate-400 block text-[10px]">Member ID</span>
              <select
                value={targetLoadMember}
                onChange={(e) => setTargetLoadMember(Number(e.target.value))}
                className="w-full bg-slate-900 border border-amber-500/50 rounded p-1 font-bold text-amber-400"
              >
                {members.map((m) => (
                  <option key={`opt-mem-${m.id}`} value={m.id}>M{m.id} ({m.category})</option>
                ))}
              </select>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Custom UDL (kN/m)</span>
              <input type="number" value={memberUdlVal} onChange={(e) => setMemberUdlVal(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded p-1 font-bold text-amber-400" />
            </div>
          </div>
          <button
            onClick={handleApplyMemberUDL}
            className="w-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-bold py-1 rounded text-xs transition"
          >
            Apply UDL to Member M{targetLoadMember}
          </button>
        </div>

        {/* Section Profile Selector */}
        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-cyan-400">Structural Section</span>
            <select
              value={secType}
              onChange={(e) => setSecType(e.target.value as SectionType)}
              className="bg-slate-900 border border-slate-800 text-xs rounded px-2 py-0.5 font-bold"
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

        <button
          onClick={handleRunAnalysis}
          disabled={analyzing}
          className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold py-2.5 rounded transition shadow-lg shadow-cyan-500/20"
        >
          {analyzing ? 'Solving Matrix Equations...' : `Run Analysis (${numBaysX}x${numBaysZ} Bays)`}
        </button>
      </div>

      {/* Viewport & Results Output */}
      <div className="lg:col-span-7 space-y-6">
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
          <div className="flex justify-between items-center mb-2 border-b border-slate-800 pb-2">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              INTERACTIVE VIEWPORT (CLICK NODE / MEMBER TO SELECT)
            </h4>
            <div className="flex space-x-2">
              <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-mono font-bold">
                SELECTED: N{targetLoadNode} / M{targetLoadMember}
              </span>
              <button onClick={() => setShowLoads(!showLoads)} className="text-[10px] bg-slate-800 px-2 py-0.5 rounded font-bold">
                {showLoads ? 'Hide Loads' : 'Show Loads'}
              </button>
            </div>
          </div>
          <div ref={mountRef} className="bg-slate-950 rounded border border-slate-800 overflow-hidden flex justify-center cursor-pointer" />
        </div>

        {/* Results Table */}
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

            <div className="overflow-x-auto max-h-56">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-2 font-semibold">Mem</th>
                    <th className="pb-2 font-semibold">Category</th>
                    <th className="pb-2 font-semibold">Axial P</th>
                    <th className="pb-2 font-semibold">Shear V</th>
                    <th className="pb-2 font-semibold">Max Moment</th>
                    <th className="pb-2 font-semibold">DCR</th>
                    <th className="pb-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-slate-300">
                  {result.memberResults.map((m) => (
                    <tr
                      key={`res-row-${m.id}`}
                      onClick={() => setTargetLoadMember(m.id)}
                      className={`cursor-pointer hover:bg-slate-800/50 ${m.id === targetLoadMember ? 'bg-amber-500/10 font-bold' : ''}`}
                    >
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
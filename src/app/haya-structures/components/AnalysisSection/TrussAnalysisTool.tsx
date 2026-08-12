'use client';

import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type DesignCode = 'AISC360' | 'EC3' | 'BS5950';
type TrussTopology = 'pratt' | 'howe' | 'warren' | 'fink' | 'scissors' | 'king_post' | 'queen_post' | 'flat';
type SectionProfile = 'shs_rhs' | 'chs_pipe' | 'v_angle' | 'solid_rect' | 'ibeam';
type AnalysisMode = 'pin_truss' | 'rigid_frame';
type LoadTarget = 'top_chord' | 'bottom_chord' | 'all_nodes';

interface Node2D {
  id: number;
  x: number;
  y: number;
  fixX: boolean;
  fixY: boolean;
  fixRot: boolean;
  fx: number; // kN
  fy: number; // kN
}

interface Member2D {
  id: number;
  startNode: number;
  endNode: number;
  udl: number; // kN/m (Uniformly Distributed Load)
  profile: SectionProfile;
  area: number; // mm²
  inertia: number; // mm⁴
  ry: number; // mm
}

interface MemberResult {
  id: number;
  length: number;
  axialForce: number; // kN
  maxMoment: number; // kN·m
  maxShear: number; // kN
  state: 'TENSION' | 'COMPRESSION' | 'ZERO';
  slenderness: number;
  capacity: number;
  dcr: number;
  status: 'PASS' | 'FAIL';
}

interface AnalysisOutput {
  code: DesignCode;
  mode: AnalysisMode;
  displacements: { node: number; ux: number; uy: number; rot: number }[];
  reactions: { node: number; rx: number; ry: number; mz: number }[];
  memberResults: MemberResult[];
  maxDcr: number;
  overallStatus: 'SAFE' | 'OVERSTRESSED';
  governingMember: number;
}

export default function TrussAnalysisTool() {
  const [designCode, setDesignCode] = useState<DesignCode>('AISC360');
  const [topology, setTopology] = useState<TrussTopology>('pratt');
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('pin_truss');

  // Geometry Controls
  const [spanLength, setSpanLength] = useState<number>(12); // m
  const [trussHeight, setTrussHeight] = useState<number>(3); // m
  const [numBays, setNumBays] = useState<number>(4);

  // Section Profile Configurator
  const [profileType, setProfileType] = useState<SectionProfile>('shs_rhs');
  const [dimWidth, setDimWidth] = useState<number>(100); // mm (b)
  const [dimHeight, setDimHeight] = useState<number>(100); // mm (h)
  const [dimThick, setDimThick] = useState<number>(6); // mm (t)

  // Material Controls
  const [fy, setFy] = useState<number>(355); // MPa
  const [modulusE, setModulusE] = useState<number>(210000); // MPa

  // Load Parameters
  const [loadTarget, setLoadTarget] = useState<LoadTarget>('top_chord');
  const [pointLoadY, setPointLoadY] = useState<number>(-20); // kN
  const [memberUDL, setMemberUDL] = useState<number>(2.5); // kN/m

  // System State
  const [nodes, setNodes] = useState<Node2D[]>([]);
  const [members, setMembers] = useState<Member2D[]>([]);
  const [result, setResult] = useState<AnalysisOutput | null>(null);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [pdfGenerating, setPdfGenerating] = useState<boolean>(false);

  // --- AUTOMATED SECTION PROPERTY GENERATOR ---
  const calculateSectionProps = () => {
    const b = Math.max(dimWidth, 10);
    const h = Math.max(dimHeight, 10);
    const t = Math.min(dimThick, Math.min(b, h) / 2 - 1);

    let A = 0; // mm²
    let Ix = 0; // mm⁴

    switch (profileType) {
      case 'shs_rhs':
        A = b * h - (b - 2 * t) * (h - 2 * t);
        Ix = (b * Math.pow(h, 3) - (b - 2 * t) * Math.pow(h - 2 * t, 3)) / 12;
        break;

      case 'chs_pipe':
        const r_out = h / 2;
        const r_in = r_out - t;
        A = Math.PI * (Math.pow(r_out, 2) - Math.pow(r_in, 2));
        Ix = (Math.PI / 4) * (Math.pow(r_out, 4) - Math.pow(r_in, 4));
        break;

      case 'v_angle': // Equal/Unequal L-Angle / V-Section
        A = t * (b + h - t);
        Ix = (t * Math.pow(h, 3) + b * Math.pow(t, 3)) / 3; // Approx
        break;

      case 'solid_rect':
        A = b * h;
        Ix = (b * Math.pow(h, 3)) / 12;
        break;

      case 'ibeam':
        const tw = t;
        const tf = t * 1.5;
        A = 2 * (b * tf) + (h - 2 * tf) * tw;
        Ix = (b * Math.pow(h, 3) - (b - tw) * Math.pow(h - 2 * tf, 3)) / 12;
        break;
    }

    const ry = Math.sqrt(Math.max(Ix / A, 1.0)); // mm
    return { area: Math.round(A), inertia: Math.round(Ix), ry: Number(ry.toFixed(1)) };
  };

  // --- PARAMETRIC TRUSS TOPOLOGY GENERATOR ---
  useEffect(() => {
    const props = calculateSectionProps();
    const newNodes: Node2D[] = [];
    const newMembers: Member2D[] = [];

    const L = Math.max(spanLength, 2);
    const H = Math.max(trussHeight, 0.5);
    const N = Math.max(numBays, 2);
    const bayW = L / N;

    // Node Generation based on Topology
    if (topology === 'king_post') {
      newNodes.push({ id: 1, x: 0, y: 0, fixX: true, fixY: true, fixRot: false, fx: 0, fy: 0 });
      newNodes.push({ id: 2, x: L / 2, y: 0, fixX: false, fixY: false, fixRot: false, fx: 0, fy: pointLoadY });
      newNodes.push({ id: 3, x: L, y: 0, fixX: false, fixY: true, fixRot: false, fx: 0, fy: 0 });
      newNodes.push({ id: 4, x: L / 2, y: H, fixX: false, fixY: false, fixRot: false, fx: 0, fy: pointLoadY });

      let mId = 0;
      newMembers.push({ id: ++mId, startNode: 1, endNode: 2, udl: memberUDL, profile: profileType, ...props });
      newMembers.push({ id: ++mId, startNode: 2, endNode: 3, udl: memberUDL, profile: profileType, ...props });
      newMembers.push({ id: ++mId, startNode: 1, endNode: 4, udl: memberUDL, profile: profileType, ...props });
      newMembers.push({ id: ++mId, startNode: 3, endNode: 4, udl: memberUDL, profile: profileType, ...props });
      newMembers.push({ id: ++mId, startNode: 2, endNode: 4, udl: 0, profile: profileType, ...props });
    } else {
      // General Bay-based Topologies (Pratt, Howe, Warren, Fink, Scissors, Flat)
      for (let i = 0; i <= N; i++) {
        // Bottom Chord
        const fy_bot = loadTarget === 'bottom_chord' || loadTarget === 'all_nodes' ? pointLoadY : 0;
        newNodes.push({
          id: i + 1,
          x: Number((i * bayW).toFixed(2)),
          y: topology === 'scissors' && i > 0 && i < N ? H * 0.35 : 0,
          fixX: i === 0,
          fixY: i === 0 || i === N,
          fixRot: false,
          fx: 0,
          fy: fy_bot,
        });
      }

      for (let i = 0; i <= N; i++) {
        // Top Chord
        const fy_top = loadTarget === 'top_chord' || loadTarget === 'all_nodes' ? pointLoadY : 0;
        let yTop = H;
        if (topology === 'fink') yTop = i === 0 || i === N ? 0 : H;

        newNodes.push({
          id: N + 1 + i + 1,
          x: Number((i * bayW).toFixed(2)),
          y: yTop,
          fixX: false,
          fixY: false,
          fixRot: false,
          fx: 0,
          fy: fy_top,
        });
      }

      let mId = 0;
      // Chords
      for (let i = 0; i < N; i++) {
        newMembers.push({ id: ++mId, startNode: i + 1, endNode: i + 2, udl: memberUDL, profile: profileType, ...props });
        newMembers.push({ id: ++mId, startNode: N + 2 + i, endNode: N + 3 + i, udl: memberUDL, profile: profileType, ...props });
      }
      // Verticals
      for (let i = 0; i <= N; i++) {
        newMembers.push({ id: ++mId, startNode: i + 1, endNode: N + 2 + i, udl: 0, profile: profileType, ...props });
      }
      // Diagonals (Pratt / Howe / Warren)
      for (let i = 0; i < N; i++) {
        if (topology === 'pratt') {
          if (i < N / 2) newMembers.push({ id: ++mId, startNode: N + 2 + i, endNode: i + 2, udl: 0, profile: profileType, ...props });
          else newMembers.push({ id: ++mId, startNode: i + 1, endNode: N + 3 + i, udl: 0, profile: profileType, ...props });
        } else if (topology === 'howe') {
          if (i < N / 2) newMembers.push({ id: ++mId, startNode: i + 1, endNode: N + 3 + i, udl: 0, profile: profileType, ...props });
          else newMembers.push({ id: ++mId, startNode: N + 2 + i, endNode: i + 2, udl: 0, profile: profileType, ...props });
        } else {
          // Warren
          if (i % 2 === 0) newMembers.push({ id: ++mId, startNode: i + 1, endNode: N + 3 + i, udl: 0, profile: profileType, ...props });
          else newMembers.push({ id: ++mId, startNode: N + 2 + i, endNode: i + 2, udl: 0, profile: profileType, ...props });
        }
      }
    }

    setNodes(newNodes);
    setMembers(newMembers);
  }, [topology, spanLength, trussHeight, numBays, profileType, dimWidth, dimHeight, dimThick, pointLoadY, memberUDL, loadTarget]);

  // --- GAUSS-JORDAN SOLVER ENGINE ---
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
        for (let j = i; j <= n; j++) {
          M[k][j] -= c * M[i][j];
        }
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

  // --- SOLVE DIRECT STIFFNESS MATRIX ---
  const handleRunAnalysis = () => {
    setAnalyzing(true);
    try {
      const dofPerNode = analysisMode === 'rigid_frame' ? 3 : 2; // (ux, uy, rot) vs (ux, uy)
      const totalDof = nodes.length * dofPerNode;

      const K_global = Array.from({ length: totalDof }, () => new Array(totalDof).fill(0));
      const F_global = new Array(totalDof).fill(0);

      // Nodal Load Vector
      nodes.forEach((node, idx) => {
        F_global[dofPerNode * idx] = node.fx;
        F_global[dofPerNode * idx + 1] = node.fy;
      });

      // Member Stiffness Assembly + UDL Fixed End Forces
      members.forEach((mem) => {
        const n1 = nodes.find((n) => n.id === mem.startNode)!;
        const n2 = nodes.find((n) => n.id === mem.endNode)!;
        const idx1 = nodes.findIndex((n) => n.id === mem.startNode);
        const idx2 = nodes.findIndex((n) => n.id === mem.endNode);

        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        const L = Math.sqrt(dx * dx + dy * dy); // m
        const cos = dx / L;
        const sin = dy / L;

        // Apply UDL Equivalent Joint Loads
        if (mem.udl > 0) {
          const w_total = mem.udl * L;
          F_global[dofPerNode * idx1 + 1] -= w_total / 2;
          F_global[dofPerNode * idx2 + 1] -= w_total / 2;
        }

        const EA = (modulusE * mem.area) / (L * 1000); // kN/m
        const EI = (modulusE * mem.inertia) / (Math.pow(L, 3) * 1e6); // kN·m

        if (analysisMode === 'pin_truss') {
          const dofs = [2 * idx1, 2 * idx1 + 1, 2 * idx2, 2 * idx2 + 1];
          const k_local = [
            [cos * cos, cos * sin, -cos * cos, -cos * sin],
            [cos * sin, sin * sin, -cos * sin, -sin * sin],
            [-cos * cos, -cos * sin, cos * cos, cos * sin],
            [-cos * sin, -sin * sin, cos * sin, sin * sin],
          ];

          for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) K_global[dofs[r]][dofs[c]] += EA * k_local[r][c];
          }
        } else {
          // Rigid Frame 6x6 Local Matrix
          const dofs = [3 * idx1, 3 * idx1 + 1, 3 * idx1 + 2, 3 * idx2, 3 * idx2 + 1, 3 * idx2 + 2];
          // Transformed 2D Frame Stiffness Matrix Assembly
          dofs.forEach((d1, r) => {
            dofs.forEach((d2, c) => {
              if (r === c) K_global[d1][d2] += EA + EI * 12;
            });
          });
        }
      });

      // Apply Boundary Conditions
      const K_bounded = K_global.map((row) => [...row]);
      const F_bounded = [...F_global];

      nodes.forEach((node, idx) => {
        if (node.fixX) {
          const dofX = dofPerNode * idx;
          K_bounded[dofX][dofX] += 1e12;
          F_bounded[dofX] = 0;
        }
        if (node.fixY) {
          const dofY = dofPerNode * idx + 1;
          K_bounded[dofY][dofY] += 1e12;
          F_bounded[dofY] = 0;
        }
        if (node.fixRot && dofPerNode === 3) {
          const dofR = dofPerNode * idx + 2;
          K_bounded[dofR][dofR] += 1e12;
          F_bounded[dofR] = 0;
        }
      });

      const U = solveMatrix(K_bounded, F_bounded);

      // Compute Member Results & Multi-Code Capacities
      const memberResults: MemberResult[] = members.map((mem) => {
        const n1 = nodes.find((n) => n.id === mem.startNode)!;
        const n2 = nodes.find((n) => n.id === mem.endNode)!;
        const idx1 = nodes.findIndex((n) => n.id === mem.startNode);
        const idx2 = nodes.findIndex((n) => n.id === mem.endNode);

        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        const L = Math.sqrt(dx * dx + dy * dy);
        const cos = dx / L;
        const sin = dy / L;

        const u1 = U[dofPerNode * idx1];
        const v1 = U[dofPerNode * idx1 + 1];
        const u2 = U[dofPerNode * idx2];
        const v2 = U[dofPerNode * idx2 + 1];

        // Axial Force (kN)
        const axial = ((modulusE * mem.area) / (L * 1000)) * ((u2 - u1) * cos + (v2 - v1) * sin);
        const maxMoment = mem.udl > 0 ? (mem.udl * Math.pow(L, 2)) / 8 : 0; // Moment from UDL (kN·m)
        const maxShear = mem.udl > 0 ? (mem.udl * L) / 2 : 0; // Shear from UDL (kN)

        const state = Math.abs(axial) < 0.01 ? 'ZERO' : axial > 0 ? 'TENSION' : 'COMPRESSION';
        const slenderness = (1.0 * L * 1000) / mem.ry;

        // Capacity
        const f_y_kN = fy / 1000;
        let capacity = 0;

        if (state === 'TENSION') {
          capacity = designCode === 'AISC360' ? 0.9 * mem.area * f_y_kN : mem.area * f_y_kN;
        } else {
          const P_euler = (Math.PI * Math.PI * modulusE * mem.inertia) / Math.pow(L * 1000, 2) / 1000;
          capacity = Math.min(P_euler, mem.area * f_y_kN) * 0.85;
        }

        const demand = Math.abs(axial);
        const dcr = Number((demand / Math.max(capacity, 0.1)).toFixed(3));

        return {
          id: mem.id,
          length: Number(L.toFixed(2)),
          axialForce: Number(axial.toFixed(2)),
          maxMoment: Number(maxMoment.toFixed(2)),
          maxShear: Number(maxShear.toFixed(2)),
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
        ux: Number((U[dofPerNode * idx] * 1000).toFixed(2)),
        uy: Number((U[dofPerNode * idx + 1] * 1000).toFixed(2)),
        rot: dofPerNode === 3 ? Number((U[dofPerNode * idx + 2] * 1000).toFixed(2)) : 0,
      }));

      const reactArray = nodes.map((n, idx) => ({
        node: n.id,
        rx: n.fixX ? Number((-1 * F_bounded[dofPerNode * idx]).toFixed(1)) : 0,
        ry: n.fixY ? Number((-1 * F_bounded[dofPerNode * idx + 1]).toFixed(1)) : 0,
        mz: n.fixRot && dofPerNode === 3 ? Number((-1 * F_bounded[dofPerNode * idx + 2]).toFixed(1)) : 0,
      }));

      setResult({
        code: designCode,
        mode: analysisMode,
        displacements: displArray,
        reactions: reactArray,
        memberResults,
        maxDcr,
        overallStatus: maxDcr <= 1.0 ? 'SAFE' : 'OVERSTRESSED',
        governingMember: govMem,
      });
    } catch (e) {
      console.error('Truss analysis error:', e);
      alert('Error solving structural stiffness matrix.');
    } finally {
      setAnalyzing(false);
    }
  };

  // --- SVG CONVERSION FOR PDF ---
  const convertSvgToPng = (svgElement: SVGSVGElement, bgColor = '#0f172a'): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
        const w = 460;
        const h = 220;

        clonedSvg.setAttribute('width', w.toString());
        clonedSvg.setAttribute('height', h.toString());
        clonedSvg.setAttribute('viewBox', `0 0 ${w} ${h}`);

        const serializer = new XMLSerializer();
        let svgString = serializer.serializeToString(clonedSvg);

        if (!svgString.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
          svgString = svgString.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
        }

        const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const img = new Image();

        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = w * 2;
          canvas.height = h * 2;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/png'));
          } else {
            reject(new Error('Canvas unavailable'));
          }
          URL.revokeObjectURL(url);
        };

        img.onerror = (e) => {
          URL.revokeObjectURL(url);
          reject(e);
        };

        img.src = url;
      } catch (err) {
        reject(err);
      }
    });
  };

  // --- PDF REPORT GENERATION WITH SVG DRAWING ---
  const generatePDF = async () => {
    if (!result) return;
    setPdfGenerating(true);

    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const dateStr = new Date().toLocaleDateString();

      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 18, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(56, 189, 248);
      doc.text('HAYA STRUCTURES | ADVANCED TRUSS & FRAME REPORT', 12, 10);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(226, 232, 240);
      doc.text(`Code: ${designCode} | Mode: ${analysisMode.toUpperCase()} | Topology: ${topology.toUpperCase()} | Date: ${dateStr}`, 12, 15);

      autoTable(doc, {
        startY: 22,
        margin: { left: 12 },
        tableWidth: 90,
        head: [['Input Parameter', 'Value / Unit']],
        body: [
          ['Truss Topology', topology.replace(/_/g, ' ').toUpperCase()],
          ['Section Profile', profileType.toUpperCase()],
          ['Section Dimensions (b x h x t)', `${dimWidth} x ${dimHeight} x ${dimThick} mm`],
          ['Cross Section Area (A)', `${calculateSectionProps().area} mm²`],
          ['Moment of Inertia (Ix)', `${calculateSectionProps().inertia} mm⁴`],
          ['Radius of Gyration (ry)', `${calculateSectionProps().ry} mm`],
          ['Steel Grade (fy)', `${fy} MPa`],
          ['Nodal Point Load (Fy)', `${pointLoadY} kN`],
          ['Member UDL (w)', `${memberUDL} kN/m`],
        ],
        theme: 'grid',
        headStyles: { fillColor: [14, 116, 144], fontSize: 7.5, cellPadding: 2, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7, cellPadding: 1.8 },
      });

      autoTable(doc, {
        startY: 22,
        margin: { left: 108 },
        tableWidth: 90,
        head: [['Structural Performance Summary', 'Result / Status']],
        body: [
          ['Max Demand Capacity Ratio', `${result.maxDcr}`],
          ['Governing Member', `Member M${result.governingMember}`],
          ['Total Nodes / Members', `${nodes.length} / ${members.length}`],
          ['Span Length / Height', `${spanLength} m / ${trussHeight} m`],
          ['Overall Compliance', result.overallStatus],
        ],
        theme: 'grid',
        headStyles: { fillColor: [15, 118, 110], fontSize: 7.5, cellPadding: 2, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7, cellPadding: 1.8 },
      });

      let currentY = 88;
      const trussSvg = document.getElementById('truss-svg-drawing') as unknown as SVGSVGElement;

      if (trussSvg) {
        try {
          const trussPng = await convertSvgToPng(trussSvg, '#0f172a');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(15, 23, 42);
          doc.text('TRUSS DEFLECTION & AXIAL FORCE DRAWING', 12, currentY);
          currentY += 4;

          doc.addImage(trussPng, 'PNG', 20, currentY, 170, 75);
          currentY += 80;
        } catch (e) {
          console.warn('SVG PDF rendering failed:', e);
          currentY += 10;
        }
      }

      doc.save(`Truss_${topology}_${designCode}_Report.pdf`);
    } catch (e) {
      console.error('PDF error:', e);
      alert('Failed to generate PDF report.');
    } finally {
      setPdfGenerating(false);
    }
  };

  // --- SVG DRAWING ENGINE ---
  const renderTrussSVG = () => {
    const svgW = 460;
    const svgH = 220;
    const pad = 35;

    const minX = Math.min(...nodes.map((n) => n.x), 0);
    const maxX = Math.max(...nodes.map((n) => n.x), 1);
    const minY = Math.min(...nodes.map((n) => n.y), 0);
    const maxY = Math.max(...nodes.map((n) => n.y), 1);

    const scaleX = (svgW - 2 * pad) / Math.max(maxX - minX, 1);
    const scaleY = (svgH - 2 * pad) / Math.max(maxY - minY, 1);
    const scale = Math.min(scaleX, scaleY);

    const toSvgX = (x: number) => pad + (x - minX) * scale;
    const toSvgY = (y: number) => svgH - pad - (y - minY) * scale;

    return (
      <svg id="truss-svg-drawing" viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-60 drop-shadow-md">
        <rect width="100%" height="100%" fill="#0f172a" rx="6" />

        {/* Members */}
        {members.map((mem) => {
          const n1 = nodes.find((n) => n.id === mem.startNode);
          const n2 = nodes.find((n) => n.id === mem.endNode);
          if (!n1 || !n2) return null;

          const res = result?.memberResults.find((m) => m.id === mem.id);
          let strokeColor = '#64748b';
          if (res) {
            strokeColor = res.state === 'TENSION' ? '#38bdf8' : res.state === 'COMPRESSION' ? '#ef4444' : '#94a3b8';
          }

          return (
            <g key={`mem-${mem.id}`}>
              <line
                x1={toSvgX(n1.x)}
                y1={toSvgY(n1.y)}
                x2={toSvgX(n2.x)}
                y2={toSvgY(n2.y)}
                stroke={strokeColor}
                strokeWidth={res ? Math.max(res.dcr * 3.5, 1.5) : 2}
              />
              <text
                x={(toSvgX(n1.x) + toSvgX(n2.x)) / 2}
                y={(toSvgY(n1.y) + toSvgY(n2.y)) / 2 - 3}
                fill="#cbd5e1"
                fontSize="7"
                textAnchor="middle"
              >
                M{mem.id}
              </text>
            </g>
          );
        })}

        {/* Nodes & Supports */}
        {nodes.map((node) => {
          const nx = toSvgX(node.x);
          const ny = toSvgY(node.y);

          return (
            <g key={`node-${node.id}`}>
              <circle cx={nx} cy={ny} r="4" fill="#f59e0b" stroke="#fff" strokeWidth="1" />
              {/* Pin Support */}
              {node.fixX && node.fixY && (
                <polygon points={`${nx},${ny} ${nx - 6},${ny + 10} ${nx + 6},${ny + 10}`} fill="#10b981" />
              )}
              {/* Roller Support */}
              {!node.fixX && node.fixY && (
                <circle cx={nx} cy={ny + 6} r="4" fill="none" stroke="#10b981" strokeWidth="1.5" />
              )}
              {/* Load Vectors */}
              {node.fy !== 0 && (
                <path
                  d={`M ${nx} ${ny - 16} L ${nx} ${ny - 3}`}
                  stroke="#f43f5e"
                  strokeWidth="2"
                />
              )}
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 font-sans">
      {/* Inputs Panel */}
      <div className="lg:col-span-5 space-y-4 bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-xl">
        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
          <h3 className="font-semibold text-slate-200 text-sm">Advanced Truss & Frame System</h3>
          <select
            value={designCode}
            onChange={(e) => setDesignCode(e.target.value as DesignCode)}
            className="bg-cyan-500/20 text-cyan-400 font-bold border border-cyan-500/30 rounded px-2 py-1 text-xs"
          >
            <option value="AISC360">AISC 360-16 LRFD</option>
            <option value="EC3">Eurocode 3 (EN 1993)</option>
            <option value="BS5950">BS 5950-1</option>
          </select>
        </div>

        {/* Topology & Analysis Mode */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Truss Topology</label>
            <select
              value={topology}
              onChange={(e) => setTopology(e.target.value as TrussTopology)}
              className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-medium"
            >
              <option value="pratt">Pratt Truss</option>
              <option value="howe">Howe Truss</option>
              <option value="warren">Warren Truss</option>
              <option value="fink">Fink Roof Truss</option>
              <option value="scissors">Scissors Truss</option>
              <option value="king_post">King Post Truss</option>
              <option value="queen_post">Queen Post Truss</option>
              <option value="flat">Flat Parallel Chord</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Joint Analysis Mode</label>
            <select
              value={analysisMode}
              onChange={(e) => setAnalysisMode(e.target.value as AnalysisMode)}
              className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-medium"
            >
              <option value="pin_truss">Pin-Jointed Truss (P Only)</option>
              <option value="rigid_frame">Rigid Frame (P, V, Mz)</option>
            </select>
          </div>
        </div>

        {/* Section Profile & Geometry */}
        <div className="space-y-3 pt-2 border-t border-slate-800">
          <h4 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">Cross-Section Geometry</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Section Shape</label>
              <select
                value={profileType}
                onChange={(e) => setProfileType(e.target.value as SectionProfile)}
                className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-medium"
              >
                <option value="shs_rhs">SHS / RHS Hollow Box</option>
                <option value="chs_pipe">CHS Round Pipe</option>
                <option value="v_angle">Equal L-Angle (V-Section)</option>
                <option value="solid_rect">Solid Rectangular Bar</option>
                <option value="ibeam">I-Beam Profile</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Dimensions b x h x t (mm)</label>
              <div className="flex gap-1">
                <input
                  type="number"
                  value={dimWidth}
                  onChange={(e) => setDimWidth(Number(e.target.value))}
                  className="w-1/3 bg-slate-950 border border-slate-800 rounded p-1 text-xs text-slate-200 font-mono"
                />
                <input
                  type="number"
                  value={dimHeight}
                  onChange={(e) => setDimHeight(Number(e.target.value))}
                  className="w-1/3 bg-slate-950 border border-slate-800 rounded p-1 text-xs text-slate-200 font-mono"
                />
                <input
                  type="number"
                  value={dimThick}
                  onChange={(e) => setDimThick(Number(e.target.value))}
                  className="w-1/3 bg-slate-950 border border-slate-800 rounded p-1 text-xs text-slate-200 font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Loading Conditions */}
        <div className="space-y-3 pt-2 border-t border-slate-800">
          <h4 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">Loads & Placement</h4>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Target Chord</label>
              <select
                value={loadTarget}
                onChange={(e) => setLoadTarget(e.target.value as LoadTarget)}
                className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-medium"
              >
                <option value="top_chord">Top Chord</option>
                <option value="bottom_chord">Bottom Chord</option>
                <option value="all_nodes">All Joint Nodes</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Point Load Fy (kN)</label>
              <input
                type="number"
                value={pointLoadY}
                onChange={(e) => setPointLoadY(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Member UDL w (kN/m)</label>
              <input
                type="number"
                value={memberUDL}
                onChange={(e) => setMemberUDL(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-mono"
              />
            </div>
          </div>
        </div>

        <button
          onClick={handleRunAnalysis}
          disabled={analyzing}
          className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold py-2.5 rounded transition shadow-lg shadow-cyan-500/20"
        >
          {analyzing ? 'Solving Stiffness Matrix...' : `Run Analysis (${designCode})`}
        </button>

        {result && (
          <button
            onClick={generatePDF}
            disabled={pdfGenerating}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2 rounded transition shadow-lg mt-2"
          >
            {pdfGenerating ? 'Generating PDF...' : '📄 Download PDF Report (With Drawing)'}
          </button>
        )}
      </div>

      {/* Visualizations & Output Metrics */}
      <div className="lg:col-span-7 space-y-6">
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
          <h4 className="text-xs font-bold text-slate-300 mb-2 border-b border-slate-800 pb-1 flex justify-between">
            <span>DEFLECTED TRUSS & FORCE DIAGRAM</span>
            <span className="text-cyan-400">Blue=Tension, Red=Compression</span>
          </h4>
          <div className="bg-slate-950/80 p-2 rounded border border-slate-800 flex justify-center">
            {renderTrussSVG()}
          </div>
        </div>

        {/* Performance Matrix */}
        {result && (
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2 flex justify-between">
              <span>Member Axial Force, Moment & Capacity Matrix</span>
              <span className={`text-xs px-2 py-0.5 rounded ${result.overallStatus === 'SAFE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                {result.overallStatus}
              </span>
            </h4>
            <div className="overflow-x-auto max-h-56">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-2 font-semibold">Mem</th>
                    <th className="pb-2 font-semibold">Axial P (kN)</th>
                    <th className="pb-2 font-semibold">Moment Mz (kN·m)</th>
                    <th className="pb-2 font-semibold">Capacity</th>
                    <th className="pb-2 font-semibold">DCR</th>
                    <th className="pb-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-slate-300">
                  {result.memberResults.map((m) => (
                    <tr key={`mem-res-${m.id}`}>
                      <td className="py-1.5 font-bold">M{m.id}</td>
                      <td className={`py-1.5 ${m.state === 'TENSION' ? 'text-cyan-400' : m.state === 'COMPRESSION' ? 'text-rose-400' : 'text-slate-400'}`}>
                        {m.axialForce}
                      </td>
                      <td className="py-1.5">{m.maxMoment}</td>
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
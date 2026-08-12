'use client';

import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type DesignCode = 'AISC360' | 'EC3' | 'BS5950';
type TrussPreset = 'pratt' | 'howe' | 'warren' | 'custom';

interface Node2D {
  id: number;
  x: number; // meters
  y: number; // meters
  fixX: boolean;
  fixY: boolean;
  fx: number; // kN
  fy: number; // kN
}

interface Member2D {
  id: number;
  startNode: number;
  endNode: number;
  area: number; // mm²
  inertia: number; // mm⁴
  ry: number; // Radius of gyration r (mm)
}

interface MemberResult {
  id: number;
  length: number; // m
  axialForce: number; // kN (Positive = Tension, Negative = Compression)
  state: 'TENSION' | 'COMPRESSION' | 'ZERO';
  slenderness: number; // KL/r
  capacity: number; // kN
  dcr: number;
  status: 'PASS' | 'FAIL';
}

interface TrussAnalysisResult {
  code: DesignCode;
  displacements: { node: number; ux: number; uy: number }[];
  reactions: { node: number; rx: number; ry: number }[];
  memberResults: MemberResult[];
  maxDcr: number;
  overallStatus: 'SAFE' | 'OVERSTRESSED';
  governingMember: number;
}

export default function TrussAnalysisTool() {
  const [designCode, setDesignCode] = useState<DesignCode>('AISC360');
  const [trussPreset, setTrussPreset] = useState<TrussPreset>('pratt');

  // Truss Geometry Presets Controls
  const [spanLength, setSpanLength] = useState<number>(12); // meters
  const [trussHeight, setTrussHeight] = useState<number>(3); // meters
  const [numBays, setNumBays] = useState<number>(4);

  // Material Properties
  const [steelGrade, setSteelGrade] = useState<string>('S355');
  const [modulusE, setModulusE] = useState<number>(210000); // MPa
  const [fy, setFy] = useState<number>(355); // MPa

  // Section Properties (SHS 100x100x6 Default)
  const [sectionArea, setSectionArea] = useState<number>(2190); // mm²
  const [sectionInertia, setSectionInertia] = useState<number>(3330000); // mm⁴
  const [sectionRadius, setSectionRadius] = useState<number>(38.9); // mm (r = sqrt(I/A))

  // Nodes & Members Data
  const [nodes, setNodes] = useState<Node2D[]>([]);
  const [members, setMembers] = useState<Member2D[]>([]);

  const [analysisResult, setAnalysisResult] = useState<TrussAnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [exportingPdf, setExportingPdf] = useState<boolean>(false);

  // Auto-generate Parametric Truss Geometry
  useEffect(() => {
    if (trussPreset === 'custom') return;

    const newNodes: Node2D[] = [];
    const newMembers: Member2D[] = [];

    const L = Math.max(spanLength, 2);
    const H = Math.max(trussHeight, 0.5);
    const N = Math.max(numBays, 2);
    const bayW = L / N;

    // Bottom Chord Nodes
    for (let i = 0; i <= N; i++) {
      newNodes.push({
        id: i,
        x: Number((i * bayW).toFixed(2)),
        y: 0,
        fixX: i === 0, // Pin at left support
        fixY: i === 0 || i === N, // Roller at right support
        fx: 0,
        fy: i > 0 && i < N ? -25 : -12.5, // Point load gravity on bottom chord
      });
    }

    // Top Chord Nodes
    for (let i = 0; i <= N; i++) {
      newNodes.push({
        id: N + 1 + i,
        x: Number((i * bayW).toFixed(2)),
        y: H,
        fixX: false,
        fixY: false,
        fx: 0,
        fy: -15, // Top chord wind/dead loads
      });
    }

    let mId = 0;
    // Bottom Chord Members
    for (let i = 0; i < N; i++) {
      newMembers.push({ id: ++mId, startNode: i, endNode: i + 1, area: sectionArea, inertia: sectionInertia, ry: sectionRadius });
    }
    // Top Chord Members
    for (let i = 0; i < N; i++) {
      newMembers.push({ id: ++mId, startNode: N + 1 + i, endNode: N + 1 + i + 1, area: sectionArea, inertia: sectionInertia, ry: sectionRadius });
    }
    // Vertical Members
    for (let i = 0; i <= N; i++) {
      newMembers.push({ id: ++mId, startNode: i, endNode: N + 1 + i, area: sectionArea, inertia: sectionInertia, ry: sectionRadius });
    }
    // Diagonal Members
    for (let i = 0; i < N; i++) {
      if (trussPreset === 'pratt') {
        // Pratt: Diagonals slope down towards center
        if (i < N / 2) {
          newMembers.push({ id: ++mId, startNode: N + 1 + i, endNode: i + 1, area: sectionArea, inertia: sectionInertia, ry: sectionRadius });
        } else {
          newMembers.push({ id: ++mId, startNode: i, endNode: N + 1 + i + 1, area: sectionArea, inertia: sectionInertia, ry: sectionRadius });
        }
      } else if (trussPreset === 'howe') {
        // Howe: Diagonals slope up towards center
        if (i < N / 2) {
          newMembers.push({ id: ++mId, startNode: i, endNode: N + 1 + i + 1, area: sectionArea, inertia: sectionInertia, ry: sectionRadius });
        } else {
          newMembers.push({ id: ++mId, startNode: N + 1 + i, endNode: i + 1, area: sectionArea, inertia: sectionInertia, ry: sectionRadius });
        }
      } else {
        // Warren: Alternating diagonals
        if (i % 2 === 0) {
          newMembers.push({ id: ++mId, startNode: i, endNode: N + 1 + i + 1, area: sectionArea, inertia: sectionInertia, ry: sectionRadius });
        } else {
          newMembers.push({ id: ++mId, startNode: N + 1 + i, endNode: i + 1, area: sectionArea, inertia: sectionInertia, ry: sectionRadius });
        }
      }
    }

    setNodes(newNodes);
    setMembers(newMembers);
  }, [trussPreset, spanLength, trussHeight, numBays, sectionArea, sectionInertia, sectionRadius]);

  // --- 2D DIRECT STIFFNESS MATRIX SOLVER ---
  const solveMatrixSystem = (A: number[][], b: number[]): number[] => {
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
      for (let j = i + 1; j < n; j++) {
        sum -= M[i][j] * x[j];
      }
      x[i] = Math.abs(M[i][i]) > 1e-12 ? sum / M[i][i] : 0;
    }
    return x;
  };

  const handleRunAnalysis = () => {
    setAnalyzing(true);
    try {
      const numNodes = nodes.length;
      const numDof = numNodes * 2;
      const K_global = Array.from({ length: numDof }, () => new Array(numDof).fill(0));
      const F_global = new Array(numDof).fill(0);

      // Assemble Global Force Vector
      nodes.forEach((node, idx) => {
        F_global[2 * idx] = node.fx;
        F_global[2 * idx + 1] = node.fy;
      });

      // Assemble Global Stiffness Matrix
      members.forEach((mem) => {
        const n1 = nodes.find((n) => n.id === mem.startNode);
        const n2 = nodes.find((n) => n.id === mem.endNode);
        if (!n1 || !n2) return;

        const idx1 = nodes.findIndex((n) => n.id === mem.startNode);
        const idx2 = nodes.findIndex((n) => n.id === mem.endNode);

        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        const L = Math.sqrt(dx * dx + dy * dy);
        const cos = dx / L;
        const sin = dy / L;

        const k_axial = (modulusE * mem.area) / (L * 1000); // kN/m

        const k_local = [
          [cos * cos, cos * sin, -cos * cos, -cos * sin],
          [cos * sin, sin * sin, -cos * sin, -sin * sin],
          [-cos * cos, -cos * sin, cos * cos, cos * sin],
          [-cos * sin, -sin * sin, cos * sin, sin * sin],
        ];

        const dofs = [2 * idx1, 2 * idx1 + 1, 2 * idx2, 2 * idx2 + 1];

        for (let r = 0; r < 4; r++) {
          for (let c = 0; c < 4; c++) {
            K_global[dofs[r]][dofs[c]] += k_axial * k_local[r][c];
          }
        }
      });

      // Apply Boundary Conditions (Penalty Method)
      const K_bounded = K_global.map((row) => [...row]);
      const F_bounded = [...F_global];

      nodes.forEach((node, idx) => {
        if (node.fixX) {
          const dofX = 2 * idx;
          K_bounded[dofX][dofX] += 1e12;
          F_bounded[dofX] = 0;
        }
        if (node.fixY) {
          const dofY = 2 * idx + 1;
          K_bounded[dofY][dofY] += 1e12;
          F_bounded[dofY] = 0;
        }
      });

      // Solve Displacements (D = K^-1 * F)
      const U = solveMatrixSystem(K_bounded, F_bounded);

      // Compute Member Axial Forces & Multi-Code Design Capacity
      const memberResults: MemberResult[] = members.map((mem) => {
        const n1 = nodes.find((n) => n.id === mem.startNode)!;
        const n2 = nodes.find((n) => n.id === mem.endNode)!;
        const idx1 = nodes.findIndex((n) => n.id === mem.startNode);
        const idx2 = nodes.findIndex((n) => n.id === mem.endNode);

        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        const L = Math.sqrt(dx * dx + dy * dy); // meters
        const cos = dx / L;
        const sin = dy / L;

        const u1 = U[2 * idx1];
        const v1 = U[2 * idx1 + 1];
        const u2 = U[2 * idx2];
        const v2 = U[2 * idx2 + 1];

        // Axial Force (kN)
        const axial = ((modulusE * mem.area) / (L * 1000)) * ((u2 - u1) * cos + (v2 - v1) * sin);
        const state = Math.abs(axial) < 0.01 ? 'ZERO' : axial > 0 ? 'TENSION' : 'COMPRESSION';

        // Slenderness KL/r (K=1.0 for pinned truss member)
        const slenderness = (1.0 * L * 1000) / mem.ry;

        // Capacity Calculations according to Selected Code
        let capacity = 0;
        const f_y_kN = fy / 1000; // kN/mm²

        if (state === 'TENSION') {
          // Tension Capacity
          if (designCode === 'AISC360') capacity = 0.90 * mem.area * f_y_kN; // AISC LRFD
          else if (designCode === 'EC3') capacity = (mem.area * f_y_kN) / 1.0; // EC3 gamma_M0 = 1.0
          else capacity = mem.area * f_y_kN; // BS 5950
        } else {
          // Compression Buckling Capacity (Euler Column Buckling Curve)
          const P_euler = (Math.PI * Math.PI * modulusE * mem.inertia) / Math.pow(L * 1000, 2) / 1000; // kN
          const Py = mem.area * f_y_kN;

          if (designCode === 'AISC360') {
            const Fe = (Math.PI * Math.PI * modulusE) / Math.pow(slenderness, 2);
            const Fcr = slenderness <= 4.71 * Math.sqrt(modulusE / fy)
              ? Math.pow(0.658, fy / Fe) * fy
              : 0.877 * Fe;
            capacity = (0.90 * mem.area * Fcr) / 1000;
          } else if (designCode === 'EC3') {
            const lambda_bar = Math.sqrt(Py / P_euler);
            const phi_ec3 = 0.5 * (1 + 0.49 * (lambda_bar - 0.2) + Math.pow(lambda_bar, 2));
            const chi = Math.min(1.0 / (phi_ec3 + Math.sqrt(Math.pow(phi_ec3, 2) - Math.pow(lambda_bar, 2))), 1.0);
            capacity = (chi * Py) / 1.0;
          } else {
            // BS 5950 approximation
            capacity = Math.min(P_euler, Py) * 0.85;
          }
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
        ux: Number((U[2 * idx] * 1000).toFixed(2)), // mm
        uy: Number((U[2 * idx + 1] * 1000).toFixed(2)), // mm
      }));

      const reactArray = nodes.map((n, idx) => ({
        node: n.id,
        rx: n.fixX ? Number((-1 * F_bounded[2 * idx]).toFixed(1)) : 0,
        ry: n.fixY ? Number((-1 * F_bounded[2 * idx + 1]).toFixed(1)) : 0,
      }));

      setAnalysisResult({
        code: designCode,
        displacements: displArray,
        reactions: reactArray,
        memberResults,
        maxDcr,
        overallStatus: maxDcr <= 1.0 ? 'SAFE' : 'OVERSTRESSED',
        governingMember: govMem,
      });
    } catch (e) {
      console.error('Truss Analysis error:', e);
      alert('Error calculating truss matrix mechanics.');
    } finally {
      setAnalyzing(false);
    }
  };

  // --- SVG DRAWING FOR CANVAS AND PDF ---
  const renderTrussSVG = () => {
    const svgW = 440;
    const svgH = 200;
    const pad = 30;

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
      <svg id="truss-diagram-svg" viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-56 drop-shadow-md">
        <rect width="100%" height="100%" fill="#0f172a" rx="6" />

        {/* Draw Members */}
        {members.map((mem) => {
          const n1 = nodes.find((n) => n.id === mem.startNode);
          const n2 = nodes.find((n) => n.id === mem.endNode);
          if (!n1 || !n2) return null;

          const res = analysisResult?.memberResults.find((m) => m.id === mem.id);
          let strokeColor = '#64748b'; // Neutral
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

        {/* Draw Nodes & Supports */}
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
              {/* Force Vectors */}
              {node.fy !== 0 && (
                <path
                  d={`M ${nx} ${ny - 15} L ${nx} ${ny - 3}`}
                  stroke="#f43f5e"
                  strokeWidth="2"
                  markerEnd="url(#arrow)"
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
      {/* Control Inputs Panel */}
      <div className="lg:col-span-5 space-y-4 bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-xl">
        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
          <h3 className="font-semibold text-slate-200 text-sm">Truss Analysis & Design</h3>
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

        {/* Geometry Presets */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Truss Topology</label>
            <select
              value={trussPreset}
              onChange={(e) => setTrussPreset(e.target.value as TrussPreset)}
              className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-medium"
            >
              <option value="pratt">Pratt Truss</option>
              <option value="howe">Howe Truss</option>
              <option value="warren">Warren Truss</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Number of Bays</label>
            <input
              type="number"
              value={numBays}
              onChange={(e) => setNumBays(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-mono"
            />
          </div>
        </div>

        {/* Dimensions */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Total Span (m)</label>
            <input
              type="number"
              value={spanLength}
              onChange={(e) => setSpanLength(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Truss Height (m)</label>
            <input
              type="number"
              value={trussHeight}
              onChange={(e) => setTrussHeight(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-mono"
            />
          </div>
        </div>

        {/* Material & Cross Section */}
        <div className="space-y-3 pt-2 border-t border-slate-800">
          <h4 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">Member Section & Material</h4>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Area (mm²)</label>
              <input
                type="number"
                value={sectionArea}
                onChange={(e) => setSectionArea(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">r = √(I/A) (mm)</label>
              <input
                type="number"
                value={sectionRadius}
                onChange={(e) => setSectionRadius(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">fy (MPa)</label>
              <input
                type="number"
                value={fy}
                onChange={(e) => setFy(Number(e.target.value))}
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
      </div>

      {/* Visualization & Matrix Results Output */}
      <div className="lg:col-span-7 space-y-6">
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
          <h4 className="text-xs font-bold text-slate-300 mb-2 border-b border-slate-800 pb-1 flex justify-between">
            <span>2D TRUSS DEFLECTED & AXIAL FORCE DIAGRAM</span>
            <span className="text-cyan-400">Blue=Tension, Red=Compression</span>
          </h4>
          <div className="bg-slate-950/80 p-2 rounded border border-slate-800 flex justify-center">
            {renderTrussSVG()}
          </div>
        </div>

        {/* Member Axial Force Matrix Table */}
        {analysisResult && (
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2 flex justify-between">
              <span>Member Axial Force & Buckling Verification</span>
              <span className={`text-xs px-2 py-0.5 rounded ${analysisResult.overallStatus === 'SAFE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                {analysisResult.overallStatus}
              </span>
            </h4>
            <div className="overflow-x-auto max-h-56">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-2 font-semibold">Mem</th>
                    <th className="pb-2 font-semibold">Force (kN)</th>
                    <th className="pb-2 font-semibold">State</th>
                    <th className="pb-2 font-semibold">KL/r</th>
                    <th className="pb-2 font-semibold">Capacity</th>
                    <th className="pb-2 font-semibold">DCR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-slate-300">
                  {analysisResult.memberResults.map((m) => (
                    <tr key={`res-${m.id}`}>
                      <td className="py-1.5 font-bold">M{m.id}</td>
                      <td className="py-1.5">{m.axialForce}</td>
                      <td className={`py-1.5 font-bold ${m.state === 'TENSION' ? 'text-cyan-400' : m.state === 'COMPRESSION' ? 'text-rose-400' : 'text-slate-400'}`}>
                        {m.state}
                      </td>
                      <td className="py-1.5">{m.slenderness}</td>
                      <td className="py-1.5">{m.capacity} kN</td>
                      <td className={`py-1.5 font-bold ${m.dcr <= 1.0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {m.dcr}
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
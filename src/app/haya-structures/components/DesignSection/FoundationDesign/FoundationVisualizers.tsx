'use client';

import React, { useState, useMemo } from 'react';
import { Foundation3DRenderer } from './Foundation3DRenderer';
import { Geometry3DData } from '@/lib/structural/foundation';

export interface VisualizerResult {
  category?: 'shallow' | 'deep' | string;
  type?: string;
  foundationType?: string;
  typeId?: string;
  geometry?: {
    B?: number;
    L?: number;
    D?: number;
    d?: number;
    colSpacing?: number;
    c21?: number;
    c22?: number;
    numPiles?: number;
    pileDiameter?: number;
  };
  reinforcement?: {
    botBarDiam?: number;
    botBarSpacing?: number;
    topBarDiam?: number;
    topBarSpacing?: number;
    meshMode?: 'single' | 'double';
  };
}

interface VisualizerProps {
  result: VisualizerResult;
  c1: number;
  c2: number;
  cover: number;
}

export function FoundationVisualizers({ result, c1, c2, cover }: VisualizerProps) {
  const [activeTab, setActiveTab] = useState<'2d' | '3d'>('2d');

  // Robust Type Detection (handles result.type, result.foundationType, result.typeId)
  const rawType = (
    result?.type ||
    result?.foundationType ||
    result?.typeId ||
    'isolated'
  )
    .toString()
    .toLowerCase();

  const category = (
    result?.category || (rawType.includes('pile') ? 'deep' : 'shallow')
  ).toLowerCase();

  const isCombined = rawType.includes('combined');
  const isStrap = rawType.includes('strap');
  const isWallStrip = rawType.includes('wall') || rawType.includes('strip') || rawType.includes('continuous');
  const isPileCap = category === 'deep' || rawType.includes('pile');
  const isRaft = rawType.includes('raft') || rawType.includes('mat');
  const isIsolated = !isCombined && !isStrap && !isWallStrip && !isPileCap && !isRaft;

  const {
    B = 1800,
    L = 1800,
    D = 450,
    d = 375,
    colSpacing = 1200,
    c21 = c1 || 400,
    c22 = c2 || 400,
    numPiles = 4,
    pileDiameter = 400,
  } = result?.geometry ?? {};

  const {
    botBarDiam = 16,
    botBarSpacing = 150,
    topBarDiam = 12,
    topBarSpacing = 200,
    meshMode = 'single',
  } = result?.reinforcement ?? {};

  const isDoubleMesh = meshMode === 'double' || Boolean(topBarDiam && topBarSpacing) || isRaft || isCombined;

  // --- Dynamic SVG Scaling based on actual B x L Aspect Ratio ---
  const svgBox = useMemo(() => {
    const maxW = 210;
    const maxH = 140;
    const aspect = B / (L || 1);

    let w = maxW;
    let h = maxH;

    if (aspect >= 1) {
      w = maxW;
      h = Math.max(40, Math.min(maxH, maxW / aspect));
    } else {
      h = maxH;
      w = Math.max(40, Math.min(maxW, maxH * aspect));
    }

    const x = 150 - w / 2;
    const y = 105 - h / 2;

    return { x, y, w, h };
  }, [B, L]);

  // Dynamic pile location layout calculation for CAD Plan View
  const pileCoordinates = useMemo(() => {
    if (!isPileCap) return [];
    const count = Math.max(2, numPiles);
    const { x, y, w, h } = svgBox;
    const pad = Math.min(w, h) * 0.25;

    const left = x + pad;
    const right = x + w - pad;
    const top = y + pad;
    const bottom = y + h - pad;
    const midX = x + w / 2;
    const midY = y + h / 2;

    if (count === 2) {
      return [{ x: left, y: midY }, { x: right, y: midY }];
    }
    if (count === 3) {
      return [{ x: midX, y: top }, { x: left, y: bottom }, { x: right, y: bottom }];
    }
    if (count === 5) {
      return [
        { x: left, y: top }, { x: right, y: top },
        { x: midX, y: midY },
        { x: left, y: bottom }, { x: right, y: bottom },
      ];
    }
    // Standard 4 or 6 grid
    const coords = [
      { x: left, y: top }, { x: right, y: top },
      { x: left, y: bottom }, { x: right, y: bottom },
    ];
    if (count >= 6) {
      coords.push({ x: midX, y: top }, { x: midX, y: bottom });
    }
    return coords;
  }, [isPileCap, numPiles, svgBox]);

  // --- Dynamic 3D Geometry Payload Generation ---
  const render3DData: Geometry3DData = useMemo(() => {
    const footingWidthM = B / 1000;
    const footingDepthM = L / 1000;
    const footingHeightM = D / 1000;
    const colHeightM = 1.2;

    const mainCol1Width = (c1 || 400) / 1000;
    const mainCol1Depth = (c2 || 400) / 1000;
    const mainCol2Width = c21 / 1000;
    const mainCol2Depth = c22 / 1000;
    const spacingM = colSpacing / 1000;

    const footingBoxes = [];
    const columnBoxes = [];

    if (isStrap) {
      const pad1W = footingWidthM * 0.4;
      const pad2W = footingWidthM * 0.4;
      const xOffset1 = -footingWidthM / 2 + pad1W / 2;
      const xOffset2 = footingWidthM / 2 - pad2W / 2;

      footingBoxes.push(
        { width: pad1W, height: footingHeightM, depth: footingDepthM, position: { x: xOffset1, y: 0, z: 0 } },
        { width: pad2W, height: footingHeightM, depth: footingDepthM, position: { x: xOffset2, y: 0, z: 0 } }
      );

      const strapLength = Math.max(0.2, xOffset2 - xOffset1 - (pad1W + pad2W) / 2);
      footingBoxes.push({
        width: strapLength,
        height: footingHeightM * 0.6,
        depth: mainCol1Depth * 1.1,
        position: { x: (xOffset1 + xOffset2) / 2, y: 0, z: 0 },
      });

      columnBoxes.push(
        { width: mainCol1Width, height: colHeightM, depth: mainCol1Depth, position: { x: xOffset1, y: footingHeightM / 2 + colHeightM / 2, z: 0 } },
        { width: mainCol2Width, height: colHeightM, depth: mainCol2Depth, position: { x: xOffset2, y: footingHeightM / 2 + colHeightM / 2, z: 0 } }
      );
    } else if (isCombined) {
      footingBoxes.push({
        width: footingWidthM,
        height: footingHeightM,
        depth: footingDepthM,
        position: { x: 0, y: 0, z: 0 },
      });

      const offset = Math.min(spacingM / 2, footingWidthM / 2 - mainCol1Width * 0.8);
      columnBoxes.push(
        { width: mainCol1Width, height: colHeightM, depth: mainCol1Depth, position: { x: -offset, y: footingHeightM / 2 + colHeightM / 2, z: 0 } },
        { width: mainCol2Width, height: colHeightM, depth: mainCol2Depth, position: { x: offset, y: footingHeightM / 2 + colHeightM / 2, z: 0 } }
      );
    } else if (isRaft) {
      footingBoxes.push({
        width: footingWidthM,
        height: footingHeightM,
        depth: footingDepthM,
        position: { x: 0, y: 0, z: 0 },
      });

      // Show 4 column stubs on Raft
      const xOff = footingWidthM * 0.25;
      const zOff = footingDepthM * 0.25;
      columnBoxes.push(
        { width: mainCol1Width, height: colHeightM, depth: mainCol1Depth, position: { x: -xOff, y: footingHeightM / 2 + colHeightM / 2, z: -zOff } },
        { width: mainCol1Width, height: colHeightM, depth: mainCol1Depth, position: { x: xOff, y: footingHeightM / 2 + colHeightM / 2, z: -zOff } },
        { width: mainCol1Width, height: colHeightM, depth: mainCol1Depth, position: { x: -xOff, y: footingHeightM / 2 + colHeightM / 2, z: zOff } },
        { width: mainCol1Width, height: colHeightM, depth: mainCol1Depth, position: { x: xOff, y: footingHeightM / 2 + colHeightM / 2, z: zOff } }
      );
    } else {
      footingBoxes.push({
        width: footingWidthM,
        height: footingHeightM,
        depth: footingDepthM,
        position: { x: 0, y: 0, z: 0 },
      });

      columnBoxes.push({
        width: mainCol1Width,
        height: colHeightM,
        depth: isWallStrip ? footingDepthM * 0.95 : mainCol1Depth,
        position: { x: 0, y: footingHeightM / 2 + colHeightM / 2, z: 0 },
      });
    }

    return {
      footingBox: footingBoxes[0],
      footingBoxes,
      columnBoxes,
      rebars3D: [],
    };
  }, [B, L, D, c1, c2, c21, c22, colSpacing, isCombined, isStrap, isWallStrip, isRaft]);

  const foundationLabel = isStrap
    ? 'Strap Footing'
    : isCombined
    ? 'Combined Footing'
    : isWallStrip
    ? 'Wall / Strip Footing'
    : isPileCap
    ? 'Pile Cap'
    : isRaft
    ? 'Raft / Mat Foundation'
    : 'Isolated Pad Footing';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
      {/* Header Controls & View Toggle */}
      <div className="flex justify-between items-center bg-slate-950 px-4 py-2.5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <span>📐</span> Structural CAD & Visualizer
          </span>
          <span className="bg-cyan-950 text-cyan-400 text-[10px] px-2 py-0.5 rounded border border-cyan-800 font-mono font-semibold uppercase">
            {foundationLabel}
          </span>
        </div>

        <div className="flex bg-slate-900 p-0.5 rounded border border-slate-800 font-mono text-[11px]">
          <button
            onClick={() => setActiveTab('2d')}
            className={`px-3 py-1 rounded font-bold transition ${
              activeTab === '2d' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            2D CAD View
          </button>
          <button
            onClick={() => setActiveTab('3d')}
            className={`px-3 py-1 rounded font-bold transition ${
              activeTab === '3d' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            3D Mesh Preview
          </button>
        </div>
      </div>

      <div className="p-4">
        {activeTab === '2d' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* ----------------- 2D PLAN VIEW SVG ----------------- */}
            <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 text-center flex flex-col justify-between">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
                  Plan View ({B}mm × {L}mm)
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  Mesh: {isDoubleMesh ? 'Double Mesh' : 'Single Bottom Mesh'}
                </span>
              </div>

              <svg viewBox="0 0 300 220" className="w-full h-56 mx-auto">
                {/* 1. STRAP FOOTING PLAN */}
                {isStrap && (
                  <g>
                    {/* Left Pad */}
                    <rect x="35" y="35" width="75" height="135" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" rx="2" />
                    {/* Right Pad */}
                    <rect x="190" y="35" width="75" height="135" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" rx="2" />
                    {/* Connecting Strap Beam */}
                    <rect x="110" y="85" width="80" height="35" fill="#0f172a" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 2" />
                    <text x="150" y="106" fill="#f59e0b" fontSize="8" textAnchor="middle" className="font-mono">
                      Strap Beam
                    </text>
                    {/* Left Column */}
                    <rect x="57" y="82" width="30" height="40" fill="#475569" stroke="#cbd5e1" strokeWidth="1.5" />
                    {/* Right Column */}
                    <rect x="213" y="82" width="30" height="40" fill="#475569" stroke="#cbd5e1" strokeWidth="1.5" />
                  </g>
                )}

                {/* 2. COMBINED FOOTING PLAN */}
                {isCombined && (
                  <g>
                    <rect x={svgBox.x} y={svgBox.y} width={svgBox.w} height={svgBox.h} fill="#1e293b" stroke="#38bdf8" strokeWidth="2" rx="2" />
                    {/* Column 1 */}
                    <rect x={svgBox.x + svgBox.w * 0.2 - 15} y={svgBox.y + svgBox.h / 2 - 15} width="30" height="30" fill="#475569" stroke="#cbd5e1" strokeWidth="1.5" />
                    {/* Column 2 */}
                    <rect x={svgBox.x + svgBox.w * 0.8 - 15} y={svgBox.y + svgBox.h / 2 - 15} width="30" height="30" fill="#475569" stroke="#cbd5e1" strokeWidth="1.5" />
                    {/* Column Spacing Line */}
                    <line
                      x1={svgBox.x + svgBox.w * 0.2}
                      y1={svgBox.y + svgBox.h / 2}
                      x2={svgBox.x + svgBox.w * 0.8}
                      y2={svgBox.y + svgBox.h / 2}
                      stroke="#f59e0b"
                      strokeWidth="1.2"
                      strokeDasharray="3 2"
                    />
                    <text x="150" y={svgBox.y + svgBox.h / 2 - 6} fill="#f59e0b" fontSize="8" textAnchor="middle" className="font-mono">
                      s = {colSpacing}mm
                    </text>
                  </g>
                )}

                {/* 3. WALL / STRIP FOOTING PLAN */}
                {isWallStrip && (
                  <g>
                    <rect x="25" y={svgBox.y} width="250" height={svgBox.h} fill="#1e293b" stroke="#38bdf8" strokeWidth="2" rx="2" />
                    {/* Continuous Wall Stripe */}
                    <rect x="25" y={105 - 12} width="250" height="24" fill="#475569" stroke="#cbd5e1" strokeWidth="1.5" />
                    {/* Wall hatching pattern */}
                    <line x1="40" y1="93" x2="52" y2="117" stroke="#94a3b8" strokeWidth="1" />
                    <line x1="80" y1="93" x2="92" y2="117" stroke="#94a3b8" strokeWidth="1" />
                    <line x1="120" y1="93" x2="132" y2="117" stroke="#94a3b8" strokeWidth="1" />
                    <line x1="160" y1="93" x2="172" y2="117" stroke="#94a3b8" strokeWidth="1" />
                    <line x1="200" y1="93" x2="212" y2="117" stroke="#94a3b8" strokeWidth="1" />
                    <line x1="240" y1="93" x2="252" y2="117" stroke="#94a3b8" strokeWidth="1" />
                  </g>
                )}

                {/* 4. PILE CAP PLAN */}
                {isPileCap && (
                  <g>
                    <rect x={svgBox.x} y={svgBox.y} width={svgBox.w} height={svgBox.h} fill="#1e293b" stroke="#38bdf8" strokeWidth="2" rx="2" />
                    {/* Pile Circles */}
                    <g fill="#0f172a" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="3 2">
                      {pileCoordinates.map((pt, idx) => (
                        <circle key={idx} cx={pt.x} cy={pt.y} r={Math.min(16, Math.max(10, pileDiameter / 30))} />
                      ))}
                    </g>
                    {/* Center Column */}
                    <rect x="133" y={105 - 17} width="34" height="34" fill="#475569" stroke="#cbd5e1" strokeWidth="1.5" />
                  </g>
                )}

                {/* 5. RAFT / MAT FOUNDATION PLAN */}
                {isRaft && (
                  <g>
                    <rect x="25" y="25" width="250" height="150" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" rx="2" />
                    {/* Multi-column Grid */}
                    <rect x="60" y="50" width="25" height="25" fill="#475569" stroke="#cbd5e1" strokeWidth="1" />
                    <rect x="215" y="50" width="25" height="25" fill="#475569" stroke="#cbd5e1" strokeWidth="1" />
                    <rect x="60" y="125" width="25" height="25" fill="#475569" stroke="#cbd5e1" strokeWidth="1" />
                    <rect x="215" y="125" width="25" height="25" fill="#475569" stroke="#cbd5e1" strokeWidth="1" />
                    <rect x="137.5" y="87.5" width="25" height="25" fill="#475569" stroke="#cbd5e1" strokeWidth="1" />
                    {/* Grid Lines */}
                    <line x1="25" y1="62.5" x2="275" y2="62.5" stroke="#334155" strokeWidth="1" strokeDasharray="4 2" />
                    <line x1="25" y1="137.5" x2="275" y2="137.5" stroke="#334155" strokeWidth="1" strokeDasharray="4 2" />
                    <line x1="72.5" y1="25" x2="72.5" y2="175" stroke="#334155" strokeWidth="1" strokeDasharray="4 2" />
                    <line x1="227.5" y1="25" x2="227.5" y2="175" stroke="#334155" strokeWidth="1" strokeDasharray="4 2" />
                  </g>
                )}

                {/* 6. ISOLATED FOOTING PLAN (DEFAULT) */}
                {isIsolated && (
                  <g>
                    <rect x={svgBox.x} y={svgBox.y} width={svgBox.w} height={svgBox.h} fill="#1e293b" stroke="#38bdf8" strokeWidth="2" rx="2" />
                    <rect x="132" y={105 - 18} width="36" height="36" fill="#475569" stroke="#cbd5e1" strokeWidth="1.5" />
                  </g>
                )}

                {/* Dynamic Rebar Overlay Grid */}
                {!isStrap && !isRaft && (
                  <g stroke="#10b981" strokeWidth="1" strokeDasharray="4 3" opacity="0.6">
                    <line x1={svgBox.x + 10} y1={svgBox.y + 15} x2={svgBox.x + svgBox.w - 10} y2={svgBox.y + 15} />
                    <line x1={svgBox.x + 10} y1={svgBox.y + svgBox.h - 15} x2={svgBox.x + svgBox.w - 10} y2={svgBox.y + svgBox.h - 15} />
                    <line x1={svgBox.x + 15} y1={svgBox.y + 10} x2={svgBox.x + 15} y2={svgBox.y + svgBox.h - 10} />
                    <line x1={svgBox.x + svgBox.w - 15} y1={svgBox.y + 10} x2={svgBox.x + svgBox.w - 15} y2={svgBox.y + svgBox.h - 10} />
                  </g>
                )}

                {/* Dimension Annotations */}
                <text x="150" y="16" fill="#38bdf8" fontSize="10" textAnchor="middle" className="font-mono">
                  B = {B} mm
                </text>

                <text x="150" y="202" fill="#10b981" fontSize="9" textAnchor="middle" className="font-sans font-medium">
                  Btm Mesh: T{botBarDiam} @ {botBarSpacing}mm c/c
                </text>
                {isDoubleMesh && (
                  <text x="150" y="215" fill="#f59e0b" fontSize="8.5" textAnchor="middle" className="font-sans">
                    Top Mesh: T{topBarDiam} @ {topBarSpacing}mm c/c
                  </text>
                )}
              </svg>
            </div>

            {/* ----------------- 2D ELEVATION CROSS-SECTION SVG ----------------- */}
            <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 text-center flex flex-col justify-between">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
                  Elevation Cross-Section
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  D = {D}mm | d = {d}mm
                </span>
              </div>

              <svg viewBox="0 0 300 220" className="w-full h-56 mx-auto">
                {/* Natural Ground Level Line */}
                <line x1="10" y1="50" x2="290" y2="50" stroke="#64748b" strokeWidth="1.5" strokeDasharray="6 4" />
                <text x="25" y="42" fill="#64748b" fontSize="8" className="font-mono">
                  NGL (Ground Level)
                </text>

                {/* ELEVATION 1: PILE CAP WITH PILES */}
                {isPileCap && (
                  <g fill="#334155" stroke="#64748b" strokeWidth="1.5">
                    <rect x="70" y="150" width="32" height="50" />
                    <rect x="198" y="150" width="32" height="50" />
                    <text x="86" y="180" fill="#94a3b8" fontSize="7" textAnchor="middle" className="font-mono">
                      Ø{pileDiameter}
                    </text>
                    <text x="214" y="180" fill="#94a3b8" fontSize="7" textAnchor="middle" className="font-mono">
                      Ø{pileDiameter}
                    </text>
                  </g>
                )}

                {/* ELEVATION 2: STRAP FOOTING (Two separate pads connected by beam) */}
                {isStrap ? (
                  <g>
                    {/* Left Pad */}
                    <rect x="35" y="100" width="75" height="50" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" rx="1" />
                    {/* Right Pad */}
                    <rect x="190" y="100" width="75" height="50" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" rx="1" />
                    {/* Strap Beam */}
                    <rect x="110" y="110" width="80" height="30" fill="#0f172a" stroke="#f59e0b" strokeWidth="1.5" />
                    {/* Column 1 */}
                    <rect x="55" y="25" width="35" height="75" fill="#334155" stroke="#94a3b8" strokeWidth="1.5" />
                    {/* Column 2 */}
                    <rect x="210" y="25" width="35" height="75" fill="#334155" stroke="#94a3b8" strokeWidth="1.5" />
                  </g>
                ) : isCombined ? (
                  /* ELEVATION 3: COMBINED FOOTING */
                  <g>
                    <rect x="35" y="100" width="230" height="50" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" rx="1" />
                    <rect x="65" y="25" width="35" height="75" fill="#334155" stroke="#94a3b8" strokeWidth="1.5" />
                    <rect x="200" y="25" width="35" height="75" fill="#334155" stroke="#94a3b8" strokeWidth="1.5" />
                  </g>
                ) : isWallStrip ? (
                  /* ELEVATION 4: WALL / STRIP FOOTING */
                  <g>
                    <rect x="35" y="100" width="230" height="50" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" rx="1" />
                    {/* Continuous Wall */}
                    <rect x="120" y="20" width="60" height="80" fill="#475569" stroke="#cbd5e1" strokeWidth="1.5" />
                  </g>
                ) : (
                  /* ELEVATION 5: ISOLATED / RAFT / PILE CAP MASS */
                  <g>
                    <rect x="35" y="100" width="230" height="50" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" rx="1" />
                    <rect x="130" y="20" width="40" height="80" fill="#334155" stroke="#94a3b8" strokeWidth="1.5" />
                  </g>
                )}

                {/* Main Bottom Reinforcement Line with Hooks */}
                <path
                  d="M 45 112 L 45 142 L 255 142 L 255 112"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Bottom Bar Cross-Section Circles */}
                <g fill="#059669">
                  <circle cx="65" cy="138" r="2.5" />
                  <circle cx="100" cy="138" r="2.5" />
                  <circle cx="135" cy="138" r="2.5" />
                  <circle cx="165" cy="138" r="2.5" />
                  <circle cx="200" cy="138" r="2.5" />
                  <circle cx="235" cy="138" r="2.5" />
                </g>

                {/* Top Rebar Mesh (if double mesh) */}
                {isDoubleMesh && (
                  <>
                    <path
                      d="M 45 130 L 45 108 L 255 108 L 255 130"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <g fill="#d97706">
                      <circle cx="65" cy="112" r="2" />
                      <circle cx="100" cy="112" r="2" />
                      <circle cx="135" cy="112" r="2" />
                      <circle cx="165" cy="112" r="2" />
                      <circle cx="200" cy="112" r="2" />
                      <circle cx="235" cy="112" r="2" />
                    </g>
                  </>
                )}

                {/* Dimension Bar */}
                <line x1="275" y1="100" x2="275" y2="150" stroke="#38bdf8" strokeWidth="1" />
                <line x1="271" y1="100" x2="279" y2="100" stroke="#38bdf8" strokeWidth="1" />
                <line x1="271" y1="150" x2="279" y2="150" stroke="#38bdf8" strokeWidth="1" />
                <text
                  x="287"
                  y="125"
                  fill="#38bdf8"
                  fontSize="9"
                  textAnchor="middle"
                  className="font-mono"
                  transform="rotate(90,287,125)"
                >
                  D = {D}mm
                </text>

                <text x="150" y="172" fill="#cbd5e1" fontSize="9" textAnchor="middle" className="font-mono">
                  Depth d = {d} mm | Cover = {cover} mm
                </text>
              </svg>
            </div>
          </div>
        ) : (
          /* ----------------- 3D INTERACTIVE RENDERER ----------------- */
          <Foundation3DRenderer
            data={render3DData}
            meshMode={isDoubleMesh ? 'double' : 'single'}
            botBarSpacing={botBarSpacing}
            topBarSpacing={topBarSpacing}
            botBarDiam={botBarDiam}
            topBarDiam={topBarDiam}
            cover={cover}
          />
        )}
      </div>
    </div>
  );
}
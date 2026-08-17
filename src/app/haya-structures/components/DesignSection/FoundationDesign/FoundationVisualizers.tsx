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

  // Robust Type Detection
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
    const maxW = 200;
    const maxH = 130;
    const aspect = B / (L || 1);

    let w = maxW;
    let h = maxH;

    if (aspect >= 1) {
      w = maxW;
      h = Math.max(50, Math.min(maxH, maxW / aspect));
    } else {
      h = maxH;
      w = Math.max(50, Math.min(maxW, maxH * aspect));
    }

    const x = 140 - w / 2;
    const y = 100 - h / 2;

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
    const coords = [
      { x: left, y: top }, { x: right, y: top },
      { x: left, y: bottom }, { x: right, y: bottom },
    ];
    if (count >= 6) {
      coords.push({ x: midX, y: top }, { x: midX, y: bottom });
    }
    return coords;
  }, [isPileCap, numPiles, svgBox]);

  // Unique X projection coords for Piles in Elevation View
  const pileElevationXCoords = useMemo(() => {
    if (!isPileCap || pileCoordinates.length === 0) return [70, 198];
    const uniqueXs = Array.from(new Set(pileCoordinates.map((p) => p.x)));
    return uniqueXs.sort((a, b) => a - b);
  }, [isPileCap, pileCoordinates]);

  // Dynamic 3D Geometry Payload Generation
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

              <svg viewBox="0 0 280 210" className="w-full h-56 mx-auto">
                {/* 1. STRAP FOOTING PLAN */}
                {isStrap && (
                  <g>
                    <rect x="30" y="35" width="70" height="130" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" rx="2" />
                    <rect x="180" y="35" width="70" height="130" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" rx="2" />
                    <rect x="100" y="82" width="80" height="36" fill="#0f172a" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 2" />
                    <text x="140" y="103" fill="#f59e0b" fontSize="8" textAnchor="middle" className="font-mono">
                      Strap Beam
                    </text>
                    <rect x="50" y="80" width="30" height="40" fill="#475569" stroke="#cbd5e1" strokeWidth="1.5" />
                    <rect x="200" y="80" width="30" height="40" fill="#475569" stroke="#cbd5e1" strokeWidth="1.5" />
                  </g>
                )}

                {/* 2. COMBINED FOOTING PLAN */}
                {isCombined && (
                  <g>
                    <rect x={svgBox.x} y={svgBox.y} width={svgBox.w} height={svgBox.h} fill="#1e293b" stroke="#38bdf8" strokeWidth="2" rx="2" />
                    <rect x={svgBox.x + svgBox.w * 0.2 - 14} y={svgBox.y + svgBox.h / 2 - 14} width="28" height="28" fill="#475569" stroke="#cbd5e1" strokeWidth="1.5" />
                    <rect x={svgBox.x + svgBox.w * 0.8 - 14} y={svgBox.y + svgBox.h / 2 - 14} width="28" height="28" fill="#475569" stroke="#cbd5e1" strokeWidth="1.5" />
                    <line
                      x1={svgBox.x + svgBox.w * 0.2}
                      y1={svgBox.y + svgBox.h / 2}
                      x2={svgBox.x + svgBox.w * 0.8}
                      y2={svgBox.y + svgBox.h / 2}
                      stroke="#f59e0b"
                      strokeWidth="1.2"
                      strokeDasharray="3 2"
                    />
                    <text x="140" y={svgBox.y + svgBox.h / 2 - 6} fill="#f59e0b" fontSize="8" textAnchor="middle" className="font-mono">
                      s = {colSpacing}mm
                    </text>
                  </g>
                )}

                {/* 3. WALL / STRIP FOOTING PLAN */}
                {isWallStrip && (
                  <g>
                    <rect x="20" y={svgBox.y} width="240" height={svgBox.h} fill="#1e293b" stroke="#38bdf8" strokeWidth="2" rx="2" />
                    <rect x="20" y={100 - 12} width="240" height="24" fill="#475569" stroke="#cbd5e1" strokeWidth="1.5" />
                    <line x1="35" y1="88" x2="47" y2="112" stroke="#94a3b8" strokeWidth="1" />
                    <line x1="75" y1="88" x2="87" y2="112" stroke="#94a3b8" strokeWidth="1" />
                    <line x1="115" y1="88" x2="127" y2="112" stroke="#94a3b8" strokeWidth="1" />
                    <line x1="155" y1="88" x2="167" y2="112" stroke="#94a3b8" strokeWidth="1" />
                    <line x1="195" y1="88" x2="207" y2="112" stroke="#94a3b8" strokeWidth="1" />
                    <line x1="235" y1="88" x2="247" y2="112" stroke="#94a3b8" strokeWidth="1" />
                  </g>
                )}

                {/* 4. PILE CAP PLAN */}
                {isPileCap && (
                  <g>
                    <rect x={svgBox.x} y={svgBox.y} width={svgBox.w} height={svgBox.h} fill="#1e293b" stroke="#38bdf8" strokeWidth="2" rx="2" />
                    <g fill="#0f172a" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="3 2">
                      {pileCoordinates.map((pt, idx) => (
                        <circle key={idx} cx={pt.x} cy={pt.y} r={Math.min(14, Math.max(9, pileDiameter / 35))} />
                      ))}
                    </g>
                    <rect x="124" y={100 - 16} width="32" height="32" fill="#475569" stroke="#cbd5e1" strokeWidth="1.5" />
                  </g>
                )}

                {/* 5. RAFT / MAT FOUNDATION PLAN */}
                {isRaft && (
                  <g>
                    <rect x="20" y="20" width="240" height="145" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" rx="2" />
                    <rect x="55" y="45" width="24" height="24" fill="#475569" stroke="#cbd5e1" strokeWidth="1" />
                    <rect x="201" y="45" width="24" height="24" fill="#475569" stroke="#cbd5e1" strokeWidth="1" />
                    <rect x="55" y="116" width="24" height="24" fill="#475569" stroke="#cbd5e1" strokeWidth="1" />
                    <rect x="201" y="116" width="24" height="24" fill="#475569" stroke="#cbd5e1" strokeWidth="1" />
                    <rect x="128" y="80.5" width="24" height="24" fill="#475569" stroke="#cbd5e1" strokeWidth="1" />
                    <line x1="20" y1="57" x2="260" y2="57" stroke="#334155" strokeWidth="1" strokeDasharray="4 2" />
                    <line x1="20" y1="128" x2="260" y2="128" stroke="#334155" strokeWidth="1" strokeDasharray="4 2" />
                    <line x1="67" y1="20" x2="67" y2="165" stroke="#334155" strokeWidth="1" strokeDasharray="4 2" />
                    <line x1="213" y1="20" x2="213" y2="165" stroke="#334155" strokeWidth="1" strokeDasharray="4 2" />
                  </g>
                )}

                {/* 6. ISOLATED FOOTING PLAN (DEFAULT) */}
                {isIsolated && (
                  <g>
                    <rect x={svgBox.x} y={svgBox.y} width={svgBox.w} height={svgBox.h} fill="#1e293b" stroke="#38bdf8" strokeWidth="2" rx="2" />
                    <rect x="123" y={100 - 17} width="34" height="34" fill="#475569" stroke="#cbd5e1" strokeWidth="1.5" />
                  </g>
                )}

                {/* Rebar Overlay Grid */}
                {!isStrap && !isRaft && (
                  <g stroke="#10b981" strokeWidth="1" strokeDasharray="4 3" opacity="0.5">
                    <line x1={svgBox.x + 8} y1={svgBox.y + 12} x2={svgBox.x + svgBox.w - 8} y2={svgBox.y + 12} />
                    <line x1={svgBox.x + 8} y1={svgBox.y + svgBox.h - 12} x2={svgBox.x + svgBox.w - 8} y2={svgBox.y + svgBox.h - 12} />
                    <line x1={svgBox.x + 12} y1={svgBox.y + 8} x2={svgBox.x + 12} y2={svgBox.y + svgBox.h - 8} />
                    <line x1={svgBox.x + svgBox.w - 12} y1={svgBox.y + 8} x2={svgBox.x + svgBox.w - 12} y2={svgBox.y + svgBox.h - 8} />
                  </g>
                )}

                {/* Dimension Annotations */}
                <text x="140" y="15" fill="#38bdf8" fontSize="10" textAnchor="middle" className="font-mono">
                  B = {B} mm
                </text>

                <text x="140" y="190" fill="#10b981" fontSize="9" textAnchor="middle" className="font-sans font-medium">
                  Btm Mesh: T{botBarDiam} @ {botBarSpacing}mm c/c
                </text>
                {isDoubleMesh && (
                  <text x="140" y="202" fill="#f59e0b" fontSize="8.5" textAnchor="middle" className="font-sans">
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

              <svg viewBox="0 0 280 210" className="w-full h-56 mx-auto">
                {/* Natural Ground Level Line */}
                <line x1="10" y1="48" x2="270" y2="48" stroke="#64748b" strokeWidth="1.5" strokeDasharray="6 4" />
                <text x="20" y="40" fill="#64748b" fontSize="8" className="font-mono">
                  NGL
                </text>

                {/* ELEVATION 1: PILE CAP WITH PILES (SYNCED X) */}
                {isPileCap && (
                  <g fill="#334155" stroke="#64748b" strokeWidth="1.5">
                    {pileElevationXCoords.map((x, i) => (
                      <g key={i}>
                        <rect x={x - 14} y="145" width="28" height="50" />
                        <text x={x} y="175" fill="#94a3b8" fontSize="7" textAnchor="middle" className="font-mono">
                          Ø{pileDiameter}
                        </text>
                      </g>
                    ))}
                  </g>
                )}

                {/* ELEVATION 2: STRAP FOOTING */}
                {isStrap ? (
                  <g>
                    <rect x="30" y="95" width="70" height="50" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" rx="1" />
                    <rect x="180" y="95" width="70" height="50" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" rx="1" />
                    <rect x="100" y="105" width="80" height="30" fill="#0f172a" stroke="#f59e0b" strokeWidth="1.5" />
                    <rect x="48" y="22" width="34" height="73" fill="#334155" stroke="#94a3b8" strokeWidth="1.5" />
                    <rect x="198" y="22" width="34" height="73" fill="#334155" stroke="#94a3b8" strokeWidth="1.5" />
                  </g>
                ) : isCombined ? (
                  /* ELEVATION 3: COMBINED FOOTING */
                  <g>
                    <rect x="30" y="95" width="220" height="50" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" rx="1" />
                    <rect x="60" y="22" width="32" height="73" fill="#334155" stroke="#94a3b8" strokeWidth="1.5" />
                    <rect x="188" y="22" width="32" height="73" fill="#334155" stroke="#94a3b8" strokeWidth="1.5" />
                  </g>
                ) : isWallStrip ? (
                  /* ELEVATION 4: WALL / STRIP FOOTING */
                  <g>
                    <rect x="30" y="95" width="220" height="50" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" rx="1" />
                    <rect x="112" y="18" width="56" height="77" fill="#475569" stroke="#cbd5e1" strokeWidth="1.5" />
                  </g>
                ) : (
                  /* ELEVATION 5: ISOLATED / RAFT / PILE CAP MASS */
                  <g>
                    <rect x="30" y="95" width="220" height="50" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" rx="1" />
                    <rect x="122" y="18" width="36" height="77" fill="#334155" stroke="#94a3b8" strokeWidth="1.5" />
                  </g>
                )}

                {/* Main Bottom Reinforcement Line with Hooks */}
                <path
                  d="M 40 107 L 40 137 L 240 137 L 240 107"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Bottom Bar Cross-Section Circles */}
                <g fill="#059669">
                  <circle cx="60" cy="133" r="2.5" />
                  <circle cx="92" cy="133" r="2.5" />
                  <circle cx="124" cy="133" r="2.5" />
                  <circle cx="156" cy="133" r="2.5" />
                  <circle cx="188" cy="133" r="2.5" />
                  <circle cx="220" cy="133" r="2.5" />
                </g>

                {/* Top Rebar Mesh (if double mesh) */}
                {isDoubleMesh && (
                  <>
                    <path
                      d="M 40 125 L 40 103 L 240 103 L 240 125"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <g fill="#d97706">
                      <circle cx="60" cy="107" r="2" />
                      <circle cx="92" cy="107" r="2" />
                      <circle cx="124" cy="107" r="2" />
                      <circle cx="156" cy="107" r="2" />
                      <circle cx="188" cy="107" r="2" />
                      <circle cx="220" cy="107" r="2" />
                    </g>
                  </>
                )}

                {/* Dimension Bar */}
                <line x1="260" y1="95" x2="260" y2="145" stroke="#38bdf8" strokeWidth="1" />
                <line x1="256" y1="95" x2="264" y2="95" stroke="#38bdf8" strokeWidth="1" />
                <line x1="256" y1="145" x2="264" y2="145" stroke="#38bdf8" strokeWidth="1" />
                <text
                  x="272"
                  y="120"
                  fill="#38bdf8"
                  fontSize="8.5"
                  textAnchor="middle"
                  className="font-mono"
                  transform="rotate(90,272,120)"
                >
                  D={D}
                </text>

                <text x="140" y="165" fill="#cbd5e1" fontSize="9" textAnchor="middle" className="font-mono">
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
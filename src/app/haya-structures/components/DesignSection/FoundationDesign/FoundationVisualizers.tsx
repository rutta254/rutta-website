'use client';

import React, { useState, useMemo } from 'react';
import { Foundation3DRenderer } from './Foundation3DRenderer';
import { Geometry3DData } from '@/lib/structural/foundation';

export interface VisualizerResult {
  category?: 'shallow' | 'deep';
  type?: string;
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

  const category = result?.category ?? 'shallow';
  const rawType = (result?.type ?? 'isolated').toLowerCase();

  // Normalize foundation type classification
  const isCombined = rawType.includes('combined');
  const isStrap = rawType.includes('strap');
  const isWallStrip = rawType.includes('wall') || rawType.includes('strip');
  const isPileCap = category === 'deep' || rawType.includes('pile');
  const isRaft = rawType.includes('raft') || rawType.includes('mat');

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

  const isDoubleMesh = meshMode === 'double' || Boolean(topBarDiam && topBarSpacing);

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
      // Strap Foundation: Two distinct pads connected by a strap beam
      const pad1W = footingWidthM * 0.45;
      const pad2W = footingWidthM * 0.45;
      const xOffset1 = -footingWidthM / 2 + pad1W / 2;
      const xOffset2 = footingWidthM / 2 - pad2W / 2;

      footingBoxes.push(
        { width: pad1W, height: footingHeightM, depth: footingDepthM, position: { x: xOffset1, y: 0, z: 0 } },
        { width: pad2W, height: footingHeightM, depth: footingDepthM, position: { x: xOffset2, y: 0, z: 0 } }
      );

      // Strap connecting beam
      const strapLength = Math.max(0.2, xOffset2 - xOffset1 - (pad1W + pad2W) / 2);
      footingBoxes.push({
        width: strapLength,
        height: footingHeightM * 0.8,
        depth: mainCol1Depth * 1.2,
        position: { x: (xOffset1 + xOffset2) / 2, y: 0, z: 0 },
      });

      columnBoxes.push(
        { width: mainCol1Width, height: colHeightM, depth: mainCol1Depth, position: { x: xOffset1, y: footingHeightM / 2 + colHeightM / 2, z: 0 } },
        { width: mainCol2Width, height: colHeightM, depth: mainCol2Depth, position: { x: xOffset2, y: footingHeightM / 2 + colHeightM / 2, z: 0 } }
      );
    } else if (isCombined) {
      // Combined Footing: Single large pad with two columns
      footingBoxes.push({
        width: footingWidthM,
        height: footingHeightM,
        depth: footingDepthM,
        position: { x: 0, y: 0, z: 0 },
      });

      const offsetFromCenter = Math.min(spacingM / 2, footingWidthM / 2 - mainCol1Width);
      columnBoxes.push(
        { width: mainCol1Width, height: colHeightM, depth: mainCol1Depth, position: { x: -offsetFromCenter, y: footingHeightM / 2 + colHeightM / 2, z: 0 } },
        { width: mainCol2Width, height: colHeightM, depth: mainCol2Depth, position: { x: offsetFromCenter, y: footingHeightM / 2 + colHeightM / 2, z: 0 } }
      );
    } else if (isWallStrip) {
      // Wall Strip Footing: Continuous linear footing with a wall running along its length
      footingBoxes.push({
        width: footingWidthM,
        height: footingHeightM,
        depth: footingDepthM,
        position: { x: 0, y: 0, z: 0 },
      });

      columnBoxes.push({
        width: (c1 || 300) / 1000,
        height: colHeightM,
        depth: footingDepthM * 0.95,
        position: { x: 0, y: footingHeightM / 2 + colHeightM / 2, z: 0 },
      });
    } else {
      // Standard Isolated, Raft, or Pile Cap
      footingBoxes.push({
        width: footingWidthM,
        height: footingHeightM,
        depth: footingDepthM,
        position: { x: 0, y: 0, z: 0 },
      });

      columnBoxes.push({
        width: mainCol1Width,
        height: colHeightM,
        depth: mainCol1Depth,
        position: { x: 0, y: footingHeightM / 2 + colHeightM / 2, z: 0 },
      });
    }

    return {
      footingBox: footingBoxes[0],
      footingBoxes,
      columnBoxes,
      rebars3D: [],
    };
  }, [B, L, D, c1, c2, c21, c22, colSpacing, isCombined, isStrap, isWallStrip]);

  // Dynamic pile location layout calculation for CAD Plan View
  const pileCoordinates = useMemo(() => {
    if (!isPileCap) return [];
    const count = Math.max(2, numPiles);
    const coords: { x: number; y: number }[] = [];

    if (count === 2) {
      coords.push({ x: 90, y: 110 }, { x: 210, y: 110 });
    } else if (count === 3) {
      coords.push({ x: 150, y: 55 }, { x: 80, y: 155 }, { x: 220, y: 155 });
    } else if (count === 5) {
      coords.push({ x: 70, y: 55 }, { x: 230, y: 55 }, { x: 150, y: 110 }, { x: 70, y: 165 }, { x: 230, y: 165 });
    } else {
      // Standard 4-pile or 6+ grid
      coords.push({ x: 70, y: 55 }, { x: 230, y: 55 }, { x: 70, y: 165 }, { x: 230, y: 165 });
      if (count >= 6) {
        coords.push({ x: 150, y: 55 }, { x: 150, y: 165 });
      }
    }
    return coords;
  }, [isPileCap, numPiles]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
      {/* Header Controls & View Toggle */}
      <div className="flex justify-between items-center bg-slate-950 px-4 py-2.5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <span>🎨</span> Structural CAD & 3D Interactive Model
          </span>
          <span className="bg-cyan-950 text-cyan-400 text-[10px] px-2 py-0.5 rounded border border-cyan-800 font-mono font-semibold uppercase">
            {rawType.replace('_', ' ')}
          </span>
        </div>

        <div className="flex bg-slate-900 p-0.5 rounded border border-slate-800 font-mono text-[11px]">
          <button
            onClick={() => setActiveTab('2d')}
            className={`px-3 py-1 rounded font-bold transition ${
              activeTab === '2d' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            2D CAD Drawings
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
                  Mesh: {isDoubleMesh ? 'Double (Top & Btm)' : 'Single (Bottom)'}
                </span>
              </div>

              <svg viewBox="0 0 300 240" className="w-full h-56 mx-auto">
                {/* Main Footing Outline */}
                {isStrap ? (
                  <g>
                    {/* Left Pad */}
                    <rect x="35" y="35" width="85" height="150" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" rx="2" />
                    {/* Right Pad */}
                    <rect x="180" y="35" width="85" height="150" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" rx="2" />
                    {/* Strap Beam */}
                    <rect x="120" y="92" width="60" height="36" fill="#0f172a" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 2" />
                  </g>
                ) : (
                  <rect x="35" y="25" width="230" height="170" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" rx="3" />
                )}

                {/* Pile Cap Layout Piles */}
                {isPileCap && (
                  <g fill="#0f172a" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="3 2">
                    {pileCoordinates.map((pt, idx) => (
                      <circle key={idx} cx={pt.x} cy={pt.y} r={Math.min(18, Math.max(12, pileDiameter / 25))} />
                    ))}
                  </g>
                )}

                {/* Rebar Grid Lines (Bottom Reinforcement Mesh) */}
                <g stroke="#10b981" strokeWidth="1.2" strokeDasharray="4 3" opacity="0.75">
                  <line x1="45" y1="45" x2="255" y2="45" />
                  <line x1="45" y1="80" x2="255" y2="80" />
                  <line x1="45" y1="110" x2="255" y2="110" />
                  <line x1="45" y1="140" x2="255" y2="140" />
                  <line x1="45" y1="175" x2="255" y2="175" />

                  <line x1="55" y1="35" x2="55" y2="185" />
                  <line x1="100" y1="35" x2="100" y2="185" />
                  <line x1="150" y1="35" x2="150" y2="185" />
                  <line x1="200" y1="35" x2="200" y2="185" />
                  <line x1="245" y1="35" x2="245" y2="185" />
                </g>

                {/* Top Mesh overlay if double mesh */}
                {isDoubleMesh && (
                  <g stroke="#f59e0b" strokeWidth="1" strokeDasharray="2 2" opacity="0.65">
                    <line x1="50" y1="62" x2="250" y2="62" />
                    <line x1="50" y1="125" x2="250" y2="125" />
                    <line x1="50" y1="158" x2="250" y2="158" />
                  </g>
                )}

                {/* Column / Wall Overlay */}
                {isCombined || isStrap ? (
                  <g>
                    <rect x="60" y="90" width="36" height="40" fill="#475569" stroke="#cbd5e1" strokeWidth="1.5" />
                    <rect x="204" y="90" width="36" height="40" fill="#475569" stroke="#cbd5e1" strokeWidth="1.5" />
                    <line x1="78" y1="110" x2="222" y2="110" stroke="#f59e0b" strokeWidth="1.2" strokeDasharray="3 2" />
                    <text x="150" y="105" fill="#f59e0b" fontSize="8" textAnchor="middle" className="font-mono">
                      s = {colSpacing}mm
                    </text>
                  </g>
                ) : isWallStrip ? (
                  <rect x="40" y="95" width="220" height="30" fill="#475569" stroke="#cbd5e1" strokeWidth="1.5" />
                ) : (
                  <rect x="130" y="90" width="40" height="40" fill="#475569" stroke="#cbd5e1" strokeWidth="1.5" />
                )}

                {/* Dimensioning & Annotations */}
                <text x="150" y="17" fill="#38bdf8" fontSize="10" textAnchor="middle" fontFamily="monospace" className="font-mono">
                  B = {B} mm
                </text>
                <text
                  x="285"
                  y="110"
                  fill="#38bdf8"
                  fontSize="10"
                  textAnchor="middle"
                  className="font-mono"
                  transform="rotate(90,285,110)"
                >
                  L = {L} mm
                </text>

                <text x="150" y="213" fill="#10b981" fontSize="9" textAnchor="middle" className="font-sans font-medium">
                  Btm Mesh: T{botBarDiam} @ {botBarSpacing}mm c/c B.W.
                </text>
                {isDoubleMesh && (
                  <text x="150" y="226" fill="#f59e0b" fontSize="8.5" textAnchor="middle" className="font-sans">
                    Top Mesh: T{topBarDiam} @ {topBarSpacing}mm c/c B.W.
                  </text>
                )}
              </svg>
            </div>

            {/* ----------------- 2D ELEVATION CROSS-SECTION SVG ----------------- */}
            <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 text-center flex flex-col justify-between">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
                  Elevation Section View
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  D = {D}mm | d = {d}mm
                </span>
              </div>

              <svg viewBox="0 0 300 240" className="w-full h-56 mx-auto">
                {/* Ground Level NGL Line */}
                <line x1="10" y1="50" x2="290" y2="50" stroke="#64748b" strokeWidth="1.5" strokeDasharray="6 4" />
                <text x="25" y="42" fill="#64748b" fontSize="8" className="font-mono">
                  NGL (Ground Level)
                </text>

                {/* Piles in elevation view */}
                {isPileCap && (
                  <g fill="#334155" stroke="#64748b" strokeWidth="1.5">
                    <rect x="70" y="160" width="32" height="55" />
                    <rect x="198" y="160" width="32" height="55" />
                    <text x="86" y="190" fill="#94a3b8" fontSize="7" textAnchor="middle" className="font-mono">
                      Ø{pileDiameter}
                    </text>
                    <text x="214" y="190" fill="#94a3b8" fontSize="7" textAnchor="middle" className="font-mono">
                      Ø{pileDiameter}
                    </text>
                  </g>
                )}

                {/* Concrete Footing Mass */}
                <rect x="35" y="100" width="230" height="60" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" rx="1" />

                {/* Superstructure Column / Columns */}
                {isCombined || isStrap ? (
                  <g fill="#334155" stroke="#94a3b8" strokeWidth="1.5">
                    <rect x="65" y="25" width="36" height="75" />
                    <rect x="199" y="25" width="36" height="75" />
                  </g>
                ) : (
                  <rect x="130" y="20" width="40" height="80" fill="#334155" stroke="#94a3b8" strokeWidth="1.5" />
                )}

                {/* Bottom Main Rebar Line + L-shaped Hooks */}
                <path
                  d="M 45 118 L 45 152 L 255 152 L 255 118"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Transverse Bottom Rebar Dots */}
                <g fill="#059669">
                  <circle cx="65" cy="148" r="2.5" />
                  <circle cx="100" cy="148" r="2.5" />
                  <circle cx="135" cy="148" r="2.5" />
                  <circle cx="165" cy="148" r="2.5" />
                  <circle cx="200" cy="148" r="2.5" />
                  <circle cx="235" cy="148" r="2.5" />
                </g>

                {/* Top Rebar Mesh (if applicable) */}
                {isDoubleMesh && (
                  <>
                    <path
                      d="M 45 140 L 45 108 L 255 108 L 255 140"
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

                {/* Column Dowel Rebars */}
                <path
                  d="M 140 40 L 140 148 L 125 148 M 160 40 L 160 148 L 175 148"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                  strokeDasharray="4 2"
                />

                {/* Height Dimension Bar */}
                <line x1="275" y1="100" x2="275" y2="160" stroke="#38bdf8" strokeWidth="1" />
                <line x1="271" y1="100" x2="279" y2="100" stroke="#38bdf8" strokeWidth="1" />
                <line x1="271" y1="160" x2="279" y2="160" stroke="#38bdf8" strokeWidth="1" />
                <text
                  x="287"
                  y="130"
                  fill="#38bdf8"
                  fontSize="9"
                  textAnchor="middle"
                  className="font-mono"
                  transform="rotate(90,287,130)"
                >
                  D = {D}mm
                </text>

                <text x="150" y="180" fill="#cbd5e1" fontSize="9" textAnchor="middle" className="font-mono">
                  Depth d = {d} mm | Concrete Cover = {cover} mm
                </text>
                <text x="150" y="195" fill="#10b981" fontSize="8.5" textAnchor="middle" className="font-sans font-medium">
                  90° Hook Anchorage Length L<sub>dh</sub> Included
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
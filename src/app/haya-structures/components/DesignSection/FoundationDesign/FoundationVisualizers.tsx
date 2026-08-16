'use client';

import React, { useState } from 'react';
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
  const foundationType = result?.type ?? 'isolated';

  const {
    B = 1800,
    L = 1800,
    D = 450,
    d = 375,
    colSpacing = 1200,
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

  // Convert mm dimensions into 3D meters required by Geometry3DData
  const footingWidthM = B / 1000;
  const footingDepthM = L / 1000;
  const footingHeightM = D / 1000;
  const colWidthM = (c1 || 400) / 1000;
  const colDepthM = (c2 || 400) / 1000;
  const colHeightM = 1.0;

  const render3DData: Geometry3DData = {
    footingBox: {
      width: footingWidthM,
      height: footingHeightM,
      depth: footingDepthM,
      position: { x: 0, y: 0, z: 0 },
    },
    footingBoxes: [
      {
        width: footingWidthM,
        height: footingHeightM,
        depth: footingDepthM,
        position: { x: 0, y: 0, z: 0 },
      },
    ],
    columnBoxes: [
      {
        width: colWidthM,
        height: colHeightM,
        depth: colDepthM,
        position: { x: 0, y: footingHeightM / 2 + colHeightM / 2, z: 0 },
      },
    ],
    rebars3D: [],
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
      <div className="flex justify-between items-center bg-slate-950 px-4 py-2.5 border-b border-slate-800">
        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <span>🎨</span> Structural CAD Engine & Interactive 3D Model
        </span>
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
            {/* Plan View Drawing */}
            <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 text-center flex flex-col justify-between">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
                  Plan View ({B}mm x {L}mm)
                </span>
                <span className="text-[10px] font-mono text-slate-400 capitalize">
                  Type: {foundationType.replace('_', ' ')}
                </span>
              </div>

              <svg viewBox="0 0 300 240" className="w-full h-56 mx-auto">
                <rect x="40" y="25" width="220" height="170" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" rx="3" />

                {(category === 'deep' || foundationType === 'pile_cap') && (
                  <g fill="#0f172a" stroke="#64748b" strokeWidth="1.5" strokeDasharray="3 2">
                    <circle cx="75" cy="55" r="16" />
                    <circle cx="225" cy="55" r="16" />
                    <circle cx="75" cy="165" r="16" />
                    <circle cx="225" cy="165" r="16" />
                    {numPiles > 4 && <circle cx="150" cy="110" r="16" />}
                  </g>
                )}

                <g stroke="#10b981" strokeWidth="1.5" strokeDasharray="5 3" opacity="0.8">
                  <line x1="52" y1="45" x2="248" y2="45" />
                  <line x1="52" y1="80" x2="248" y2="80" />
                  <line x1="52" y1="110" x2="248" y2="110" />
                  <line x1="52" y1="140" x2="248" y2="140" />
                  <line x1="52" y1="175" x2="248" y2="175" />

                  <line x1="65" y1="35" x2="65" y2="185" />
                  <line x1="110" y1="35" x2="110" y2="185" />
                  <line x1="150" y1="35" x2="150" y2="185" />
                  <line x1="190" y1="35" x2="190" y2="185" />
                  <line x1="235" y1="35" x2="235" y2="185" />
                </g>

                {isDoubleMesh && (
                  <g stroke="#f59e0b" strokeWidth="1" strokeDasharray="2 2" opacity="0.7">
                    <line x1="56" y1="60" x2="244" y2="60" />
                    <line x1="56" y1="125" x2="244" y2="125" />
                    <line x1="56" y1="160" x2="244" y2="160" />
                  </g>
                )}

                {foundationType === 'combined' || foundationType.includes('strap') ? (
                  <g>
                    <rect x="85" y="90" width="35" height="40" fill="#475569" stroke="#cbd5e1" strokeWidth="1.5" />
                    <rect x="180" y="90" width="35" height="40" fill="#475569" stroke="#cbd5e1" strokeWidth="1.5" />
                    <line x1="102" y1="110" x2="197" y2="110" stroke="#f59e0b" strokeWidth="1" strokeDasharray="3 2" />
                  </g>
                ) : foundationType === 'wall_strip' ? (
                  <rect x="135" y="30" width="30" height="160" fill="#475569" stroke="#cbd5e1" strokeWidth="1.5" />
                ) : (
                  <rect x="130" y="90" width="40" height="40" fill="#475569" stroke="#cbd5e1" strokeWidth="1.5" />
                )}

                <text x="150" y="17" fill="#38bdf8" fontSize="10" textAnchor="middle" fontFamily="monospace" className="font-mono">
                  B = {B} mm
                </text>
                <text
                  x="280"
                  y="110"
                  fill="#38bdf8"
                  fontSize="10"
                  textAnchor="middle"
                  className="font-mono"
                  transform="rotate(90,280,110)"
                >
                  L = {L} mm
                </text>

                <text x="150" y="215" fill="#10b981" fontSize="9" textAnchor="middle" className="font-sans font-medium">
                  Btm: T{botBarDiam} @ {botBarSpacing}mm c/c B.W.
                </text>
                {isDoubleMesh && (
                  <text x="150" y="228" fill="#f59e0b" fontSize="8.5" textAnchor="middle" className="font-sans">
                    Top: T{topBarDiam} @ {topBarSpacing}mm c/c B.W.
                  </text>
                )}
              </svg>
            </div>

            {/* Elevation Cross-Section View */}
            <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 text-center flex flex-col justify-between">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
                  Elevation Cross-Section View
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  D = {D}mm | d = {d}mm
                </span>
              </div>

              <svg viewBox="0 0 300 240" className="w-full h-56 mx-auto">
                <line x1="10" y1="50" x2="290" y2="50" stroke="#64748b" strokeWidth="1.5" strokeDasharray="6 4" />
                <text x="25" y="42" fill="#64748b" fontSize="8" className="font-mono">
                  NGL (Ground Level)
                </text>

                {(category === 'deep' || foundationType === 'pile_cap') && (
                  <g fill="#334155" stroke="#64748b" strokeWidth="1.5">
                    <rect x="70" y="160" width="30" height="50" />
                    <rect x="200" y="160" width="30" height="50" />
                  </g>
                )}

                <rect x="40" y="100" width="220" height="60" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" rx="1" />

                {foundationType === 'combined' || foundationType.includes('strap') ? (
                  <g fill="#334155" stroke="#94a3b8" strokeWidth="1.5">
                    <rect x="80" y="30" width="35" height="70" />
                    <rect x="185" y="30" width="35" height="70" />
                  </g>
                ) : (
                  <rect x="130" y="20" width="40" height="80" fill="#334155" stroke="#94a3b8" strokeWidth="1.5" />
                )}

                <path
                  d="M 52 118 L 52 152 L 248 152 L 248 118"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                <g fill="#059669">
                  <circle cx="70" cy="148" r="2.5" />
                  <circle cx="110" cy="148" r="2.5" />
                  <circle cx="150" cy="148" r="2.5" />
                  <circle cx="190" cy="148" r="2.5" />
                  <circle cx="230" cy="148" r="2.5" />
                </g>

                {isDoubleMesh && (
                  <>
                    <path
                      d="M 52 140 L 52 108 L 248 108 L 248 140"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <g fill="#d97706">
                      <circle cx="70" cy="112" r="2" />
                      <circle cx="110" cy="112" r="2" />
                      <circle cx="150" cy="112" r="2" />
                      <circle cx="190" cy="112" r="2" />
                      <circle cx="230" cy="112" r="2" />
                    </g>
                  </>
                )}

                <path
                  d="M 140 50 L 140 148 L 125 148 M 160 50 L 160 148 L 175 148"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                  strokeDasharray="4 2"
                />

                <line x1="270" y1="100" x2="270" y2="160" stroke="#38bdf8" strokeWidth="1" />
                <line x1="266" y1="100" x2="274" y2="100" stroke="#38bdf8" strokeWidth="1" />
                <line x1="266" y1="160" x2="274" y2="160" stroke="#38bdf8" strokeWidth="1" />
                <text
                  x="283"
                  y="130"
                  fill="#38bdf8"
                  fontSize="9"
                  textAnchor="middle"
                  className="font-mono"
                  transform="rotate(90,283,130)"
                >
                  D = {D}mm
                </text>

                <text x="150" y="180" fill="#cbd5e1" fontSize="9" textAnchor="middle" className="font-mono">
                  Effective Depth d = {d} mm | Cover = {cover} mm
                </text>
                <text x="150" y="195" fill="#10b981" fontSize="8.5" textAnchor="middle" className="font-sans font-medium">
                  90° Hook Anchorage Length L<sub>dh</sub> Included
                </text>
              </svg>
            </div>
          </div>
        ) : (
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
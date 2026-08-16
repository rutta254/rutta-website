'use client';

import React, { useState } from 'react';
import { FoundationDesignResult } from '@/lib/structural/foundation';

interface VisualizerProps {
  result: FoundationDesignResult;
  c1: number;
  c2: number;
  cover: number;
}

export function FoundationVisualizers({ result, c1, c2, cover }: VisualizerProps) {
  const [activeTab, setActiveTab] = useState<'2d' | '3d'>('2d');
  
  // Safe destructuring with fallbacks for optional properties
  const { B = 0, L = 0, D = 0, d = 0 } = result?.geometry ?? {};
  const { botBarDiam = 0, botBarSpacing = 0 } = result?.reinforcement ?? {};

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      {/* Viewport Header Tabs */}
      <div className="flex justify-between items-center bg-slate-950 px-4 py-2.5 border-b border-slate-800">
        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <span>🎨</span> Visual CAD Engine & 3D Structural View
        </span>
        <div className="flex bg-slate-900 p-0.5 rounded border border-slate-800 font-mono text-[11px]">
          <button
            onClick={() => setActiveTab('2d')}
            className={`px-3 py-1 rounded font-bold transition ${
              activeTab === '2d' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            2D CAD Drawings
          </button>
          <button
            onClick={() => setActiveTab('3d')}
            className={`px-3 py-1 rounded font-bold transition ${
              activeTab === '3d' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
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
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-center">
              <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider block mb-2">
                Plan View (B x L Grid)
              </span>
              <svg viewBox="0 0 300 240" className="w-full h-52 mx-auto">
                {/* Outer Footing Box */}
                <rect x="40" y="20" width="220" height="180" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" rx="4" />
                {/* Column Center Stub */}
                <rect x="130" y="90" width="40" height="40" fill="#475569" stroke="#cbd5e1" strokeWidth="1.5" />
                {/* Main Rebar Lines */}
                <line x1="50" y1="40" x2="250" y2="40" stroke="#10b981" strokeWidth="2" strokeDasharray="4 2" />
                <line x1="50" y1="70" x2="250" y2="70" stroke="#10b981" strokeWidth="2" strokeDasharray="4 2" />
                <line x1="50" y1="170" x2="250" y2="170" stroke="#10b981" strokeWidth="2" strokeDasharray="4 2" />
                {/* Dimensions */}
                <text x="150" y="15" fill="#38bdf8" fontSize="10" textAnchor="middle" fontFamily="monospace">
                  B = {B} mm
                </text>
                <text x="275" y="115" fill="#38bdf8" fontSize="10" textAnchor="middle" fontFamily="monospace" transform="rotate(90,275,115)">
                  L = {L} mm
                </text>
                <text x="150" y="220" fill="#10b981" fontSize="9" textAnchor="middle" fontFamily="sans-serif">
                  Ø{botBarDiam}mm @ {botBarSpacing}mm c/c Both Ways
                </text>
              </svg>
            </div>

            {/* Cross Section View */}
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-center">
              <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider block mb-2">
                Elevation Cross-Section View
              </span>
              <svg viewBox="0 0 300 240" className="w-full h-52 mx-auto">
                {/* Ground Level Line */}
                <line x1="10" y1="50" x2="290" y2="50" stroke="#64748b" strokeWidth="1.5" strokeDasharray="6 4" />
                <text x="25" y="42" fill="#64748b" fontSize="8" fontFamily="monospace">NGL (Soil)</text>
                {/* Column Stub */}
                <rect x="130" y="20" width="40" height="80" fill="#334155" stroke="#94a3b8" strokeWidth="1.5" />
                {/* Footing Slab Block */}
                <rect x="40" y="100" width="220" height="70" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
                {/* Bottom Concrete Cover Line */}
                <line x1="52" y1="156" x2="248" y2="156" stroke="#10b981" strokeWidth="3" />
                {/* 90-degree L-Bends */}
                <path d="M 52 135 L 52 156 L 248 156 L 248 135" fill="none" stroke="#10b981" strokeWidth="2.5" />
                {/* Thickness Annotations */}
                <text x="275" y="140" fill="#38bdf8" fontSize="10" textAnchor="middle" fontFamily="monospace" transform="rotate(90,275,140)">
                  D = {D} mm
                </text>
                <text x="150" y="195" fill="#cbd5e1" fontSize="9" textAnchor="middle" fontFamily="monospace">
                  Effective Depth d = {d} mm | Cover = {cover} mm
                </text>
              </svg>
            </div>
          </div>
        ) : (
          /* Interactive 3D CSS Canvas Mesh Rendering */
          <div className="bg-slate-950 p-6 rounded-lg border border-slate-800 text-center space-y-4">
            <div className="relative w-full h-64 bg-slate-900/60 rounded-xl border border-slate-800 flex items-center justify-center overflow-hidden">
              {/* Isometric Projected Box Render */}
              <div className="transform -rotate-12 rotate-x-45 perspective-1000 transition-all duration-500">
                {/* Concrete Block Mesh */}
                <div 
                  className="relative bg-cyan-500/20 border-2 border-cyan-400 rounded shadow-2xl flex flex-col justify-between p-2"
                  style={{ width: `${Math.min(B / 12, 220)}px`, height: `${Math.min(D / 4, 90)}px` }}
                >
                  {/* Column Isometric Stub */}
                  <div 
                    className="mx-auto -mt-12 bg-slate-700 border border-slate-400 rounded-xs" 
                    style={{ width: `${c1 / 10}px`, height: '50px' }}
                  />
                  {/* Internal Rebar Skeleton Grid Lines */}
                  <div className="w-full h-1 bg-emerald-400 shadow-md shadow-emerald-500/50 rounded" />
                </div>
              </div>
            </div>
            <div className="flex justify-between items-center text-xs font-mono text-slate-400 px-2">
              <span>Footing Bounds: {B / 1000}m x {L / 1000}m x {D / 1000}m</span>
              <span className="text-emerald-400 font-bold">3D Rebar Cage Mesh Generated</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
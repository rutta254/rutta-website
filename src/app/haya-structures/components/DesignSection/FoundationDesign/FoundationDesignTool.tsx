'use client';

import React, { useState } from 'react';
import type { 
  DesignCode, 
  FoundationCategory, 
  ShallowType, 
  DeepType, 
  CombinedSubType, 
  FoundationDesignInput, 
  FoundationDesignResult 
} from '@/lib/structural/foundation';
import { runFoundationDesign } from '@/lib/structural/foundation/autoSizer';
import { generateFoundationPdfReport } from '@/lib/reports/foundationPdfReport';
import { Foundation3DRenderer } from './Foundation3DRenderer';

export default function FoundationDesignTool() {
  // General Configuration
  const [code, setCode] = useState<DesignCode>('BS8110');
  const [category, setCategory] = useState<FoundationCategory>('shallow');
  const [shallowType, setShallowType] = useState<ShallowType>('isolated_pad');
  const [deepType, setDeepType] = useState<DeepType>('pile_cap');
  const [combinedSubType, setCombinedSubType] = useState<CombinedSubType>('strap');
  const [meshMode, setMeshMode] = useState<'single' | 'double'>('single');

  // Concrete & Material Properties
  const [fc, setFc] = useState<number>(30);
  const [fy, setFy] = useState<number>(460);
  const [cover, setCover] = useState<number>(50);
  const [gammaSoil, setGammaSoil] = useState<number>(18);
  const [embedmentDepth, setEmbedmentDepth] = useState<number>(1500);

  // Column 1 Inputs
  const [c1, setC1] = useState<number>(400);
  const [c2, setC2] = useState<number>(400);
  const [pDead, setPDead] = useState<number>(950);
  const [pLive, setPLive] = useState<number>(480);
  const [mDeadX, setMDeadX] = useState<number>(75);
  const [mLiveX, setMLiveX] = useState<number>(35);

  // Column 2 Inputs (Combined Footings)
  const [c21, setC21] = useState<number>(400);
  const [c22, setC22] = useState<number>(400);
  const [p2Dead, setP2Dead] = useState<number>(750);
  const [p2Live, setP2Live] = useState<number>(380);
  const [m2DeadX, setM2DeadX] = useState<number>(50);
  const [m2LiveX, setM2LiveX] = useState<number>(25);

  // Combined Footing Geometry
  const [qAllow, setQAllow] = useState<number>(200);
  const [colSpacing, setColSpacing] = useState<number>(3500);
  const [edgeDistance1, setEdgeDistance1] = useState<number>(500);
  const [edgeDistance2, setEdgeDistance2] = useState<number>(500);
  const [maxL, setMaxL] = useState<number | undefined>(undefined);

  // Deep Foundation Inputs
  const [pileDiameter, setPileDiameter] = useState<number>(500);
  const [pileCapacity, setPileCapacity] = useState<number>(650);
  const [numPiles, setNumPiles] = useState<number>(4);

  const constructPayload = (): FoundationDesignInput => {
    if (category === 'shallow') {
      return {
        code,
        category: 'shallow',
        shallowType,
        combinedSubType: shallowType === 'combined' ? combinedSubType : undefined,
        fc,
        fy,
        cover,
        c1,
        c2,
        pDead,
        pLive,
        mDeadX,
        mLiveX,
        qAllow,
        gammaSoil,
        embedmentDepth,
        // Dual column details for combined footings
        ...(shallowType === 'combined' && {
          c21,
          c22,
          p2Dead,
          p2Live,
          m2DeadX,
          m2LiveX,
          colSpacing,
          edgeDistance1,
          edgeDistance2,
          maxL,
        }),
      };
    } else {
      return {
        code,
        category: 'deep',
        deepType,
        fc,
        fy,
        cover,
        c1,
        c2,
        pDead,
        pLive,
        mDeadX,
        mLiveX,
        pileDiameter,
        pileCapacity,
        numPiles,
      };
    }
  };

  const result: FoundationDesignResult = runFoundationDesign(constructPayload());

  return (
    <div className="space-y-6 text-slate-100 font-sans">
      {/* Header Controls */}
      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Design Code Standard:
          </label>
          <select
            value={code}
            onChange={(e) => setCode(e.target.value as DesignCode)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-cyan-400 focus:outline-none focus:border-cyan-500"
          >
            <option value="BS8110">BS 8110 (British Standard / Africa / Commonwealth)</option>
            <option value="ACI318_19">ACI 318-19 (American Concrete Institute)</option>
            <option value="EC2_EN1992">Eurocode 2 (BS EN 1992 / Europe)</option>
            <option value="IS456">IS 456:2000 (Indian Standard)</option>
            <option value="AS3600">AS 3600:2018 (Australian Standard)</option>
            <option value="CSA_A23_3">CSA A23.3-19 (Canadian Standard)</option>
          </select>
        </div>

        <button
          onClick={() => generateFoundationPdfReport(result)}
          className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition"
        >
          📄 Export Math Workflow PDF
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Inputs Panel */}
        <div className="lg:col-span-5 space-y-5 bg-slate-900 p-5 rounded-xl border border-slate-800">
          {/* Category Selector */}
          <div>
            <label className="block text-[10px] text-slate-400 uppercase font-bold mb-2">Category</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCategory('shallow')}
                className={`py-2 rounded-lg text-xs font-bold border transition ${
                  category === 'shallow'
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                    : 'bg-slate-950 text-slate-400 border-slate-800'
                }`}
              >
                Shallow Foundations
              </button>
              <button
                type="button"
                onClick={() => setCategory('deep')}
                className={`py-2 rounded-lg text-xs font-bold border transition ${
                  category === 'deep'
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                    : 'bg-slate-950 text-slate-400 border-slate-800'
                }`}
              >
                Deep Foundations
              </button>
            </div>
          </div>

          {/* Type Selection */}
          <div>
            <label className="block text-[10px] text-slate-400 uppercase font-bold mb-2">Type Selection</label>
            {category === 'shallow' ? (
              <>
                <select
                  value={shallowType}
                  onChange={(e) => setShallowType(e.target.value as ShallowType)}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="isolated_pad">Isolated Pad Footing</option>
                  <option value="wall_strip">Continuous Wall / Strip Footing</option>
                  <option value="combined">Combined / Strap Footing</option>
                  <option value="raft_mat">Raft / Mat Foundation</option>
                </select>

                {/* Subtype Dropdown for Combined Footings */}
                {shallowType === 'combined' && (
                  <div className="mt-3 p-3 bg-slate-950/80 rounded-lg border border-cyan-500/30 space-y-1.5">
                    <label className="block text-[10px] text-cyan-400 uppercase font-bold">
                      Combined Footing Subtype
                    </label>
                    <select
                      value={combinedSubType}
                      onChange={(e) => setCombinedSubType(e.target.value as CombinedSubType)}
                      className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-slate-200 font-medium focus:outline-none focus:border-cyan-500"
                    >
                      <option value="rectangular">Rectangular Combined</option>
                      <option value="trapezoidal">Trapezoidal Combined</option>
                      <option value="strap">Strap / Cantilever Footing</option>
                    </select>
                  </div>
                )}
              </>
            ) : (
              <select
                value={deepType}
                onChange={(e) => setDeepType(e.target.value as DeepType)}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="pile_cap">Pile Cap Assembly</option>
                <option value="single_pile">Single Driven / Bored Pile</option>
                <option value="drilled_shaft">Large Diameter Drilled Shaft</option>
              </select>
            )}
          </div>

          {/* Rebar Mesh Selection */}
          <div>
            <label className="block text-[10px] text-slate-400 uppercase font-bold mb-2">
              Reinforcement Mesh Configuration
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMeshMode('single')}
                className={`py-2 rounded-lg text-xs font-bold border transition ${
                  meshMode === 'single'
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                    : 'bg-slate-950 text-slate-400 border-slate-800'
                }`}
              >
                Single Mesh (Bottom)
              </button>
              <button
                type="button"
                onClick={() => setMeshMode('double')}
                className={`py-2 rounded-lg text-xs font-bold border transition ${
                  meshMode === 'double'
                    ? 'bg-amber-500 text-slate-950 border-amber-400'
                    : 'bg-slate-950 text-slate-400 border-slate-800'
                }`}
              >
                Double Mesh (Top & Bottom)
              </button>
            </div>
          </div>

          {/* Materials & Geotechnical Section */}
          <div className="border-t border-slate-800 pt-3 space-y-3">
            <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider block">
              Materials & Geotechnical Properties
            </span>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">q_allow (kPa)</label>
                <input
                  type="number"
                  value={qAllow}
                  onChange={(e) => setQAllow(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">f_c' / f_cu (MPa)</label>
                <input
                  type="number"
                  value={fc}
                  onChange={(e) => setFc(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs font-mono"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs text-slate-400 mb-1">f_y (MPa)</label>
                <input
                  type="number"
                  value={fy}
                  onChange={(e) => setFy(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Cover (mm)</label>
                <input
                  type="number"
                  value={cover}
                  onChange={(e) => setCover(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Depth (mm)</label>
                <input
                  type="number"
                  value={embedmentDepth}
                  onChange={(e) => setEmbedmentDepth(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs font-mono"
                />
              </div>
            </div>
          </div>

          {/* Column 1 Loads & Dimensions */}
          <div className="border-t border-slate-800 pt-3 space-y-3">
            <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider block">
              {category === 'shallow' && shallowType === 'combined' ? 'Column 1 (Exterior / Left)' : 'Column Loads & Dimensions'}
            </span>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Col 1 Width c1 (mm)</label>
                <input
                  type="number"
                  value={c1}
                  onChange={(e) => setC1(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Col 1 Depth c2 (mm)</label>
                <input
                  type="number"
                  value={c2}
                  onChange={(e) => setC2(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs font-mono"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">P1 Dead (kN)</label>
                <input
                  type="number"
                  value={pDead}
                  onChange={(e) => setPDead(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">P1 Live (kN)</label>
                <input
                  type="number"
                  value={pLive}
                  onChange={(e) => setPLive(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs font-mono"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">M1 Dead X (kNm)</label>
                <input
                  type="number"
                  value={mDeadX}
                  onChange={(e) => setMDeadX(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">M1 Live X (kNm)</label>
                <input
                  type="number"
                  value={mLiveX}
                  onChange={(e) => setMLiveX(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs font-mono"
                />
              </div>
            </div>
          </div>

          {/* Combined Footing Specific Controls */}
          {category === 'shallow' && shallowType === 'combined' && (
            <div className="border-t border-cyan-500/30 pt-3 space-y-3 bg-cyan-950/20 p-3 rounded-lg">
              <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider block">
                Column 2 & Footing Spacing Parameters
              </span>

              {/* Column 2 Dimensions */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Col 2 Width c2_1 (mm)</label>
                  <input
                    type="number"
                    value={c21}
                    onChange={(e) => setC21(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Col 2 Depth c2_2 (mm)</label>
                  <input
                    type="number"
                    value={c22}
                    onChange={(e) => setC22(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Column 2 Loads */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">P2 Dead (kN)</label>
                  <input
                    type="number"
                    value={p2Dead}
                    onChange={(e) => setP2Dead(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">P2 Live (kN)</label>
                  <input
                    type="number"
                    value={p2Live}
                    onChange={(e) => setP2Live(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Geometry Distances */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Col Spacing S (mm)</label>
                  <input
                    type="number"
                    value={colSpacing}
                    onChange={(e) => setColSpacing(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Left Overhang e1 (mm)</label>
                  <input
                    type="number"
                    value={edgeDistance1}
                    onChange={(e) => setEdgeDistance1(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Right Overhang e2 (mm)</label>
                  <input
                    type="number"
                    value={edgeDistance2}
                    onChange={(e) => setEdgeDistance2(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Max Length L_max (mm)</label>
                  <input
                    type="number"
                    placeholder="Auto"
                    value={maxL ?? ''}
                    onChange={(e) => setMaxL(e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Deep Foundation Controls */}
          {category === 'deep' && (
            <div className="border-t border-amber-500/30 pt-3 space-y-3 bg-amber-950/20 p-3 rounded-lg">
              <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block">
                Pile Cap & Deep Foundation Setup
              </span>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Pile Dia (mm)</label>
                  <input
                    type="number"
                    value={pileDiameter}
                    onChange={(e) => setPileDiameter(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Cap. (kN)</label>
                  <input
                    type="number"
                    value={pileCapacity}
                    onChange={(e) => setPileCapacity(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">No. Piles</label>
                  <input
                    type="number"
                    value={numPiles}
                    onChange={(e) => setNumPiles(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Output Panel & 3D WebGL Canvas */}
        <div className="lg:col-span-7 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-900 border border-cyan-500/30 p-3 rounded-xl text-center">
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Footing Dimension</span>
              <span className="text-base font-bold font-mono text-cyan-400">
                {result.geometry.B} x {result.geometry.L} mm
              </span>
            </div>
            <div className="bg-slate-900 border border-cyan-500/30 p-3 rounded-xl text-center">
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Overall Depth (D)</span>
              <span className="text-base font-bold font-mono text-cyan-400">{result.geometry.D} mm</span>
            </div>
            <div className="bg-slate-900 border border-emerald-500/30 p-3 rounded-xl text-center">
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Total Rebar Mass</span>
              <span className="text-base font-bold font-mono text-emerald-400">
                {meshMode === 'double' ? (result.totalSteelWeightKg * 1.85).toFixed(0) : result.totalSteelWeightKg} kg
              </span>
            </div>
          </div>

          {/* 3D WebGL Three.js Renderer Viewport */}
          <Foundation3DRenderer data={result.geometry3D} meshMode={meshMode} />

          {/* Code Checks Summary */}
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-2">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              {result.typeLabel} — Structural Checks ({result.codeUsed})
            </h4>
            <div className="grid grid-cols-4 gap-2 pt-2 text-center text-xs font-mono">
              <div className="p-2 bg-slate-950 rounded border border-slate-800">
                <span className="text-[9px] text-slate-400 block">Bearing DCR</span>
                <span className="font-bold text-slate-200">{result.structuralChecks.bearingOrPileDcr}</span>
              </div>
              <div className="p-2 bg-slate-950 rounded border border-slate-800">
                <span className="text-[9px] text-slate-400 block">Punching DCR</span>
                <span className="font-bold text-slate-200">{result.structuralChecks.punchingShearDcr}</span>
              </div>
              <div className="p-2 bg-slate-950 rounded border border-slate-800">
                <span className="text-[9px] text-slate-400 block">Flexure DCR</span>
                <span className="font-bold text-slate-200">{result.structuralChecks.flexureDcr}</span>
              </div>
              <div className="p-2 bg-slate-950 rounded border border-slate-800">
                <span className="text-[9px] text-slate-400 block">Concrete Vol.</span>
                <span className="font-bold text-cyan-400">{result.concreteVolumeM3} m³</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
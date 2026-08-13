'use client';

import React, { useState } from 'react';
import { 
  FoundationCategory, 
  ShallowType, 
  DeepType, 
  CombinedSubType, 
  FoundationDesignInput, 
  FoundationDesignResult 
} from '@/lib/structural/foundation';
import { runFoundationDesign } from '@/lib/structural/foundation/autoSizer';

export default function FoundationDesignTool() {
  const [category, setCategory] = useState<FoundationCategory>('shallow');
  const [shallowType, setShallowType] = useState<ShallowType>('isolated_pad');
  const [deepType, setDeepType] = useState<DeepType>('pile_cap');
  const [combinedSubType, setCombinedSubType] = useState<CombinedSubType>('strap');

  // Input States
  const [fc, setFc] = useState<number>(28);
  const [fy, setFy] = useState<number>(420);
  const [cover, setCover] = useState<number>(75);
  const [c1, setC1] = useState<number>(400);
  const [c2, setC2] = useState<number>(400);

  const [pDead, setPDead] = useState<number>(900);
  const [pLive, setPLive] = useState<number>(500);
  const [mDead, setMDead] = useState<number>(80);
  const [mLive, setMLive] = useState<number>(40);

  // Shallow Inputs
  const [qAllow, setQAllow] = useState<number>(220);
  const [colSpacing, setColSpacing] = useState<number>(3500);

  // Deep Inputs
  const [pileDiameter, setPileDiameter] = useState<number>(500);
  const [pileCapacity, setPileCapacity] = useState<number>(600);
  const [numPiles, setNumPiles] = useState<number>(4);

  // Build Payload & Run Engine
  const constructPayload = (): FoundationDesignInput => {
    if (category === 'shallow') {
      return {
        code: 'ACI318',
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
        mDead,
        mLive,
        qAllow,
        gammaSoil: 18,
        embedmentDepth: 1500,
        colSpacing,
      };
    } else {
      return {
        code: 'ACI318',
        category: 'deep',
        deepType,
        fc,
        fy,
        cover,
        c1,
        c2,
        pDead,
        pLive,
        mDead,
        mLive,
        pileDiameter,
        pileCapacity,
        numPiles,
      };
    }
  };

  const [result, setResult] = useState<FoundationDesignResult>(() => runFoundationDesign(constructPayload()));

  const handleUpdate = () => {
    setResult(runFoundationDesign(constructPayload()));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-950 p-6 rounded-2xl border border-slate-800 text-slate-100">
      {/* LEFT: CONTROLS & DYNAMIC INPUT FORM */}
      <div className="lg:col-span-5 space-y-4 bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-xl">
        {/* Category Toggles */}
        <div>
          <label className="block text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-2">
            1. Foundation Category
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => { setCategory('shallow'); handleUpdate(); }}
              className={`py-2 rounded-lg text-xs font-bold transition border ${
                category === 'shallow'
                  ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/20'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              Shallow Foundations
            </button>
            <button
              onClick={() => { setCategory('deep'); handleUpdate(); }}
              className={`py-2 rounded-lg text-xs font-bold transition border ${
                category === 'deep'
                  ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/20'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              Deep Foundations
            </button>
          </div>
        </div>

        {/* Sub-type Selection */}
        <div>
          <label className="block text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-2">
            2. Classification Type
          </label>
          {category === 'shallow' ? (
            <select
              value={shallowType}
              onChange={(e) => { setShallowType(e.target.value as ShallowType); handleUpdate(); }}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 font-medium"
            >
              <option value="isolated_pad">Isolated Pad Footing</option>
              <option value="wall_strip">Continuous Wall / Strip Footing</option>
              <option value="combined">Combined / Strap Footing</option>
              <option value="raft_mat">Raft / Mat Foundation</option>
            </select>
          ) : (
            <select
              value={deepType}
              onChange={(e) => { setDeepType(e.target.value as DeepType); handleUpdate(); }}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 font-medium"
            >
              <option value="pile_cap">Pile Cap Assembly</option>
              <option value="single_pile">Single Driven / Bored Pile</option>
              <option value="drilled_shaft">Large Diameter Drilled Shaft</option>
            </select>
          )}
        </div>

        {category === 'shallow' && shallowType === 'combined' && (
          <div className="p-2.5 bg-slate-950 rounded border border-slate-800 space-y-2">
            <label className="block text-[10px] text-cyan-400 font-bold">Combined Geometry Layout</label>
            <select
              value={combinedSubType}
              onChange={(e) => { setCombinedSubType(e.target.value as CombinedSubType); handleUpdate(); }}
              className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-slate-200"
            >
              <option value="rectangular">Rectangular Combined</option>
              <option value="trapezoidal">Trapezoidal Combined</option>
              <option value="strap">Strap (Cantilever) Footing</option>
            </select>
          </div>
        )}

        {/* Dynamic Inputs Section */}
        <div className="space-y-3 pt-2 border-t border-slate-800">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Axial Dead P_Dead (kN)</label>
              <input
                type="number"
                value={pDead}
                onChange={(e) => setPDead(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Axial Live P_Live (kN)</label>
              <input
                type="number"
                value={pLive}
                onChange={(e) => setPLive(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs font-mono"
              />
            </div>
          </div>

          {category === 'shallow' ? (
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
                <label className="block text-xs text-slate-400 mb-1">Concrete f'c (MPa)</label>
                <input
                  type="number"
                  value={fc}
                  onChange={(e) => setFc(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs font-mono"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">Pile Ø (mm)</label>
                <input
                  type="number"
                  value={pileDiameter}
                  onChange={(e) => setPileDiameter(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">Pile Cap. (kN)</label>
                <input
                  type="number"
                  value={pileCapacity}
                  onChange={(e) => setPileCapacity(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">Num Piles</label>
                <input
                  type="number"
                  value={numPiles}
                  onChange={(e) => setNumPiles(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs font-mono"
                />
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleUpdate}
          className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold py-2.5 rounded transition text-xs uppercase tracking-wider"
        >
          Run Direct Design Optimization
        </button>
      </div>

      {/* RIGHT: RESULTS, GEOMETRY & BAR BENDING SCHEDULE */}
      <div className="lg:col-span-7 space-y-4">
        {/* Metric Overview Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-900 border border-cyan-500/30 p-3 rounded-xl text-center">
            <span className="text-[10px] text-slate-400 block uppercase font-bold">Optimized Dimensions</span>
            <span className="text-base font-bold font-mono text-cyan-400">
              {result.geometry.B} x {result.geometry.L} mm
            </span>
          </div>

          <div className="bg-slate-900 border border-cyan-500/30 p-3 rounded-xl text-center">
            <span className="text-[10px] text-slate-400 block uppercase font-bold">Thickness / Depth (D)</span>
            <span className="text-base font-bold font-mono text-cyan-400">
              {result.geometry.D} mm
            </span>
          </div>

          <div className="bg-slate-900 border border-emerald-500/30 p-3 rounded-xl text-center">
            <span className="text-[10px] text-slate-400 block uppercase font-bold">Total Rebar Weight</span>
            <span className="text-base font-bold font-mono text-emerald-400">
              {result.totalSteelWeightKg} kg
            </span>
          </div>
        </div>

        {/* Structural Checks Table */}
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-2">
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              {result.typeLabel} — Structural Design Ratios
            </h4>
            <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${result.status === 'OPTIMIZED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400'}`}>
              {result.status}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 text-center text-xs font-mono">
            <div className="p-2 bg-slate-950 rounded border border-slate-800">
              <span className="text-[9px] text-slate-400 block">{category === 'shallow' ? 'Bearing DCR' : 'Pile Cap. DCR'}</span>
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

        {/* Bar Bending Schedule (BBS) */}
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-3">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Rebar Cut Schedule (BBS Takeoff)
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300 border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2">Mark</th>
                  <th className="py-2">Description</th>
                  <th className="py-2">Bar Size</th>
                  <th className="py-2">Spacing</th>
                  <th className="py-2">Qty</th>
                  <th className="py-2">Cut Len</th>
                  <th className="py-2">Weight</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {result.bbs.map((item) => (
                  <tr key={item.mark}>
                    <td className="py-2 text-cyan-400 font-bold">{item.mark}</td>
                    <td className="py-2 font-sans text-slate-300">{item.description}</td>
                    <td className="py-2">Ø{item.barDiameter}</td>
                    <td className="py-2">{item.spacing}mm</td>
                    <td className="py-2">{item.count}</td>
                    <td className="py-2">{item.cutLength}m</td>
                    <td className="py-2 text-emerald-400 font-bold">{item.totalWeight}kg</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
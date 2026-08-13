'use client';

import React, { useState } from 'react';
import { 
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

export default function FoundationDesignTool() {
  const [code, setCode] = useState<DesignCode>('ACI318_19');
  const [category, setCategory] = useState<FoundationCategory>('shallow');
  const [shallowType, setShallowType] = useState<ShallowType>('isolated_pad');
  const [deepType, setDeepType] = useState<DeepType>('pile_cap');
  const [combinedSubType, setCombinedSubType] = useState<CombinedSubType>('strap');

  const [fc, setFc] = useState<number>(28);
  const [fy, setFy] = useState<number>(420);
  const [cover, setCover] = useState<number>(75);
  const [c1, setC1] = useState<number>(400);
  const [c2, setC2] = useState<number>(400);

  const [pDead, setPDead] = useState<number>(900);
  const [pLive, setPLive] = useState<number>(500);
  const [mDeadX, setMDeadX] = useState<number>(80);
  const [mLiveX, setMLiveX] = useState<number>(40);

  const [qAllow, setQAllow] = useState<number>(220);
  const [colSpacing, setColSpacing] = useState<number>(3500);

  const [pileDiameter, setPileDiameter] = useState<number>(500);
  const [pileCapacity, setPileCapacity] = useState<number>(600);
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
        gammaSoil: 18,
        embedmentDepth: 1500,
        colSpacing,
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
      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-slate-400 uppercase">Design Code Standard:</label>
          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 font-mono text-xs">
            <button
              onClick={() => setCode('ACI318_19')}
              className={`px-3 py-1 rounded font-bold transition ${
                code === 'ACI318_19' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ACI 318-19 (US)
            </button>
            <button
              onClick={() => setCode('EC2_EN1992')}
              className={`px-3 py-1 rounded font-bold transition ${
                code === 'EC2_EN1992' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Eurocode 2 (EU/UK)
            </button>
          </div>
        </div>

        <button
          onClick={() => generateFoundationPdfReport(result)}
          className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20"
        >
          📄 Export Math Workflow PDF
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-4 bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-xl">
          <div>
            <label className="block text-[10px] text-slate-400 uppercase font-bold mb-2">Category</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setCategory('shallow')}
                className={`py-2 rounded-lg text-xs font-bold border ${
                  category === 'shallow' ? 'bg-cyan-500 text-slate-950 border-cyan-400' : 'bg-slate-950 text-slate-400 border-slate-800'
                }`}
              >
                Shallow Foundations
              </button>
              <button
                onClick={() => setCategory('deep')}
                className={`py-2 rounded-lg text-xs font-bold border ${
                  category === 'deep' ? 'bg-cyan-500 text-slate-950 border-cyan-400' : 'bg-slate-950 text-slate-400 border-slate-800'
                }`}
              >
                Deep Foundations
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[10px] text-slate-400 uppercase font-bold mb-2">Type</label>
            {category === 'shallow' ? (
              <select
                value={shallowType}
                onChange={(e) => setShallowType(e.target.value as ShallowType)}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200"
              >
                <option value="isolated_pad">Isolated Pad Footing</option>
                <option value="wall_strip">Continuous Wall / Strip Footing</option>
                <option value="combined">Combined / Strap Footing</option>
                <option value="raft_mat">Raft / Mat Foundation</option>
              </select>
            ) : (
              <select
                value={deepType}
                onChange={(e) => setDeepType(e.target.value as DeepType)}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200"
              >
                <option value="pile_cap">Pile Cap Assembly</option>
                <option value="single_pile">Single Driven / Bored Pile</option>
                <option value="drilled_shaft">Large Diameter Drilled Shaft</option>
              </select>
            )}
          </div>

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
        </div>

        <div className="lg:col-span-7 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-900 border border-cyan-500/30 p-3 rounded-xl text-center">
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Dimensions</span>
              <span className="text-base font-bold font-mono text-cyan-400">{result.geometry.B} x {result.geometry.L} mm</span>
            </div>
            <div className="bg-slate-900 border border-cyan-500/30 p-3 rounded-xl text-center">
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Depth (D)</span>
              <span className="text-base font-bold font-mono text-cyan-400">{result.geometry.D} mm</span>
            </div>
            <div className="bg-slate-900 border border-emerald-500/30 p-3 rounded-xl text-center">
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Rebar Weight</span>
              <span className="text-base font-bold font-mono text-emerald-400">{result.totalSteelWeightKg} kg</span>
            </div>
          </div>

          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-2">
            <h4 className="text-xs font-bold text-slate-300 uppercase">{result.typeLabel} — Structural Design Ratios</h4>
            <div className="grid grid-cols-4 gap-2 pt-2 text-center text-xs font-mono">
              <div className="p-2 bg-slate-950 rounded border border-slate-800">
                <span className="text-[9px] text-slate-400 block">Bearing/Pile DCR</span>
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
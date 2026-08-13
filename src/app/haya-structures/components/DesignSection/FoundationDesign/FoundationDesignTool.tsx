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
import { Foundation3DRenderer } from './Foundation3DRenderer';

export default function FoundationDesignTool() {
  const [code, setCode] = useState<DesignCode>('BS8110');
  const [category, setCategory] = useState<FoundationCategory>('shallow');
  const [shallowType, setShallowType] = useState<ShallowType>('isolated_pad');
  const [deepType, setDeepType] = useState<DeepType>('pile_cap');
  const [combinedSubType, setCombinedSubType] = useState<CombinedSubType>('strap');

  const [fc, setFc] = useState<number>(30);
  const [fy, setFy] = useState<number>(460);
  const [cover, setCover] = useState<number>(50);
  const [c1, setC1] = useState<number>(400);
  const [c2, setC2] = useState<number>(400);

  const [pDead, setPDead] = useState<number>(950);
  const [pLive, setPLive] = useState<number>(480);
  const [mDeadX, setMDeadX] = useState<number>(75);
  const [mLiveX, setMLiveX] = useState<number>(35);

  const [qAllow, setQAllow] = useState<number>(200);
  const [colSpacing, setColSpacing] = useState<number>(3500);

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
        <div className="lg:col-span-5 space-y-4 bg-slate-900 p-5 rounded-xl border border-slate-800">
          <div>
            <label className="block text-[10px] text-slate-400 uppercase font-bold mb-2">Category</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setCategory('shallow')}
                className={`py-2 rounded-lg text-xs font-bold border transition ${
                  category === 'shallow' ? 'bg-cyan-500 text-slate-950 border-cyan-400' : 'bg-slate-950 text-slate-400 border-slate-800'
                }`}
              >
                Shallow Foundations
              </button>
              <button
                onClick={() => setCategory('deep')}
                className={`py-2 rounded-lg text-xs font-bold border transition ${
                  category === 'deep' ? 'bg-cyan-500 text-slate-950 border-cyan-400' : 'bg-slate-950 text-slate-400 border-slate-800'
                }`}
              >
                Deep Foundations
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[10px] text-slate-400 uppercase font-bold mb-2">Type Selection</label>
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Allowable Soil q_allow (kPa)</label>
              <input
                type="number"
                value={qAllow}
                onChange={(e) => setQAllow(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Concrete f_cu/f'c (MPa)</label>
              <input
                type="number"
                value={fc}
                onChange={(e) => setFc(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs font-mono"
              />
            </div>
          </div>
        </div>

        {/* Right Output Panel & 3D WebGL Canvas */}
        <div className="lg:col-span-7 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-900 border border-cyan-500/30 p-3 rounded-xl text-center">
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Footing Dimension</span>
              <span className="text-base font-bold font-mono text-cyan-400">{result.geometry.B} x {result.geometry.L} mm</span>
            </div>
            <div className="bg-slate-900 border border-cyan-500/30 p-3 rounded-xl text-center">
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Overall Depth (D)</span>
              <span className="text-base font-bold font-mono text-cyan-400">{result.geometry.D} mm</span>
            </div>
            <div className="bg-slate-900 border border-emerald-500/30 p-3 rounded-xl text-center">
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Total Rebar Mass</span>
              <span className="text-base font-bold font-mono text-emerald-400">{result.totalSteelWeightKg} kg</span>
            </div>
          </div>

          {/* 3D WebGL Three.js Renderer Viewport */}
          <Foundation3DRenderer data={result.geometry3D} />

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
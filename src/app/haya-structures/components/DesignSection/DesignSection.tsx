'use client';

import React, { useState } from 'react';
import { DesignInput, DesignResult } from '@/lib/structural/foundation';
import { runFoundationAutoDesign } from '@/lib/structural/foundation/autoSizer';

export default function FoundationDesignTool() {
  const [inputs, setInputs] = useState<DesignInput>({
    code: 'ACI318',
    footingType: 'isolated_pad',
    pDead: 800,
    pLive: 450,
    mDead: 60,
    mLive: 40,
    qAllow: 200,
    fc: 28,
    fy: 420,
    gammaSoil: 18,
    embedmentDepth: 1500,
    cover: 75,
    c1: 400,
    c2: 400,
  });

  const [result, setResult] = useState<DesignResult>(() => runFoundationAutoDesign(inputs));

  const handleInputChange = (field: keyof DesignInput, value: number | string) => {
    const updated = { ...inputs, [field]: value };
    setInputs(updated);
    setResult(runFoundationAutoDesign(updated));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-950 p-6 rounded-2xl border border-slate-800 text-slate-100 font-sans">
      {/* Left Input Panel */}
      <div className="lg:col-span-5 space-y-4 bg-slate-900 p-5 rounded-xl border border-slate-800">
        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
          <h3 className="font-semibold text-slate-200 text-sm">Design Optimization Parameters</h3>
          <span className="text-xs font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
            AUTO-SIZING ACTIVE
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Dead Load P_Dead (kN)</label>
            <input
              type="number"
              value={inputs.pDead}
              onChange={(e) => handleInputChange('pDead', Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm font-mono text-slate-200"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Live Load P_Live (kN)</label>
            <input
              type="number"
              value={inputs.pLive}
              onChange={(e) => handleInputChange('pLive', Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm font-mono text-slate-200"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Soil Capacity q_allow (kPa)</label>
            <input
              type="number"
              value={inputs.qAllow}
              onChange={(e) => handleInputChange('qAllow', Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm font-mono text-slate-200"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Concrete f'c (MPa)</label>
            <input
              type="number"
              value={inputs.fc}
              onChange={(e) => handleInputChange('fc', Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm font-mono text-slate-200"
            />
          </div>
        </div>
      </div>

      {/* Right Output Panel & BBS */}
      <div className="lg:col-span-7 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-900 border border-cyan-500/30 p-4 rounded-xl text-center">
            <span className="text-[10px] text-slate-400 block uppercase">Optimized Plan (B x L)</span>
            <span className="text-lg font-bold font-mono text-cyan-400">
              {result.geometry.B} x {result.geometry.L} mm
            </span>
          </div>

          <div className="bg-slate-900 border border-cyan-500/30 p-4 rounded-xl text-center">
            <span className="text-[10px] text-slate-400 block uppercase">Min Thickness (D)</span>
            <span className="text-lg font-bold font-mono text-cyan-400">
              {result.geometry.D} mm
            </span>
          </div>

          <div className="bg-slate-900 border border-emerald-500/30 p-4 rounded-xl text-center">
            <span className="text-[10px] text-slate-400 block uppercase">Steel Weight</span>
            <span className="text-lg font-bold font-mono text-emerald-400">
              {result.totalSteelWeightKg} kg
            </span>
          </div>
        </div>

        {/* Bar Bending Schedule Table */}
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-3">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Automated Bar Bending Schedule (BBS)
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
                  <th className="py-2">Cut Len (m)</th>
                  <th className="py-2">Weight (kg)</th>
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
                    <td className="py-2">{item.cutLength}</td>
                    <td className="py-2 text-emerald-400 font-bold">{item.totalWeight}</td>
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
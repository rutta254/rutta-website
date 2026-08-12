'use client';

import { useState } from 'react';

export default function WallAnalysisTool() {
  const [wallType, setWallType] = useState<'retaining' | 'bearing' | 'shear'>('retaining');
  const [height, setHeight] = useState<number>(3.5);
  const [thickness, setThickness] = useState<number>(300);
  const [soilPhi, setSoilPhi] = useState<number>(30);
  const [gammaSoil, setGammaSoil] = useState<number>(18);
  const [surcharge, setSurcharge] = useState<number>(10);
  const [baseWidth, setBaseWidth] = useState<number>(2.2);
  const [axialLoad, setAxialLoad] = useState<number>(500);

  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          element_type: 'wall',
          wall_type: wallType,
          height: Number(height),
          thickness: Number(thickness),
          soil_phi: Number(soilPhi),
          gamma_soil: Number(gammaSoil),
          surcharge: Number(surcharge),
          base_width: Number(baseWidth),
          axial_load: Number(axialLoad),
        }),
      });
      const data = await res.json();
      setResult(data.data || data);
    } catch (err) {
      console.error(err);
      alert('Error analyzing wall.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-5 space-y-4 bg-slate-900 p-5 rounded-xl border border-slate-800">
        <h3 className="font-semibold text-slate-200 border-b border-slate-800 pb-2">Wall Analysis Parameters</h3>
        
        <div>
          <label className="block text-xs text-slate-400 mb-1">Wall Type</label>
          <select value={wallType} onChange={(e: any) => setWallType(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200">
            <option value="retaining">Cantilever Retaining Wall</option>
            <option value="bearing">RC Bearing Wall</option>
            <option value="shear">RC Shear Wall</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Height H (m)</label>
            <input type="number" step="0.1" value={height} onChange={(e) => setHeight(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Thickness t (mm)</label>
            <input type="number" value={thickness} onChange={(e) => setThickness(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200" />
          </div>
        </div>

        {wallType === 'retaining' ? (
          <>
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Base Width B (m)</label>
                <input type="number" step="0.1" value={baseWidth} onChange={(e) => setBaseWidth(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Friction Angle φ (°)</label>
                <input type="number" value={soilPhi} onChange={(e) => setSoilPhi(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Soil Unit Wt γ (kN/m³)</label>
                <input type="number" value={gammaSoil} onChange={(e) => setGammaSoil(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Surcharge q (kN/m²)</label>
                <input type="number" value={surcharge} onChange={(e) => setSurcharge(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200" />
              </div>
            </div>
          </>
        ) : (
          <div>
            <label className="block text-xs text-slate-400 mb-1">Axial Load Pu (kN)</label>
            <input type="number" value={axialLoad} onChange={(e) => setAxialLoad(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200" />
          </div>
        )}

        <button onClick={handleAnalyze} disabled={loading} className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold py-2.5 rounded transition disabled:opacity-50">
          {loading ? 'Analyzing...' : 'Run Wall Analysis'}
        </button>

        {result && (
          <div className="mt-4 pt-3 border-t border-slate-800 space-y-1 text-sm bg-slate-950 p-3 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-slate-400 uppercase">Status</span>
              <span className={`text-xs px-2 py-0.5 rounded font-bold ${result.verification?.status === 'SAFE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                {result.verification?.status}
              </span>
            </div>
            {wallType === 'retaining' ? (
              <>
                <p>Overturning FOS: <span className="text-cyan-400 font-mono">{result.safety_factors?.FOS_overturning}</span> (Min 1.5)</p>
                <p>Sliding FOS: <span className="text-cyan-400 font-mono">{result.safety_factors?.FOS_sliding}</span> (Min 1.5)</p>
              </>
            ) : (
              <p>Demand Capacity Ratio: <span className="text-cyan-400 font-mono">{result.verification?.dcr}</span></p>
            )}
          </div>
        )}
      </div>

      <div className="lg:col-span-7 bg-slate-900 p-5 rounded-xl border border-slate-800 flex justify-center items-center">
        <svg viewBox="0 0 240 220" className="w-full h-56 drop-shadow">
          <rect x="70" y="30" width="25" height="130" fill="#475569" stroke="#94a3b8" strokeWidth="1.5" />
          <rect x="30" y="160" width="130" height="25" fill="#334155" stroke="#94a3b8" strokeWidth="1.5" />
          <path d="M 95 60 L 190 160 H 95 Z" fill="#b45309" fillOpacity="0.25" stroke="#b45309" strokeDasharray="3 3" />
          <text x="135" y="120" fill="#f59e0b" fontSize="10" fontWeight="bold">Soil Backfill</text>
        </svg>
      </div>
    </div>
  );
}
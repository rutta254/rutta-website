'use client';

import { useState } from 'react';

export default function FoundationAnalysisTool() {
  const [bx, setBx] = useState<number>(2.0);
  const [ly, setLy] = useState<number>(2.0);
  const [thickness, setThickness] = useState<number>(500);
  const [pu, setPu] = useState<number>(1200);
  const [mx, setMx] = useState<number>(50);
  const [allowableQ, setAllowableQ] = useState<number>(200);

  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          element_type: 'foundation',
          length_x: Number(bx),
          width_y: Number(ly),
          thickness: Number(thickness),
          pu: Number(pu),
          mx: Number(mx),
          allowable_q: Number(allowableQ),
        }),
      });
      const data = await res.json();
      setResult(data.data || data);
    } catch (err) {
      console.error(err);
      alert('Error analyzing foundation.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-5 space-y-4 bg-slate-900 p-5 rounded-xl border border-slate-800">
        <h3 className="font-semibold text-slate-200 border-b border-slate-800 pb-2">Shallow Pad Footing</h3>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Footing Length Bx (m)</label>
            <input type="number" step="0.1" value={bx} onChange={(e) => setBx(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Footing Width Ly (m)</label>
            <input type="number" step="0.1" value={ly} onChange={(e) => setLy(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Thickness H (mm)</label>
            <input type="number" value={thickness} onChange={(e) => setThickness(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Allowable q (kPa)</label>
            <input type="number" value={allowableQ} onChange={(e) => setAllowableQ(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Axial Load Pu (kN)</label>
            <input type="number" value={pu} onChange={(e) => setPu(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Moment Mx (kNm)</label>
            <input type="number" value={mx} onChange={(e) => setMx(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200" />
          </div>
        </div>

        <button onClick={handleAnalyze} disabled={loading} className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold py-2.5 rounded transition disabled:opacity-50">
          {loading ? 'Analyzing Foundation...' : 'Run Footing Analysis'}
        </button>

        {result && (
          <div className="mt-4 pt-3 border-t border-slate-800 space-y-1 text-sm bg-slate-950 p-3 rounded-lg">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold text-slate-400 uppercase">Verification</span>
              <span className={`text-xs px-2 py-0.5 rounded font-bold ${result.verification?.status === 'SAFE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                {result.verification?.status}
              </span>
            </div>
            <p>Max Soil Pressure (q_max): <span className="text-cyan-400 font-mono">{result.geotechnical?.q_max} kPa</span></p>
            <p>Bearing Capacity DCR: <span className="text-cyan-400 font-mono">{result.geotechnical?.bearing_dcr}</span></p>
            <p>Punching Shear DCR: <span className="text-cyan-400 font-mono">{result.structural?.punching_dcr}</span></p>
          </div>
        )}
      </div>

      <div className="lg:col-span-7 bg-slate-900 p-5 rounded-xl border border-slate-800 flex justify-center items-center">
        <svg viewBox="0 0 240 180" className="w-full h-48 drop-shadow">
          <rect x="20" y="110" width="200" height="40" fill="#334155" stroke="#94a3b8" strokeWidth="2" rx="2" />
          <rect x="100" y="30" width="40" height="80" fill="#475569" stroke="#94a3b8" strokeWidth="2" />
          <line x1="120" y1="10" x2="120" y2="28" stroke="#ef4444" strokeWidth="2.5" />
          <polygon points="120,30 115,20 125,20" fill="#ef4444" />
        </svg>
      </div>
    </div>
  );
}
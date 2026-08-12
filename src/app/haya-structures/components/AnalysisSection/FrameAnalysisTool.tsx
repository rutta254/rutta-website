'use client';

import { useState } from 'react';

export default function FrameAnalysisTool() {
  const [span, setSpan] = useState<number>(12);
  const [height, setHeight] = useState<number>(5);
  const [roofW, setRoofW] = useState<number>(15);
  const [windH, setWindH] = useState<number>(8);

  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          element_type: 'frame',
          span: Number(span),
          height: Number(height),
          roof_w: Number(roofW),
          wind_h: Number(windH),
        }),
      });
      const data = await res.json();
      setResult(data.data || data);
    } catch (err) {
      console.error(err);
      alert('Error analyzing portal frame.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-5 space-y-4 bg-slate-900 p-5 rounded-xl border border-slate-800">
        <h3 className="font-semibold text-slate-200 border-b border-slate-800 pb-2">Single-Bay Portal Frame</h3>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Frame Span L (m)</label>
            <input type="number" value={span} onChange={(e) => setSpan(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Column Height H (m)</label>
            <input type="number" value={height} onChange={(e) => setHeight(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Roof Load w (kN/m)</label>
            <input type="number" value={roofW} onChange={(e) => setRoofW(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Wind Load H_wind (kN)</label>
            <input type="number" value={windH} onChange={(e) => setWindH(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200" />
          </div>
        </div>

        <button onClick={handleAnalyze} disabled={loading} className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold py-2.5 rounded transition disabled:opacity-50">
          {loading ? 'Solving Frame...' : 'Run Frame Analysis'}
        </button>

        {result && (
          <div className="mt-4 pt-3 border-t border-slate-800 space-y-1 text-sm bg-slate-950 p-3 rounded-lg">
            <p>Corner Moment (M_corner): <span className="text-cyan-400 font-mono">{result.internal_forces?.M_corner} kNm</span></p>
            <p>Mid-span Moment (M_span): <span className="text-cyan-400 font-mono">{result.internal_forces?.M_span} kNm</span></p>
            <p>Max Column Axial: <span className="text-emerald-400 font-mono">{result.internal_forces?.max_axial_col} kN</span></p>
          </div>
        )}
      </div>

      <div className="lg:col-span-7 bg-slate-900 p-5 rounded-xl border border-slate-800 flex justify-center items-center">
        <svg viewBox="0 0 240 180" className="w-full h-48 drop-shadow">
          <path d="M 40 150 V 60 L 120 40 L 200 60 V 150" fill="none" stroke="#38bdf8" strokeWidth="3" />
          <line x1="20" y1="150" x2="60" y2="150" stroke="#94a3b8" strokeWidth="2" />
          <line x1="180" y1="150" x2="220" y2="150" stroke="#94a3b8" strokeWidth="2" />
        </svg>
      </div>
    </div>
  );
}
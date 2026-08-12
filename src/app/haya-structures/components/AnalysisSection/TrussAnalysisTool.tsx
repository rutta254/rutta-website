'use client';

import { useState } from 'react';

export default function TrussAnalysisTool() {
  const [trussType, setTrussType] = useState<'pratt' | 'howe' | 'warren'>('pratt');
  const [span, setSpan] = useState<number>(12);
  const [height, setHeight] = useState<number>(2.5);
  const [panels, setPanels] = useState<number>(6);
  const [nodeLoad, setNodeLoad] = useState<number>(20);

  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          element_type: 'truss',
          truss_type: trussType,
          span: Number(span),
          height: Number(height),
          panels: Number(panels),
          node_load: Number(nodeLoad),
        }),
      });
      const data = await res.json();
      setResult(data.data || data);
    } catch (err) {
      console.error(err);
      alert('Error analyzing truss.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-5 space-y-4 bg-slate-900 p-5 rounded-xl border border-slate-800">
        <h3 className="font-semibold text-slate-200 border-b border-slate-800 pb-2">2D Truss Parameters</h3>
        
        <div>
          <label className="block text-xs text-slate-400 mb-1">Configuration</label>
          <select value={trussType} onChange={(e: any) => setTrussType(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200">
            <option value="pratt">Pratt Truss</option>
            <option value="howe">Howe Truss</option>
            <option value="warren">Warren Truss</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Span L (m)</label>
            <input type="number" value={span} onChange={(e) => setSpan(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Height H (m)</label>
            <input type="number" step="0.1" value={height} onChange={(e) => setHeight(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Panels Count</label>
            <input type="number" value={panels} onChange={(e) => setPanels(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Joint Load P (kN)</label>
            <input type="number" value={nodeLoad} onChange={(e) => setNodeLoad(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200" />
          </div>
        </div>

        <button onClick={handleAnalyze} disabled={loading} className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold py-2.5 rounded transition disabled:opacity-50">
          {loading ? 'Solving Truss...' : 'Run Truss Analysis'}
        </button>

        {result && (
          <div className="mt-4 pt-3 border-t border-slate-800 space-y-1 text-sm bg-slate-950 p-3 rounded-lg">
            <p>Reactions R_A = R_B: <span className="text-cyan-400 font-mono">{result.reactions?.R_A} kN</span></p>
            <p>Max Compression (Top Chord): <span className="text-red-400 font-mono">{result.member_forces?.max_top_chord_compression} kN</span></p>
            <p>Max Tension (Bottom Chord): <span className="text-emerald-400 font-mono">{result.member_forces?.max_bot_chord_tension} kN</span></p>
            <p>Overall DCR: <span className="text-cyan-400 font-mono">{result.verification?.overall_dcr}</span></p>
          </div>
        )}
      </div>

      <div className="lg:col-span-7 bg-slate-900 p-5 rounded-xl border border-slate-800 flex justify-center items-center">
        <svg viewBox="0 0 300 120" className="w-full h-48 drop-shadow">
          <polygon points="20,100 150,30 280,100" fill="none" stroke="#38bdf8" strokeWidth="2" />
          <line x1="20" y1="100" x2="280" y2="100" stroke="#38bdf8" strokeWidth="2" />
          <line x1="150" y1="30" x2="150" y2="100" stroke="#0284c7" strokeWidth="1.5" />
          <line x1="85" y1="65" x2="85" y2="100" stroke="#0284c7" strokeWidth="1.5" />
          <line x1="215" y1="65" x2="215" y2="100" stroke="#0284c7" strokeWidth="1.5" />
        </svg>
      </div>
    </div>
  );
}
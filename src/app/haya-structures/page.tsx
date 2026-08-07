'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function HayaStructures() {
  const [length, setLength] = useState<number>(6);
  const [load, setLoad] = useState<number>(10);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      // Send both simple keys and point_load structure for backend compatibility
      const payload = {
        length: Number(length),
        span: Number(length),
        load: Number(load),
        point_loads: [
          {
            magnitude: Number(load),
            position: Number(length) / 2, // Default load position at mid-span
          },
        ],
      };

      const res = await fetch('https://beam-analysis-cloud-api.onrender.com/api/v1/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }

      const data = await res.json();
      console.log('API Response:', data);

      setResult(data.data || data);
    } catch (err) {
      console.error(err);
      alert('Error connecting to backend API. Please check your Render service status.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8 font-sans">
      <Link href="/" className="text-cyan-400 text-sm mb-6 inline-block hover:underline">
        ← Back to Rutta.com Home
      </Link>
      
      <h1 className="text-3xl font-bold text-cyan-400 mb-2">Haya Structures LLC</h1>
      <p className="text-slate-400 mb-8">Live Cloud-Native Structural Beam Calculator</p>

      <div className="max-w-xl bg-slate-800 p-6 rounded-xl border border-slate-700">
        <div className="mb-4">
          <label className="block text-sm mb-2 text-slate-300">Beam Length / Span (meters):</label>
          <input
            type="number"
            value={length}
            onChange={(e) => setLength(Number(e.target.value))}
            className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white focus:outline-none focus:border-cyan-400"
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm mb-2 text-slate-300">Mid-span Point Load (kN):</label>
          <input
            type="number"
            value={load}
            onChange={(e) => setLoad(Number(e.target.value))}
            className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white focus:outline-none focus:border-cyan-400"
          />
        </div>

        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-900 font-bold py-2.5 rounded transition disabled:opacity-50"
        >
          {loading ? 'Analyzing on Cloud...' : 'Run Analysis via Cloud API'}
        </button>

        {result && (
          <div className="mt-6 p-4 bg-slate-900 rounded border border-cyan-500/40 text-sm space-y-3">
            <h4 className="font-bold text-cyan-400 text-base border-b border-slate-800 pb-2">Analysis Results</h4>
            
            <div className="grid grid-cols-2 gap-2 text-slate-300">
              <p><strong>Span:</strong> {result.span ?? length} m</p>
              <p><strong>Beam Type:</strong> Simply Supported</p>
              <p><strong>Max Shear Force:</strong> <span className="text-cyan-300 font-mono">{result.critical_values?.max_shear_force ?? 0} kN</span></p>
              <p><strong>Max Bending Moment:</strong> <span className="text-cyan-300 font-mono">{result.critical_values?.max_bending_moment ?? 0} kN·m</span></p>
              <p><strong>Reaction R<sub>A</sub>:</strong> <span className="text-cyan-300 font-mono">{result.reactions?.R_A ?? 0} kN</span></p>
              <p><strong>Reaction R<sub>B</sub>:</strong> <span className="text-cyan-300 font-mono">{result.reactions?.R_B ?? 0} kN</span></p>
            </div>

            <details className="mt-4 text-xs text-slate-400 border-t border-slate-800 pt-3">
              <summary className="cursor-pointer text-cyan-400 hover:underline">View Raw JSON Response</summary>
              <pre className="mt-2 p-2 bg-slate-950 rounded overflow-x-auto text-green-400 font-mono text-[11px]">
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
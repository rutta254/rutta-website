'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';

export default function HayaStructures() {
  const [length, setLength] = useState<number>(6);
  const [load, setLoad] = useState<number>(10);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const payload = {
        length: Number(length),
        span: Number(length),
        load: Number(load),
        point_loads: [
          {
            magnitude: Number(load),
            position: Number(length) / 2,
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

  // Map backend array coordinates (x_coords, shear_force, bending_moment, deflection_mm) into Chart objects
  const chartData =
    result?.x_coords?.map((x: number, i: number) => ({
      x: Number(x.toFixed(2)),
      Shear: Number((result.shear_force?.[i] ?? 0).toFixed(2)),
      Moment: Number((result.bending_moment?.[i] ?? 0).toFixed(2)),
      Deflection: Number((result.deflection_mm?.[i] ?? 0).toFixed(3)),
    })) || [];

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 md:p-8 font-sans">
      <Link href="/" className="text-cyan-400 text-sm mb-6 inline-block hover:underline">
        ← Back to Rutta.com Home
      </Link>

      <h1 className="text-3xl font-bold text-cyan-400 mb-1">Haya Structures LLC</h1>
      <p className="text-slate-400 mb-8">Live Cloud-Native Structural Beam Analysis & Diagrams</p>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Input & Key Results Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
            <h2 className="text-lg font-semibold text-slate-200 mb-4">Beam Parameters</h2>
            
            <div className="mb-4">
              <label className="block text-sm mb-2 text-slate-300">Beam Length / Span (m):</label>
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
          </div>

          {result && (
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-3 text-sm text-slate-300">
              <h3 className="font-bold text-cyan-400 text-base border-b border-slate-700 pb-2">
                Statics Summary
              </h3>
              <p><strong>Span:</strong> {result.span ?? length} m</p>
              <p><strong>Max Shear Force:</strong> <span className="text-cyan-300 font-mono">{result.critical_values?.max_shear_force ?? 0} kN</span></p>
              <p><strong>Max Bending Moment:</strong> <span className="text-cyan-300 font-mono">{result.critical_values?.max_bending_moment ?? 0} kN·m</span></p>
              <p><strong>Support R<sub>A</sub>:</strong> <span className="text-cyan-300 font-mono">{result.reactions?.R_A ?? 0} kN</span></p>
              <p><strong>Support R<sub>B</sub>:</strong> <span className="text-cyan-300 font-mono">{result.reactions?.R_B ?? 0} kN</span></p>
            </div>
          )}
        </div>

        {/* Diagrams Display Area */}
        <div className="lg:col-span-8 space-y-6">
          {chartData.length > 0 ? (
            <>
              {/* Shear Force Diagram */}
              <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                <h3 className="text-md font-bold text-cyan-400 mb-4">Shear Force Diagram (SFD) - [kN]</h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="x" unit="m" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
                      <ReferenceLine y={0} stroke="#64748b" />
                      <Line type="monotone" dataKey="Shear" stroke="#38bdf8" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Bending Moment Diagram */}
              <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                <h3 className="text-md font-bold text-emerald-400 mb-4">Bending Moment Diagram (BMD) - [kN·m]</h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="x" unit="m" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
                      <ReferenceLine y={0} stroke="#64748b" />
                      <Line type="monotone" dataKey="Moment" stroke="#34d399" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-slate-800/50 p-12 rounded-xl border border-dashed border-slate-700 text-center text-slate-500">
              Run the analysis to render live Shear Force and Bending Moment diagrams.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
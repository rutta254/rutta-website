'use client';

import { useState } from 'react';
import Link from 'next/link';

type ElementType = 'beam' | 'column' | 'truss_2d';

export default function StructuralAnalysisTool() {
  const [elementType, setElementType] = useState<ElementType>('beam');
  
  // Shared Parameters
  const [length, setLength] = useState<number>(6);
  const [load, setLoad] = useState<number>(10);
  
  // Beam Specifics
  const [support, setSupport] = useState<'simply_supported' | 'cantilever' | 'fixed_fixed'>('simply_supported');
  
  // Column Specifics
  const [axialLoad, setAxialLoad] = useState<number>(150); // kN
  const [boundary, setBoundary] = useState<'pinned_pinned' | 'fixed_free' | 'fixed_fixed'>('pinned_pinned');

  // Results & Loading
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const handleAnalyze = async () => {
    setLoading(true);
    setResult(null);

    // Build context-specific payload based on selected element
    let payload: any = { element_type: elementType };

    if (elementType === 'beam') {
      payload = {
        ...payload,
        span: Number(length),
        support,
        loads: [{ type: 'point', magnitude: Number(load), position: Number(length) / 2 }],
      };
    } else if (elementType === 'column') {
      payload = {
        ...payload,
        length: Number(length),
        axial_load: Number(axialLoad),
        boundary,
      };
    } else if (elementType === 'truss_2d') {
      payload = {
        ...payload,
        span: Number(length),
        load: Number(load),
      };
    }

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`Server status ${res.status}`);
      const data = await res.json();
      setResult(data.data || data);
    } catch (err) {
      console.error(err);
      alert('Error connecting to backend API.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 font-sans">
      <h1 className="text-3xl font-bold text-cyan-400 mb-2">Haya Structures Analysis Suite</h1>
      <p className="text-slate-400 mb-6">Multi-Element Structural Calculation Engine</p>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar Controls */}
        <div className="lg:col-span-4 bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-2">Select Structural Element:</label>
            <select
              value={elementType}
              onChange={(e) => setElementType(e.target.value as ElementType)}
              className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-cyan-400 font-semibold focus:outline-none"
            >
              <option value="beam">Flexural Beam (SFD / BMD / Deflection)</option>
              <option value="column">Axial Column (Euler Buckling & Stress)</option>
              <option value="truss_2d">2D Truss (Method of Joints / Axial Force)</option>
            </select>
          </div>

          <hr className="border-slate-700" />

          {/* Dynamic Form Inputs based on Element */}
          {elementType === 'beam' && (
            <>
              <div>
                <label className="block text-sm text-slate-300">Beam Span (m):</label>
                <input
                  type="number"
                  value={length}
                  onChange={(e) => setLength(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300">Support Condition:</label>
                <select
                  value={support}
                  onChange={(e) => setSupport(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
                >
                  <option value="simply_supported">Simply Supported</option>
                  <option value="cantilever">Cantilever</option>
                  <option value="fixed_fixed">Fixed-Fixed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-300">Mid-Span Point Load (kN):</label>
                <input
                  type="number"
                  value={load}
                  onChange={(e) => setLoad(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
                />
              </div>
            </>
          )}

          {elementType === 'column' && (
            <>
              <div>
                <label className="block text-sm text-slate-300">Column Height / Length (m):</label>
                <input
                  type="number"
                  value={length}
                  onChange={(e) => setLength(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300">Boundary End Conditions:</label>
                <select
                  value={boundary}
                  onChange={(e) => setBoundary(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
                >
                  <option value="pinned_pinned">Pinned-Pinned (K = 1.0)</option>
                  <option value="fixed_free">Fixed-Free (K = 2.0)</option>
                  <option value="fixed_fixed">Fixed-Fixed (K = 0.5)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-300">Axial Load P (kN):</label>
                <input
                  type="number"
                  value={axialLoad}
                  onChange={(e) => setAxialLoad(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
                />
              </div>
            </>
          )}

          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold py-2.5 rounded transition"
          >
            {loading ? 'Analyzing...' : `Analyze ${elementType.toUpperCase()}`}
          </button>
        </div>

        {/* Dynamic Display Area */}
        <div className="lg:col-span-8 bg-slate-800 p-6 rounded-xl border border-slate-700">
          <h2 className="text-lg font-bold text-cyan-400 mb-4">Structural Results</h2>

          {!result ? (
            <p className="text-slate-500 text-center py-12">Select element type and click Analyze to generate results.</p>
          ) : (
            <div className="space-y-4 text-sm">
              {elementType === 'column' && (
                <div className="space-y-2">
                  <p><strong>Effective Length (Le):</strong> {result.effective_length} m</p>
                  <p><strong>Euler Critical Buckling Load ($P_{cr}$):</strong> <span className="text-emerald-400 font-mono font-bold">{result.critical_buckling_load_kn} kN</span></p>
                  <p><strong>Applied Load ($P_{apply}$):</strong> {result.applied_load_kn} kN</p>
                  <p><strong>Status:</strong> {result.is_safe ? <span className="text-emerald-400 font-bold">PASS (No Buckling)</span> : <span className="text-rose-500 font-bold">FAIL (Buckling Risk!)</span>}</p>
                </div>
              )}

              {elementType === 'beam' && (
                <div>
                  <p><strong>Max Shear Force:</strong> {result.critical_values?.max_shear_force} kN</p>
                  <p><strong>Max Bending Moment:</strong> {result.critical_values?.max_bending_moment} kN·m</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
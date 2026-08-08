'type client';
'use client';

import { useState } from 'react';

type ElementType = 'beam' | 'column' | 'truss_2d';
type BeamSupport = 'simply_supported' | 'cantilever' | 'fixed_fixed';
type ColumnBoundary = 'pinned_pinned' | 'fixed_free' | 'fixed_fixed';

interface PlotPoint {
  x: number;
  moment: number;
}

interface StructuralResult {
  effective_length?: number;
  critical_buckling_load_kn?: number;
  applied_load_kn?: number;
  is_safe?: boolean;
  // Support both nested and flattened structures
  critical_values?: {
    max_shear_force?: number;
    max_bending_moment?: number;
  };
  max_shear_force?: number;
  max_bending_moment?: number;
  reactions?: Record<string, number>;
  plot_points?: PlotPoint[];
  status?: string;
  message?: string;
}

export default function StructuralAnalysisTool() {
  const [elementType, setElementType] = useState<ElementType>('beam');
  const [length, setLength] = useState<number>(6);
  const [load, setLoad] = useState<number>(10);
  const [support, setSupport] = useState<BeamSupport>('simply_supported');
  const [axialLoad, setAxialLoad] = useState<number>(150);
  const [boundary, setBoundary] = useState<ColumnBoundary>('pinned_pinned');
  const [trussNodes, setTrussNodes] = useState<number>(3);
  const [trussMembers, setTrussMembers] = useState<number>(3);

  const [result, setResult] = useState<StructuralResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [downloadingPdf, setDownloadingPdf] = useState<boolean>(false);

  const handleAnalyze = async () => {
    setLoading(true);
    setResult(null);

    let payload: Record<string, unknown> = { element_type: elementType };

    if (elementType === 'beam') {
      payload = {
        ...payload,
        span: Number(length),
        support,
        load: Number(load),
      };
    } else if (elementType === 'column') {
      payload = {
        ...payload,
        length: Number(length),
        load: Number(axialLoad),
        boundary,
      };
    } else if (elementType === 'truss_2d') {
      payload = {
        ...payload,
        nodes_count: Number(trussNodes),
        members_count: Number(trussMembers),
        load: Number(load),
      };
    }

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`Server returned status ${res.status}`);
      const jsonResponse = await res.json();
      
      // Safely extract data whether nested under 'data' or returned directly
      const actualData = jsonResponse.data !== undefined ? jsonResponse.data : jsonResponse;
      setResult(actualData);
    } catch (err) {
      console.error(err);
      alert('Error connecting to backend API.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      let payload: Record<string, unknown> = {
        element_type: elementType,
        span: Number(length),
        length: Number(length),
        load: elementType === 'column' ? Number(axialLoad) : Number(load),
        support,
        boundary,
        action: 'pdf',
      };

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('PDF download failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'rutta_structural_report.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error(err);
      alert('Could not download PDF report.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Helper values to prevent N/A bugs
  const shearVal = result?.critical_values?.max_shear_force ?? result?.max_shear_force;
  const momentVal = result?.critical_values?.max_bending_moment ?? result?.max_bending_moment;

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

          {elementType === 'beam' && (
            <>
              <div>
                <label className="block text-sm text-slate-300">Beam Span (m):</label>
                <input
                  type="number"
                  value={length}
                  onChange={(e) => setLength(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white mt-1"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300">Support Condition:</label>
                <select
                  value={support}
                  onChange={(e) => setSupport(e.target.value as BeamSupport)}
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white mt-1"
                >
                  <option value="simply_supported">Simply Supported</option>
                  <option value="cantilever">Cantilever</option>
                  <option value="fixed_fixed">Fixed-Fixed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-300">Uniform/Point Load (kN/m or kN):</label>
                <input
                  type="number"
                  value={load}
                  onChange={(e) => setLoad(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white mt-1"
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
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white mt-1"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300">Boundary End Conditions:</label>
                <select
                  value={boundary}
                  onChange={(e) => setBoundary(e.target.value as ColumnBoundary)}
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white mt-1"
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
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white mt-1"
                />
              </div>
            </>
          )}

          {elementType === 'truss_2d' && (
            <>
              <div>
                <label className="block text-sm text-slate-300">Number of Joints/Nodes:</label>
                <input
                  type="number"
                  value={trussNodes}
                  onChange={(e) => setTrussNodes(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white mt-1"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300">Number of Members:</label>
                <input
                  type="number"
                  value={trussMembers}
                  onChange={(e) => setTrussMembers(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white mt-1"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300">Joint Nodal Load (kN):</label>
                <input
                  type="number"
                  value={load}
                  onChange={(e) => setLoad(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white mt-1"
                />
              </div>
            </>
          )}

          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold py-2.5 rounded transition disabled:opacity-50"
          >
            {loading ? 'Analyzing...' : `Analyze ${elementType.toUpperCase()}`}
          </button>
        </div>

        {/* Dynamic Display Area */}
        <div className="lg:col-span-8 bg-slate-800 p-6 rounded-xl border border-slate-700 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-cyan-400 mb-4">Structural Results</h2>

            {!result ? (
              <p className="text-slate-500 text-center py-12">Select element type and click Analyze to generate results.</p>
            ) : (
              <div className="space-y-4 text-sm">
                {elementType === 'column' && (
                  <div className="space-y-2">
                    <p><strong>Effective Length (Le):</strong> {result.effective_length ?? 'N/A'} m</p>
                    <p>
                      <strong>Euler Critical Buckling Load (P_cr):</strong>{' '}
                      <span className="text-emerald-400 font-mono font-bold">
                        {result.critical_buckling_load_kn ?? 'N/A'} kN
                      </span>
                    </p>
                    <p><strong>Applied Load (P_apply):</strong> {result.applied_load_kn ?? axialLoad} kN</p>
                    <p>
                      <strong>Status:</strong>{' '}
                      {result.is_safe ? (
                        <span className="text-emerald-400 font-bold">PASS (No Buckling)</span>
                      ) : (
                        <span className="text-rose-500 font-bold">FAIL (Buckling Risk!)</span>
                      )}
                    </p>
                  </div>
                )}

                {elementType === 'beam' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 bg-slate-900 p-4 rounded border border-slate-700">
                      <div>
                        <p className="text-slate-400 text-xs">Max Shear Force</p>
                        <p className="text-xl font-bold text-cyan-400">
                          {shearVal !== undefined ? `${shearVal} kN` : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-xs">Max Bending Moment</p>
                        <p className="text-xl font-bold text-emerald-400">
                          {momentVal !== undefined ? `${momentVal} kN·m` : 'N/A'}
                        </p>
                      </div>
                    </div>

                    {result.reactions && (
                      <p>
                        <strong>Reactions:</strong> R_A = {result.reactions.R_A ?? 0} kN, R_B = {result.reactions.R_B ?? 0} kN
                      </p>
                    )}

                    {result.plot_points && result.plot_points.length > 0 && (
                      <div className="mt-4">
                        <p className="text-xs text-slate-400 mb-2">Bending Moment Distribution Profile (X vs M):</p>
                        <div className="bg-slate-900 p-3 rounded border border-slate-700 h-36 flex items-end gap-1 overflow-x-auto">
                          {result.plot_points.map((pt, idx) => {
                            const maxM = Math.max(...result.plot_points!.map(p => Math.abs(p.moment)), 1);
                            const heightPct = Math.max(Math.round((Math.abs(pt.moment) / maxM) * 100), 5);
                            return (
                              <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                                <div 
                                  className="w-full bg-cyan-500 hover:bg-cyan-400 rounded-t transition-all"
                                  style={{ height: `${heightPct}%` }}
                                />
                                <span className="text-[9px] text-slate-400 mt-1">{pt.x}m</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {elementType === 'truss_2d' && (
                  <div className="space-y-2">
                    <p><strong>Status:</strong> {result.status || 'Analysis complete'}</p>
                    {result.message && <p>{result.message}</p>}
                  </div>
                )}
              </div>
            )}
          </div>

          {result && (
            <div className="mt-6 pt-4 border-t border-slate-700 flex justify-between items-center">
              <span className="text-xs text-slate-400">Calculation engine synced</span>
              <button
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
                className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-4 py-2 rounded text-xs transition disabled:opacity-50"
              >
                {downloadingPdf ? 'Generating PDF...' : 'Download PDF Report'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
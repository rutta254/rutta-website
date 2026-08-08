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
    <div className="min-h-screen bg-black text-white p-6 font-sans">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-extrabold text-white mb-2 font-['Plus_Jakarta_Sans']">
          Haya Structures Analysis Suite
        </h1>
        <p className="text-neutral-400 mb-8">Multi-Element Structural Calculation Engine</p>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Sidebar Controls */}
          <div className="lg:col-span-4 bg-neutral-950 p-6 rounded-3xl border border-neutral-800 space-y-6 shadow-2xl">
            <div>
              <label className="block text-sm font-semibold text-neutral-300 mb-2">Select Structural Element:</label>
              <select
                value={elementType}
                onChange={(e) => setElementType(e.target.value as ElementType)}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-white font-medium focus:outline-none focus:border-neutral-500"
              >
                <option value="beam">Flexural Beam (SFD / BMD / Deflection)</option>
                <option value="column">Axial Column (Euler Buckling & Stress)</option>
                <option value="truss_2d">2D Truss (Method of Joints / Axial Force)</option>
              </select>
            </div>

            <hr className="border-neutral-800" />

            {elementType === 'beam' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">Beam Span (m):</label>
                  <input
                    type="number"
                    value={length}
                    onChange={(e) => setLength(Number(e.target.value))}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-white focus:outline-none focus:border-neutral-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">Support Condition:</label>
                  <select
                    value={support}
                    onChange={(e) => setSupport(e.target.value as BeamSupport)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-white focus:outline-none focus:border-neutral-500"
                  >
                    <option value="simply_supported">Simply Supported</option>
                    <option value="cantilever">Cantilever</option>
                    <option value="fixed_fixed">Fixed-Fixed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">Uniform/Point Load (kN/m or kN):</label>
                  <input
                    type="number"
                    value={load}
                    onChange={(e) => setLoad(Number(e.target.value))}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-white focus:outline-none focus:border-neutral-500"
                  />
                </div>
              </div>
            )}

            {elementType === 'column' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">Column Height / Length (m):</label>
                  <input
                    type="number"
                    value={length}
                    onChange={(e) => setLength(Number(e.target.value))}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-white focus:outline-none focus:border-neutral-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">Boundary End Conditions:</label>
                  <select
                    value={boundary}
                    onChange={(e) => setBoundary(e.target.value as ColumnBoundary)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-white focus:outline-none focus:border-neutral-500"
                  >
                    <option value="pinned_pinned">Pinned-Pinned (K = 1.0)</option>
                    <option value="fixed_free">Fixed-Free (K = 2.0)</option>
                    <option value="fixed_fixed">Fixed-Fixed (K = 0.5)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">Axial Load P (kN):</label>
                  <input
                    type="number"
                    value={axialLoad}
                    onChange={(e) => setAxialLoad(Number(e.target.value))}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-white focus:outline-none focus:border-neutral-500"
                  />
                </div>
              </div>
            )}

            {elementType === 'truss_2d' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">Number of Joints/Nodes:</label>
                  <input
                    type="number"
                    value={trussNodes}
                    onChange={(e) => setTrussNodes(Number(e.target.value))}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-white focus:outline-none focus:border-neutral-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">Number of Members:</label>
                  <input
                    type="number"
                    value={trussMembers}
                    onChange={(e) => setTrussMembers(Number(e.target.value))}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-white focus:outline-none focus:border-neutral-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">Joint Nodal Load (kN):</label>
                  <input
                    type="number"
                    value={load}
                    onChange={(e) => setLoad(Number(e.target.value))}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-white focus:outline-none focus:border-neutral-500"
                  />
                </div>
              </div>
            )}

            <button
              onClick={handleAnalyze}
              disabled={loading}
              className="w-full bg-white hover:bg-neutral-200 text-black font-bold py-3.5 rounded-xl transition disabled:opacity-50 shadow-md"
            >
              {loading ? 'Analyzing...' : `Analyze ${elementType.toUpperCase()}`}
            </button>
          </div>

          {/* Dynamic Display Area */}
          <div className="lg:col-span-8 bg-neutral-950 p-8 rounded-3xl border border-neutral-800 flex flex-col justify-between shadow-2xl">
            <div>
              <h2 className="text-xl font-bold text-white mb-6">Structural Results</h2>

              {!result ? (
                <div className="text-center py-24 border border-dashed border-neutral-800 rounded-2xl">
                  <p className="text-neutral-500">Select element parameters and click Analyze to generate results.</p>
                </div>
              ) : (
                <div className="space-y-6 text-sm">
                  {elementType === 'column' && (
                    <div className="space-y-3 bg-neutral-900/60 p-6 rounded-2xl border border-neutral-800">
                      <p className="flex justify-between">
                        <span className="text-neutral-400">Effective Length (Le):</span> 
                        <span className="font-semibold">{result.effective_length ?? 'N/A'} m</span>
                      </p>
                      <p className="flex justify-between">
                        <span className="text-neutral-400">Euler Critical Buckling Load (P_cr):</span>
                        <span className="text-white font-mono font-bold">
                          {result.critical_buckling_load_kn ?? 'N/A'} kN
                        </span>
                      </p>
                      <p className="flex justify-between">
                        <span className="text-neutral-400">Applied Load (P_apply):</span> 
                        <span className="font-semibold">{result.applied_load_kn ?? axialLoad} kN</span>
                      </p>
                      <div className="pt-2 border-t border-neutral-800 flex justify-between items-center">
                        <span className="text-neutral-400">Status:</span>
                        {result.is_safe ? (
                          <span className="px-3 py-1 bg-white text-black font-bold rounded-lg text-xs">PASS (No Buckling)</span>
                        ) : (
                          <span className="px-3 py-1 bg-neutral-800 text-rose-400 font-bold rounded-lg text-xs border border-rose-500/30">FAIL (Buckling Risk!)</span>
                        )}
                      </div>
                    </div>
                  )}

                  {elementType === 'beam' && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4 bg-neutral-900/60 p-6 rounded-2xl border border-neutral-800">
                        <div>
                          <p className="text-neutral-400 text-xs mb-1">Max Shear Force</p>
                          <p className="text-2xl font-black text-white">
                            {shearVal !== undefined ? `${shearVal} kN` : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-neutral-400 text-xs mb-1">Max Bending Moment</p>
                          <p className="text-2xl font-black text-white">
                            {momentVal !== undefined ? `${momentVal} kN·m` : 'N/A'}
                          </p>
                        </div>
                      </div>

                      {result.reactions && (
                        <div className="bg-neutral-900/60 p-4 rounded-2xl border border-neutral-800">
                          <p className="text-neutral-300 font-medium">
                            Reactions: <span className="font-mono text-neutral-400">R_A = {result.reactions.R_A ?? 0} kN, R_B = {result.reactions.R_B ?? 0} kN</span>
                          </p>
                        </div>
                      )}

                      {result.plot_points && result.plot_points.length > 0 && (
                        <div className="bg-neutral-900/60 p-6 rounded-2xl border border-neutral-800">
                          <p className="text-xs text-neutral-400 mb-4 font-semibold uppercase tracking-wider">Bending Moment Distribution Profile (X vs M):</p>
                          <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 h-44 flex items-end gap-1.5 overflow-x-auto">
                            {result.plot_points.map((pt, idx) => {
                              const maxM = Math.max(...result.plot_points!.map(p => Math.abs(p.moment)), 1);
                              const heightPct = Math.max(Math.round((Math.abs(pt.moment) / maxM) * 100), 8);
                              return (
                                <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group relative min-w-[20px]">
                                  <div 
                                    className="w-full bg-white hover:bg-neutral-300 rounded-t transition-all"
                                    style={{ height: `${heightPct}%` }}
                                  />
                                  <span className="text-[10px] text-neutral-500 mt-2">{pt.x}m</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {elementType === 'truss_2d' && (
                    <div className="space-y-3 bg-neutral-900/60 p-6 rounded-2xl border border-neutral-800">
                      <p><strong>Status:</strong> {result.status || 'Analysis complete'}</p>
                      {result.message && <p className="text-neutral-400">{result.message}</p>}
                    </div>
                  )}
                </div>
              )}
            </div>

            {result && (
              <div className="mt-8 pt-6 border-t border-neutral-800 flex justify-between items-center">
                <span className="text-xs text-neutral-500">Calculation engine synced</span>
                <button
                  onClick={handleDownloadPdf}
                  disabled={downloadingPdf}
                  className="bg-neutral-900 hover:bg-neutral-800 text-white border border-neutral-700 font-bold px-5 py-2.5 rounded-xl text-xs transition disabled:opacity-50"
                >
                  {downloadingPdf ? 'Generating PDF...' : 'Download PDF Report'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
'use client';

import { useState, useRef } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';

type SupportType = 'simply_supported' | 'cantilever' | 'fixed_fixed' | 'propped_cantilever';

interface LoadItem {
  id: string;
  type: 'point' | 'udl' | 'moment' | 'triangular';
  magnitude: number;
  magnitudeEnd?: number;
  position: number;
  length?: number;
}

interface AnalysisResult {
  span?: number;
  reactions?: {
    R_A?: number;
    R_B?: number;
  };
  critical_values?: {
    max_shear_force?: number;
    max_bending_moment?: number;
    max_deflection?: number;
  };
  x_coords?: number[];
  shear_force?: number[];
  bending_moment?: number[];
}

export default function BeamAnalysisTool() {
  const [length, setLength] = useState<number>(6);
  const [support, setSupport] = useState<SupportType>('simply_supported');
  const [loads, setLoads] = useState<LoadItem[]>([
    { id: '1', type: 'point', magnitude: 15, position: 3 }
  ]);

  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const chartsRef = useRef<HTMLDivElement>(null);

  const addLoad = () => {
    setLoads([
      ...loads,
      { id: Date.now().toString(), type: 'point', magnitude: 10, position: length / 2 }
    ]);
  };

  const removeLoad = (id: string) => {
    setLoads(loads.filter(l => l.id !== id));
  };

  const updateLoad = (id: string, field: keyof LoadItem, value: string | number) => {
    setLoads(loads.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const payload = {
        element_type: 'beam',
        span: Number(length),
        support,
        loads: loads.map(l => ({
          type: l.type,
          magnitude: Number(l.magnitude),
          magnitudeEnd: l.magnitudeEnd !== undefined ? Number(l.magnitudeEnd) : undefined,
          position: Number(l.position),
          length: l.length !== undefined ? Number(l.length) : undefined,
        })),
      };

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`Server returned status ${res.status}`);
      const data = await res.json();
      setResult(data.data || data);
    } catch (err) {
      console.error(err);
      alert('Error connecting to backend API or computing finite element response.');
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = async () => {
    if (!result) return;
    setDownloadingPdf(true);
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const dateStr = new Date().toLocaleDateString();

      doc.setFontSize(18);
      doc.setTextColor(15, 23, 42);
      doc.text('HAYA STRUCTURES LLC', 14, 20);
      doc.setFontSize(12);
      doc.setTextColor(100);
      doc.text('Advanced Structural Beam Verification Report', 14, 28);
      doc.setFontSize(10);
      doc.text(`Date Generated: ${dateStr}`, 14, 34);
      doc.line(14, 40, 196, 40);

      doc.setFontSize(12);
      doc.text('1. Design Input Parameters & Support Configuration', 14, 48);
      autoTable(doc, {
        startY: 52,
        head: [['Parameter', 'Value', 'Unit']],
        body: [
          ['Beam Span', `${result.span ?? length}`, 'm'],
          ['Support Type', `${support.replace('_', ' ').toUpperCase()}`, '-'],
          ['Total Active Loads', `${loads.length}`, 'items'],
        ],
        theme: 'striped',
        headStyles: { fillColor: [14, 116, 144] },
      });

      let lastY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
      doc.text('2. Computed Reaction Statics & Critical Extremes', 14, lastY);
      autoTable(doc, {
        startY: lastY + 4,
        head: [['Metric', 'Value', 'Unit']],
        body: [
          ['Reaction R_A (Left Support)', `${result.reactions?.R_A ?? 0}`, 'kN'],
          ['Reaction R_B (Right Support)', `${result.reactions?.R_B ?? 0}`, 'kN'],
          ['Max Shear Force (V_max)', `${result.critical_values?.max_shear_force ?? 0}`, 'kN'],
          ['Max Bending Moment (M_max)', `${result.critical_values?.max_bending_moment ?? 0}`, 'kN·m'],
          ['Max Deflection (Δ_max)', `${result.critical_values?.max_deflection ?? 0}`, 'mm'],
        ],
        theme: 'striped',
        headStyles: { fillColor: [15, 118, 110] },
      });

      if (chartsRef.current) {
        const canvas = await html2canvas(chartsRef.current, { scale: 2, useCORS: true });
        const imgData = canvas.toDataURL('image/png');
        lastY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

        if (lastY > 180) { 
          doc.addPage(); 
          lastY = 20; 
        }
        
        doc.setFontSize(12);
        doc.setTextColor(15, 23, 42);
        doc.text('3. Shear Force & Bending Moment Diagrams (SFD & BMD)', 14, lastY);
        doc.addImage(imgData, 'PNG', 14, lastY + 4, 182, 85);
      }

      doc.save(`Haya_Structures_Beam_${length}m_Report.pdf`);
    } catch (err) {
      console.error(err);
      alert('Failed to generate PDF export package.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const chartData = result?.x_coords?.map((x: number, i: number) => ({
    x: Number(x.toFixed(2)),
    Shear: Number((result.shear_force?.[i] ?? 0).toFixed(2)),
    Moment: Number((result.bending_moment?.[i] ?? 0).toFixed(2)),
  })) || [];

  const svgWidth = 800;
  const svgHeight = 220;
  const marginX = 100;
  const beamWidth = svgWidth - 2 * marginX;
  const scaleX = length > 0 ? beamWidth / length : 0;
  const beamY = 120;
  const beamThickness = 12;
  const getX = (val: number) => marginX + (val * scaleX);

  const drawPin = (x: number) => (
    <g key={`pin-${x}`}>
      <polygon points={`${x},${beamY + beamThickness} ${x - 15},${beamY + beamThickness + 25} ${x + 15},${beamY + beamThickness + 25}`} fill="#64748b" />
      <line x1={x - 20} y1={beamY + beamThickness + 25} x2={x + 20} y2={beamY + beamThickness + 25} stroke="#64748b" strokeWidth="4" />
    </g>
  );

  const drawFixed = (x: number, isLeft: boolean) => (
    <g key={`fixed-${x}`}>
      <rect x={isLeft ? x - 15 : x} y={beamY - 30} width="15" height={60 + beamThickness} fill="#475569" />
      <line x1={isLeft ? x - 15 : x + 15} y1={beamY - 30} x2={isLeft ? x - 15 : x + 15} y2={beamY + 30 + beamThickness} stroke="#94a3b8" strokeWidth="2" strokeDasharray="4 4" />
    </g>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-5 space-y-4 bg-slate-900 p-5 rounded-xl border border-slate-800">
        <h3 className="font-semibold text-slate-200 border-b border-slate-800 pb-2">Beam Geometry & Supports</h3>
        
        <div>
          <label className="block text-xs text-slate-400 mb-1">Span Length L (m)</label>
          <input
            type="number"
            value={length}
            onChange={(e) => setLength(Number(e.target.value))}
            className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200"
          />
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Support Condition Type</label>
          <select
            value={support}
            onChange={(e) => setSupport(e.target.value as SupportType)}
            className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200"
          >
            <option value="simply_supported">Simply Supported (Pinned-Pinned)</option>
            <option value="cantilever">Cantilever (Fixed-Free)</option>
            <option value="fixed_fixed">Fixed - Fixed</option>
            <option value="propped_cantilever">Propped Cantilever (Fixed-Pinned)</option>
          </select>
        </div>

        <div className="pt-2 border-t border-slate-800 space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="font-semibold text-slate-200 text-sm">Applied Loads Configuration</h4>
            <button
              onClick={addLoad}
              className="text-xs bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 px-2.5 py-1 rounded hover:bg-cyan-500/30 transition"
            >
              + Add Load
            </button>
          </div>

          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {loads.map((loadItem, index) => (
              <div key={loadItem.id} className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2 relative">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-cyan-400">Load #{index + 1}</span>
                  {loads.length > 1 && (
                    <button onClick={() => removeLoad(loadItem.id)} className="text-red-400 hover:text-red-300 text-xs">
                      Remove
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400">Type</label>
                    <select
                      value={loadItem.type}
                      onChange={(e) => updateLoad(loadItem.id, 'type', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-slate-200"
                    >
                      <option value="point">Point Load (kN)</option>
                      <option value="udl">UDL (kN/m)</option>
                      <option value="moment">Moment (kN·m)</option>
                      <option value="triangular">Triangular / Trapezoidal</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400">
                      {loadItem.type === 'udl' ? 'Intensity (kN/m)' : loadItem.type === 'moment' ? 'Moment (kN·m)' : 'Magnitude (kN)'}
                    </label>
                    <input
                      type="number"
                      value={loadItem.magnitude}
                      onChange={(e) => updateLoad(loadItem.id, 'magnitude', Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-slate-200"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400">Position / Start (m)</label>
                    <input
                      type="number"
                      value={loadItem.position}
                      onChange={(e) => updateLoad(loadItem.id, 'position', Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-slate-200"
                    />
                  </div>

                  {(loadItem.type === 'udl' || loadItem.type === 'triangular') && (
                    <div>
                      <label className="block text-[10px] text-slate-400">Distributed Length (m)</label>
                      <input
                        type="number"
                        value={loadItem.length ?? length}
                        onChange={(e) => updateLoad(loadItem.id, 'length', Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-slate-200"
                      />
                    </div>
                  )}

                  {loadItem.type === 'triangular' && (
                    <div>
                      <label className="block text-[10px] text-slate-400">End Magnitude (kN/m)</label>
                      <input
                        type="number"
                        value={loadItem.magnitudeEnd ?? 0}
                        onChange={(e) => updateLoad(loadItem.id, 'magnitudeEnd', Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-slate-200"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold py-2.5 rounded transition disabled:opacity-50 mt-4"
        >
          {loading ? 'Running FEM & Equilibrium Solver...' : 'Run Comprehensive Beam Analysis'}
        </button>

        {result && (
          <div className="mt-4 pt-4 border-t border-slate-800 space-y-2 text-sm bg-slate-950 p-3 rounded-lg border border-slate-800">
            <p className="text-xs text-slate-400 font-bold uppercase mb-1">Computed Summary:</p>
            <p>Left Reaction (R_A): <span className="text-cyan-400 font-mono">{result.reactions?.R_A ?? 0} kN</span></p>
            <p>Right Reaction (R_B): <span className="text-cyan-400 font-mono">{result.reactions?.R_B ?? 0} kN</span></p>
            <p>Max Shear Force: <span className="text-cyan-400 font-mono">{result.critical_values?.max_shear_force ?? 0} kN</span></p>
            <p>Max Bending Moment: <span className="text-emerald-400 font-mono">{result.critical_values?.max_bending_moment ?? 0} kN·m</span></p>
            
            <button
              onClick={generatePDF}
              disabled={downloadingPdf}
              className="w-full mt-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2 rounded transition shadow-lg"
            >
              {downloadingPdf ? 'Generating PDF Report...' : '📄 Download PDF Report (With Graphs)'}
            </button>
          </div>
        )}
      </div>

      <div className="lg:col-span-7 space-y-6">
        <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 flex flex-col justify-center">
          <h3 className="text-xs font-bold text-slate-300 mb-4 border-b border-slate-800 pb-2">
            LIVE BEAM VISUALIZATION
          </h3>
          <div className="w-full overflow-hidden bg-slate-950/50 rounded-lg border border-slate-800 mb-6 flex justify-center p-4">
            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto max-h-48 drop-shadow-md">
              <line x1={marginX} y1={beamY + 60} x2={marginX + beamWidth} y2={beamY + 60} stroke="#475569" strokeWidth="1" />
              <line x1={marginX} y1={beamY + 55} x2={marginX} y2={beamY + 65} stroke="#475569" strokeWidth="2" />
              <line x1={marginX + beamWidth} y1={beamY + 55} x2={marginX + beamWidth} y2={beamY + 65} stroke="#475569" strokeWidth="2" />
              <text x={marginX + beamWidth / 2} y={beamY + 80} fill="#94a3b8" fontSize="14" textAnchor="middle" fontWeight="bold">
                Span (L) = {length}m
              </text>

              <rect x={marginX} y={beamY} width={beamWidth} height={beamThickness} fill="#94a3b8" rx="2" />

              {support === 'simply_supported' && (<>{drawPin(marginX)}{drawPin(marginX + beamWidth)}</>)}
              {support === 'cantilever' && drawFixed(marginX, true)}
              {support === 'fixed_fixed' && (<>{drawFixed(marginX, true)}{drawFixed(marginX + beamWidth, false)}</>)}
              {support === 'propped_cantilever' && (<>{drawFixed(marginX, true)}{drawPin(marginX + beamWidth)}</>)}

              {loads.map((load) => {
                const startX = getX(Math.min(load.position, length));
                if (load.type === 'point') {
                  return (
                    <g key={load.id}>
                      <line x1={startX} y1={beamY - 40} x2={startX} y2={beamY - 5} stroke="#06b6d4" strokeWidth="3" />
                      <polygon points={`${startX},${beamY} ${startX - 5},${beamY - 10} ${startX + 5},${beamY - 10}`} fill="#06b6d4" />
                      <text x={startX} y={beamY - 45} fill="#22d3ee" fontSize="12" textAnchor="middle" fontWeight="bold">{load.magnitude} kN</text>
                    </g>
                  );
                }
                if (load.type === 'udl' || load.type === 'triangular') {
                  const loadLen = load.length || length;
                  const endX = getX(Math.min(load.position + loadLen, length));
                  const udlWidth = Math.max(endX - startX, 0);
                  if (udlWidth > 0) {
                    return (
                      <g key={load.id}>
                        {load.type === 'udl' ? (
                          <rect x={startX} y={beamY - 25} width={udlWidth} height="20" fill="#0ea5e9" fillOpacity="0.2" stroke="#0ea5e9" strokeWidth="1" strokeDasharray="4 2" />
                        ) : (
                          <polygon points={`${startX},${beamY - 5} ${startX},${beamY - 25} ${endX},${beamY - 5}`} fill="#8b5cf6" fillOpacity="0.2" stroke="#8b5cf6" strokeWidth="1" />
                        )}
                        <text x={startX + udlWidth / 2} y={beamY - 32} fill={load.type === 'udl' ? "#38bdf8" : "#a78bfa"} fontSize="12" textAnchor="middle" fontWeight="bold">
                          {load.type === 'udl' ? `${load.magnitude} kN/m` : `${load.magnitude} - ${load.magnitudeEnd || 0} kN/m`}
                        </text>
                      </g>
                    );
                  }
                }
                if (load.type === 'moment') {
                  return (
                    <g key={load.id}>
                      <path d={`M ${startX - 15} ${beamY - 15} A 15 15 0 1 1 ${startX + 15} ${beamY - 15}`} fill="none" stroke="#f59e0b" strokeWidth="2.5" />
                      <text x={startX} y={beamY - 35} fill="#fbbf24" fontSize="12" textAnchor="middle" fontWeight="bold">{load.magnitude} kN·m</text>
                    </g>
                  );
                }
                return null;
              })}
            </svg>
          </div>
        </div>

        <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 flex flex-col justify-center">
          {chartData.length > 0 ? (
            <div ref={chartsRef} className="space-y-6 bg-slate-900 p-3 rounded-lg">
              <div className="text-xs font-bold text-slate-300 mb-2 border-b border-slate-800 pb-1 flex justify-between">
                <span>HAYA STRUCTURES - BEAM ANALYSIS RESULTS</span>
                <span className="text-cyan-400 font-mono">Span: {length}m | {support.toUpperCase()}</span>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-cyan-400 mb-1 uppercase">Shear Force Diagram (SFD) [kN]</h4>
                <div className="h-48 w-full bg-slate-950/70 p-2 rounded border border-slate-800">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="x" stroke="#64748b" fontSize={10} unit="m" />
                      <YAxis stroke="#64748b" fontSize={10} unit="kN" />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '11px' }} />
                      <ReferenceLine y={0} stroke="#475569" strokeWidth={1.5} />
                      <Line type="monotone" dataKey="Shear" stroke="#38bdf8" strokeWidth={2.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-emerald-400 mb-1 uppercase">Bending Moment Diagram (BMD) [kN·m]</h4>
                <div className="h-48 w-full bg-slate-950/70 p-2 rounded border border-slate-800">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="x" stroke="#64748b" fontSize={10} unit="m" />
                      <YAxis stroke="#64748b" fontSize={10} unit="kN·m" />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '11px' }} />
                      <ReferenceLine y={0} stroke="#475569" strokeWidth={1.5} />
                      <Line type="monotone" dataKey="Moment" stroke="#34d399" strokeWidth={2.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-slate-500 py-16 space-y-2">
              <p className="text-lg">SFD & BMD will appear here.</p>
              <p className="text-xs">Click &quot;Run Comprehensive Beam Analysis&quot; to generate output graphs.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
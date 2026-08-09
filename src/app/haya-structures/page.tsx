'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
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

export default function HayaStructuresHub() {
  // Primary Navigation Toggles: 'analysis' | 'design' | 'consultancy' | 'projects'
  const [activeTab, setActiveTab] = useState<'analysis' | 'design' | 'consultancy' | 'projects'>('analysis');
  
  // Structural Element Sub-Toggles for Analysis Mode
  const [structuralElement, setStructuralElement] = useState<'beam' | 'column' | 'slab' | 'wall' | 'truss' | 'foundation' | 'frame'>('beam');

  // Beam Calculator States
  const [length, setLength] = useState(6);
  const [load, setLoad] = useState(10);
  const [support, setSupport] = useState<'simply_supported' | 'cantilever'>('simply_supported');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const chartsRef = useRef<HTMLDivElement>(null);

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const payload = {
        element_type: 'beam',
        span: Number(length),
        support,
        loads: [{ type: 'point', magnitude: Number(load), position: Number(length) / 2 }],
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
      alert('Error connecting to backend API.');
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
      doc.text('Structural Beam Verification Report', 14, 28);
      doc.setFontSize(10);
      doc.text(`Date Generated: ${dateStr}`, 14, 34);
      doc.line(14, 40, 196, 40);

      doc.setFontSize(12);
      doc.text('1. Design Input Parameters', 14, 48);
      autoTable(doc, {
        startY: 52,
        head: [['Parameter', 'Value', 'Unit']],
        body: [
          ['Beam Span', `${result.span ?? length}`, 'm'],
          ['Support Type', `${support.replace('_', ' ')}`, '-'],
          ['Point Load', `${load}`, 'kN'],
        ],
        theme: 'striped',
        headStyles: { fillColor: [14, 116, 144] },
      });

      let lastY = (doc as any).lastAutoTable.finalY + 10;
      doc.text('2. Computed Statics', 14, lastY);
      autoTable(doc, {
        startY: lastY + 4,
        head: [['Metric', 'Value', 'Unit']],
        body: [
          ['Reaction R_A', `${result.reactions?.R_A ?? 0}`, 'kN'],
          ['Reaction R_B', `${result.reactions?.R_B ?? 0}`, 'kN'],
          ['Max Shear Force (V_max)', `${result.critical_values?.max_shear_force ?? 0}`, 'kN'],
          ['Max Bending Moment (M_max)', `${result.critical_values?.max_bending_moment ?? 0}`, 'kN·m'],
        ],
        theme: 'striped',
        headStyles: { fillColor: [15, 118, 110] },
      });

      if (chartsRef.current) {
        const canvas = await html2canvas(chartsRef.current, { scale: 2 });
        const imgData = canvas.toDataURL('image/png');
        lastY = (doc as any).lastAutoTable.finalY + 10;

        if (lastY > 190) { doc.addPage(); lastY = 20; }
        doc.text('3. SFD & BMD Diagrams', 14, lastY);
        doc.addImage(imgData, 'PNG', 14, lastY + 4, 182, 75);
      }

      doc.save(`Haya_Structures_Report_${length}m.pdf`);
    } catch (err) {
      console.error(err);
      alert('Failed to generate PDF.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const chartData = result?.x_coords?.map((x: number, i: number) => ({
    x: Number(x.toFixed(2)),
    Shear: Number((result.shear_force?.[i] ?? 0).toFixed(2)),
    Moment: Number((result.bending_moment?.[i] ?? 0).toFixed(2)),
  })) || [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header & Primary Toggles */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 pb-4 gap-4">
          <div>
            <Link href="/" className="text-cyan-400 text-sm hover:underline">
              ← Back to Rutta.com Home
            </Link>
            <h1 className="text-3xl font-extrabold text-cyan-400 mt-1">HAYA STRUCTURES SUITE</h1>
            <p className="text-sm text-slate-400">Integrated Structural Engineering Platform</p>
          </div>

          <div className="flex bg-slate-900 p-1.5 rounded-xl border border-slate-800 gap-1 flex-wrap">
            {(['analysis', 'design', 'consultancy', 'projects'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition ${
                  activeTab === tab ? 'bg-cyan-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* TAB 1: ANALYSIS */}
        {activeTab === 'analysis' && (
          <div className="space-y-6">
            {/* Structural Component Sub-Toggles */}
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Select Structural Element for Analysis
              </h2>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {[
                  { id: 'beam', label: 'Beams' },
                  { id: 'column', label: 'Columns' },
                  { id: 'slab', label: 'Slabs' },
                  { id: 'wall', label: 'Walls' },
                  { id: 'truss', label: 'Trusses' },
                  { id: 'foundation', label: 'Foundations' },
                  { id: 'frame', label: 'Frames' },
                ].map((el) => (
                  <button
                    key={el.id}
                    onClick={() => setStructuralElement(el.id as any)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                      structuralElement === el.id
                        ? 'bg-teal-500 text-slate-950 font-bold'
                        : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    {el.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Render Calculator based on Sub-Toggle */}
            {structuralElement === 'beam' ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-4 space-y-4 bg-slate-900 p-5 rounded-xl border border-slate-800">
                  <h3 className="font-semibold text-slate-200">Beam Design Parameters</h3>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Span Length (m)</label>
                    <input
                      type="number"
                      value={length}
                      onChange={(e) => setLength(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Support Condition</label>
                    <select
                      value={support}
                      onChange={(e) => setSupport(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200"
                    >
                      <option value="simply_supported">Simply Supported</option>
                      <option value="cantilever">Cantilever</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Point Load (kN)</label>
                    <input
                      type="number"
                      value={load}
                      onChange={(e) => setLoad(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200"
                    />
                  </div>
                  <button
                    onClick={handleAnalyze}
                    disabled={loading}
                    className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold py-2.5 rounded transition disabled:opacity-50"
                  >
                    {loading ? 'Analyzing...' : 'Run Beam Analysis'}
                  </button>

                  {result && (
                    <div className="mt-4 pt-4 border-t border-slate-800 space-y-2 text-sm">
                      <p>Max Shear: <span className="text-cyan-400 font-mono">{result.critical_values?.max_shear_force ?? 0} kN</span></p>
                      <p>Max Moment: <span className="text-emerald-400 font-mono">{result.critical_values?.max_bending_moment ?? 0} kN·m</span></p>
                      <button
                        onClick={generatePDF}
                        disabled={downloadingPdf}
                        className="w-full mt-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2 rounded transition"
                      >
                        {downloadingPdf ? 'Generating PDF...' : '📄 Download PDF Report'}
                      </button>
                    </div>
                  )}
                </div>

                <div className="lg:col-span-8 bg-slate-900 p-5 rounded-xl border border-slate-800 flex flex-col justify-center">
                  {chartData.length > 0 ? (
                    <div ref={chartsRef} className="space-y-6 bg-slate-900 p-2">
                      <div>
                        <h4 className="text-xs font-semibold text-cyan-400 mb-2 uppercase">Shear Force Diagram (SFD)</h4>
                        <div className="h-44 w-full bg-slate-950/50 p-2 rounded border border-slate-800">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                              <XAxis dataKey="x" stroke="#64748b" fontSize={10} unit="m" />
                              <YAxis stroke="#64748b" fontSize={10} unit="kN" />
                              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '11px' }} />
                              <ReferenceLine y={0} stroke="#475569" />
                              <Line type="monotone" dataKey="Shear" stroke="#38bdf8" strokeWidth={2} dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-xs font-semibold text-emerald-400 mb-2 uppercase">Bending Moment Diagram (BMD)</h4>
                        <div className="h-44 w-full bg-slate-950/50 p-2 rounded border border-slate-800">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                              <XAxis dataKey="x" stroke="#64748b" fontSize={10} unit="m" />
                              <YAxis stroke="#64748b" fontSize={10} unit="kN·m" />
                              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '11px' }} />
                              <ReferenceLine y={0} stroke="#475569" />
                              <Line type="monotone" dataKey="Moment" stroke="#34d399" strokeWidth={2} dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-slate-500 py-20">
                      Configure your beam parameters and click &quot;Run Beam Analysis&quot; to render diagrams.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-slate-900 p-12 rounded-xl border border-slate-800 text-center text-slate-400">
                <h3 className="text-xl font-semibold text-cyan-400 mb-2 capitalize">{structuralElement} Analysis Module</h3>
                <p>Finite element modeling and boundary formulations for {structuralElement}s are initializing.</p>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: DESIGN */}
        {activeTab === 'design' && (
          <div className="bg-slate-900 p-8 rounded-xl border border-slate-800 space-y-4">
            <h2 className="text-xl font-bold text-cyan-400">Structural Member Design & Code Verification</h2>
            <p className="text-slate-300 text-sm">
              Perform ULS and SLS design checks (BS 8110 / ACI 318) for concrete and steel sections using internal forces computed from the Analysis tab.
            </p>
          </div>
        )}

        {/* TAB 3: CONSULTANCY */}
        {activeTab === 'consultancy' && (
          <div className="bg-slate-900 p-8 rounded-xl border border-slate-800 space-y-4">
            <h2 className="text-xl font-bold text-cyan-400">Engineering Consultancy & Advisory Desk</h2>
            <p className="text-slate-300 text-sm">
              Schedule direct engineering reviews, site inspections, and structural calculations validation with professional oversight.
            </p>
          </div>
        )}

        {/* TAB 4: PROJECTS */}
        {activeTab === 'projects' && (
          <div className="bg-slate-900 p-8 rounded-xl border border-slate-800 space-y-4">
            <h2 className="text-xl font-bold text-cyan-400">Saved Projects & Reports</h2>
            <p className="text-slate-300 text-sm">
              Access your historical design sessions, archived calculation logs, and export packages.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
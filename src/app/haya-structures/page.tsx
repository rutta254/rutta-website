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

export default function HayaStructures() {
  const [length, setLength] = useState(6);
  const [load, setLoad] = useState(10);
  const [support, setSupport] = useState<'simply_supported' | 'cantilever'>('simply_supported');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Reference for the charts container to capture for the PDF report
  const chartsRef = useRef<HTMLDivElement>(null);

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const payload = {
        element_type: 'beam',
        span: Number(length),
        support,
        loads: [
          {
            type: 'point',
            magnitude: Number(load),
            position: Number(length) / 2,
          },
        ],
      };

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }
      const data = await res.json();
      setResult(data.data || data);
    } catch (err) {
      console.error(err);
      alert('Error connecting to backend API. Please check your Render service status.');
    } finally {
      setLoading(false);
    }
  };

  // Enhanced PDF generator capturing both statics and chart graphics
  const generatePDF = async () => {
    if (!result) return;
    setDownloadingPdf(true);

    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const dateStr = new Date().toLocaleDateString();

      // Header Title
      doc.setFontSize(18);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text('HAYA STRUCTURES LLC', 14, 20);
      doc.setFontSize(12);
      doc.setTextColor(100);
      doc.text('Structural Beam Verification Report', 14, 28);
      doc.setFontSize(10);
      doc.text(`Date Generated: ${dateStr}`, 14, 34);
      doc.text('Engineered via Cloud API Pipeline', 14, 40);
      doc.line(14, 45, 196, 45); // Horizontal divider

      // Input Parameters Section
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text('1. Design Input Parameters', 14, 53);

      autoTable(doc, {
        startY: 57,
        head: [['Parameter', 'Value', 'Unit']],
        body: [
          ['Beam Span / Length', `${result.span ?? length}`, 'm'],
          ['Support Configuration', `${support.replace('_', ' ')}`, '-'],
          ['Point Load Magnitude', `${load}`, 'kN'],
          ['Point Load Location', `${Number(length) / 2}`, 'm (Mid-span)'],
        ],
        theme: 'striped',
        headStyles: { fillColor: [14, 116, 144] }, // cyan-700
      });

      // Statics Results Section
      let lastY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(12);
      doc.text('2. Computed Structural Statics', 14, lastY);

      autoTable(doc, {
        startY: lastY + 4,
        head: [['Metric', 'Value', 'Unit']],
        body: [
          ['Support Reaction R_A', `${result.reactions?.R_A ?? 0}`, 'kN'],
          ['Support Reaction R_B', `${result.reactions?.R_B ?? 0}`, 'kN'],
          ['Maximum Shear Force (V_max)', `${result.critical_values?.max_shear_force ?? 0}`, 'kN'],
          ['Maximum Bending Moment (M_max)', `${result.critical_values?.max_bending_moment ?? 0}`, 'kN·m'],
        ],
        theme: 'striped',
        headStyles: { fillColor: [15, 118, 110] }, // teal-700
      });

      // Capture Charts Element as Image and Embed into PDF
      if (chartsRef.current) {
        const canvas = await html2canvas(chartsRef.current, { scale: 2 });
        const imgData = canvas.toDataURL('image/png');

        lastY = (doc as any).lastAutoTable.finalY + 10;
        
        // Check if we need a new page for charts
        if (lastY > 200) {
          doc.addPage();
          lastY = 20;
        }

        doc.setFontSize(12);
        doc.setTextColor(15, 23, 42);
        doc.text('3. Shear Force & Bending Moment Diagrams', 14, lastY);

        const imgWidth = 182; // mm (196 - 14 margins)
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        doc.addImage(imgData, 'PNG', 14, lastY + 4, imgWidth, Math.min(imgHeight, 80));
      }

      // Verification & Sign-off
      const signY = 270; 
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text('Calculations performed using Cloud-Native Beam Analysis API v1.0.', 14, signY);
      doc.text('Approved by Structural Lead: _________________________', 14, signY + 6);

      // Download PDF
      doc.save(`Haya_Structures_Beam_Report_${length}m_${load}kN.pdf`);
    } catch (error) {
      console.error('PDF Generation Error:', error);
      alert('Failed to generate PDF report.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const chartData =
    result?.x_coords?.map((x: number, i: number) => ({
      x: Number(x.toFixed(2)),
      Shear: Number((result.shear_force?.[i] ?? 0).toFixed(2)),
      Moment: Number((result.bending_moment?.[i] ?? 0).toFixed(2)),
      Deflection: Number((result.deflection_mm?.[i] ?? 0).toFixed(3)),
    })) || [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Navigation & Header */}
        <div className="flex justify-between items-center border-b border-slate-800 pb-4">
          <div>
            <Link href="/" className="text-cyan-400 text-sm hover:underline">
              ← Back to Rutta.com Home
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-cyan-400 mt-1">
              HAYA STRUCTURES LLC
            </h1>
            <p className="text-sm text-slate-400">
              Live Cloud-Native Structural Beam Analysis & PDF Report Generator
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Controls & Summary */}
          <div className="lg:col-span-4 space-y-4 bg-slate-900 p-5 rounded-xl border border-slate-800">
            <h2 className="font-semibold text-slate-200">Design Parameters</h2>
            
            <div>
              <label className="block text-xs text-slate-400 mb-1">Beam Span / Length (m)</label>
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
              <label className="block text-xs text-slate-400 mb-1">Point Load Magnitude (kN)</label>
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
              {loading ? 'Analyzing...' : 'Run Analysis via Cloud API'}
            </button>

            {result && (
              <div className="mt-4 pt-4 border-t border-slate-800 space-y-2 text-sm">
                <h3 className="font-semibold text-slate-200">Statics Summary</h3>
                <p>Max Shear Force: <span className="text-cyan-400 font-mono">{result.critical_values?.max_shear_force ?? 0} kN</span></p>
                <p>Max Bending Moment: <span className="text-emerald-400 font-mono">{result.critical_values?.max_bending_moment ?? 0} kN·m</span></p>
                <p>Support R_A: <span className="font-mono">{result.reactions?.R_A ?? 0} kN</span></p>
                <p>Support R_B: <span className="font-mono">{result.reactions?.R_B ?? 0} kN</span></p>

                <button
                  onClick={generatePDF}
                  disabled={downloadingPdf}
                  className="w-full mt-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2 rounded transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {downloadingPdf ? 'Generating PDF...' : '📄 Download PDF Verification Report'}
                </button>
              </div>
            )}
          </div>

          {/* Right Column: Graphs / Diagrams display */}
          <div className="lg:col-span-8 bg-slate-900 p-5 rounded-xl border border-slate-800 flex flex-col justify-center">
            {chartData.length > 0 ? (
              <div ref={chartsRef} className="space-y-6 bg-slate-900 p-2">
                {/* Shear Force Diagram (SFD) */}
                <div>
                  <h3 className="text-xs font-semibold text-cyan-400 mb-2 uppercase tracking-wider">
                    Shear Force Diagram (SFD) - [kN]
                  </h3>
                  <div className="h-48 w-full bg-slate-950/50 p-2 rounded border border-slate-800">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="x" stroke="#64748b" fontSize={10} unit="m" />
                        <YAxis stroke="#64748b" fontSize={10} unit="kN" />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px' }} />
                        <ReferenceLine y={0} stroke="#475569" />
                        <Line type="monotone" dataKey="Shear" stroke="#38bdf8" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Bending Moment Diagram (BMD) */}
                <div>
                  <h3 className="text-xs font-semibold text-emerald-400 mb-2 uppercase tracking-wider">
                    Bending Moment Diagram (BMD) - [kN·m]
                  </h3>
                  <div className="h-48 w-full bg-slate-950/50 p-2 rounded border border-slate-800">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="x" stroke="#64748b" fontSize={10} unit="m" />
                        <YAxis stroke="#64748b" stroke="#64748b" fontSize={10} unit="kN·m" />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px' }} />
                        <ReferenceLine y={0} stroke="#475569" />
                        <Line type="monotone" dataKey="Moment" stroke="#34d399" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-slate-500 py-20">
                Run the analysis to render live Shear Force/Bending Moment diagrams & enable PDF export.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
'use client';

import { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceDot,
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type DesignCode = 'ACI318' | 'BS8110' | 'EC2';

interface ColumnResult {
  design_code?: DesignCode;
  inputs?: { width: number; depth: number; cover: number; fc: number; fy: number; numBars: number; barDiam: number; length: number; kFactor: number; pu: number; m1: number; m2: number };
  section_properties?: { Ag: number; Ast: number; rebarRatio: number; Ig?: number; r?: number };
  slenderness?: { klr?: number; slendernessRatio?: number; limit?: number; isSlender?: boolean; Pcr?: number; delta_ns?: number; Mc?: number };
  capacity?: { phiPn_max?: number; dcr?: number; status?: 'SAFE' | 'OVERSTRESSED' };
  pm_envelope?: { c: number; Pn: number; Mn: number; phiPn: number; phiMn: number }[];
  bar_locations?: { x: number; y: number; depth: number; area: number }[];
}

export default function ColumnAnalysisTool() {
  const [designCode, setDesignCode] = useState<DesignCode>('ACI318');
  const [width, setWidth] = useState<number>(400);
  const [depth, setDepth] = useState<number>(400);
  const [cover, setCover] = useState<number>(40);
  const [fc, setFc] = useState<number>(30);
  const [fy, setFy] = useState<number>(420);
  const [numBars, setNumBars] = useState<number>(8);
  const [barDiam, setBarDiam] = useState<number>(20);
  const [length, setLength] = useState<number>(3.5);
  const [kFactor, setKFactor] = useState<number>(1.0);
  const [endCondition, setEndCondition] = useState<number>(1);
  const [isBraced, setIsBraced] = useState<boolean>(true);
  const [pu, setPu] = useState<number>(1200);
  const [m1, setM1] = useState<number>(80);
  const [m2, setM2] = useState<number>(120);

  const [result, setResult] = useState<ColumnResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          element_type: 'column',
          design_code: designCode,
          width: Number(width),
          depth: Number(depth),
          cover: Number(cover),
          fc: Number(fc),
          fy: Number(fy),
          numBars: Number(numBars),
          barDiam: Number(barDiam),
          length: Number(length),
          kFactor: Number(kFactor),
          endCondition: Number(endCondition),
          isBraced,
          pu: Number(pu),
          m1: Number(m1),
          m2: Number(m2),
        }),
      });

      if (!res.ok) throw new Error(`Server status ${res.status}`);
      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error(err);
      alert('Error running column analysis solver.');
    } finally {
      setLoading(false);
    }
  };

  const convertSvgToPng = (svgElement: SVGSVGElement, bgColor = '#0f172a'): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
        const bbox = svgElement.getBoundingClientRect();
        const w = bbox.width || 600;
        const h = bbox.height || 300;

        clonedSvg.setAttribute('width', w.toString());
        clonedSvg.setAttribute('height', h.toString());
        if (!clonedSvg.getAttribute('viewBox')) {
          clonedSvg.setAttribute('viewBox', `0 0 ${w} ${h}`);
        }

        const serializer = new XMLSerializer();
        let svgString = serializer.serializeToString(clonedSvg);

        if (!svgString.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
          svgString = svgString.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
        }

        const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const img = new Image();

        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = w * 2;
          canvas.height = h * 2;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/png'));
          } else {
            reject(new Error('Canvas context unavailable'));
          }
          URL.revokeObjectURL(url);
        };

        img.onerror = (e) => {
          URL.revokeObjectURL(url);
          reject(e);
        };

        img.src = url;
      } catch (err) {
        reject(err);
      }
    });
  };

  const generatePDF = async () => {
    if (!result) return;
    setDownloadingPdf(true);

    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const dateStr = new Date().toLocaleDateString();

      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text('HAYA STRUCTURES LLC', 14, 12);
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(`Column Multi-Code Report (${designCode}) | Date: ${dateStr}`, 14, 16);
      doc.line(14, 19, 196, 19);

      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text('1. Design Inputs & Slenderness Summary', 14, 24);

      autoTable(doc, {
        startY: 27,
        margin: { left: 14 },
        tableWidth: 88,
        head: [['Parameter', 'Value', 'Unit']],
        body: [
          ['Design Code', `${designCode}`, '-'],
          ['Section (b × h)', `${width} × ${depth}`, 'mm'],
          ['Concrete Cover', `${cover}`, 'mm'],
          ['Concrete / Steel Grade', `${fc} / ${fy}`, 'MPa'],
          ['Rebar Reinforcement', `${numBars} - Ø${barDiam}`, '-'],
          ['Unbraced Length L', `${length}m`, '-'],
        ],
        theme: 'striped',
        headStyles: { fillColor: [14, 116, 144], fontSize: 7, cellPadding: 1 },
        bodyStyles: { fontSize: 7, cellPadding: 1 },
      });

      const getFinalY = (pdfDoc: jsPDF) =>
        (pdfDoc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 50;

      const leftYTotal = getFinalY(doc);

      autoTable(doc, {
        startY: 27,
        margin: { left: 106 },
        tableWidth: 90,
        head: [['Metric Description', 'Computed Value', 'Status / Unit']],
        body: [
          ['Slenderness Ratio', `${result.slenderness?.klr ?? result.slenderness?.slendernessRatio ?? 0}`, `Limit: ${result.slenderness?.limit ?? 0}`],
          ['Slenderness Status', result.slenderness?.isSlender ? 'SLENDER' : 'SHORT', '-'],
          ['Design Moment (Mc)', `${result.slenderness?.Mc ?? 0}`, 'kN·m'],
          ['Max Axial Capacity φPn,max', `${result.capacity?.phiPn_max ?? 0}`, 'kN'],
          ['Demand Capacity Ratio (DCR)', `${result.capacity?.dcr ?? 0}`, result.capacity?.status ?? 'N/A'],
        ],
        theme: 'striped',
        headStyles: { fillColor: [15, 118, 110], fontSize: 7, cellPadding: 1 },
        bodyStyles: { fontSize: 7, cellPadding: 1 },
      });

      const rightYTotal = getFinalY(doc);
      let currentY = Math.max(leftYTotal, rightYTotal) + 5;

      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text('2. Visualizations & P-M Interaction Envelope', 14, currentY);
      currentY += 3;

      const elevSvg = document.getElementById('column-elevation-svg') as unknown as SVGSVGElement;
      const secSvg = document.getElementById('column-section-svg') as unknown as SVGSVGElement;
      const pmSvg = document.querySelector('#pm-chart-container svg') as SVGSVGElement;

      if (elevSvg && secSvg) {
        try {
          const elevPng = await convertSvgToPng(elevSvg, '#0f172a');
          const secPng = await convertSvgToPng(secSvg, '#0f172a');
          doc.addImage(elevPng, 'PNG', 14, currentY, 88, 52);
          doc.addImage(secPng, 'PNG', 106, currentY, 90, 52);
          currentY += 56;
        } catch (e) {
          console.warn('SVG conversion failed:', e);
        }
      }

      if (pmSvg) {
        try {
          const pmPng = await convertSvgToPng(pmSvg, '#0f172a');
          doc.addImage(pmPng, 'PNG', 14, currentY, 182, 65);
        } catch (e) {
          console.warn('P-M Chart export failed:', e);
        }
      }

      doc.save(`Haya_Structures_Column_${designCode}_Report.pdf`);
    } catch (err) {
      console.error('PDF Generation error:', err);
      alert(`Failed to generate PDF report: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-5 space-y-4 bg-slate-900 p-5 rounded-xl border border-slate-800">
        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
          <h3 className="font-semibold text-slate-200">Column Inputs</h3>
          <select
            value={designCode}
            onChange={(e) => setDesignCode(e.target.value as DesignCode)}
            className="bg-cyan-500/20 text-cyan-400 font-bold border border-cyan-500/30 rounded px-2 py-1 text-xs"
          >
            <option value="ACI318">ACI 318-19</option>
            <option value="BS8110">BS 8110:1997</option>
            <option value="EC2">Eurocode 2 (EN 1992)</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Width b (mm)</label>
            <input type="number" value={width} onChange={(e) => setWidth(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Depth h (mm)</label>
            <input type="number" value={depth} onChange={(e) => setDepth(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Cover (mm)</label>
            <input type="number" value={cover} onChange={(e) => setCover(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">{designCode === 'BS8110' ? 'fcu' : 'f\'c / fck'} (MPa)</label>
            <input type="number" value={fc} onChange={(e) => setFc(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">fy (MPa)</label>
            <input type="number" value={fy} onChange={(e) => setFy(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200" />
          </div>
        </div>

        <div className="pt-2 border-t border-slate-800 space-y-3">
          <h4 className="font-semibold text-slate-200 text-sm">Longitudinal Rebar</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Bar Count (N)</label>
              <input type="number" value={numBars} onChange={(e) => setNumBars(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Bar Diam Ø (mm)</label>
              <input type="number" value={barDiam} onChange={(e) => setBarDiam(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200" />
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-800 space-y-3">
          <h4 className="font-semibold text-slate-200 text-sm">Boundary & Loads</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Length L (m)</label>
              <input type="number" value={length} onChange={(e) => setLength(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">{designCode === 'BS8110' ? 'BS End Cond.' : 'K Factor'}</label>
              {designCode === 'BS8110' ? (
                <select value={endCondition} onChange={(e) => setEndCondition(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200">
                  <option value={1}>Cond 1 (Fully Fixed)</option>
                  <option value={2}>Cond 2 (Partially Fixed)</option>
                  <option value={3}>Cond 3 (Pinned)</option>
                  <option value={4}>Cond 4 (Free/Cantilever)</option>
                </select>
              ) : (
                <input type="number" step="0.1" value={kFactor} onChange={(e) => setKFactor(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200" />
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Pu (kN)</label>
              <input type="number" value={pu} onChange={(e) => setPu(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">M1 (kNm)</label>
              <input type="number" value={m1} onChange={(e) => setM1(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">M2 (kNm)</label>
              <input type="number" value={m2} onChange={(e) => setM2(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200" />
            </div>
          </div>
        </div>

        <button onClick={handleAnalyze} disabled={loading} className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold py-2.5 rounded transition disabled:opacity-50 mt-4">
          {loading ? 'Calculating P-M Envelope...' : `Run Column Analysis (${designCode})`}
        </button>

        {result && (
          <div className="mt-4 pt-4 border-t border-slate-800 space-y-2 text-sm bg-slate-950 p-3 rounded-lg border border-slate-800">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-slate-400 font-bold uppercase">{designCode} Verdict:</span>
              <span className={`text-xs px-2 py-0.5 rounded font-bold ${result.capacity?.status === 'SAFE' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                {result.capacity?.status}
              </span>
            </div>
            <p>Slenderness Ratio: <span className="text-cyan-400 font-mono">{result.slenderness?.klr ?? result.slenderness?.slendernessRatio ?? 0}</span> ({result.slenderness?.isSlender ? 'Slender' : 'Short'})</p>
            <p>Design Moment (Mc): <span className="text-cyan-400 font-mono">{result.slenderness?.Mc ?? 0} kN·m</span></p>
            <p>Demand Capacity Ratio: <span className="text-emerald-400 font-mono">{result.capacity?.dcr ?? 0}</span></p>

            <button onClick={generatePDF} disabled={downloadingPdf} className="w-full mt-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2 rounded transition shadow-lg">
              {downloadingPdf ? 'Generating PDF...' : '📄 Download Column PDF Report'}
            </button>
          </div>
        )}
      </div>

      <div className="lg:col-span-7 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
            <h4 className="text-xs font-bold text-slate-300 mb-2 border-b border-slate-800 pb-1">ELEVATION VIEW</h4>
            <div className="bg-slate-950/60 p-2 rounded border border-slate-800 flex justify-center">
              <svg id="column-elevation-svg" viewBox="0 0 200 240" className="w-full h-44 drop-shadow-md">
                <line x1="100" y1="10" x2="100" y2="38" stroke="#ef4444" strokeWidth="3" />
                <polygon points="100,44 95,34 105,34" fill="#ef4444" />
                <text x="100" y="8" fill="#f87171" fontSize="10" textAnchor="middle" fontWeight="bold">Pu = {pu} kN</text>
                <rect x="70" y="45" width="60" height="8" fill="#475569" />
                <rect x="70" y="195" width="60" height="8" fill="#475569" />
                <path d="M 100 53 Q 125 124 100 195" fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeDasharray="4 2" />
                <rect x="88" y="53" width="24" height="142" fill="#64748b" fillOpacity="0.2" stroke="#64748b" strokeWidth="1" />
              </svg>
            </div>
          </div>

          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
            <h4 className="text-xs font-bold text-slate-300 mb-2 border-b border-slate-800 pb-1">SECTION ({width}×{depth}mm)</h4>
            <div className="bg-slate-950/60 p-2 rounded border border-slate-800 flex justify-center">
              <svg id="column-section-svg" viewBox="0 0 200 240" className="w-full h-44 drop-shadow-md">
                <rect x="40" y="40" width="120" height="120" fill="#1e293b" stroke="#94a3b8" strokeWidth="2" rx="4" />
                <rect x="52" y="52" width="96" height="96" fill="none" stroke="#0284c7" strokeWidth="1.5" rx="2" />
                {result?.bar_locations?.map((bar, idx) => {
                  const cx = 100 + (bar.x / (width / 2)) * 44;
                  const cy = 100 + (bar.y / (depth / 2)) * 44;
                  return <circle key={idx} cx={cx} cy={cy} r="5" fill="#38bdf8" stroke="#0284c7" strokeWidth="1" />;
                })}
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 p-5 rounded-xl border border-slate-800">
          <h3 className="text-xs font-bold text-slate-300 mb-2 border-b border-slate-800 pb-2 flex justify-between">
            <span>P-M INTERACTION ENVELOPE ({designCode})</span>
            <span className="text-cyan-400 font-mono">Pu: {pu} kN | Mc: {result?.slenderness?.Mc ?? m2} kNm</span>
          </h3>
          <div id="pm-chart-container" className="h-64 w-full bg-slate-950/70 p-2 rounded border border-slate-800">
            {result?.pm_envelope ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <LineChart data={result.pm_envelope}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="phiMn" type="number" stroke="#64748b" fontSize={10} unit=" kNm" />
                  <YAxis dataKey="phiPn" type="number" stroke="#64748b" fontSize={10} unit=" kN" />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '11px' }} />
                  <ReferenceLine y={pu} stroke="#f59e0b" strokeDasharray="3 3" />
                  <ReferenceDot
                    x={result.slenderness?.Mc ?? m2}
                    y={pu}
                    r={6}
                    fill={result.capacity?.status === 'SAFE' ? '#10b981' : '#ef4444'}
                    stroke="#ffffff"
                    strokeWidth={2}
                  />
                  <Line type="monotone" dataKey="phiPn" stroke="#38bdf8" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-slate-500 py-20">
                <p className="text-lg">P-M Curve will render here.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
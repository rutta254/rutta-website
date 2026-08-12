'use client';

import { useState } from 'react';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import jsPDF from 'jspdf';
autoTable;
import autoTable from 'jspdf-autotable';

type MaterialType = 'rc' | 'steel' | 'timber' | 'composite';
type DesignCode = 'ACI318' | 'BS8110' | 'EC2' | 'EC3' | 'AISC360' | 'EC5' | 'NDS' | 'EC4';

interface ColumnResult {
  material_type?: MaterialType;
  design_code?: DesignCode;
  inputs?: { width: number; depth: number; cover: number; fc: number; fy: number; numBars: number; barDiam: number; length: number; kFactor: number; pu: number; m1: number; m2: number };
  section_properties?: { Ag: number; Ast: number; rebarRatio: number };
  slenderness?: { klr?: number; limit?: number; isSlender?: boolean; Pcr?: number; delta_ns?: number; Mc?: number };
  capacity?: { phiPn_max?: number; dcr?: number; status?: 'SAFE' | 'OVERSTRESSED' };
  pm_envelope?: { c: number; Pn: number; Mn: number; phiPn: number; phiMn: number }[];
  bar_locations?: { x: number; y: number }[];
}

export default function ColumnAnalysisTool() {
  const [materialType, setMaterialType] = useState<MaterialType>('rc');
  const [designCode, setDesignCode] = useState<DesignCode>('ACI318');

  // Dimensions & Materials
  const [width, setWidth] = useState<number>(400);
  const [depth, setDepth] = useState<number>(400);
  const [cover, setCover] = useState<number>(40);
  const [fc, setFc] = useState<number>(30);
  const [fy, setFy] = useState<number>(420);

  // RC Rebar
  const [numBars, setNumBars] = useState<number>(8);
  const [barDiam, setBarDiam] = useState<number>(20);

  // Structural Steel / Timber
  const [fySteel, setFySteel] = useState<number>(355);
  const [fcTimber, setFcTimber] = useState<number>(24);
  const [kmodTimber, setKmodTimber] = useState<number>(0.8);

  // Boundary & Loads
  const [length, setLength] = useState<number>(3.5);
  const [kFactor, setKFactor] = useState<number>(1.0);
  const [endCondition, setEndCondition] = useState<number>(1);
  const [pu, setPu] = useState<number>(1200);
  const [m1, setM1] = useState<number>(80);
  const [m2, setM2] = useState<number>(120);

  const [result, setResult] = useState<ColumnResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const handleMaterialChange = (newMat: MaterialType) => {
    setMaterialType(newMat);
    if (newMat === 'rc') setDesignCode('ACI318');
    else if (newMat === 'steel') setDesignCode('EC3');
    else if (newMat === 'timber') setDesignCode('EC5');
    else if (newMat === 'composite') setDesignCode('EC4');
  };

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const payload = {
        element_type: 'column',
        material_type: materialType,
        design_code: designCode,
        width: Number(width),
        depth: Number(depth),
        cover: Number(cover),
        fc: Number(fc),
        fy: Number(fy),
        numBars: Number(numBars),
        barDiam: Number(barDiam),
        fy_steel: Number(fySteel),
        fc_timber: Number(fcTimber),
        k_mod: Number(kmodTimber),
        length: Number(length),
        kFactor: Number(kFactor),
        endCondition: Number(endCondition),
        pu: Number(pu),
        m1: Number(m1),
        m2: Number(m2),
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
      alert('Error solving column analysis.');
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

      // Compact Top Header
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 16, 'F');

      doc.setFontSize(11);
      doc.setTextColor(56, 189, 248);
      doc.text('HAYA STRUCTURES | COLUMN VERIFICATION REPORT', 12, 10);

      doc.setFontSize(7);
      doc.setTextColor(226, 232, 240);
      doc.text(`System: ${materialType.toUpperCase()} | Code: ${designCode} | Date: ${dateStr}`, 12, 14);

      // Summary Tables Side-by-Side
      autoTable(doc, {
        startY: 18,
        margin: { left: 12 },
        tableWidth: 90,
        head: [['Design Inputs', 'Value / Unit']],
        body: [
          ['Material', materialType.toUpperCase()],
          ['Code Standard', designCode],
          ['Section Profile', `${width} × ${depth} mm`],
          ['Column Length L', `${length} m`],
          ['Yield Strength', materialType === 'rc' ? `${fc} / ${fy} MPa` : `${fySteel} MPa`],
          ['Applied Axial Load Pu', `${pu} kN`],
        ],
        theme: 'grid',
        headStyles: { fillColor: [14, 116, 144], fontSize: 6.5, cellPadding: 1 },
        bodyStyles: { fontSize: 6.5, cellPadding: 1 },
      });

      autoTable(doc, {
        startY: 18,
        margin: { left: 108 },
        tableWidth: 90,
        head: [['Calculated Metrics', 'Output']],
        body: [
          ['Slenderness (KL/r)', `${result.slenderness?.klr ?? 0}`],
          ['Slenderness State', result.slenderness?.isSlender ? 'SLENDER' : 'SHORT'],
          ['Magnified Moment (Mc)', `${result.slenderness?.Mc ?? m2} kN·m`],
          ['Axial Capacity φPn,max', `${result.capacity?.phiPn_max ?? 0} kN`],
          ['Demand Capacity Ratio', `${result.capacity?.dcr ?? 0}`],
          ['Overall Status', result.capacity?.status ?? 'SAFE'],
        ],
        theme: 'grid',
        headStyles: { fillColor: [15, 118, 110], fontSize: 6.5, cellPadding: 1 },
        bodyStyles: { fontSize: 6.5, cellPadding: 1 },
      });

      let currentY = 56;

      const elevSvg = document.getElementById('column-elevation-svg') as unknown as SVGSVGElement;
      const secSvg = document.getElementById('column-section-svg') as unknown as SVGSVGElement;
      const pmSvg = document.querySelector('#pm-chart-container svg') as SVGSVGElement;

      if (elevSvg && secSvg) {
        try {
          const elevPng = await convertSvgToPng(elevSvg, '#0f172a');
          const secPng = await convertSvgToPng(secSvg, '#0f172a');
          doc.addImage(elevPng, 'PNG', 12, currentY, 90, 48);
          doc.addImage(secPng, 'PNG', 108, currentY, 90, 48);
          currentY += 52;
        } catch (e) {
          console.warn('SVG export failed:', e);
        }
      }

      if (pmSvg) {
        try {
          doc.setFontSize(7.5);
          doc.setTextColor(15, 23, 42);
          doc.text(`P-M INTERACTION DIAGRAM (${designCode})`, 12, currentY);
          currentY += 2;
          const pmPng = await convertSvgToPng(pmSvg, '#0f172a');
          doc.addImage(pmPng, 'PNG', 12, currentY, 186, 120);
        } catch (e) {
          console.warn('P-M Chart export failed:', e);
        }
      }

      doc.save(`Haya_Column_${materialType}_${designCode}_Report.pdf`);
    } catch (err) {
      console.error('PDF Generation error:', err);
      alert(`Failed to generate PDF: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Control Side Panel */}
      <div className="lg:col-span-5 space-y-4 bg-slate-900 p-5 rounded-xl border border-slate-800">
        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
          <h3 className="font-semibold text-slate-200">Column Inputs</h3>
          <select
            value={designCode}
            onChange={(e) => setDesignCode(e.target.value as DesignCode)}
            className="bg-cyan-500/20 text-cyan-400 font-bold border border-cyan-500/30 rounded px-2 py-1 text-xs"
          >
            {materialType === 'rc' && (
              <>
                <option value="ACI318">ACI 318-19</option>
                <option value="BS8110">BS 8110:1997</option>
                <option value="EC2">Eurocode 2 (EN 1992)</option>
              </>
            )}
            {materialType === 'steel' && (
              <>
                <option value="EC3">Eurocode 3 (EN 1993)</option>
                <option value="AISC360">AISC 360-16</option>
              </>
            )}
            {materialType === 'timber' && (
              <>
                <option value="EC5">Eurocode 5 (EN 1995)</option>
                <option value="NDS">NDS Timber Code</option>
              </>
            )}
            {materialType === 'composite' && <option value="EC4">Eurocode 4 (EN 1994)</option>}
          </select>
        </div>

        {/* Material System Selection Tabs */}
        <div className="grid grid-cols-4 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-center text-xs font-semibold">
          <button
            onClick={() => handleMaterialChange('rc')}
            className={`py-1.5 rounded transition ${materialType === 'rc' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
          >
            RC
          </button>
          <button
            onClick={() => handleMaterialChange('steel')}
            className={`py-1.5 rounded transition ${materialType === 'steel' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Steel
          </button>
          <button
            onClick={() => handleMaterialChange('timber')}
            className={`py-1.5 rounded transition ${materialType === 'timber' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Timber
          </button>
          <button
            onClick={() => handleMaterialChange('composite')}
            className={`py-1.5 rounded transition ${materialType === 'composite' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Composite
          </button>
        </div>

        {/* Geometry Inputs */}
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

        {/* Material Specs */}
        {materialType === 'rc' && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Cover (mm)</label>
                <input type="number" value={cover} onChange={(e) => setCover(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">f'c / fck (MPa)</label>
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
          </>
        )}

        {materialType === 'steel' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Yield Strength fy (MPa)</label>
              <input type="number" value={fySteel} onChange={(e) => setFySteel(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200" />
            </div>
          </div>
        )}

        {materialType === 'timber' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Compression fc,0 (MPa)</label>
              <input type="number" value={fcTimber} onChange={(e) => setFcTimber(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">kmod Factor</label>
              <input type="number" step="0.05" value={kmodTimber} onChange={(e) => setKmodTimber(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200" />
            </div>
          </div>
        )}

        {materialType === 'composite' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Steel fy (MPa)</label>
              <input type="number" value={fySteel} onChange={(e) => setFySteel(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Concrete f'c (MPa)</label>
              <input type="number" value={fc} onChange={(e) => setFc(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200" />
            </div>
          </div>
        )}

        {/* Boundary and Loading Inputs */}
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
          {loading ? 'Calculating P-M Envelope...' : `Run ${materialType.toUpperCase()} Column Analysis (${designCode})`}
        </button>

        {result && (
          <div className="mt-4 pt-4 border-t border-slate-800 space-y-2 text-sm bg-slate-950 p-3 rounded-lg border border-slate-800">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-slate-400 font-bold uppercase">{designCode} Verdict:</span>
              <span className={`text-xs px-2 py-0.5 rounded font-bold ${result.capacity?.status === 'SAFE' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                {result.capacity?.status}
              </span>
            </div>
            <p>Slenderness (KL/r): <span className="text-cyan-400 font-mono">{result.slenderness?.klr ?? 0}</span> ({result.slenderness?.isSlender ? 'Slender' : 'Short'})</p>
            <p>Magnified Moment (Mc): <span className="text-cyan-400 font-mono">{result.slenderness?.Mc ?? m2} kN·m</span></p>
            <p>Demand Capacity Ratio: <span className="text-emerald-400 font-mono">{result.capacity?.dcr ?? 0}</span></p>

            <button onClick={generatePDF} disabled={downloadingPdf} className="w-full mt-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2 rounded transition shadow-lg">
              {downloadingPdf ? 'Generating PDF...' : '📄 Download Column PDF Report'}
            </button>
          </div>
        )}
      </div>

      {/* Visual Report Display Section */}
      <div className="lg:col-span-7 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
            <h4 className="text-xs font-bold text-slate-300 mb-2 border-b border-slate-800 pb-1">ELEVATION VIEW ({materialType.toUpperCase()})</h4>
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
                {materialType === 'rc' && (
                  <>
                    <rect x="52" y="52" width="96" height="96" fill="none" stroke="#0284c7" strokeWidth="1.5" rx="2" />
                    {result?.bar_locations?.map((bar, idx) => {
                      const cx = 100 + (bar.x / (width / 2)) * 44;
                      const cy = 100 + (bar.y / (depth / 2)) * 44;
                      return <circle key={idx} cx={cx} cy={cy} r="5" fill="#38bdf8" stroke="#0284c7" strokeWidth="1" />;
                    })}
                  </>
                )}
                {materialType === 'steel' && (
                  <path d="M 55 50 H 145 V 65 H 108 V 175 H 145 V 190 H 55 V 175 H 92 V 65 H 55 Z" fill="#38bdf8" fillOpacity="0.8" stroke="#0284c7" />
                )}
              </svg>
            </div>
          </div>
        </div>

        {/* P-M Interaction Chart Rendered via ScatterChart with shape={() => null} */}
        <div className="bg-slate-900 p-5 rounded-xl border border-slate-800">
          <h3 className="text-xs font-bold text-slate-300 mb-2 border-b border-slate-800 pb-2 flex justify-between">
            <span>P-M INTERACTION ENVELOPE ({designCode})</span>
            <span className="text-cyan-400 font-mono">Pu: {pu} kN | Mc: {result?.slenderness?.Mc ?? m2} kNm</span>
          </h3>
          <div id="pm-chart-container" className="h-64 w-full bg-slate-950/70 p-2 rounded border border-slate-800">
            {result?.pm_envelope && result.pm_envelope.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="phiMn" type="number" stroke="#64748b" fontSize={10} name="Design Moment" unit=" kNm" />
                  <YAxis dataKey="phiPn" type="number" stroke="#64748b" fontSize={10} name="Design Axial Load" unit=" kN" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '11px' }}
                    formatter={(val: any, name: any) => [`${val}`, name === 'Design Moment' ? 'Moment (kNm)' : 'Axial (kN)']}
                  />

                  {/* P-M Capacity Envelope Boundary */}
                  <Scatter
                    name="P-M Envelope"
                    data={result.pm_envelope}
                    line
                    lineType="joint"
                    fill="#38bdf8"
                    stroke="#38bdf8"
                    strokeWidth={2.5}
                    shape={() => null}
                  />

                  {/* Demand Operating Point */}
                  <Scatter
                    name="Applied Demand (Mc, Pu)"
                    data={[{ phiMn: result.slenderness?.Mc ?? m2, phiPn: pu }]}
                    fill={result.capacity?.status === 'SAFE' ? '#10b981' : '#ef4444'}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-slate-500 py-20">
                <p className="text-lg">Click "Run Column Analysis" to generate the P-M Envelope.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
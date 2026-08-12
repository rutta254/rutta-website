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
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type DesignCode = 'ACI318' | 'BS8110' | 'EC2';
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
  design_code?: DesignCode;
  span?: number;
  reactions?: { R_A?: number; R_B?: number };
  critical_values?: {
    max_shear_force?: number;
    max_bending_moment?: number;
    max_deflection?: number;
  };
  design_verification?: {
    M_rd?: number;
    V_rd?: number;
    flexureDCR?: number;
    shearDCR?: number;
    overallDCR?: number;
    status?: 'SAFE' | 'OVERSTRESSED';
  };
  x_coords?: number[];
  shear_force?: number[];
  bending_moment?: number[];
}

export default function BeamAnalysisTool() {
  const [designCode, setDesignCode] = useState<DesignCode>('ACI318');
  const [length, setLength] = useState<number>(6);
  const [support, setSupport] = useState<SupportType>('simply_supported');

  // Section & Material Properties
  const [width, setWidth] = useState<number>(300);
  const [depth, setDepth] = useState<number>(500);
  const [cover, setCover] = useState<number>(35);
  const [fc, setFc] = useState<number>(25);
  const [fy, setFy] = useState<number>(460);
  const [numBarsBot, setNumBarsBot] = useState<number>(3);
  const [barDiamBot, setBarDiamBot] = useState<number>(16);
  const [stirrupDiam, setStirrupDiam] = useState<number>(8);
  const [stirrupSpacing, setStirrupSpacing] = useState<number>(150);

  const [loads, setLoads] = useState<LoadItem[]>([
    { id: '1', type: 'point', magnitude: 15, position: 3 },
  ]);

  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const addLoad = () => {
    setLoads([
      ...loads,
      { id: Date.now().toString(), type: 'point', magnitude: 10, position: length / 2 },
    ]);
  };

  const removeLoad = (id: string) => {
    setLoads(loads.filter((l) => l.id !== id));
  };

  const updateLoad = (id: string, field: keyof LoadItem, value: string | number) => {
    setLoads(loads.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  };

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const payload = {
        element_type: 'beam',
        design_code: designCode,
        span: Number(length),
        support,
        width: Number(width),
        depth: Number(depth),
        cover: Number(cover),
        fc: Number(fc),
        fy: Number(fy),
        numBarsBot: Number(numBarsBot),
        barDiamBot: Number(barDiamBot),
        stirrupDiam: Number(stirrupDiam),
        stirrupSpacing: Number(stirrupSpacing),
        loads: loads.map((l) => ({
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
      alert('Error connecting to backend API or computing structural response.');
    } finally {
      setLoading(false);
    }
  };

  const convertSvgToPng = (svgElement: SVGSVGElement, bgColor = '#0f172a'): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
        const bbox = svgElement.getBoundingClientRect();
        const w = bbox.width || 800;
        const h = bbox.height || 220;

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
      doc.text(`Beam Multi-Code Verification Report (${designCode}) | Date: ${dateStr}`, 14, 16);
      doc.line(14, 19, 196, 19);

      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text('1. Design Inputs & Structural Capacity Summary', 14, 24);

      autoTable(doc, {
        startY: 27,
        margin: { left: 14 },
        tableWidth: 88,
        head: [['Parameter', 'Value', 'Unit']],
        body: [
          ['Design Code', `${designCode}`, '-'],
          ['Span Length (L)', `${result.span ?? length}`, 'm'],
          ['Section (b × h)', `${width} × ${depth}`, 'mm'],
          ['Concrete / Steel Grade', `${fc} / ${fy}`, 'MPa'],
          ['Main Rebar', `${numBarsBot} - Ø${barDiamBot}`, '-'],
        ],
        theme: 'striped',
        headStyles: { fillColor: [14, 116, 144], fontSize: 7, cellPadding: 1 },
        bodyStyles: { fontSize: 7, cellPadding: 1 },
      });

      const getFinalY = (pdfDoc: jsPDF) =>
        (pdfDoc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 45;

      const leftYTotal = getFinalY(doc);

      autoTable(doc, {
        startY: 27,
        margin: { left: 106 },
        tableWidth: 90,
        head: [['Metric Description', 'Value', 'Status / Unit']],
        body: [
          ['Max Applied Moment |M_max|', `${result.critical_values?.max_bending_moment ?? 0}`, 'kN·m'],
          ['Design Moment Capacity', `${result.design_verification?.M_rd ?? 0}`, 'kN·m'],
          ['Max Applied Shear |V_max|', `${result.critical_values?.max_shear_force ?? 0}`, 'kN'],
          ['Design Shear Capacity', `${result.design_verification?.V_rd ?? 0}`, 'kN'],
          ['Overall DCR Status', `${result.design_verification?.overallDCR ?? 0}`, result.design_verification?.status ?? 'N/A'],
        ],
        theme: 'striped',
        headStyles: { fillColor: [15, 118, 110], fontSize: 7, cellPadding: 1 },
        bodyStyles: { fontSize: 7, cellPadding: 1 },
      });

      const rightYTotal = getFinalY(doc);
      let currentY = Math.max(leftYTotal, rightYTotal) + 5;

      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text('2. Structural Visualizations (SFD & BMD)', 14, currentY);
      currentY += 3;

      const beamSvg = document.getElementById('live-beam-svg') as unknown as SVGSVGElement;
      const sfdSvg = document.querySelector('#sfd-chart-container svg') as SVGSVGElement;
      const bmdSvg = document.querySelector('#bmd-chart-container svg') as SVGSVGElement;

      if (beamSvg) {
        try {
          const beamPng = await convertSvgToPng(beamSvg, '#0f172a');
          doc.addImage(beamPng, 'PNG', 14, currentY, 182, 36);
          currentY += 39;
        } catch (e) {
          console.warn('Beam SVG export failed:', e);
        }
      }

      if (sfdSvg) {
        try {
          const sfdPng = await convertSvgToPng(sfdSvg, '#0f172a');
          doc.addImage(sfdPng, 'PNG', 14, currentY, 182, 46);
          currentY += 49;
        } catch (e) {
          console.warn('SFD SVG export failed:', e);
        }
      }

      if (bmdSvg) {
        try {
          const bmdPng = await convertSvgToPng(bmdSvg, '#0f172a');
          doc.addImage(bmdPng, 'PNG', 14, currentY, 182, 46);
        } catch (e) {
          console.warn('BMD SVG export failed:', e);
        }
      }

      doc.save(`Haya_Structures_Beam_${designCode}_Report.pdf`);
    } catch (err) {
      console.error('PDF Generation error:', err);
      alert(`Failed to generate PDF report: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const chartData =
    result?.x_coords?.map((x: number, i: number) => ({
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
  const getX = (val: number) => marginX + val * scaleX;

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
      {/* Control Panel Column */}
      <div className="lg:col-span-5 space-y-4 bg-slate-900 p-5 rounded-xl border border-slate-800">
        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
          <h3 className="font-semibold text-slate-200">Beam Controls & Materials</h3>
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
            <label className="block text-xs text-slate-400 mb-1">Span Length L (m)</label>
            <input
              type="number"
              value={length}
              onChange={(e) => setLength(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Support Type</label>
            <select
              value={support}
              onChange={(e) => setSupport(e.target.value as SupportType)}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200"
            >
              <option value="simply_supported">Simply Supported</option>
              <option value="cantilever">Cantilever</option>
              <option value="fixed_fixed">Fixed - Fixed</option>
              <option value="propped_cantilever">Propped Cantilever</option>
            </select>
          </div>
        </div>

        {/* Cross Section Properties */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-[10px] text-slate-400">Width b (mm)</label>
            <input type="number" value={width} onChange={(e) => setWidth(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200" />
          </div>
          <div>
            <label className="block text-[10px] text-slate-400">Depth h (mm)</label>
            <input type="number" value={depth} onChange={(e) => setDepth(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200" />
          </div>
          <div>
            <label className="block text-[10px] text-slate-400">{designCode === 'BS8110' ? 'fcu' : 'f\'c / fck'} (MPa)</label>
            <input type="number" value={fc} onChange={(e) => setFc(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200" />
          </div>
        </div>

        {/* Reinforcement Details */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] text-slate-400">Tensile Rebar (N - Ø)</label>
            <div className="flex space-x-1">
              <input type="number" placeholder="N" value={numBarsBot} onChange={(e) => setNumBarsBot(Number(e.target.value))} className="w-1/2 bg-slate-950 border border-slate-800 rounded p-1 text-xs text-slate-200" />
              <input type="number" placeholder="Ø" value={barDiamBot} onChange={(e) => setBarDiamBot(Number(e.target.value))} className="w-1/2 bg-slate-950 border border-slate-800 rounded p-1 text-xs text-slate-200" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] text-slate-400">Stirrups (Ø / Pitch)</label>
            <div className="flex space-x-1">
              <input type="number" placeholder="Ø" value={stirrupDiam} onChange={(e) => setStirrupDiam(Number(e.target.value))} className="w-1/2 bg-slate-950 border border-slate-800 rounded p-1 text-xs text-slate-200" />
              <input type="number" placeholder="s" value={stirrupSpacing} onChange={(e) => setStirrupSpacing(Number(e.target.value))} className="w-1/2 bg-slate-950 border border-slate-800 rounded p-1 text-xs text-slate-200" />
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-800 space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="font-semibold text-slate-200 text-sm">Applied Loads Configuration</h4>
            <button onClick={addLoad} className="text-xs bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 px-2.5 py-1 rounded hover:bg-cyan-500/30 transition">
              + Add Load
            </button>
          </div>

          <div className="space-y-3 max-h-40 overflow-y-auto pr-1">
            {loads.map((loadItem, index) => (
              <div key={loadItem.id} className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-cyan-400">Load #{index + 1}</span>
                  {loads.length > 1 && (
                    <button onClick={() => removeLoad(loadItem.id)} className="text-red-400 hover:text-red-300 text-xs">Remove</button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <select value={loadItem.type} onChange={(e) => updateLoad(loadItem.id, 'type', e.target.value)} className="bg-slate-900 border border-slate-800 rounded p-1 text-xs text-slate-200">
                    <option value="point">Point (kN)</option>
                    <option value="udl">UDL (kN/m)</option>
                    <option value="moment">Moment (kNm)</option>
                  </select>
                  <input type="number" value={loadItem.magnitude} onChange={(e) => updateLoad(loadItem.id, 'magnitude', Number(e.target.value))} className="bg-slate-900 border border-slate-800 rounded p-1 text-xs text-slate-200" />
                  <input type="number" value={loadItem.position} onChange={(e) => updateLoad(loadItem.id, 'position', Number(e.target.value))} className="bg-slate-900 border border-slate-800 rounded p-1 text-xs text-slate-200" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <button onClick={handleAnalyze} disabled={loading} className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold py-2.5 rounded transition disabled:opacity-50 mt-4">
          {loading ? 'Solving Response...' : `Run Beam Analysis (${designCode})`}
        </button>

        {result && (
          <div className="mt-4 pt-4 border-t border-slate-800 space-y-2 text-sm bg-slate-950 p-3 rounded-lg border border-slate-800">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-slate-400 font-bold uppercase">{designCode} Verdict:</span>
              <span className={`text-xs px-2 py-0.5 rounded font-bold ${result.design_verification?.status === 'SAFE' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                {result.design_verification?.status}
              </span>
            </div>
            <p>Moment Capacity (M_rd): <span className="text-cyan-400 font-mono">{result.design_verification?.M_rd ?? 0} kN·m</span> (DCR: {result.design_verification?.flexureDCR ?? 0})</p>
            <p>Shear Capacity (V_rd): <span className="text-cyan-400 font-mono">{result.design_verification?.V_rd ?? 0} kN</span> (DCR: {result.design_verification?.shearDCR ?? 0})</p>

            <button onClick={generatePDF} disabled={downloadingPdf} className="w-full mt-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2 rounded transition shadow-lg">
              {downloadingPdf ? 'Generating PDF...' : '📄 Download PDF Report'}
            </button>
          </div>
        )}
      </div>

      {/* Visual Report Display Section */}
      <div className="lg:col-span-7 space-y-6">
        <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 flex flex-col justify-center">
          <h3 className="text-xs font-bold text-slate-300 mb-4 border-b border-slate-800 pb-2">LIVE BEAM VISUALIZATION</h3>
          <div className="w-full overflow-hidden bg-slate-950/50 rounded-lg border border-slate-800 mb-2 flex justify-center p-4">
            <svg id="live-beam-svg" viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto max-h-48 drop-shadow-md">
              <line x1={marginX} y1={beamY + 60} x2={marginX + beamWidth} y2={beamY + 60} stroke="#475569" strokeWidth="1" />
              <text x={marginX + beamWidth / 2} y={beamY + 80} fill="#94a3b8" fontSize="14" textAnchor="middle" fontWeight="bold">Span (L) = {length}m</text>
              <rect x={marginX} y={beamY} width={beamWidth} height={beamThickness} fill="#94a3b8" rx="2" />
              {support === 'simply_supported' && (<>{drawPin(marginX)}{drawPin(marginX + beamWidth)}</>)}
              {support === 'cantilever' && drawFixed(marginX, true)}
              {support === 'fixed_fixed' && (<>{drawFixed(marginX, true)}{drawFixed(marginX + beamWidth, false)}</>)}
              {support === 'propped_cantilever' && (<>{drawFixed(marginX, true)}{drawPin(marginX + beamWidth)}</>)}
            </svg>
          </div>
        </div>

        {/* SFD & BMD Charts */}
        <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 flex flex-col justify-center">
          {chartData.length > 0 ? (
            <div className="space-y-6 bg-slate-900 p-3 rounded-lg">
              <div>
                <h4 className="text-xs font-semibold text-cyan-400 mb-1 uppercase">Shear Force Diagram (SFD) [kN]</h4>
                <div id="sfd-chart-container" className="h-48 w-full bg-slate-950/70 p-2 rounded border border-slate-800">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="x" stroke="#64748b" fontSize={10} unit="m" />
                      <YAxis stroke="#64748b" fontSize={10} unit="kN" />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '11px' }} />
                      <ReferenceLine y={0} stroke="#475569" strokeWidth={1.5} />
                      <Line type="monotone" dataKey="Shear" stroke="#38bdf8" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-emerald-400 mb-1 uppercase">Bending Moment Diagram (BMD) [kN·m]</h4>
                <div id="bmd-chart-container" className="h-48 w-full bg-slate-950/70 p-2 rounded border border-slate-800">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="x" stroke="#64748b" fontSize={10} unit="m" />
                      <YAxis stroke="#64748b" fontSize={10} unit="kN·m" />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '11px' }} />
                      <ReferenceLine y={0} stroke="#475569" strokeWidth={1.5} />
                      <Line type="monotone" dataKey="Moment" stroke="#34d399" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-slate-500 py-16">
              <p className="text-lg">SFD & BMD will render here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
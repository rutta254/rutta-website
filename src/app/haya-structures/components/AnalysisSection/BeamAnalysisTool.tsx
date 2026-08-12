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

type MaterialType = 'rc' | 'steel' | 'timber' | 'composite';
type DesignCode = 'ACI318' | 'BS8110' | 'EC2' | 'EC3' | 'AISC360' | 'EC5' | 'NDS' | 'EC4';
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
  material_type?: MaterialType;
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
  const [materialType, setMaterialType] = useState<MaterialType>('rc');
  const [designCode, setDesignCode] = useState<DesignCode>('ACI318');
  const [length, setLength] = useState<number>(6);
  const [support, setSupport] = useState<SupportType>('simply_supported');

  // RC Section & Material Properties
  const [width, setWidth] = useState<number>(300);
  const [depth, setDepth] = useState<number>(500);
  const [cover, setCover] = useState<number>(35);
  const [fc, setFc] = useState<number>(25);
  const [fy, setFy] = useState<number>(460);
  const [numBarsBot, setNumBarsBot] = useState<number>(3);
  const [barDiamBot, setBarDiamBot] = useState<number>(16);
  const [stirrupDiam, setStirrupDiam] = useState<number>(8);
  const [stirrupSpacing, setStirrupSpacing] = useState<number>(150);

  // Steel Properties
  const [fySteel, setFySteel] = useState<number>(355);
  const [zxSteel, setZxSteel] = useState<number>(1200);

  // Timber Properties
  const [fmTimber, setFmTimber] = useState<number>(24);
  const [kmodTimber, setKmodTimber] = useState<number>(0.8);

  // Loads & Results
  const [loads, setLoads] = useState<LoadItem[]>([
    { id: '1', type: 'point', magnitude: 15, position: 3 },
    { id: '2', type: 'udl', magnitude: 10, position: 0, length: 6 },
  ]);

  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const handleMaterialChange = (newMat: MaterialType) => {
    setMaterialType(newMat);
    if (newMat === 'rc') setDesignCode('ACI318');
    else if (newMat === 'steel') setDesignCode('EC3');
    else if (newMat === 'timber') setDesignCode('EC5');
    else if (newMat === 'composite') setDesignCode('EC4');
  };

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
        material_type: materialType,
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
        fy_steel: Number(fySteel),
        Zx: Number(zxSteel),
        f_m: Number(fmTimber),
        k_mod: Number(kmodTimber),
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

      // Compact Header (Height: 16mm)
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 16, 'F');
      
      doc.setFontSize(11);
      doc.setTextColor(56, 189, 248);
      doc.text('HAYA STRUCTURES | STRUCTURAL BEAM VERIFICATION REPORT', 12, 10);
      
      doc.setFontSize(7);
      doc.setTextColor(226, 232, 240);
      doc.text(`Material: ${materialType.toUpperCase()} | Code: ${designCode} | Date: ${dateStr}`, 12, 14);

      // Compact Side-by-Side Tables (Y: 18mm - 55mm)
      autoTable(doc, {
        startY: 18,
        margin: { left: 12 },
        tableWidth: 90,
        head: [['Design Input Parameter', 'Value / Unit']],
        body: [
          ['Material Class', materialType.toUpperCase()],
          ['Design Code', designCode],
          ['Span Length (L)', `${result.span ?? length} m`],
          ['Section Profile', `${width} × ${depth} mm`],
          ['Material Yield Strength', materialType === 'rc' ? `${fy} MPa` : `${fySteel} MPa`],
        ],
        theme: 'grid',
        headStyles: { fillColor: [14, 116, 144], fontSize: 6.5, cellPadding: 1 },
        bodyStyles: { fontSize: 6.5, cellPadding: 1 },
      });

      autoTable(doc, {
        startY: 18,
        margin: { left: 108 },
        tableWidth: 90,
        head: [['Verification Metric', 'Calculated Output']],
        body: [
          ['Max Applied Moment |M_max|', `${result.critical_values?.max_bending_moment ?? 0} kN·m`],
          ['Design Moment Capacity (M_rd)', `${result.design_verification?.M_rd ?? 0} kN·m`],
          ['Max Applied Shear |V_max|', `${result.critical_values?.max_shear_force ?? 0} kN`],
          ['Design Shear Capacity (V_rd)', `${result.design_verification?.V_rd ?? 0} kN`],
          ['Overall DCR Status', `${result.design_verification?.overallDCR ?? 0} [${result.design_verification?.status}]`],
        ],
        theme: 'grid',
        headStyles: { fillColor: [15, 118, 110], fontSize: 6.5, cellPadding: 1 },
        bodyStyles: { fontSize: 6.5, cellPadding: 1 },
      });

      let currentY = 56;

      // Render Visualizations with Tight Vertical Offsets
      const beamSvg = document.getElementById('live-beam-svg') as unknown as SVGSVGElement;
      const sfdSvg = document.querySelector('#sfd-chart-container svg') as SVGSVGElement;
      const bmdSvg = document.querySelector('#bmd-chart-container svg') as SVGSVGElement;

      if (beamSvg) {
        try {
          const beamPng = await convertSvgToPng(beamSvg, '#0f172a');
          doc.addImage(beamPng, 'PNG', 12, currentY, 186, 42);
          currentY += 45;
        } catch (e) {
          console.warn('Beam SVG export failed:', e);
        }
      }

      if (sfdSvg) {
        try {
          doc.setFontSize(7.5);
          doc.setTextColor(15, 23, 42);
          doc.text('SHEAR FORCE DIAGRAM (SFD) [kN]', 12, currentY);
          currentY += 2;
          const sfdPng = await convertSvgToPng(sfdSvg, '#0f172a');
          doc.addImage(sfdPng, 'PNG', 12, currentY, 186, 85);
          currentY += 88;
        } catch (e) {
          console.warn('SFD SVG export failed:', e);
        }
      }

      if (bmdSvg) {
        try {
          doc.setFontSize(7.5);
          doc.setTextColor(15, 23, 42);
          doc.text('BENDING MOMENT DIAGRAM (BMD) [kN·m]', 12, currentY);
          currentY += 2;
          const bmdPng = await convertSvgToPng(bmdSvg, '#0f172a');
          doc.addImage(bmdPng, 'PNG', 12, currentY, 186, 85);
        } catch (e) {
          console.warn('BMD SVG export failed:', e);
        }
      }

      doc.save(`Haya_Beam_${materialType}_${designCode}_Report.pdf`);
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
  const beamY = 130;
  const beamThickness = 12;
  const getX = (val: number) => marginX + Math.min(Math.max(val, 0), length) * scaleX;

  const drawPin = (x: number) => (
    <g key={`pin-${x}`}>
      <polygon points={`${x},${beamY + beamThickness} ${x - 12},${beamY + beamThickness + 20} ${x + 12},${beamY + beamThickness + 20}`} fill="#64748b" />
      <line x1={x - 16} y1={beamY + beamThickness + 20} x2={x + 16} y2={beamY + beamThickness + 20} stroke="#64748b" strokeWidth="3" />
    </g>
  );

  const drawFixed = (x: number, isLeft: boolean) => (
    <g key={`fixed-${x}`}>
      <rect x={isLeft ? x - 12 : x} y={beamY - 25} width="12" height={50 + beamThickness} fill="#475569" />
      <line x1={isLeft ? x - 12 : x + 12} y1={beamY - 25} x2={isLeft ? x - 12 : x + 12} y2={beamY + 25 + beamThickness} stroke="#94a3b8" strokeWidth="2" strokeDasharray="3 3" />
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
            {materialType === 'composite' && (
              <option value="EC4">Eurocode 4 (EN 1994)</option>
            )}
          </select>
        </div>

        {/* Material Selection Tabs */}
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

        {/* Dynamic Material Specific Inputs */}
        {materialType === 'rc' && (
          <>
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
                <label className="block text-[10px] text-slate-400">f'c / fck (MPa)</label>
                <input type="number" value={fc} onChange={(e) => setFc(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200" />
              </div>
            </div>

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
          </>
        )}

        {materialType === 'steel' && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-slate-400">Yield Strength fy (MPa)</label>
              <input type="number" value={fySteel} onChange={(e) => setFySteel(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200" />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400">Plastic Modulus Zx (cm³)</label>
              <input type="number" value={zxSteel} onChange={(e) => setZxSteel(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200" />
            </div>
          </div>
        )}

        {materialType === 'timber' && (
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
              <label className="block text-[10px] text-slate-400">Bending fm (MPa)</label>
              <input type="number" value={fmTimber} onChange={(e) => setFmTimber(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200" />
            </div>
          </div>
        )}

        {materialType === 'composite' && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-slate-400">Steel Zx (cm³)</label>
              <input type="number" value={zxSteel} onChange={(e) => setZxSteel(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200" />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400">Concrete f'c (MPa)</label>
              <input type="number" value={fc} onChange={(e) => setFc(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200" />
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-slate-800 space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="font-semibold text-slate-200 text-sm">Applied Loads Configuration</h4>
            <button onClick={addLoad} className="text-xs bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 px-2.5 py-1 rounded hover:bg-cyan-500/30 transition">
              + Add Load
            </button>
          </div>

          <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
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
                    <option value="triangular">Triangular (kN/m)</option>
                  </select>
                  <div>
                    <label className="block text-[9px] text-slate-500">Mag</label>
                    <input type="number" value={loadItem.magnitude} onChange={(e) => updateLoad(loadItem.id, 'magnitude', Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded p-1 text-xs text-slate-200" />
                  </div>
                  <div>
                    <label className="block text-[9px] text-slate-500">Pos (m)</label>
                    <input type="number" value={loadItem.position} onChange={(e) => updateLoad(loadItem.id, 'position', Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded p-1 text-xs text-slate-200" />
                  </div>
                </div>

                {(loadItem.type === 'udl' || loadItem.type === 'triangular') && (
                  <div>
                    <label className="block text-[9px] text-slate-500">Loaded Span Length (m)</label>
                    <input type="number" placeholder="Length" value={loadItem.length ?? length - loadItem.position} onChange={(e) => updateLoad(loadItem.id, 'length', Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded p-1 text-xs text-slate-200" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <button onClick={handleAnalyze} disabled={loading} className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold py-2.5 rounded transition disabled:opacity-50 mt-4">
          {loading ? 'Solving Response...' : `Run ${materialType.toUpperCase()} Beam Analysis (${designCode})`}
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
          <h3 className="text-xs font-bold text-slate-300 mb-4 border-b border-slate-800 pb-2">LIVE BEAM VISUALIZATION ({materialType.toUpperCase()})</h3>
          <div className="w-full overflow-hidden bg-slate-950/50 rounded-lg border border-slate-800 mb-2 flex justify-center p-4">
            <svg id="live-beam-svg" viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto max-h-56 drop-shadow-md">
              {/* Span Centerline */}
              <line x1={marginX} y1={beamY + 50} x2={marginX + beamWidth} y2={beamY + 50} stroke="#475569" strokeWidth="1" />
              <text x={marginX + beamWidth / 2} y={beamY + 68} fill="#94a3b8" fontSize="13" textAnchor="middle" fontWeight="bold">
                Span (L) = {length}m
              </text>

              {/* Solid Beam Element */}
              <rect x={marginX} y={beamY} width={beamWidth} height={beamThickness} fill="#94a3b8" rx="2" />

              {/* Render Applied Loads Dynamic Overlay */}
              {loads.map((load, idx) => {
                const xStart = getX(load.position);

                if (load.type === 'point') {
                  return (
                    <g key={load.id || idx}>
                      <line x1={xStart} y1={55} x2={xStart} y2={beamY - 2} stroke="#ef4444" strokeWidth="3" />
                      <polygon points={`${xStart},${beamY} ${xStart - 5},${beamY - 10} ${xStart + 5},${beamY - 10}`} fill="#ef4444" />
                      <text x={xStart} y={46} fill="#f87171" fontSize="11" textAnchor="middle" fontWeight="bold">
                        P{idx + 1}: {load.magnitude} kN
                      </text>
                    </g>
                  );
                }

                if (load.type === 'udl') {
                  const uLen = load.length && load.length > 0 ? load.length : length - load.position;
                  const xEnd = getX(load.position + uLen);
                  const widthPx = Math.max(xEnd - xStart, 10);
                  const arrowCount = Math.max(3, Math.floor(widthPx / 25));
                  const step = widthPx / (arrowCount - 1);

                  return (
                    <g key={load.id || idx}>
                      <line x1={xStart} y1={85} x2={xEnd} y2={85} stroke="#38bdf8" strokeWidth="2" />
                      {Array.from({ length: arrowCount }).map((_, aIdx) => {
                        const ax = xStart + aIdx * step;
                        return (
                          <g key={aIdx}>
                            <line x1={ax} y1={85} x2={ax} y2={beamY - 2} stroke="#38bdf8" strokeWidth="1.5" />
                            <polygon points={`${ax},${beamY} ${ax - 3},${beamY - 6} ${ax + 3},${beamY - 6}`} fill="#38bdf8" />
                          </g>
                        );
                      })}
                      <text x={xStart + widthPx / 2} y={77} fill="#38bdf8" fontSize="10" textAnchor="middle" fontWeight="bold">
                        w{idx + 1}: {load.magnitude} kN/m
                      </text>
                    </g>
                  );
                }

                if (load.type === 'moment') {
                  return (
                    <g key={load.id || idx}>
                      <path d={`M ${xStart - 16} ${beamY - 10} A 18 18 0 1 1 ${xStart + 16} ${beamY - 10}`} fill="none" stroke="#f59e0b" strokeWidth="2.5" />
                      <polygon points={`${xStart + 16},${beamY - 10} ${xStart + 22},${beamY - 16} ${xStart + 10},${beamY - 16}`} fill="#f59e0b" />
                      <text x={xStart} y={beamY - 34} fill="#fbbf24" fontSize="11" textAnchor="middle" fontWeight="bold">
                        M{idx + 1}: {load.magnitude} kNm
                      </text>
                    </g>
                  );
                }

                if (load.type === 'triangular') {
                  const tLen = load.length && load.length > 0 ? load.length : length - load.position;
                  const xEnd = getX(load.position + tLen);
                  const widthPx = Math.max(xEnd - xStart, 10);
                  const arrowCount = Math.max(3, Math.floor(widthPx / 22));
                  const step = widthPx / (arrowCount - 1);

                  return (
                    <g key={load.id || idx}>
                      <line x1={xStart} y1={beamY} x2={xEnd} y2={75} stroke="#a855f7" strokeWidth="2" />
                      {Array.from({ length: arrowCount }).map((_, aIdx) => {
                        const ax = xStart + aIdx * step;
                        const topY = beamY - (aIdx / (arrowCount - 1)) * (beamY - 75);
                        if (topY >= beamY - 4) return null;
                        return (
                          <g key={aIdx}>
                            <line x1={ax} y1={topY} x2={ax} y2={beamY - 2} stroke="#a855f7" strokeWidth="1.5" />
                            <polygon points={`${ax},${beamY} ${ax - 3},${beamY - 6} ${ax + 3},${beamY - 6}`} fill="#a855f7" />
                          </g>
                        );
                      })}
                      <text x={xEnd} y={67} fill="#c084fc" fontSize="10" textAnchor="middle" fontWeight="bold">
                        {load.magnitude} kN/m
                      </text>
                    </g>
                  );
                }

                return null;
              })}

              {/* Render Structural Boundary Supports */}
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
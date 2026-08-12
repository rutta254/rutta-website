'use client';

import { useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type DesignCode = 'ACI318' | 'EC2' | 'BS8110';
type SlabSystem = 'one_way_solid' | 'two_way_solid' | 'flat_plate' | 'flat_slab';
type SupportCondition = 'simply_supported' | 'continuous' | 'cantilever' | 'restrained_4edges';

interface SlabResult {
  slab_type?: string;
  slab_system?: SlabSystem;
  design_code?: DesignCode;
  support_condition?: SupportCondition;
  inputs?: {
    lx: number;
    ly: number;
    thickness: number;
    total_h?: number;
    cover: number;
    fc: number;
    fy: number;
    dead_load: number;
    live_load: number;
    bar_diam: number;
    bar_spacing: number;
    bar_diam_y: number;
    bar_spacing_y: number;
    col_w?: number;
    col_h?: number;
  };
  loads?: {
    self_weight: number;
    total_dead: number;
    wu: number;
  };
  moments?: {
    Mu_x: number;
    Mu_y: number;
    Vu: number;
    Vu_punch?: number;
  };
  capacity?: {
    phiMn: number;
    phiMn_y: number;
    phiVc: number;
    phiVc_punch?: number;
    bo?: number;
    As_provided: number;
    As_provided_y: number;
    As_min: number;
  };
  dcr?: {
    flexure_dcr: number;
    shear_dcr: number;
    punching_dcr?: number;
    overall_dcr: number;
  };
  deflection?: {
    actual_ratio: number;
    max_ratio: number;
    status: string;
  };
  verification?: {
    flexure_dcr: number;
    shear_dcr: number;
    punching_dcr?: number;
    overall_dcr: number;
    failure_mode?: string;
    rebar_status: string;
    status: 'SAFE' | 'OVERSTRESSED';
  };
}

export default function SlabAnalysisTool() {
  const [designCode, setDesignCode] = useState<DesignCode>('ACI318');
  const [slabSystem, setSlabSystem] = useState<SlabSystem>('flat_plate');
  const [supportCondition, setSupportCondition] = useState<SupportCondition>('simply_supported');

  // Geometry
  const [lx, setLx] = useState<number>(4.0);
  const [ly, setLy] = useState<number>(6.0);
  const [thickness, setThickness] = useState<number>(180);
  const [cover, setCover] = useState<number>(25);

  // Column / Drop Panel Geometry (Punching Shear)
  const [colW, setColW] = useState<number>(400);
  const [colH, setColH] = useState<number>(400);
  const [dropPanelT, setDropPanelT] = useState<number>(50);

  // Materials
  const [fc, setFc] = useState<number>(30);
  const [fy, setFy] = useState<number>(420);

  // Loads
  const [deadLoad, setDeadLoad] = useState<number>(1.5);
  const [liveLoad, setLiveLoad] = useState<number>(3.0);

  // Reinforcement (Short Span / X)
  const [barDiam, setBarDiam] = useState<number>(12);
  const [barSpacing, setBarSpacing] = useState<number>(150);

  // Reinforcement (Long Span / Y)
  const [barDiamY, setBarDiamY] = useState<number>(10);
  const [barSpacingY, setBarSpacingY] = useState<number>(200);

  const [result, setResult] = useState<SlabResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const isPunchingRelevant = slabSystem === 'flat_plate' || slabSystem === 'flat_slab';

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const payload = {
        element_type: 'slab',
        design_code: designCode,
        slab_system: slabSystem,
        support_condition: supportCondition,
        lx: Number(lx),
        ly: Number(ly),
        thickness: Number(thickness),
        cover: Number(cover),
        fc: Number(fc),
        fy: Number(fy),
        dead_load: Number(deadLoad),
        live_load: Number(liveLoad),
        bar_diam: Number(barDiam),
        bar_spacing: Number(barSpacing),
        bar_diam_y: Number(barDiamY),
        bar_spacing_y: Number(barSpacingY),
        col_w: Number(colW),
        col_h: Number(colH),
        drop_panel_t: Number(dropPanelT),
      };

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
      alert('Error conducting slab structural analysis.');
    } finally {
      setLoading(false);
    }
  };

  const convertSvgToPng = (svgElement: SVGSVGElement, bgColor = '#0f172a'): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
        const bbox = svgElement.getBoundingClientRect();
        const w = bbox.width || 500;
        const h = bbox.height || 250;

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

      // Top Banner Header
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 16, 'F');

      doc.setFontSize(11);
      doc.setTextColor(56, 189, 248);
      doc.text('HAYA STRUCTURES | RC SLAB VERIFICATION REPORT', 12, 10);

      doc.setFontSize(7);
      doc.setTextColor(226, 232, 240);
      doc.text(`Code Standard: ${designCode} | System: ${result.slab_type} | Date: ${dateStr}`, 12, 14);

      // Section 1: Inputs & Design Summary Tables Side-by-Side
      autoTable(doc, {
        startY: 20,
        margin: { left: 12 },
        tableWidth: 90,
        head: [['Design Input Parameter', 'Value / Unit']],
        body: [
          ['Slab System Type', result.slab_type ?? 'Flat Plate'],
          ['Short Span (Lx)', `${lx} m`],
          ['Long Span (Ly)', `${ly} m`],
          ['Aspect Ratio (Ly/Lx)', `${(ly / lx).toFixed(2)}`],
          ['Slab Thickness (h)', `${thickness} mm`],
          ...(slabSystem === 'flat_slab' ? [['Drop Panel Thickness', `+${dropPanelT} mm`]] : []),
          ...(isPunchingRelevant ? [['Column Size (c1 x c2)', `${colW} x ${colH} mm`]] : []),
          ['Concrete Cover (c)', `${cover} mm`],
          ['Concrete Strength (f\'c / fck)', `${fc} MPa`],
          ['Steel Yield Strength (fy)', `${fy} MPa`],
          ['Superimposed Dead Load', `${deadLoad} kN/m²`],
          ['Live Load (LL)', `${liveLoad} kN/m²`],
          ['Primary Rebar (X)', `T${barDiam} @ ${barSpacing} mm`],
          ['Secondary Rebar (Y)', `T${barDiamY} @ ${barSpacingY} mm`],
        ],
        theme: 'grid',
        headStyles: { fillColor: [14, 116, 144], fontSize: 6.5, cellPadding: 1 },
        bodyStyles: { fontSize: 6.5, cellPadding: 1 },
      });

      autoTable(doc, {
        startY: 20,
        margin: { left: 108 },
        tableWidth: 90,
        head: [['Analysis & Structural Verification', 'Result / Status']],
        body: [
          ['Slab Classification', result.slab_type ?? 'Flat Plate'],
          ['Ultimate Load (wu)', `${result.loads?.wu ?? 0} kN/m²`],
          ['Design Moment Short Span (Mu,x)', `${result.moments?.Mu_x ?? 0} kN·m/m`],
          ['Design Moment Long Span (Mu,y)', `${result.moments?.Mu_y ?? 0} kN·m/m`],
          ['One-Way Shear Force (Vu)', `${result.moments?.Vu ?? 0} kN/m`],
          ...(isPunchingRelevant
            ? [
                ['Punching Shear Force (Vu,punch)', `${result.moments?.Vu_punch ?? 0} kN`],
                ['Punching Capacity (φVc,punch)', `${result.capacity?.phiVc_punch ?? 0} kN`],
                ['Critical Perimeter (bo)', `${result.capacity?.bo ?? 0} mm`],
                ['Punching Shear DCR', `${result.verification?.punching_dcr ?? result.dcr?.punching_dcr ?? 0}`],
              ]
            : []),
          ['Flexural Capacity (φMn,x)', `${result.capacity?.phiMn ?? 0} kN·m/m`],
          ['One-Way Shear Capacity (φVc)', `${result.capacity?.phiVc ?? 0} kN/m`],
          ['Provided Steel Area (As,x)', `${result.capacity?.As_provided ?? 0} mm²/m`],
          ['Minimum Steel Required (As,min)', `${result.capacity?.As_min ?? 0} mm²/m`],
          ['Span / Depth Ratio (L/d)', `${result.deflection?.actual_ratio} (Max: ${result.deflection?.max_ratio})`],
          ['Flexural DCR', `${result.verification?.flexure_dcr ?? result.dcr?.flexure_dcr ?? 0}`],
          ['Shear DCR', `${result.verification?.shear_dcr ?? result.dcr?.shear_dcr ?? 0}`],
          ['Governing Failure Mode', result.verification?.failure_mode ?? 'SAFE'],
          ['Overall Compliance', result.verification?.status ?? 'SAFE'],
        ],
        theme: 'grid',
        headStyles: { fillColor: [15, 118, 110], fontSize: 6.5, cellPadding: 1 },
        bodyStyles: { fontSize: 6.5, cellPadding: 1 },
      });

      let currentY = 88;

      const planSvg = document.getElementById('slab-plan-svg') as unknown as SVGSVGElement;
      const secSvg = document.getElementById('slab-section-svg') as unknown as SVGSVGElement;

      if (planSvg && secSvg) {
        try {
          const planPng = await convertSvgToPng(planSvg, '#0f172a');
          const secPng = await convertSvgToPng(secSvg, '#0f172a');

          doc.setFontSize(8);
          doc.setTextColor(15, 23, 42);
          doc.text('STRUCTURAL PLAN VIEW & REINFORCEMENT DETAILS', 12, currentY);
          currentY += 3;

          doc.addImage(planPng, 'PNG', 12, currentY, 90, 52);
          doc.addImage(secPng, 'PNG', 108, currentY, 90, 52);
        } catch (e) {
          console.warn('SVG PDF rendering failed:', e);
        }
      }

      doc.save(`Haya_Slab_Design_${designCode}_${result.slab_type?.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error('PDF Export Error:', err);
      alert('Failed to generate PDF structural report.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const getCodeName = (code: DesignCode) => {
    switch (code) {
      case 'ACI318':
        return 'ACI 318-19 (LRFD)';
      case 'EC2':
        return 'Eurocode 2 (EN 1992-1-1)';
      case 'BS8110':
        return 'BS 8110:1997 (Ultimate Limit State)';
    }
  };

  const getFailureModeBadge = (mode?: string) => {
    switch (mode) {
      case 'PUNCHING_SHEAR':
        return { label: 'CRITICAL: Punching Shear Failure', color: 'bg-rose-500/20 text-rose-400 border-rose-500/40' };
      case 'FLEXURAL_YIELDING':
        return { label: 'CRITICAL: Flexural Yielding', color: 'bg-amber-500/20 text-amber-400 border-amber-500/40' };
      case 'ONE_WAY_SHEAR':
        return { label: 'CRITICAL: One-Way Beam Shear', color: 'bg-orange-500/20 text-orange-400 border-orange-500/40' };
      case 'EXCESSIVE_DEFLECTION':
        return { label: 'WARNING: Excessive Deflection (L/d Exceeded)', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40' };
      default:
        return { label: 'OPTIMAL: All Design Checks Passed', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' };
    }
  };

  const flexDcr = result?.verification?.flexure_dcr ?? result?.dcr?.flexure_dcr ?? 0;
  const shearDcr = result?.verification?.shear_dcr ?? result?.dcr?.shear_dcr ?? 0;
  const punchDcr = result?.verification?.punching_dcr ?? result?.dcr?.punching_dcr ?? 0;
  const overallDcr = result?.verification?.overall_dcr ?? result?.dcr?.overall_dcr ?? 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Control Input Panel */}
      <div className="lg:col-span-5 space-y-4 bg-slate-900 p-5 rounded-xl border border-slate-800">
        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
          <h3 className="font-semibold text-slate-200">RC Slab Design Inputs</h3>
          <select
            value={designCode}
            onChange={(e) => setDesignCode(e.target.value as DesignCode)}
            className="bg-cyan-500/20 text-cyan-400 font-bold border border-cyan-500/30 rounded px-2 py-1 text-xs"
          >
            <option value="ACI318">ACI 318-19</option>
            <option value="EC2">Eurocode 2 (EN 1992)</option>
            <option value="BS8110">BS 8110:1997</option>
          </select>
        </div>

        {/* Slab System Selector */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Structural Slab System</label>
          <select
            value={slabSystem}
            onChange={(e) => setSlabSystem(e.target.value as SlabSystem)}
            className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200 font-medium"
          >
            <option value="flat_plate">Flat Plate (Direct Column Support)</option>
            <option value="flat_slab">Flat Slab (With Drop Panels)</option>
            <option value="two_way_solid">Two-Way Solid Slab on Beams</option>
            <option value="one_way_solid">One-Way Solid Slab</option>
          </select>
        </div>

        {/* Boundary Support Conditions */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Boundary Support Condition</label>
          <select
            value={supportCondition}
            onChange={(e) => setSupportCondition(e.target.value as SupportCondition)}
            className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200"
          >
            <option value="simply_supported">Simply Supported</option>
            <option value="continuous">Continuous / Fixed Ends</option>
            <option value="restrained_4edges">Restrained Exterior Edges (Two-Way)</option>
            <option value="cantilever">Cantilever Slab</option>
          </select>
        </div>

        {/* Dimensions & Thickness */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Short Span Lx (m)</label>
            <input
              type="number"
              step="0.1"
              value={lx}
              onChange={(e) => setLx(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Long Span Ly (m)</label>
            <input
              type="number"
              step="0.1"
              value={ly}
              onChange={(e) => setLy(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Slab Thickness h (mm)</label>
            <input
              type="number"
              value={thickness}
              onChange={(e) => setThickness(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Clear Cover (mm)</label>
            <input
              type="number"
              value={cover}
              onChange={(e) => setCover(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200"
            />
          </div>
        </div>

        {/* Punching Shear Specific Parameters */}
        {isPunchingRelevant && (
          <div className="p-3 bg-cyan-950/30 border border-cyan-800/40 rounded-lg space-y-3">
            <h4 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">Punching Shear Parameters</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Column Width c1 (mm)</label>
                <input
                  type="number"
                  value={colW}
                  onChange={(e) => setColW(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Column Height c2 (mm)</label>
                <input
                  type="number"
                  value={colH}
                  onChange={(e) => setColH(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200"
                />
              </div>
            </div>
            {slabSystem === 'flat_slab' && (
              <div>
                <label className="block text-xs text-slate-400 mb-1">Extra Drop Panel Thickness (mm)</label>
                <input
                  type="number"
                  value={dropPanelT}
                  onChange={(e) => setDropPanelT(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200"
                />
              </div>
            )}
          </div>
        )}

        {/* Material Specs */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
          <div>
            <label className="block text-xs text-slate-400 mb-1">{designCode === 'ACI318' ? "f'c (MPa)" : 'fck (MPa)'}</label>
            <input
              type="number"
              value={fc}
              onChange={(e) => setFc(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">fy / fyk (MPa)</label>
            <input
              type="number"
              value={fy}
              onChange={(e) => setFy(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200"
            />
          </div>
        </div>

        {/* Loading Parameters */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Superimposed DL (kN/m²)</label>
            <input
              type="number"
              step="0.1"
              value={deadLoad}
              onChange={(e) => setDeadLoad(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Live Load LL (kN/m²)</label>
            <input
              type="number"
              step="0.1"
              value={liveLoad}
              onChange={(e) => setLiveLoad(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200"
            />
          </div>
        </div>

        {/* Reinforcement Configuration */}
        <div className="space-y-3 pt-2 border-t border-slate-800">
          <h4 className="font-semibold text-slate-200 text-xs uppercase tracking-wider text-cyan-400">Primary Rebar (Short Span / Bottom X)</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Bar Diam Øx (mm)</label>
              <input
                type="number"
                value={barDiam}
                onChange={(e) => setBarDiam(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Spacing sx (mm)</label>
              <input
                type="number"
                value={barSpacing}
                onChange={(e) => setBarSpacing(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200"
              />
            </div>
          </div>

          <h4 className="font-semibold text-slate-200 text-xs uppercase tracking-wider text-cyan-400">Secondary Rebar (Long Span / Y)</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Bar Diam Øy (mm)</label>
              <input
                type="number"
                value={barDiamY}
                onChange={(e) => setBarDiamY(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Spacing sy (mm)</label>
              <input
                type="number"
                value={barSpacingY}
                onChange={(e) => setBarSpacingY(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200"
              />
            </div>
          </div>
        </div>

        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold py-2.5 rounded transition disabled:opacity-50 mt-4 shadow-lg shadow-cyan-500/20"
        >
          {loading ? 'Analyzing Structural System...' : `Run Slab Verification (${designCode})`}
        </button>

        {result && (
          <div className="mt-4 pt-4 border-t border-slate-800 space-y-2 text-sm bg-slate-950 p-3.5 rounded-lg border border-slate-800">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-slate-400 font-bold uppercase">{getCodeName(designCode)}:</span>
              <span
                className={`text-xs px-2 py-0.5 rounded font-bold ${
                  result.verification?.status === 'SAFE'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                }`}
              >
                {result.verification?.status}
              </span>
            </div>
            <p>
              System Type: <span className="text-cyan-400 font-semibold">{result.slab_type}</span>
            </p>
            <p>
              Design Load (wu): <span className="text-cyan-400 font-mono">{result.loads?.wu} kN/m²</span>
            </p>
            <p>
              Short Span Moment (Mu,x): <span className="text-cyan-400 font-mono">{result.moments?.Mu_x} kN·m/m</span>
            </p>
            {isPunchingRelevant && (
              <p>
                Punching Shear (Vu,punch): <span className="text-rose-400 font-mono">{result.moments?.Vu_punch ?? 0} kN</span>
              </p>
            )}
            <p>
              Flexural Capacity (φMn): <span className="text-emerald-400 font-mono">{result.capacity?.phiMn} kN·m/m</span>
            </p>
            <p>
              Overall Governing DCR: <span className="text-emerald-400 font-mono">{overallDcr}</span>
            </p>

            <button
              onClick={generatePDF}
              disabled={downloadingPdf}
              className="w-full mt-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2 rounded transition shadow-lg"
            >
              {downloadingPdf ? 'Generating PDF Report...' : '📄 Download Complete Slab PDF Report'}
            </button>
          </div>
        )}
      </div>

      {/* Visual Graphical & Detailed Verification Output */}
      <div className="lg:col-span-7 space-y-6">
        {/* Metric Cards Row */}
        {result && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center">
              <span className="text-xs text-slate-400 block mb-1">Flexure DCR</span>
              <span className={`text-lg font-bold font-mono ${flexDcr <= 1.0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {flexDcr}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center">
              <span className="text-xs text-slate-400 block mb-1">One-Way Shear</span>
              <span className={`text-lg font-bold font-mono ${shearDcr <= 1.0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {shearDcr}
              </span>
            </div>

            {isPunchingRelevant ? (
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center">
                <span className="text-xs text-slate-400 block mb-1">Punching DCR</span>
                <span className={`text-lg font-bold font-mono ${punchDcr <= 1.0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {punchDcr}
                </span>
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center opacity-50">
                <span className="text-xs text-slate-400 block mb-1">Punching DCR</span>
                <span className="text-xs text-slate-500 block">N/A (Beams Present)</span>
              </div>
            )}

            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center">
              <span className="text-xs text-slate-400 block mb-1">Deflection (L/d)</span>
              <span
                className={`text-lg font-bold font-mono ${
                  result.deflection?.status === 'PASS' ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {result.deflection?.actual_ratio} / {result.deflection?.max_ratio}
              </span>
            </div>
          </div>
        )}

        {/* Failure Mode Banner */}
        {result && (
          <div className={`p-3 rounded-xl border flex items-center justify-between ${getFailureModeBadge(result.verification?.failure_mode).color}`}>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider block">Governing Structural Behavior</span>
              <span className="text-sm font-semibold">{getFailureModeBadge(result.verification?.failure_mode).label}</span>
            </div>
            <span className="text-xs font-mono font-bold bg-slate-950/60 px-2.5 py-1 rounded border border-slate-800">
              Max DCR: {overallDcr}
            </span>
          </div>
        )}

        {/* Plan & Section Graphical Diagrams */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
            <h4 className="text-xs font-bold text-slate-300 mb-2 border-b border-slate-800 pb-1 flex justify-between">
              <span>SLAB PLAN VIEW</span>
              <span className="text-cyan-400">{ly / lx > 2 ? 'One-Way Action' : 'Two-Way Action'}</span>
            </h4>
            <div className="bg-slate-950/60 p-3 rounded border border-slate-800 flex justify-center">
              <svg id="slab-plan-svg" viewBox="0 0 280 200" className="w-full h-44 drop-shadow-md">
                <rect x="20" y="20" width="240" height="160" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" rx="4" />

                {/* Primary Spanning Axis Arrow */}
                <line x1="20" y1="100" x2="260" y2="100" stroke="#f59e0b" strokeWidth="2.5" strokeDasharray="5 3" />
                <polygon points="260,100 250,95 250,105" fill="#f59e0b" />
                <polygon points="20,100 30,95 30,105" fill="#f59e0b" />

                {/* Secondary Axis Arrow if Two-Way */}
                {ly / lx <= 2 && (
                  <>
                    <line x1="140" y1="20" x2="140" y2="180" stroke="#10b981" strokeWidth="2" strokeDasharray="4 2" />
                    <polygon points="140,180 135,170 145,170" fill="#10b981" />
                    <polygon points="140,20 135,30 145,30" fill="#10b981" />
                  </>
                )}

                {/* Punching Shear Column & Critical Perimeter Overlay */}
                {isPunchingRelevant && (
                  <g>
                    {/* Punching Perimeter d/2 */}
                    <rect
                      x="115"
                      y="75"
                      width="50"
                      height="50"
                      fill="none"
                      stroke={punchDcr > 1.0 ? '#f43f5e' : '#f59e0b'}
                      strokeWidth="1.5"
                      strokeDasharray="3 3"
                    />
                    {/* Column */}
                    <rect x="125" y="85" width="30" height="30" fill="#475569" stroke="#94a3b8" strokeWidth="1.5" />
                    <text x="140" y="103" fill="#f8fafc" fontSize="7" textAnchor="middle" fontWeight="bold">
                      COL
                    </text>
                  </g>
                )}

                <text x="140" y="40" fill="#fbbf24" fontSize="10" textAnchor="middle" fontWeight="bold">
                  Lx = {lx}m (Primary)
                </text>
                <text x="140" y="170" fill="#cbd5e1" fontSize="9" textAnchor="middle">
                  Ly = {ly}m
                </text>
              </svg>
            </div>
          </div>

          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
            <h4 className="text-xs font-bold text-slate-300 mb-2 border-b border-slate-800 pb-1 flex justify-between">
              <span>SECTION VIEW (1000mm Strip)</span>
              <span className="text-cyan-400">h = {thickness}mm</span>
            </h4>
            <div className="bg-slate-950/60 p-3 rounded border border-slate-800 flex justify-center">
              <svg id="slab-section-svg" viewBox="0 0 280 140" className="w-full h-44 drop-shadow-md">
                {/* Drop Panel Render */}
                {slabSystem === 'flat_slab' && (
                  <rect x="90" y="100" width="100" height="15" fill="#1e293b" stroke="#64748b" strokeWidth="1.5" />
                )}

                {/* Main Slab Body */}
                <rect x="20" y="30" width="240" height="70" fill="#334155" stroke="#94a3b8" strokeWidth="2" rx="2" />

                {/* Bottom Rebar X Line */}
                <line x1="30" y1="85" x2="250" y2="85" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />

                {/* Bottom Rebar Y Dots */}
                <circle cx="50" cy="81" r="3" fill="#10b981" />
                <circle cx="90" cy="81" r="3" fill="#10b981" />
                <circle cx="130" cy="81" r="3" fill="#10b981" />
                <circle cx="170" cy="81" r="3" fill="#10b981" />
                <circle cx="210" cy="81" r="3" fill="#10b981" />

                {/* Punching Shear Failure Crack Visualization */}
                {result?.verification?.failure_mode === 'PUNCHING_SHEAR' && (
                  <g>
                    <line x1="100" y1="30" x2="130" y2="100" stroke="#f43f5e" strokeWidth="2.5" strokeDasharray="3 2" />
                    <line x1="180" y1="30" x2="150" y2="100" stroke="#f43f5e" strokeWidth="2.5" strokeDasharray="3 2" />
                  </g>
                )}

                <text x="140" y="20" fill="#38bdf8" fontSize="9" textAnchor="middle" fontWeight="bold">
                  Top Surface (Compression Zone)
                </text>
                <text x="140" y="125" fill="#f59e0b" fontSize="8" textAnchor="middle">
                  Bottom Rebar: T{barDiam}@{barSpacing}mm (X) + T{barDiamY}@{barSpacingY}mm (Y)
                </text>
              </svg>
            </div>
          </div>
        </div>

        {/* Detailed Design Verification Table */}
        {result && (
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2">
              Detailed Structural Compliance Breakdown
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-2 font-semibold">Check Parameter</th>
                    <th className="pb-2 font-semibold">Demand / Value</th>
                    <th className="pb-2 font-semibold">Capacity / Limit</th>
                    <th className="pb-2 font-semibold">DCR / Ratio</th>
                    <th className="pb-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-slate-300 font-mono">
                  <tr>
                    <td className="py-2 text-slate-200 font-sans font-medium">Flexural Bending (X)</td>
                    <td className="py-2">{result.moments?.Mu_x} kN·m/m</td>
                    <td className="py-2 text-emerald-400">{result.capacity?.phiMn} kN·m/m</td>
                    <td className="py-2 font-bold">{flexDcr}</td>
                    <td className="py-2 font-sans font-bold">
                      <span className={flexDcr <= 1.0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {flexDcr <= 1.0 ? 'PASS' : 'FAIL'}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-200 font-sans font-medium">One-Way Beam Shear</td>
                    <td className="py-2">{result.moments?.Vu} kN/m</td>
                    <td className="py-2 text-emerald-400">{result.capacity?.phiVc} kN/m</td>
                    <td className="py-2 font-bold">{shearDcr}</td>
                    <td className="py-2 font-sans font-bold">
                      <span className={shearDcr <= 1.0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {shearDcr <= 1.0 ? 'PASS' : 'FAIL'}
                      </span>
                    </td>
                  </tr>
                  {isPunchingRelevant && (
                    <tr>
                      <td className="py-2 text-slate-200 font-sans font-medium">Two-Way Punching Shear</td>
                      <td className="py-2 text-rose-300">{result.moments?.Vu_punch ?? 0} kN</td>
                      <td className="py-2 text-emerald-400">{result.capacity?.phiVc_punch ?? 0} kN</td>
                      <td className="py-2 font-bold">{punchDcr}</td>
                      <td className="py-2 font-sans font-bold">
                        <span className={punchDcr <= 1.0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {punchDcr <= 1.0 ? 'PASS' : 'FAIL'}
                        </span>
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td className="py-2 text-slate-200 font-sans font-medium">Minimum Reinforcement (As,min)</td>
                    <td className="py-2">{result.capacity?.As_provided} mm²/m</td>
                    <td className="py-2 text-emerald-400">{result.capacity?.As_min} mm²/m</td>
                    <td className="py-2">-</td>
                    <td className="py-2 font-sans font-bold">
                      <span className={result.verification?.rebar_status === 'ADEQUATE' ? 'text-emerald-400' : 'text-rose-400'}>
                        {result.verification?.rebar_status}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-200 font-sans font-medium">Deflection Span/Depth Ratio (L/d)</td>
                    <td className="py-2">{result.deflection?.actual_ratio}</td>
                    <td className="py-2 text-emerald-400">Max {result.deflection?.max_ratio}</td>
                    <td className="py-2">-</td>
                    <td className="py-2 font-sans font-bold">
                      <span className={result.deflection?.status === 'PASS' ? 'text-emerald-400' : 'text-amber-400'}>
                        {result.deflection?.status}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
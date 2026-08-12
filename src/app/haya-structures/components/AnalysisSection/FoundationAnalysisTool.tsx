'use client';

import React, { useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type DesignCode = 'ACI318' | 'EC2';

interface FootingResult {
  code: DesignCode;
  geometry: {
    B: number; // Width (mm)
    L: number; // Length (mm)
    D: number; // Thickness (mm)
    d: number; // Effective depth (mm)
    c1: number; // Column length (mm)
    c2: number; // Column width (mm)
  };
  geotechnical: {
    q_max: number; // Max bearing pressure (kPa)
    q_min: number; // Min bearing pressure (kPa)
    q_allow: number; // Allowable soil pressure (kPa)
    uplift: boolean; // Uplift condition status
  };
  structural: {
    Pu: number;
    Mux: number;
    qu_max: number; // Factored soil pressure for design (kPa)
    Vu_1way: number; // One-way shear demand (kN)
    phiVc_1way: number; // One-way shear capacity (kN)
    Vu_2way: number; // Two-way shear demand (kN)
    phiVc_2way: number; // Two-way shear capacity (kN)
    Mu_flexure: number; // Flexural moment demand (kN·m)
    phiMn: number; // Moment capacity (kN·m)
    As_req: number; // Required steel area (mm²)
    As_provided: number; // Provided steel area (mm²)
  };
  dcr: {
    bearing_dcr: number;
    shear_1way_dcr: number;
    shear_2way_dcr: number;
    flexure_dcr: number;
  };
  status: 'SAFE' | 'OVERSTRESSED';
  governing_check: string;
}

export default function FootingAnalysisTool() {
  const [code, setCode] = useState<DesignCode>('ACI318');

  // Footing Geometry (mm)
  const [footingB, setFootingB] = useState<number>(2400);
  const [footingL, setFootingL] = useState<number>(2400);
  const [footingD, setFootingD] = useState<number>(550);
  const [cover, setCover] = useState<number>(75);

  // Column Geometry (mm)
  const [colC1, setColC1] = useState<number>(400);
  const [colC2, setColC2] = useState<number>(400);

  // Soil Properties
  const [qAllow, setQAllow] = useState<number>(200); // kPa
  const [gammaSoil, setGammaSoil] = useState<number>(18); // kN/m³
  const [embedmentDepth, setEmbedmentDepth] = useState<number>(1500); // mm

  // Rebar Layout
  const [barDiam, setBarDiam] = useState<number>(16);
  const [barSpacing, setBarSpacing] = useState<number>(150);

  // Materials (MPa)
  const [fc, setFc] = useState<number>(28);
  const [fy, setFy] = useState<number>(420);

  // Unfactored Service Loads
  const [P_Dead, setP_Dead] = useState<number>(650); // kN
  const [P_Live, setP_Live] = useState<number>(350); // kN
  const [M_Dead, setM_Dead] = useState<number>(80);  // kN·m
  const [M_Live, setM_Live] = useState<number>(40);  // kN·m

  const [result, setResult] = useState<FootingResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [pdfGenerating, setPdfGenerating] = useState<boolean>(false);

  // --- STRUCTURAL ANALYSIS ENGINE ---
  const handleAnalyze = () => {
    setLoading(true);
    try {
      const B = Math.max(Number(footingB), 500) / 1000; // m
      const L = Math.max(Number(footingL), 500) / 1000; // m
      const D = Math.max(Number(footingD), 200) / 1000; // m
      const c = Number(cover) / 1000; // m
      const db = Number(barDiam) / 1000; // m
      const d = D - c - db / 2; // Effective depth (m)

      const c1 = Math.max(Number(colC1), 100) / 1000; // m
      const c2 = Math.max(Number(colC2), 100) / 1000; // m

      const f_c = Number(fc);
      const f_y = Number(fy);
      const q_all = Number(qAllow);

      // 1. Service Loads & Soil Bearing Pressure (kPA)
      const P_service = Number(P_Dead) + Number(P_Live);
      const M_service = Number(M_Dead) + Number(M_Live);
      const footingWeight = B * L * D * 24; // Self-weight
      const soilWeight = B * L * (Number(embedmentDepth) / 1000 - D) * Number(gammaSoil);
      const P_total_service = P_service + footingWeight + soilWeight;

      const A_footing = B * L;
      const S_footing = (B * Math.pow(L, 2)) / 6;

      const q_avg = P_total_service / A_footing;
      const q_flexure = M_service / S_footing;

      const q_max = q_avg + q_flexure;
      const q_min = q_avg - q_flexure;
      const uplift = q_min < 0;

      // 2. Factored Ultimate Loads (1.2D + 1.6L)
      const Pu = 1.2 * Number(P_Dead) + 1.6 * Number(P_Live);
      const Mux = 1.2 * Number(M_Dead) + 1.6 * Number(M_Live);

      // Factored Soil Pressure for Concrete Design
      const qu_avg = Pu / A_footing;
      const qu_flex = Mux / S_footing;
      const qu_max = qu_avg + qu_flex;

      // 3. One-Way Shear Check (Wide Beam Shear at distance d)
      const dist_to_d = (L - c1) / 2 - d;
      const Vu_1way = dist_to_d > 0 ? qu_max * B * dist_to_d : 0; // kN
      const phi_shear = 0.75;
      const Vc_1way = (0.17 * Math.sqrt(f_c) * (B * 1000) * (d * 1000)) / 1000; // kN
      const phiVc_1way = phi_shear * Vc_1way;

      // 4. Two-Way Punching Shear Check (Perimeter b0 at d/2)
      const bo = 2 * (c1 + d) + 2 * (c2 + d); // m
      const A_punching = (c1 + d) * (c2 + d);
      const Vu_2way = Pu - qu_max * A_punching; // kN

      const beta = Math.max(c1 / c2, c2 / c1);
      const Vc_2way_1 = 0.17 * (1 + 2 / beta) * Math.sqrt(f_c) * (bo * 1000) * (d * 1000);
      const Vc_2way_2 = 0.33 * Math.sqrt(f_c) * (bo * 1000) * (d * 1000);
      const Vc_2way = Math.min(Vc_2way_1, Vc_2way_2) / 1000; // kN
      const phiVc_2way = phi_shear * Vc_2way;

      // 5. Flexural Reinforcement Check (Moment at column face)
      const cantilever = (L - c1) / 2;
      const Mu_flexure = (qu_max * B * Math.pow(cantilever, 2)) / 2; // kN·m

      const phi_flex = 0.90;
      const b_mm = B * 1000;
      const d_mm = d * 1000;

      // Required Steel Area (Quadratic Whitney block solution)
      const K_val = (Mu_flexure * 1e6) / (phi_flex * b_mm * Math.pow(d_mm, 2) * f_c);
      const rho_req = (0.85 * f_c / f_y) * (1 - Math.sqrt(Math.max(1 - 2 * K_val / 0.85, 0.01)));
      const As_req = Math.max(rho_req * b_mm * d_mm, 0.0018 * b_mm * (D * 1000)); // mm²

      // Provided Steel Area
      const s_bar = Math.max(Number(barSpacing), 50);
      const num_bars = Math.floor((b_mm - 2 * Number(cover)) / s_bar) + 1;
      const As_bar = (Math.PI / 4) * Math.pow(Number(barDiam), 2);
      const As_provided = num_bars * As_bar;

      const a_block = (As_provided * f_y) / (0.85 * f_c * b_mm);
      const Mn = (As_provided * f_y * (d_mm - a_block / 2)) / 1e6;
      const phiMn = phi_flex * Mn;

      // DCRs
      const bearing_dcr = q_max / q_all;
      const shear_1way_dcr = Vu_1way / phiVc_1way;
      const shear_2way_dcr = Vu_2way / phiVc_2way;
      const flexure_dcr = Mu_flexure / phiMn;

      const max_dcr = Math.max(bearing_dcr, shear_1way_dcr, shear_2way_dcr, flexure_dcr);
      let governing_check = 'Soil Bearing Capacity';
      if (max_dcr === shear_1way_dcr) governing_check = 'One-Way Beam Shear';
      if (max_dcr === shear_2way_dcr) governing_check = 'Two-Way Punching Shear';
      if (max_dcr === flexure_dcr) governing_check = 'Bottom Flexural Bending';

      const res: FootingResult = {
        code,
        geometry: {
          B: B * 1000,
          L: L * 1000,
          D: D * 1000,
          d: Math.round(d_mm),
          c1: c1 * 1000,
          c2: c2 * 1000,
        },
        geotechnical: {
          q_max: Number(q_max.toFixed(1)),
          q_min: Number(q_min.toFixed(1)),
          q_allow: q_all,
          uplift,
        },
        structural: {
          Pu,
          Mux,
          qu_max: Number(qu_max.toFixed(1)),
          Vu_1way: Number(Vu_1way.toFixed(1)),
          phiVc_1way: Number(phiVc_1way.toFixed(1)),
          Vu_2way: Number(Vu_2way.toFixed(1)),
          phiVc_2way: Number(phiVc_2way.toFixed(1)),
          Mu_flexure: Number(Mu_flexure.toFixed(1)),
          phiMn: Number(phiMn.toFixed(1)),
          As_req: Math.round(As_req),
          As_provided: Math.round(As_provided),
        },
        dcr: {
          bearing_dcr: Number(bearing_dcr.toFixed(3)),
          shear_1way_dcr: Number(shear_1way_dcr.toFixed(3)),
          shear_2way_dcr: Number(shear_2way_dcr.toFixed(3)),
          flexure_dcr: Number(flexure_dcr.toFixed(3)),
        },
        status: max_dcr <= 1.0 && !uplift ? 'SAFE' : 'OVERSTRESSED',
        governing_check,
      };

      setResult(res);
    } catch (err) {
      console.error('Footing calculation error:', err);
      alert('Error performing footing calculation.');
    } finally {
      setLoading(false);
    }
  };

  // --- PDF REPORT GENERATION ---
  const generatePDF = async () => {
    if (!result) return;
    setPdfGenerating(true);

    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const dateStr = new Date().toLocaleDateString();

      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 18, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(56, 189, 248);
      doc.text('HAYA STRUCTURES | SPREAD FOOTING DESIGN REPORT', 12, 10);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(226, 232, 240);
      doc.text(`Standard: ${code} | Date: ${dateStr}`, 12, 15);

      autoTable(doc, {
        startY: 22,
        margin: { left: 12 },
        tableWidth: 90,
        head: [['Input Parameter', 'Value / Unit']],
        body: [
          ['Footing Size (B x L)', `${result.geometry.B} x ${result.geometry.L} mm`],
          ['Thickness (D) / Effective (d)', `${result.geometry.D} / ${result.geometry.d} mm`],
          ['Column Size (c1 x c2)', `${result.geometry.c1} x ${result.geometry.c2} mm`],
          ['Allowable Soil Capacity (q_allow)', `${result.geotechnical.q_allow} kPa`],
          ['Service Dead / Live Load', `${P_Dead} / ${P_Live} kN`],
          ['Service Dead / Live Moment', `${M_Dead} / ${M_Live} kN·m`],
          ['Concrete f\'c / Steel fy', `${fc} / ${fy} MPa`],
          ['Provided Reinforcement', `Ø${barDiam} @ ${barSpacing}mm (${result.structural.As_provided} mm²)`],
        ],
        theme: 'grid',
        headStyles: { fillColor: [14, 116, 144], fontSize: 7.5, cellPadding: 2, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7, cellPadding: 1.8 },
      });

      autoTable(doc, {
        startY: 22,
        margin: { left: 108 },
        tableWidth: 90,
        head: [['Design Check & Capacity Summary', 'Result / Status']],
        body: [
          ['Max Soil Pressure (q_max)', `${result.geotechnical.q_max} kPa`],
          ['Min Soil Pressure (q_min)', `${result.geotechnical.q_min} kPa (${result.geotechnical.uplift ? 'UPLIFT' : 'No Tension'})`],
          ['Soil Bearing DCR', `${result.dcr.bearing_dcr} (${result.dcr.bearing_dcr <= 1 ? 'PASS' : 'FAIL'})`],
          ['One-Way Shear (Vu / φVc)', `${result.structural.Vu_1way} / ${result.structural.phiVc_1way} kN`],
          ['One-Way Shear DCR', `${result.dcr.shear_1way_dcr}`],
          ['Punching Shear (Vu / φVc)', `${result.structural.Vu_2way} / ${result.structural.phiVc_2way} kN`],
          ['Punching Shear DCR', `${result.dcr.shear_2way_dcr}`],
          ['Flexural Moment (Mu / φMn)', `${result.structural.Mu_flexure} / ${result.structural.phiMn} kN·m`],
          ['Required Steel Area (As_req)', `${result.structural.As_req} mm²`],
          ['Governing Failure State', result.governing_check],
          ['Overall Compliance', result.status],
        ],
        theme: 'grid',
        headStyles: { fillColor: [15, 118, 110], fontSize: 7.5, cellPadding: 2, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7, cellPadding: 1.8 },
      });

      const finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(12, finalY, 186, 25, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text('FOOTING STRUCTURAL DESIGN VERIFICATION', 16, finalY + 6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(51, 65, 85);
      doc.text(`Status: ${result.status === 'SAFE' ? 'APPROVED & COMPLIANT' : 'CRITICAL OVERSTRESS'}`, 16, finalY + 13);
      doc.text(`Governing Failure State: ${result.governing_check}`, 16, finalY + 19);

      doc.save(`Footing_Design_Report_${code}.pdf`);
    } catch (e) {
      console.error('PDF error:', e);
      alert('Failed to generate Footing PDF.');
    } finally {
      setPdfGenerating(false);
    }
  };

  // --- SVG PLAN & ELEVATION DRAWINGS ---
  const renderFootingSVG = () => {
    const w = 320;
    const h = 220;
    const cx = w / 2;
    const cy = h / 2;

    const scale = 120 / Math.max(footingB, footingL);
    const footingWidth = footingB * scale;
    const footingLength = footingL * scale;
    const colWidth = colC2 * scale;
    const colLength = colC1 * scale;

    // Punching shear perimeter offset (d/2)
    const d_est = (footingD - cover) * scale;
    const punchWidth = colWidth + d_est;
    const punchLength = colLength + d_est;

    return (
      <svg id="footing-svg" viewBox={`0 0 ${w} ${h}`} className="w-full h-56 drop-shadow-md">
        <rect width="100%" height="100%" fill="#0f172a" rx="6" />

        {/* Footing Outline */}
        <rect
          x={cx - footingWidth / 2}
          y={cy - footingLength / 2}
          width={footingWidth}
          height={footingLength}
          fill="#1e293b"
          stroke="#94a3b8"
          strokeWidth="2"
        />

        {/* Punching Shear Perimeter b0 (d/2) */}
        <rect
          x={cx - punchWidth / 2}
          y={cy - punchLength / 2}
          width={punchWidth}
          height={punchLength}
          fill="none"
          stroke="#f59e0b"
          strokeWidth="1.5"
          strokeDasharray="4 2"
        />

        {/* Column Pedestal */}
        <rect
          x={cx - colWidth / 2}
          y={cy - colLength / 2}
          width={colWidth}
          height={colLength}
          fill="#38bdf8"
          stroke="#0284c7"
          strokeWidth="1.5"
        />

        {/* Rebar Grid Lines */}
        <line
          x1={cx - footingWidth / 2 + 10}
          y1={cy + footingLength / 2 - 8}
          x2={cx + footingWidth / 2 - 10}
          y2={cy + footingLength / 2 - 8}
          stroke="#ef4444"
          strokeWidth="2"
        />

        <text x={cx} y={cy - footingLength / 2 - 6} fill="#cbd5e1" fontSize="9" textAnchor="middle" fontWeight="bold">
          Plan View: B = {footingB}mm × L = {footingL}mm
        </text>
        <text x={cx} y={cy + footingLength / 2 + 14} fill="#f59e0b" fontSize="8" textAnchor="middle">
          Orange Dash = Punching Perimeter (b₀ at d/2)
        </text>
      </svg>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 font-sans">
      {/* Control Inputs Panel */}
      <div className="lg:col-span-5 space-y-4 bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-xl">
        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
          <h3 className="font-semibold text-slate-200 text-sm">Footing Analysis Inputs</h3>
          <select
            value={code}
            onChange={(e) => setCode(e.target.value as DesignCode)}
            className="bg-cyan-500/20 text-cyan-400 font-bold border border-cyan-500/30 rounded px-2 py-1 text-xs"
          >
            <option value="ACI318">ACI 318-19</option>
            <option value="EC2">Eurocode 2</option>
          </select>
        </div>

        {/* Geometry */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Width B (mm)</label>
            <input
              type="number"
              value={footingB}
              onChange={(e) => setFootingB(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Length L (mm)</label>
            <input
              type="number"
              value={footingL}
              onChange={(e) => setFootingL(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Thickness D (mm)</label>
            <input
              type="number"
              value={footingD}
              onChange={(e) => setFootingD(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-mono"
            />
          </div>
        </div>

        {/* Column Size */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Column c1 (mm)</label>
            <input
              type="number"
              value={colC1}
              onChange={(e) => setColC1(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200 font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Column c2 (mm)</label>
            <input
              type="number"
              value={colC2}
              onChange={(e) => setColC2(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200 font-mono"
            />
          </div>
        </div>

        {/* Soil & Materials */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
          <div>
            <label className="block text-xs text-slate-400 mb-1">q_allow (kPa)</label>
            <input
              type="number"
              value={qAllow}
              onChange={(e) => setQAllow(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200 font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Concrete f'c (MPa)</label>
            <input
              type="number"
              value={fc}
              onChange={(e) => setFc(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200 font-mono"
            />
          </div>
        </div>

        {/* Service Loads */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Dead Load P_D (kN)</label>
            <input
              type="number"
              value={P_Dead}
              onChange={(e) => setP_Dead(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200 font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Live Load P_L (kN)</label>
            <input
              type="number"
              value={P_Live}
              onChange={(e) => setP_Live(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200 font-mono"
            />
          </div>
        </div>

        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold py-2.5 rounded transition shadow-lg shadow-cyan-500/20"
        >
          {loading ? 'Calculating Footing...' : `Analyze Footing (${code})`}
        </button>

        {result && (
          <button
            onClick={generatePDF}
            disabled={pdfGenerating}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2 rounded transition shadow-lg mt-2"
          >
            {pdfGenerating ? 'Generating Report...' : '📄 Download PDF Design Report'}
          </button>
        )}
      </div>

      {/* Visualizations & Output Metrics */}
      <div className="lg:col-span-7 space-y-6">
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
          <h4 className="text-xs font-bold text-slate-300 mb-2 border-b border-slate-800 pb-1 flex justify-between">
            <span>FOOTING PLAN & SHEAR PERIMETER</span>
            <span className="text-cyan-400">{code}</span>
          </h4>
          <div className="bg-slate-950/80 p-2 rounded border border-slate-800 flex justify-center">
            {renderFootingSVG()}
          </div>
        </div>

        {/* Dynamic Metric Display Cards */}
        {result && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center">
              <span className="text-xs text-slate-400 block mb-1">Bearing DCR</span>
              <span className={`text-lg font-bold font-mono ${result.dcr.bearing_dcr <= 1.0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {result.dcr.bearing_dcr}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center">
              <span className="text-xs text-slate-400 block mb-1">Punching DCR</span>
              <span className={`text-lg font-bold font-mono ${result.dcr.shear_2way_dcr <= 1.0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {result.dcr.shear_2way_dcr}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center">
              <span className="text-xs text-slate-400 block mb-1">Flexure DCR</span>
              <span className={`text-lg font-bold font-mono ${result.dcr.flexure_dcr <= 1.0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {result.dcr.flexure_dcr}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center">
              <span className="text-xs text-slate-400 block mb-1">q_max (kPa)</span>
              <span className="text-lg font-bold font-mono text-cyan-400">
                {result.geotechnical.q_max}
              </span>
            </div>
          </div>
        )}

        {/* Structural Matrix */}
        {result && (
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2 flex justify-between">
              <span>Footing Compliance Matrix</span>
              <span className={`text-xs px-2 py-0.5 rounded ${result.status === 'SAFE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                {result.status}
              </span>
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-2 font-semibold">Check</th>
                    <th className="pb-2 font-semibold">Demand</th>
                    <th className="pb-2 font-semibold">Capacity</th>
                    <th className="pb-2 font-semibold">DCR</th>
                    <th className="pb-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-slate-300">
                  <tr>
                    <td className="py-2 text-slate-200 font-sans">Soil Bearing Pressure</td>
                    <td className="py-2">{result.geotechnical.q_max} kPa</td>
                    <td className="py-2 text-emerald-400">{result.geotechnical.q_allow} kPa</td>
                    <td className="py-2 font-bold">{result.dcr.bearing_dcr}</td>
                    <td className="py-2 font-sans font-bold">
                      <span className={result.dcr.bearing_dcr <= 1.0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {result.dcr.bearing_dcr <= 1.0 ? 'PASS' : 'FAIL'}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-200 font-sans">Two-Way Punching Shear</td>
                    <td className="py-2">{result.structural.Vu_2way} kN</td>
                    <td className="py-2 text-emerald-400">{result.structural.phiVc_2way} kN</td>
                    <td className="py-2 font-bold">{result.dcr.shear_2way_dcr}</td>
                    <td className="py-2 font-sans font-bold">
                      <span className={result.dcr.shear_2way_dcr <= 1.0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {result.dcr.shear_2way_dcr <= 1.0 ? 'PASS' : 'FAIL'}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-200 font-sans">Flexural Bending (Mu)</td>
                    <td className="py-2">{result.structural.Mu_flexure} kN·m</td>
                    <td className="py-2 text-emerald-400">{result.structural.phiMn} kN·m</td>
                    <td className="py-2 font-bold">{result.dcr.flexure_dcr}</td>
                    <td className="py-2 font-sans font-bold">
                      <span className={result.dcr.flexure_dcr <= 1.0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {result.dcr.flexure_dcr <= 1.0 ? 'PASS' : 'FAIL'}
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
'use client';

import React, { useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type DesignCode = 'ACI318' | 'EC2';
type FootingType = 'isolated_pad' | 'wall_strip' | 'combined';
type MeshType = 'single_mesh' | 'double_mesh';

interface FootingResult {
  code: DesignCode;
  footing_type: FootingType;
  mesh_type: MeshType;
  geometry: {
    B: number; // Width (mm)
    L: number; // Length (mm)
    D: number; // Thickness (mm)
    d: number; // Effective depth (mm)
    c1: number; // Column length / Wall thickness (mm)
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
    As_req_bot: number; // Required bottom steel (mm²)
    As_prov_bot: number; // Provided bottom steel (mm²)
    As_req_top: number; // Required top steel (mm²)
    As_prov_top: number; // Provided top steel (mm²)
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
  const [footingType, setFootingType] = useState<FootingType>('isolated_pad');
  const [meshType, setMeshType] = useState<MeshType>('single_mesh');

  // Footing Geometry (mm)
  const [footingB, setFootingB] = useState<number>(2500);
  const [footingL, setFootingL] = useState<number>(2500);
  const [footingD, setFootingD] = useState<number>(550);
  const [cover, setCover] = useState<number>(75);

  // Column / Pier Geometry (mm)
  const [colC1, setColC1] = useState<number>(400);
  const [colC2, setColC2] = useState<number>(400);

  // Soil Properties
  const [qAllow, setQAllow] = useState<number>(220); // kPa
  const [gammaSoil, setGammaSoil] = useState<number>(18); // kN/m³
  const [embedmentDepth, setEmbedmentDepth] = useState<number>(1500); // mm

  // Rebar Details
  const [barDiam, setBarDiam] = useState<number>(16);
  const [barSpacing, setBarSpacing] = useState<number>(150);
  const [topBarDiam, setTopBarDiam] = useState<number>(12);
  const [topBarSpacing, setTopBarSpacing] = useState<number>(200);

  // Materials (MPa)
  const [fc, setFc] = useState<number>(28);
  const [fy, setFy] = useState<number>(420);

  // Unfactored Service Loads
  const [P_Dead, setP_Dead] = useState<number>(700); // kN
  const [P_Live, setP_Live] = useState<number>(400); // kN
  const [M_Dead, setM_Dead] = useState<number>(90);  // kN·m
  const [M_Live, setM_Live] = useState<number>(50);  // kN·m

  const [result, setResult] = useState<FootingResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [pdfGenerating, setPdfGenerating] = useState<boolean>(false);

  // --- ANALYSIS ENGINE ---
  const handleAnalyze = () => {
    setLoading(true);
    try {
      const B = Math.max(Number(footingB), 400) / 1000;
      const L = Math.max(Number(footingL), 400) / 1000;
      const D = Math.max(Number(footingD), 200) / 1000;
      const c = Number(cover) / 1000;
      const db = Number(barDiam) / 1000;
      const d = D - c - db / 2; // Effective depth (m)

      const c1 = Math.max(Number(colC1), 100) / 1000;
      const c2 = Math.max(Number(colC2), 100) / 1000;

      const f_c = Number(fc);
      const f_y = Number(fy);
      const q_all = Number(qAllow);

      // 1. Service Soil Bearing Pressure
      const P_service = Number(P_Dead) + Number(P_Live);
      const M_service = Number(M_Dead) + Number(M_Live);

      const b_eff = footingType === 'wall_strip' ? 1.0 : B;
      const A_footing = b_eff * L;
      const S_footing = (b_eff * Math.pow(L, 2)) / 6;

      const footingWeight = b_eff * L * D * 24;
      const soilWeight = b_eff * L * (Number(embedmentDepth) / 1000 - D) * Number(gammaSoil);
      const P_total_service = P_service + footingWeight + soilWeight;

      const q_avg = P_total_service / A_footing;
      const q_flexure = M_service / S_footing;

      const q_max = q_avg + q_flexure;
      const q_min = q_avg - q_flexure;
      const uplift = q_min < 0;

      // 2. Factored Ultimate Loads (1.2D + 1.6L)
      const Pu = 1.2 * Number(P_Dead) + 1.6 * Number(P_Live);
      const Mux = 1.2 * Number(M_Dead) + 1.6 * Number(M_Live);

      const qu_avg = Pu / A_footing;
      const qu_flex = Mux / S_footing;
      const qu_max = qu_avg + qu_flex;

      // 3. One-Way Shear Check (Wide Beam Shear at distance d)
      const dist_to_d = (L - c1) / 2 - d;
      const Vu_1way = dist_to_d > 0 ? qu_max * b_eff * dist_to_d : 0;
      const phi_shear = 0.75;
      const Vc_1way = (0.17 * Math.sqrt(f_c) * (b_eff * 1000) * (d * 1000)) / 1000;
      const phiVc_1way = phi_shear * Vc_1way;

      // 4. Two-Way Punching Shear Check
      let Vu_2way = 0;
      let phiVc_2way = 1.0;

      if (footingType !== 'wall_strip') {
        const bo = 2 * (c1 + d) + 2 * (c2 + d);
        const A_punching = (c1 + d) * (c2 + d);
        Vu_2way = Math.max(Pu - qu_max * A_punching, 0);

        const beta = Math.max(c1 / c2, c2 / c1);
        const Vc_2way_1 = 0.17 * (1 + 2 / beta) * Math.sqrt(f_c) * (bo * 1000) * (d * 1000);
        const Vc_2way_2 = 0.33 * Math.sqrt(f_c) * (bo * 1000) * (d * 1000);
        phiVc_2way = phi_shear * (Math.min(Vc_2way_1, Vc_2way_2) / 1000);
      } else {
        // Strip footings do not experience punching shear
        Vu_2way = 0;
        phiVc_2way = 9999;
      }

      // 5. Bottom Flexural Reinforcement (Positive Moment at Column Face)
      const cantilever = (L - c1) / 2;
      const Mu_flexure = (qu_max * b_eff * Math.pow(cantilever, 2)) / 2;

      const phi_flex = 0.90;
      const b_mm = b_eff * 1000;
      const d_mm = d * 1000;

      const K_val = (Mu_flexure * 1e6) / (phi_flex * b_mm * Math.pow(d_mm, 2) * f_c);
      const rho_req = (0.85 * f_c / f_y) * (1 - Math.sqrt(Math.max(1 - (2 * K_val) / 0.85, 0.01)));
      const As_req_bot = Math.max(rho_req * b_mm * d_mm, 0.0018 * b_mm * (D * 1000));

      const s_bar_bot = Math.max(Number(barSpacing), 50);
      const num_bars_bot = Math.floor((b_mm - 2 * Number(cover)) / s_bar_bot) + 1;
      const As_bar_bot = (Math.PI / 4) * Math.pow(Number(barDiam), 2);
      const As_prov_bot = num_bars_bot * As_bar_bot;

      const a_block_bot = (As_prov_bot * f_y) / (0.85 * f_c * b_mm);
      const Mn_bot = (As_prov_bot * f_y * (d_mm - a_block_bot / 2)) / 1e6;
      const phiMn = phi_flex * Mn_bot;

      // 6. Top Flexural Reinforcement (In case of Double Mesh or Uplift)
      let As_req_top = 0;
      let As_prov_top = 0;

      if (meshType === 'double_mesh') {
        As_req_top = 0.0018 * b_mm * (D * 1000); // Temperature & shrinkage minimum
        const s_bar_top = Math.max(Number(topBarSpacing), 50);
        const num_bars_top = Math.floor((b_mm - 2 * Number(cover)) / s_bar_top) + 1;
        const As_bar_top = (Math.PI / 4) * Math.pow(Number(topBarDiam), 2);
        As_prov_top = num_bars_top * As_bar_top;
      }

      // DCR Calculations
      const bearing_dcr = q_max / q_all;
      const shear_1way_dcr = Vu_1way / phiVc_1way;
      const shear_2way_dcr = footingType === 'wall_strip' ? 0 : Vu_2way / phiVc_2way;
      const flexure_dcr = Mu_flexure / phiMn;

      const max_dcr = Math.max(bearing_dcr, shear_1way_dcr, shear_2way_dcr, flexure_dcr);
      let governing_check = 'Soil Bearing Capacity';
      if (max_dcr === shear_1way_dcr) governing_check = 'One-Way Wide Beam Shear';
      if (max_dcr === shear_2way_dcr) governing_check = 'Two-Way Punching Shear';
      if (max_dcr === flexure_dcr) governing_check = 'Bottom Flexural Bending';
      if (uplift && meshType === 'single_mesh') governing_check = 'Uplift Tension (Top Mesh Required!)';

      const res: FootingResult = {
        code,
        footing_type: footingType,
        mesh_type: meshType,
        geometry: {
          B: Math.round(B * 1000),
          L: Math.round(L * 1000),
          D: Math.round(D * 1000),
          d: Math.round(d_mm),
          c1: Math.round(c1 * 1000),
          c2: Math.round(c2 * 1000),
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
          As_req_bot: Math.round(As_req_bot),
          As_prov_bot: Math.round(As_prov_bot),
          As_req_top: Math.round(As_req_top),
          As_prov_top: Math.round(As_prov_top),
        },
        dcr: {
          bearing_dcr: Number(bearing_dcr.toFixed(3)),
          shear_1way_dcr: Number(shear_1way_dcr.toFixed(3)),
          shear_2way_dcr: Number(shear_2way_dcr.toFixed(3)),
          flexure_dcr: Number(flexure_dcr.toFixed(3)),
        },
        status: max_dcr <= 1.0 && (!uplift || meshType === 'double_mesh') ? 'SAFE' : 'OVERSTRESSED',
        governing_check,
      };

      setResult(res);
    } catch (err) {
      console.error('Footing calculation error:', err);
      alert('Error analyzing foundation geometry.');
    } finally {
      setLoading(false);
    }
  };

  // --- SVG CONVERSION FOR PDF REPORT ---
  const convertSvgToPng = (svgElement: SVGSVGElement, bgColor = '#0f172a'): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
        const bbox = svgElement.getBoundingClientRect();
        const w = bbox.width || 420;
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
            reject(new Error('Canvas unavailable'));
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

  // --- PDF REPORT GENERATION WITH SVG DRAWING EMBEDDED ---
  const generatePDF = async () => {
    if (!result) return;
    setPdfGenerating(true);

    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const dateStr = new Date().toLocaleDateString();

      // Banner Header
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 18, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(56, 189, 248);
      doc.text('HAYA STRUCTURES | FOUNDATION & REINFORCEMENT REPORT', 12, 10);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(226, 232, 240);
      doc.text(`Code: ${code} | Type: ${footingType.toUpperCase()} | Mesh: ${meshType.toUpperCase()} | Date: ${dateStr}`, 12, 15);

      // Section 1: Tables
      autoTable(doc, {
        startY: 22,
        margin: { left: 12 },
        tableWidth: 90,
        head: [['Input Parameter', 'Value / Unit']],
        body: [
          ['Footing Type', footingType.replace(/_/g, ' ').toUpperCase()],
          ['Mesh Layout', meshType.replace(/_/g, ' ').toUpperCase()],
          ['Footing Size (B x L)', `${result.geometry.B} x ${result.geometry.L} mm`],
          ['Thickness (D) / Depth (d)', `${result.geometry.D} / ${result.geometry.d} mm`],
          ['Column Size (c1 x c2)', `${result.geometry.c1} x ${result.geometry.c2} mm`],
          ['Allowable Soil Capacity', `${result.geotechnical.q_allow} kPa`],
          ['Service Load (P / M)', `${Number(P_Dead) + Number(P_Live)} kN / ${Number(M_Dead) + Number(M_Live)} kN·m`],
          ['Concrete / Steel Strength', `${fc} / ${fy} MPa`],
          ['Bottom Mesh Rebar', `Ø${barDiam} @ ${barSpacing}mm (${result.structural.As_prov_bot} mm²)`],
          ['Top Mesh Rebar', meshType === 'double_mesh' ? `Ø${topBarDiam} @ ${topBarSpacing}mm (${result.structural.As_prov_top} mm²)` : 'None (Single Mesh)'],
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
          ['Bottom Steel Area (Req/Prov)', `${result.structural.As_req_bot} / ${result.structural.As_prov_bot} mm²`],
          ['Governing Failure State', result.governing_check],
          ['Overall Compliance', result.status],
        ],
        theme: 'grid',
        headStyles: { fillColor: [15, 118, 110], fontSize: 7.5, cellPadding: 2, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7, cellPadding: 1.8 },
      });

      // Section 2: SVG Visualization Embedding
      let currentY = 104;
      const footingSvg = document.getElementById('footing-composite-svg') as unknown as SVGSVGElement;

      if (footingSvg) {
        try {
          const footingPng = await convertSvgToPng(footingSvg, '#0f172a');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(15, 23, 42);
          doc.text('FOOTING PLAN & ELEVATION DETAILED DRAWING', 12, currentY);
          currentY += 4;

          doc.addImage(footingPng, 'PNG', 25, currentY, 160, 68);
          currentY += 72;
        } catch (e) {
          console.warn('SVG PDF rendering failed:', e);
          currentY += 10;
        }
      }

      // Section 3: Engineering Sign-off Box
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(12, currentY, 186, 26, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text('FOOTING STRUCTURAL DESIGN VERIFICATION', 16, currentY + 6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(51, 65, 85);
      doc.text(`Status: ${result.status === 'SAFE' ? 'APPROVED & COMPLIANT' : 'CRITICAL OVERSTRESS'}`, 16, currentY + 13);
      doc.text(`Governing Failure State: ${result.governing_check}`, 16, currentY + 19);

      doc.save(`Footing_${footingType}_${meshType}_Report.pdf`);
    } catch (e) {
      console.error('PDF error:', e);
      alert('Failed to generate PDF report.');
    } finally {
      setPdfGenerating(false);
    }
  };

  // --- SVG PLAN & ELEVATION DUAL VISUALIZER ---
  const renderCompositeSVG = () => {
    const w = 440;
    const h = 210;

    // Plan View Parameters (Left Side)
    const planCx = 110;
    const planCy = 110;
    const scalePlan = 110 / Math.max(footingB, footingL);

    const planB = footingB * scalePlan;
    const planL = footingL * scalePlan;
    const planC1 = colC1 * scalePlan;
    const planC2 = colC2 * scalePlan;

    // Punching Shear Perimeter
    const d_est = (footingD - cover) * scalePlan;
    const punchW = planC2 + d_est;
    const punchL = planC1 + d_est;

    // Elevation View Parameters (Right Side)
    const elevX = 240;
    const elevY = 60;
    const elevW = 170;
    const elevH = 70;

    // Trapezoid Pressure
    const qMaxVal = result ? result.geotechnical.q_max : 200;
    const qMinVal = result ? Math.max(result.geotechnical.q_min, 0) : 100;
    const pScale = 35 / Math.max(qMaxVal, 100);
    const hQMax = qMaxVal * pScale;
    const hQMin = qMinVal * pScale;

    return (
      <svg id="footing-composite-svg" viewBox={`0 0 ${w} ${h}`} className="w-full h-56 drop-shadow-md">
        <rect width="100%" height="100%" fill="#0f172a" rx="6" />

        {/* Divider Line */}
        <line x1="220" y1="15" x2="220" y2="195" stroke="#334155" strokeWidth="1" strokeDasharray="4 2" />

        {/* --- PLAN VIEW (LEFT) --- */}
        <text x={planCx} y="22" fill="#cbd5e1" fontSize="9" textAnchor="middle" fontWeight="bold">
          PLAN VIEW (B = {footingB}mm × L = {footingL}mm)
        </text>

        {/* Footing Slab */}
        <rect
          x={planCx - planB / 2}
          y={planCy - planL / 2}
          width={planB}
          height={planL}
          fill="#1e293b"
          stroke="#94a3b8"
          strokeWidth="1.5"
        />

        {/* Punching Perimeter b0 */}
        {footingType !== 'wall_strip' && (
          <rect
            x={planCx - punchW / 2}
            y={planCy - punchL / 2}
            width={punchW}
            height={punchL}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="1.2"
            strokeDasharray="3 2"
          />
        )}

        {/* Column Stub / Wall */}
        <rect
          x={planCx - (footingType === 'wall_strip' ? planB / 2 : planC2 / 2)}
          y={planCy - planC1 / 2}
          width={footingType === 'wall_strip' ? planB : planC2}
          height={planC1}
          fill="#38bdf8"
          stroke="#0284c7"
          strokeWidth="1.5"
        />

        {/* --- ELEVATION VIEW (RIGHT) --- */}
        <text x={elevX + elevW / 2} y="22" fill="#cbd5e1" fontSize="9" textAnchor="middle" fontWeight="bold">
          ELEVATION & SOIL STRESS PROFILE
        </text>

        {/* Concrete Footing Cross-Section */}
        <rect
          x={elevX}
          y={elevY}
          width={elevW}
          height={elevH}
          fill="#334155"
          stroke="#94a3b8"
          strokeWidth="1.5"
        />

        {/* Column Stub on Top */}
        <rect
          x={elevX + elevW / 2 - 20}
          y={elevY - 25}
          width="40"
          height="25"
          fill="#38bdf8"
          stroke="#0284c7"
          strokeWidth="1.5"
        />

        {/* Bottom Rebar Mesh (Red) */}
        <line
          x1={elevX + 8}
          y1={elevY + elevH - 8}
          x2={elevX + elevW - 8}
          y2={elevY + elevH - 8}
          stroke="#ef4444"
          strokeWidth="2.5"
        />

        {/* Top Rebar Mesh (Orange) - If Double Mesh selected */}
        {meshType === 'double_mesh' && (
          <line
            x1={elevX + 8}
            y1={elevY + 8}
            x2={elevX + elevW - 8}
            y2={elevY + 8}
            stroke="#f59e0b"
            strokeWidth="2.5"
          />
        )}

        {/* Soil Pressure Trapezoid */}
        <polygon
          points={`${elevX},${elevY + elevH + 4} ${elevX + elevW},${elevY + elevH + 4} ${elevX + elevW},${elevY + elevH + 4 + hQMax} ${elevX},${elevY + elevH + 4 + hQMin}`}
          fill="#f59e0b"
          opacity="0.3"
          stroke="#f59e0b"
          strokeWidth="1.5"
        />

        {/* Pressure Labels */}
        <text x={elevX - 2} y={elevY + elevH + 18} fill="#f59e0b" fontSize="7.5" textAnchor="end" fontWeight="bold">
          q_min={result ? result.geotechnical.q_min : 0}
        </text>
        <text x={elevX + elevW + 2} y={elevY + elevH + 18} fill="#f59e0b" fontSize="7.5" textAnchor="start" fontWeight="bold">
          q_max={result ? result.geotechnical.q_max : 0}
        </text>

        <text x={elevX + elevW / 2} y={elevY + elevH / 2 + 3} fill="#cbd5e1" fontSize="8" textAnchor="middle">
          D = {footingD}mm ({meshType.replace('_', ' ')})
        </text>
      </svg>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 font-sans">
      {/* Control Inputs Panel */}
      <div className="lg:col-span-5 space-y-4 bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-xl">
        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
          <h3 className="font-semibold text-slate-200 text-sm">Foundation Config</h3>
          <select
            value={code}
            onChange={(e) => setCode(e.target.value as DesignCode)}
            className="bg-cyan-500/20 text-cyan-400 font-bold border border-cyan-500/30 rounded px-2 py-1 text-xs"
          >
            <option value="ACI318">ACI 318-19</option>
            <option value="EC2">Eurocode 2</option>
          </select>
        </div>

        {/* Foundation Type & Mesh Selection */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Foundation Type</label>
            <select
              value={footingType}
              onChange={(e) => setFootingType(e.target.value as FootingType)}
              className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-medium"
            >
              <option value="isolated_pad">Isolated Pad Footing</option>
              <option value="wall_strip">Continuous Wall / Strip</option>
              <option value="combined">Combined Footing</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Rebar Mesh Layout</label>
            <select
              value={meshType}
              onChange={(e) => setMeshType(e.target.value as MeshType)}
              className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-medium"
            >
              <option value="single_mesh">Single Mesh (Bottom)</option>
              <option value="double_mesh">Double Mesh (Top & Bot)</option>
            </select>
          </div>
        </div>

        {/* Geometry Dimensions */}
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
            <label className="block text-xs text-slate-400 mb-1">Depth D (mm)</label>
            <input
              type="number"
              value={footingD}
              onChange={(e) => setFootingD(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-mono"
            />
          </div>
        </div>

        {/* Column Geometry */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              {footingType === 'wall_strip' ? 'Wall Thick c1 (mm)' : 'Column c1 (mm)'}
            </label>
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
              disabled={footingType === 'wall_strip'}
              value={colC2}
              onChange={(e) => setColC2(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200 font-mono disabled:opacity-40"
            />
          </div>
        </div>

        {/* Soil & Reinforcement Details */}
        <div className="space-y-3 pt-2 border-t border-slate-800">
          <div className="grid grid-cols-2 gap-3">
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Bot Bar Ø (mm)</label>
              <input
                type="number"
                value={barDiam}
                onChange={(e) => setBarDiam(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Bot Spacing (mm)</label>
              <input
                type="number"
                value={barSpacing}
                onChange={(e) => setBarSpacing(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200 font-mono"
              />
            </div>
          </div>

          {meshType === 'double_mesh' && (
            <div className="grid grid-cols-2 gap-3 p-2.5 bg-slate-950 rounded border border-slate-800">
              <div>
                <label className="block text-xs text-amber-400 mb-1">Top Bar Ø (mm)</label>
                <input
                  type="number"
                  value={topBarDiam}
                  onChange={(e) => setTopBarDiam(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-amber-400 mb-1">Top Spacing (mm)</label>
                <input
                  type="number"
                  value={topBarSpacing}
                  onChange={(e) => setTopBarSpacing(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-mono"
                />
              </div>
            </div>
          )}
        </div>

        {/* Loads */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
          <div>
            <label className="block text-xs text-slate-400 mb-1">P_Dead / P_Live (kN)</label>
            <div className="flex gap-1">
              <input
                type="number"
                value={P_Dead}
                onChange={(e) => setP_Dead(Number(e.target.value))}
                className="w-1/2 bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-mono"
              />
              <input
                type="number"
                value={P_Live}
                onChange={(e) => setP_Live(Number(e.target.value))}
                className="w-1/2 bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">M_Dead / M_Live (kN·m)</label>
            <div className="flex gap-1">
              <input
                type="number"
                value={M_Dead}
                onChange={(e) => setM_Dead(Number(e.target.value))}
                className="w-1/2 bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-mono"
              />
              <input
                type="number"
                value={M_Live}
                onChange={(e) => setM_Live(Number(e.target.value))}
                className="w-1/2 bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-mono"
              />
            </div>
          </div>
        </div>

        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold py-2.5 rounded transition shadow-lg shadow-cyan-500/20"
        >
          {loading ? 'Analyzing Foundation...' : `Run Analysis (${code})`}
        </button>

        {result && (
          <button
            onClick={generatePDF}
            disabled={pdfGenerating}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2 rounded transition shadow-lg mt-2"
          >
            {pdfGenerating ? 'Generating PDF Report...' : '📄 Download PDF Report (With Drawings)'}
          </button>
        )}
      </div>

      {/* Visualizations & Output Metrics */}
      <div className="lg:col-span-7 space-y-6">
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
          <h4 className="text-xs font-bold text-slate-300 mb-2 border-b border-slate-800 pb-1 flex justify-between">
            <span>FOUNDATION PLAN & ELEVATION VISUALIZER</span>
            <span className="text-cyan-400">{footingType.toUpperCase()}</span>
          </h4>
          <div className="bg-slate-950/80 p-2 rounded border border-slate-800 flex justify-center">
            {renderCompositeSVG()}
          </div>
        </div>

        {/* Dynamic Metric Cards */}
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
                {footingType === 'wall_strip' ? 'N/A' : result.dcr.shear_2way_dcr}
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

        {/* Compliance Table */}
        {result && (
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2 flex justify-between">
              <span>Foundation Compliance Matrix</span>
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
                    <td className="py-2 text-slate-200 font-sans">Bearing Pressure (q_max)</td>
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
                    <td className="py-2">{footingType === 'wall_strip' ? '-' : `${result.structural.Vu_2way} kN`}</td>
                    <td className="py-2 text-emerald-400">{footingType === 'wall_strip' ? '-' : `${result.structural.phiVc_2way} kN`}</td>
                    <td className="py-2 font-bold">{footingType === 'wall_strip' ? 'N/A' : result.dcr.shear_2way_dcr}</td>
                    <td className="py-2 font-sans font-bold text-emerald-400">
                      {footingType === 'wall_strip' ? 'N/A' : result.dcr.shear_2way_dcr <= 1.0 ? 'PASS' : 'FAIL'}
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
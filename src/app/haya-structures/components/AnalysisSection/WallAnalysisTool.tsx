'use client';

import React, { useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type DesignCode = 'ACI318' | 'EC2' | 'BS8110';
type WallType = 'shear_wall_inplane' | 'shear_wall_outplane' | 'basement_wall';

interface WallResult {
  wall_type: WallType;
  design_code: DesignCode;
  geometry: {
    length: number;      // L (mm)
    thickness: number;   // t (mm)
    height: number;      // H (mm)
    cover: number;       // c (mm)
    Ag: number;          // Gross area (mm²)
  };
  geotechnical: {
    phi: number;         // Friction angle (degrees)
    gamma: number;       // Soil unit weight (kN/m³)
    surcharge: number;   // Surcharge load q (kPa)
    Ka: number;          // Active earth pressure coefficient
    Kp: number;          // Passive earth pressure coefficient
    K0: number;          // At-rest earth pressure coefficient
    K_used: number;      // Governing K coefficient
    P_soil: number;      // Lateral soil force (kN/m)
    P_surcharge: number; // Surcharge lateral force (kN/m)
  };
  reinforcement: {
    vert_bar_diam: number;
    vert_spacing: number;
    horiz_bar_diam: number;
    horiz_spacing: number;
    layers: number;
    rho_v: number;      // Vertical steel ratio %
    rho_h: number;      // Horizontal steel ratio %
    Ast_v: number;      // Total vertical steel area (mm²)
    Ast_h: number;      // Total horizontal steel area (mm²/m)
  };
  loads: {
    Pu: number;   // Axial force (kN)
    Mu: number;   // Bending moment (kN·m)
    Vu: number;   // Shear force (kN)
  };
  capacity: {
    phiPn_max: number; // Max axial capacity (kN)
    phiMn: number;    // Bending moment capacity (kN·m)
    phiVn: number;    // Shear capacity (kN)
  };
  dcr: {
    axial_dcr: number;
    flexure_dcr: number;
    shear_dcr: number;
    combined_dcr: number;
    slenderness_ratio: number;
  };
  verification: {
    status: 'SAFE' | 'OVERSTRESSED';
    min_steel_status: 'PASS' | 'FAIL';
    slenderness_status: 'PASS' | 'SLENDER_WARNING';
    governing_check: string;
  };
}

export default function WallAnalysisTool() {
  const [designCode, setDesignCode] = useState<DesignCode>('ACI318');
  const [wallType, setWallType] = useState<WallType>('basement_wall');

  // Wall Dimensions (mm)
  const [length, setLength] = useState<number>(3000);   // Wall length L (mm)
  const [thickness, setThickness] = useState<number>(300); // Wall thickness t (mm)
  const [height, setHeight] = useState<number>(3500);   // Retained height H (mm)
  const [cover, setCover] = useState<number>(40);       // Clear cover c (mm)

  // Geotechnical / Earth Pressure Parameters
  const [autoSoilCalc, setAutoSoilCalc] = useState<boolean>(true);
  const [phiDeg, setPhiDeg] = useState<number>(30);      // Friction angle (deg)
  const [gammaSoil, setGammaSoil] = useState<number>(18);  // Unit weight (kN/m³)
  const [surchargeQ, setSurchargeQ] = useState<number>(10); // Surcharge q (kPa)

  // Reinforcement Configuration
  const [vertBarDiam, setVertBarDiam] = useState<number>(16);   // Vertical rebar diam (mm)
  const [vertSpacing, setVertSpacing] = useState<number>(150);  // Vertical spacing (mm)
  const [horizBarDiam, setHorizBarDiam] = useState<number>(12);  // Horizontal rebar diam (mm)
  const [horizSpacing, setHorizSpacing] = useState<number>(200); // Horizontal spacing (mm)
  const [curtainLayers, setCurtainLayers] = useState<number>(2); // Rebar curtains

  // Materials (MPa)
  const [fc, setFc] = useState<number>(30);  // Concrete f'c (MPa)
  const [fy, setFy] = useState<number>(420); // Steel fy (MPa)

  // Applied Design Loads
  const [Pu, setPu] = useState<number>(300);  // Axial Load (kN)
  const [Mu, setMu] = useState<number>(180);  // Bending Moment (kN·m)
  const [Vu, setVu] = useState<number>(120);  // Shear Force (kN)

  const [result, setResult] = useState<WallResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [downloadingPdf, setDownloadingPdf] = useState<boolean>(false);

  // --- STRUCTURAL & EARTH PRESSURE ANALYSIS ENGINE ---
  const handleAnalyze = () => {
    setLoading(true);

    try {
      const L = Math.max(Number(length), 300);
      const t = Math.max(Number(thickness), 100);
      const H_mm = Math.max(Number(height), 500);
      const H_m = H_mm / 1000; // Height in meters
      const c = Number(cover);
      const f_c = Number(fc);
      const f_y = Number(fy);

      // Strip analysis width: 1000mm for basement/retaining out-of-plane, or full L for in-plane shear wall
      const isOutPlane = wallType === 'shear_wall_outplane' || wallType === 'basement_wall';
      const b_eff = isOutPlane ? 1000 : L;

      // 1. Earth Pressure Calculations
      const phiRad = (Math.min(Math.max(Number(phiDeg), 5), 45) * Math.PI) / 180;
      const gamma = Math.max(Number(gammaSoil), 10);
      const q = Math.max(Number(surchargeQ), 0);

      const Ka = Math.pow(Math.tan(Math.PI / 4 - phiRad / 2), 2);
      const Kp = 1 / Ka;
      const K0 = 1 - Math.sin(phiRad);

      // Governing K Coefficient (K0 for rigid basement wall, Ka for yielding retaining wall)
      let K_used = wallType === 'basement_wall' ? K0 : Ka;
      if (wallType === 'shear_wall_inplane') K_used = 0; // In-plane wall ignores lateral soil pressure by default

      // Soil & Surcharge Forces per meter strip (kN/m)
      const P_soil_strip = 0.5 * K_used * gamma * Math.pow(H_m, 2);
      const P_surcharge_strip = K_used * q * H_m;

      // Resultant Forces and Base Moments (Service / Unfactored)
      const M_soil_strip = P_soil_strip * (H_m / 3);
      const M_surcharge_strip = P_surcharge_strip * (H_m / 2);

      let calc_Vu = (P_soil_strip + P_surcharge_strip) * (b_eff / 1000);
      let calc_Mu = (M_soil_strip + M_surcharge_strip) * (b_eff / 1000);

      // Factored Ultimate Loads (Apply 1.6 Earth/Surcharge Load Factor per ACI 318)
      if (autoSoilCalc && isOutPlane) {
        calc_Vu = Number((calc_Vu * 1.6).toFixed(1));
        calc_Mu = Number((calc_Mu * 1.6).toFixed(1));
        setVu(calc_Vu);
        setMu(calc_Mu);
      }

      const p_u = Math.abs(Number(Pu));
      const m_u = autoSoilCalc && isOutPlane ? calc_Mu : Math.abs(Number(Mu));
      const v_u = autoSoilCalc && isOutPlane ? calc_Vu : Math.abs(Number(Vu));

      // 2. Gross Concrete Area (Ag)
      const Ag = b_eff * t;

      // 3. Reinforcement Calculations
      const db_v = Number(vertBarDiam);
      const s_v = Math.max(Number(vertSpacing), 50);
      const db_h = Number(horizBarDiam);
      const s_h = Math.max(Number(horizSpacing), 50);
      const numLayers = Math.max(Number(curtainLayers), 1);

      const A_bar_v = (Math.PI / 4) * Math.pow(db_v, 2);
      const A_bar_h = (Math.PI / 4) * Math.pow(db_h, 2);

      const vertBarsCount = Math.floor(b_eff / s_v) + 1;
      const Ast_v = vertBarsCount * A_bar_v * numLayers;

      const horizBarsPerMeter = Math.floor(1000 / s_h);
      const Ast_h = horizBarsPerMeter * A_bar_h * numLayers;

      const rho_v = (Ast_v / Ag) * 100;
      const rho_h = (Ast_h / (1000 * t)) * 100;

      const min_rho = db_v <= 16 ? 0.12 : 0.15;
      const min_steel_status = rho_v >= min_rho && rho_h >= min_rho ? 'PASS' : 'FAIL';

      // 4. Slenderness Check (H / t)
      const slenderness_ratio = H_mm / t;
      const slenderness_limit = isOutPlane ? 30 : 25;
      const slenderness_status = slenderness_ratio <= slenderness_limit ? 'PASS' : 'SLENDER_WARNING';

      // 5. Axial Compression Capacity (phiPn_max)
      const P0 = (0.85 * f_c * (Ag - Ast_v) + f_y * Ast_v) / 1000; // kN
      const phi_axial = 0.65;
      const phiPn_max = Math.max(0.80 * phi_axial * P0, 1.0);

      // 6. Flexural Capacity (phiMn)
      const d_eff = isOutPlane ? t - c - db_v / 2 : L - c - db_v / 2;
      const phi_flexure = 0.90;

      const a = (Ast_v * f_y) / (0.85 * f_c * b_eff);
      const Mn = (Ast_v * f_y * (d_eff - a / 2)) / 1e6; // kN·m
      const phiMn = Math.max(phi_flexure * Mn, 1.0);

      // 7. Shear Capacity (phiVn)
      const phi_shear = 0.75;
      const Vc = (0.17 * Math.sqrt(f_c) * b_eff * d_eff) / 1000; // Concrete shear (kN)
      const Vs = (Ast_h * f_y * d_eff) / (s_h * 1000);           // Steel shear (kN)
      const phiVn = Math.max(phi_shear * (Vc + Vs), 1.0);

      // 8. Demand Capacity Ratios (DCR)
      const axial_dcr = p_u / phiPn_max;
      const flexure_dcr = m_u / phiMn;
      const shear_dcr = v_u / phiVn;

      const combined_dcr = axial_dcr >= 0.2 
        ? axial_dcr + (8 / 9) * flexure_dcr 
        : axial_dcr / 2 + flexure_dcr;

      const overall_dcr = Math.max(combined_dcr, shear_dcr);

      let governing_check = 'P-M Flexural Interaction';
      if (shear_dcr > combined_dcr) governing_check = 'Lateral Shear Capacity';
      if (min_steel_status === 'FAIL') governing_check = 'Minimum Reinforcement Limit (< 0.12%)';
      if (slenderness_status === 'SLENDER_WARNING') governing_check = 'Wall Slenderness Limit Exceeded (H/t > 30)';

      const res: WallResult = {
        wall_type: wallType,
        design_code: designCode,
        geometry: {
          length: L,
          thickness: t,
          height: H_mm,
          cover: c,
          Ag: Math.round(Ag),
        },
        geotechnical: {
          phi: Number(phiDeg),
          gamma,
          surcharge: q,
          Ka: Number(Ka.toFixed(3)),
          Kp: Number(Kp.toFixed(3)),
          K0: Number(K0.toFixed(3)),
          K_used: Number(K_used.toFixed(3)),
          P_soil: Number(P_soil_strip.toFixed(1)),
          P_surcharge: Number(P_surcharge_strip.toFixed(1)),
        },
        reinforcement: {
          vert_bar_diam: db_v,
          vert_spacing: s_v,
          horiz_bar_diam: db_h,
          horiz_spacing: s_h,
          layers: numLayers,
          rho_v: Number(rho_v.toFixed(2)),
          rho_h: Number(rho_h.toFixed(2)),
          Ast_v: Math.round(Ast_v),
          Ast_h: Math.round(Ast_h),
        },
        loads: {
          Pu: p_u,
          Mu: m_u,
          Vu: v_u,
        },
        capacity: {
          phiPn_max: Number(phiPn_max.toFixed(1)),
          phiMn: Number(phiMn.toFixed(1)),
          phiVn: Number(phiVn.toFixed(1)),
        },
        dcr: {
          axial_dcr: Number(axial_dcr.toFixed(3)),
          flexure_dcr: Number(flexure_dcr.toFixed(3)),
          shear_dcr: Number(shear_dcr.toFixed(3)),
          combined_dcr: Number(combined_dcr.toFixed(3)),
          slenderness_ratio: Number(slenderness_ratio.toFixed(1)),
        },
        verification: {
          status: overall_dcr <= 1.0 && min_steel_status === 'PASS' ? 'SAFE' : 'OVERSTRESSED',
          min_steel_status,
          slenderness_status,
          governing_check,
        },
      };

      setResult(res);
    } catch (err) {
      console.error('Wall Analysis error:', err);
      alert('An error occurred during earth pressure and wall structural calculations.');
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
        const w = bbox.width || 320;
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

  // --- PDF REPORT GENERATION ---
  const generatePDF = async () => {
    if (!result) return;
    setDownloadingPdf(true);

    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const dateStr = new Date().toLocaleDateString();

      // Header Banner
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 18, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(56, 189, 248);
      doc.text('HAYA STRUCTURES | BASEMENT & EARTH PRESSURE REPORT', 12, 10);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(226, 232, 240);
      doc.text(`Code: ${designCode} | Type: ${wallType.replace(/_/g, ' ').toUpperCase()} | Date: ${dateStr}`, 12, 15);

      // Section 1: Inputs & Soil Parameters
      autoTable(doc, {
        startY: 22,
        margin: { left: 12 },
        tableWidth: 90,
        head: [['Geotechnical & Structural Inputs', 'Value / Unit']],
        body: [
          ['Wall Application', wallType.replace(/_/g, ' ').toUpperCase()],
          ['Wall Height (H)', `${result.geometry.height} mm`],
          ['Wall Thickness (t)', `${result.geometry.thickness} mm`],
          ['Soil Friction Angle (φ)', `${result.geotechnical.phi}°`],
          ['Soil Unit Weight (γ)', `${result.geotechnical.gamma} kN/m³`],
          ['Surcharge Load (q)', `${result.geotechnical.surcharge} kPa`],
          ['Active Coeff (Ka)', `${result.geotechnical.Ka}`],
          ['At-Rest Coeff (K0)', `${result.geotechnical.K0}`],
          ['Design Pressure Coeff (K)', `${result.geotechnical.K_used}`],
          ['Vertical Steel', `Ø${result.reinforcement.vert_bar_diam} @ ${result.reinforcement.vert_spacing}mm`],
        ],
        theme: 'grid',
        headStyles: { fillColor: [14, 116, 144], fontSize: 7.5, cellPadding: 2, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7, cellPadding: 1.8 },
      });

      autoTable(doc, {
        startY: 22,
        margin: { left: 108 },
        tableWidth: 90,
        head: [['Analysis & Section Capacities', 'Result / Status']],
        body: [
          ['Lateral Soil Force (P_soil)', `${result.geotechnical.P_soil} kN/m`],
          ['Surcharge Force (P_q)', `${result.geotechnical.P_surcharge} kN/m`],
          ['Ultimate Shear (Vu)', `${result.loads.Vu} kN`],
          ['Ultimate Moment (Mu)', `${result.loads.Mu} kN·m`],
          ['Vertical Steel Area (Ast,v)', `${result.reinforcement.Ast_v} mm²`],
          ['Slenderness Ratio (H/t)', `${result.dcr.slenderness_ratio} (${result.verification.slenderness_status})`],
          ['Axial Capacity (φPn,max)', `${result.capacity.phiPn_max} kN`],
          ['Flexural Capacity (φMn)', `${result.capacity.phiMn} kN·m`],
          ['Shear Capacity (phiVn)', `${result.capacity.phiVn} kN`],
          ['Governing Failure Check', result.verification.governing_check],
          ['Overall Compliance', result.verification.status],
        ],
        theme: 'grid',
        headStyles: { fillColor: [15, 118, 110], fontSize: 7.5, cellPadding: 2, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7, cellPadding: 1.8 },
      });

      // Section 2: SVG Diagram Embed
      let currentY = 102;
      const wallSvg = document.getElementById('wall-section-svg') as unknown as SVGSVGElement;

      if (wallSvg) {
        try {
          const wallPng = await convertSvgToPng(wallSvg, '#0f172a');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(15, 23, 42);
          doc.text('WALL SECTION & LATERAL EARTH PRESSURE PROFILE', 12, currentY);
          currentY += 4;

          doc.addImage(wallPng, 'PNG', 45, currentY, 120, 60);
          currentY += 63;
        } catch (e) {
          console.warn('SVG PDF rendering failed:', e);
          currentY += 10;
        }
      }

      // Section 3: Compliance Matrix
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text('STRUCTURAL DEMAND VS CAPACITY RATIO (DCR) MATRIX', 12, currentY);
      currentY += 3;

      autoTable(doc, {
        startY: currentY,
        margin: { left: 12, right: 12 },
        head: [['Structural Limit State Check', 'Design Demand', 'Design Capacity', 'DCR Ratio', 'Verdict']],
        body: [
          ['Axial Compression Load', `${result.loads.Pu} kN`, `${result.capacity.phiPn_max} kN`, `${result.dcr.axial_dcr}`, result.dcr.axial_dcr <= 1.0 ? 'PASS' : 'FAIL'],
          ['Flexural Bending Resistance', `${result.loads.Mu} kN·m`, `${result.capacity.phiMn} kN·m`, `${result.dcr.flexure_dcr}`, result.dcr.flexure_dcr <= 1.0 ? 'PASS' : 'FAIL'],
          ['Combined P-M Interaction Ratio', 'P-M Surface', 'Interaction Limit', `${result.dcr.combined_dcr}`, result.dcr.combined_dcr <= 1.0 ? 'PASS' : 'FAIL'],
          ['Lateral Shear Resistance (Vu)', `${result.loads.Vu} kN`, `${result.capacity.phiVn} kN`, `${result.dcr.shear_dcr}`, result.dcr.shear_dcr <= 1.0 ? 'PASS' : 'FAIL'],
          ['Minimum Steel Ratio Check', 'ρv, ρh', 'Min 0.12%', `${result.reinforcement.rho_v}%`, result.verification.min_steel_status],
        ],
        theme: 'grid',
        headStyles: { fillColor: [30, 41, 59], fontSize: 7.5, cellPadding: 2, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7, cellPadding: 1.8 },
      });

      // Section 4: Engineering Sign-off
      const finalTableY = (doc as any).lastAutoTable.finalY + 6;

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(12, finalTableY, 110, 36, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text('EARTH PRESSURE DESIGN ASSUMPTIONS', 16, finalTableY + 5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(51, 65, 85);
      const notes = [
        `1. Earth pressure calculated via Rankine Theory (K0 = 1-sin φ = ${result.geotechnical.K0}).`,
        `2. Surcharge pressure distribution assumed uniform: σ_q = K * q (${result.geotechnical.surcharge} kPa).`,
        '3. Ultimate lateral loads factored with 1.6 factor per ACI 318 ULS combinations.',
        '4. Verification assumes rigid non-yielding basement wall restraints.',
      ];
      notes.forEach((note, idx) => {
        doc.text(note, 16, finalTableY + 11 + idx * 5.5);
      });

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(128, finalTableY, 70, 36, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text('VERIFICATION STAMP', 132, finalTableY + 5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text('Engineered By: Haya Wall Engine', 132, finalTableY + 12);
      doc.text('Status:', 132, finalTableY + 19);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(result.verification.status === 'SAFE' ? 16 : 225, result.verification.status === 'SAFE' ? 185 : 29, result.verification.status === 'SAFE' ? 129 : 72);
      doc.text(result.verification.status === 'SAFE' ? 'APPROVED / COMPLIANT' : 'OVERSTRESSED', 145, finalTableY + 19);

      doc.setDrawColor(148, 163, 184);
      doc.line(132, finalTableY + 28, 192, finalTableY + 28);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(6);
      doc.setTextColor(100, 116, 139);
      doc.text('Authorized Geotechnical & Structural Seal', 132, finalTableY + 32);

      doc.save(`Haya_EarthPressure_Wall_${designCode}_${wallType}.pdf`);
    } catch (err) {
      console.error('Wall PDF Export Error:', err);
      alert('Failed to generate Earth Pressure Wall PDF report.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  // --- SVG CROSS SECTION & LATERAL EARTH PRESSURE DIAGRAM ---
  const renderWallSVG = () => {
    const svgWidth = 320;
    const svgHeight = 220;
    const wallX = 140;
    const wallYTop = 30;
    const wallYBot = 180;
    const wallH = wallYBot - wallYTop;

    const t = Number(thickness);
    const scaledT = Math.min(Math.max((t / 300) * 26, 18), 45);

    // Lateral Pressure Triangle Coordinates (Soil + Surcharge)
    const soilPresX = wallX - 70;      // Triangular soil pressure width
    const surchPresX = wallX - 35;     // Uniform surcharge pressure width

    return (
      <svg id="wall-section-svg" viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-56 drop-shadow-md">
        <defs>
          <pattern id="soilHatch" width="10" height="10" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="10" stroke="#334155" strokeWidth="1.2" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="#0f172a" rx="6" />

        {/* Backfill Soil Mass */}
        <polygon
          points={`20,${wallYTop} ${wallX},${wallYTop} ${wallX},${wallYBot} 20,${wallYBot}`}
          fill="url(#soilHatch)"
          opacity="0.6"
        />

        {/* Concrete Wall Main Body */}
        <rect
          x={wallX}
          y={wallYTop}
          width={scaledT}
          height={wallH}
          fill="#475569"
          stroke="#94a3b8"
          strokeWidth="2"
        />

        {/* Rebar Lines (Vertical Curtains) */}
        <line x1={wallX + 5} y1={wallYTop + 5} x2={wallX + 5} y2={wallYBot - 5} stroke="#f59e0b" strokeWidth="2.5" strokeDasharray="4 2" />
        {curtainLayers >= 2 && (
          <line x1={wallX + scaledT - 5} y1={wallYTop + 5} x2={wallX + scaledT - 5} y2={wallYBot - 5} stroke="#f59e0b" strokeWidth="2.5" strokeDasharray="4 2" />
        )}

        {/* Surcharge Uniform Pressure Rect (q) */}
        {autoSoilCalc && surchargeQ > 0 && (
          <polygon
            points={`${surchPresX},${wallYTop} ${wallX},${wallYTop} ${wallX},${wallYBot} ${surchPresX},${wallYBot}`}
            fill="#38bdf8"
            opacity="0.25"
            stroke="#38bdf8"
            strokeWidth="1"
            strokeDasharray="2 2"
          />
        )}

        {/* Active/At-Rest Soil Pressure Triangle */}
        {autoSoilCalc && (
          <polygon
            points={`${wallX},${wallYTop} ${wallX},${wallYBot} ${soilPresX},${wallYBot}`}
            fill="#f59e0b"
            opacity="0.3"
            stroke="#f59e0b"
            strokeWidth="1.5"
          />
        )}

        {/* Pressure Vectors (Arrows) */}
        {autoSoilCalc && (
          <>
            <path d={`M ${soilPresX + 10} ${wallYBot - 10} L ${wallX - 2} ${wallYBot - 10}`} stroke="#f59e0b" strokeWidth="2" markerEnd="url(#arrow)" />
            <path d={`M ${surchPresX + 5} ${wallYTop + 30} L ${wallX - 2} ${wallYTop + 30}`} stroke="#38bdf8" strokeWidth="1.5" />
            <text x={soilPresX - 5} y={wallYBot - 5} fill="#f59e0b" fontSize="8" fontWeight="bold">p_soil</text>
            <text x={surchPresX - 5} y={wallYTop + 25} fill="#38bdf8" fontSize="8" fontWeight="bold">q_surcharge</text>
          </>
        )}

        {/* Labels & Callouts */}
        <text x={wallX + scaledT + 8} y={wallYTop + wallH / 2} fill="#cbd5e1" fontSize="9" fontWeight="bold">
          H = {height}mm
        </text>
        <text x={wallX + scaledT / 2} y={wallYBot + 15} fill="#94a3b8" fontSize="8" textAnchor="middle">
          t = {thickness}mm
        </text>
      </svg>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 font-sans">
      {/* Control Input Panel */}
      <div className="lg:col-span-5 space-y-4 bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-xl">
        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
          <h3 className="font-semibold text-slate-200 text-sm">Wall & Soil Parameters</h3>
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

        {/* Wall Application Type Selector */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Wall Type Application</label>
          <select
            value={wallType}
            onChange={(e) => setWallType(e.target.value as WallType)}
            className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200 font-medium"
          >
            <option value="basement_wall">RC Basement Wall (Unyielding At-Rest K0)</option>
            <option value="shear_wall_outplane">RC Retaining Wall / Out-of-Plane Shear (Active Ka)</option>
            <option value="shear_wall_inplane">RC Core Shear Wall (In-Plane Load Bearing)</option>
          </select>
        </div>

        {/* Automatic Earth Pressure Calculation Toggle */}
        <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded border border-slate-800">
          <span className="text-xs text-slate-300 font-medium">Auto Rankine Earth Pressure</span>
          <input
            type="checkbox"
            checked={autoSoilCalc}
            onChange={(e) => setAutoSoilCalc(e.target.checked)}
            className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
          />
        </div>

        {/* Geotechnical Parameters Section */}
        {autoSoilCalc && (
          <div className="space-y-3 p-3 bg-slate-950/60 rounded border border-slate-800">
            <h4 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">Geotechnical Parameters</h4>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Soil φ (°)</label>
                <input
                  type="number"
                  value={phiDeg}
                  onChange={(e) => setPhiDeg(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">γ (kN/m³)</label>
                <input
                  type="number"
                  value={gammaSoil}
                  onChange={(e) => setGammaSoil(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Surcharge q (kPa)</label>
                <input
                  type="number"
                  value={surchargeQ}
                  onChange={(e) => setSurchargeQ(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {/* Geometry Dimensions */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Thickness t (mm)</label>
            <input
              type="number"
              value={thickness}
              onChange={(e) => setThickness(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200 font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Height H (mm)</label>
            <input
              type="number"
              value={height}
              onChange={(e) => setHeight(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200 font-mono"
            />
          </div>
        </div>

        {/* Reinforcement Configuration */}
        <div className="space-y-3 pt-2 border-t border-slate-800">
          <div className="flex justify-between items-center">
            <h4 className="font-semibold text-xs uppercase tracking-wider text-cyan-400">
              Reinforcement Config
            </h4>
            <select
              value={curtainLayers}
              onChange={(e) => setCurtainLayers(Number(e.target.value))}
              className="bg-slate-950 text-slate-200 text-xs border border-slate-800 rounded px-2 py-0.5"
            >
              <option value={1}>1 Rebar Layer</option>
              <option value={2}>2 Rebar Layers (Double)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Vert Bar Ø (mm)</label>
              <input
                type="number"
                value={vertBarDiam}
                onChange={(e) => setVertBarDiam(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Vert Spacing (mm)</label>
              <input
                type="number"
                value={vertSpacing}
                onChange={(e) => setVertSpacing(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Material & Direct Loads */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Pu (kN)</label>
            <input
              type="number"
              value={Pu}
              onChange={(e) => setPu(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-sm text-slate-200 font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Mu (kN·m)</label>
            <input
              type="number"
              disabled={autoSoilCalc && wallType !== 'shear_wall_inplane'}
              value={Mu}
              onChange={(e) => setMu(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-sm text-slate-200 font-mono disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Vu (kN)</label>
            <input
              type="number"
              disabled={autoSoilCalc && wallType !== 'shear_wall_inplane'}
              value={Vu}
              onChange={(e) => setVu(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-sm text-slate-200 font-mono disabled:opacity-50"
            />
          </div>
        </div>

        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold py-2.5 rounded transition disabled:opacity-50 mt-4 shadow-lg shadow-cyan-500/20"
        >
          {loading ? 'Analyzing Earth Pressure & Wall...' : `Run Analysis (${designCode})`}
        </button>

        {result && (
          <button
            onClick={generatePDF}
            disabled={downloadingPdf}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2 rounded transition shadow-lg mt-2"
          >
            {downloadingPdf ? 'Generating PDF Report...' : '📄 Download Complete Geotechnical PDF'}
          </button>
        )}
      </div>

      {/* Visualizations & Output Metrics */}
      <div className="lg:col-span-7 space-y-6">
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
          <h4 className="text-xs font-bold text-slate-300 mb-2 border-b border-slate-800 pb-1 flex justify-between">
            <span>EARTH PRESSURE & WALL CROSS-SECTION</span>
            <span className="text-cyan-400">{wallType.replace(/_/g, ' ').toUpperCase()}</span>
          </h4>
          <div className="bg-slate-950/80 p-2 rounded border border-slate-800 flex justify-center">
            {renderWallSVG()}
          </div>
        </div>

        {/* Metric Summary Cards */}
        {result && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center">
              <span className="text-xs text-slate-400 block mb-1">Earth Coeff (K)</span>
              <span className="text-lg font-bold font-mono text-cyan-400">
                {result.geotechnical.K_used}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center">
              <span className="text-xs text-slate-400 block mb-1">Flexure DCR</span>
              <span className={`text-lg font-bold font-mono ${result.dcr.flexure_dcr <= 1.0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {result.dcr.flexure_dcr}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center">
              <span className="text-xs text-slate-400 block mb-1">Shear DCR</span>
              <span className={`text-lg font-bold font-mono ${result.dcr.shear_dcr <= 1.0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {result.dcr.shear_dcr}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center">
              <span className="text-xs text-slate-400 block mb-1">Slenderness (H/t)</span>
              <span className={`text-lg font-bold font-mono ${result.verification.slenderness_status === 'PASS' ? 'text-emerald-400' : 'text-amber-400'}`}>
                {result.dcr.slenderness_ratio}
              </span>
            </div>
          </div>
        )}

        {/* Structural Matrix Output */}
        {result && (
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2 flex justify-between">
              <span>Geotechnical & Structural Verification</span>
              <span className={`text-xs px-2 py-0.5 rounded ${result.verification.status === 'SAFE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                {result.verification.status}
              </span>
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-2 font-semibold">Limit State Check</th>
                    <th className="pb-2 font-semibold">Demand</th>
                    <th className="pb-2 font-semibold">Capacity</th>
                    <th className="pb-2 font-semibold">DCR</th>
                    <th className="pb-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-slate-300">
                  <tr>
                    <td className="py-2 text-slate-200 font-sans">Earth Pressure Resultant (P)</td>
                    <td className="py-2">{result.geotechnical.P_soil} kN/m</td>
                    <td className="py-2 text-cyan-400">K = {result.geotechnical.K_used}</td>
                    <td className="py-2 font-bold">-</td>
                    <td className="py-2 font-sans font-bold text-cyan-400">CALCULATED</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-200 font-sans">Flexural Moment (Mu)</td>
                    <td className="py-2">{result.loads.Mu} kN·m</td>
                    <td className="py-2 text-emerald-400">{result.capacity.phiMn} kN·m</td>
                    <td className="py-2 font-bold">{result.dcr.flexure_dcr}</td>
                    <td className="py-2 font-sans font-bold">
                      <span className={result.dcr.flexure_dcr <= 1.0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {result.dcr.flexure_dcr <= 1.0 ? 'PASS' : 'FAIL'}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-200 font-sans">Lateral Shear (Vu)</td>
                    <td className="py-2">{result.loads.Vu} kN</td>
                    <td className="py-2 text-emerald-400">{result.capacity.phiVn} kN</td>
                    <td className="py-2 font-bold">{result.dcr.shear_dcr}</td>
                    <td className="py-2 font-sans font-bold">
                      <span className={result.dcr.shear_dcr <= 1.0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {result.dcr.shear_dcr <= 1.0 ? 'PASS' : 'FAIL'}
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
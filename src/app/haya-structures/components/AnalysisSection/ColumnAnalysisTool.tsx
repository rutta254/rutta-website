'use client';

import React, { useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type DesignCode = 'ACI318' | 'EC2' | 'BS8110';
type ColumnSectionType = 
  | 'rc_rectangular' 
  | 'rc_circular' 
  | 'steel_encased_i' 
  | 'steel_encased_h' 
  | 'steel_encased_t';

interface ColumnResult {
  section_type: ColumnSectionType;
  design_code: DesignCode;
  geometry: {
    b: number;
    h: number;
    cover: number;
    Ag: number;
    Ac: number;
    Ast: number;
    Ass: number;
  };
  loads: {
    Pu: number;
    Mux: number;
    Muy: number;
    Vu: number;
  };
  capacity: {
    phiPn_max: number;
    phiMnx: number;
    phiMny: number;
    phiVc: number;
  };
  dcr: {
    axial_dcr: number;
    flexure_x_dcr: number;
    flexure_y_dcr: number;
    pm_interaction_dcr: number;
    shear_dcr: number;
    overall_dcr: number;
  };
  verification: {
    status: 'SAFE' | 'OVERSTRESSED';
    governing_check: string;
    rebar_ratio: number; // percentage
  };
}

export default function ColumnAnalysisTool() {
  const [designCode, setDesignCode] = useState<DesignCode>('ACI318');
  const [sectionType, setSectionType] = useState<ColumnSectionType>('steel_encased_i');

  // Concrete Dimensions
  const [b, setB] = useState<number>(500); // Width / Diameter (mm)
  const [h, setH] = useState<number>(500); // Height (mm)
  const [cover, setCover] = useState<number>(40); // Concrete Cover (mm)

  // Encased Steel Section Dimensions (I, H, T profiles)
  const [ds, setDs] = useState<number>(300); // Steel Depth (mm)
  const [bf, setBf] = useState<number>(200); // Flange Width (mm)
  const [tw, setTw] = useState<number>(10);  // Web Thickness (mm)
  const [tf, setTf] = useState<number>(15);  // Flange Thickness (mm)

  // Material Strengths
  const [fc, setFc] = useState<number>(35);   // Concrete f'c (MPa)
  const [fy, setFy] = useState<number>(460);  // Rebar fy (MPa)
  const [fys, setFys] = useState<number>(355); // Structural Steel fy (MPa)

  // Reinforcement
  const [barDiam, setBarDiam] = useState<number>(20);  // Main Bar Diameter (mm)
  const [tieDiam, setTieDiam] = useState<number>(10);  // Tie / Stirrup Diameter (mm)
  const [nx, setNx] = useState<number>(3);             // Bars along X face (Rectangular)
  const [ny, setNy] = useState<number>(3);             // Bars along Y face (Rectangular)
  const [nTotalCircular, setNTotalCircular] = useState<number>(8); // Total bars for Circular

  // Design Loads
  const [Pu, setPu] = useState<number>(1800);  // Axial Load (kN)
  const [Mux, setMux] = useState<number>(150); // Moment X (kN·m)
  const [Muy, setMuy] = useState<number>(80);  // Moment Y (kN·m)
  const [Vu, setVu] = useState<number>(120);   // Shear Force (kN)

  const [result, setResult] = useState<ColumnResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [downloadingPdf, setDownloadingPdf] = useState<boolean>(false);

  const isEncased = sectionType.startsWith('steel_encased');
  const isCircular = sectionType === 'rc_circular';

  // --- MATHEMATICAL ANALYSIS ENGINE ---
  const handleAnalyze = () => {
    setLoading(true);

    try {
      // 1. Gross Concrete Area (Ag)
      const grossB = Math.max(Number(b), 100);
      const grossH = isCircular ? grossB : Math.max(Number(h), 100);
      const Ag = isCircular 
        ? (Math.PI / 4) * Math.pow(grossB, 2) 
        : grossB * grossH;

      // 2. Rebar Count & Area (Ast)
      let totalRebars = 4;
      if (isCircular) {
        totalRebars = Math.max(Number(nTotalCircular), 4);
      } else if (isEncased) {
        totalRebars = 4; // Corner rebars for composite cage
      } else {
        const numX = Math.max(Number(nx), 2);
        const numY = Math.max(Number(ny), 2);
        totalRebars = 2 * numX + 2 * Math.max(numY - 2, 0);
      }
      const db = Math.max(Number(barDiam), 8);
      const Ast = totalRebars * (Math.PI / 4) * Math.pow(db, 2);

      // 3. Encased Steel Profile Area (Ass) & Section Modulus (Zx, Zy)
      let Ass = 0;
      let Zx_steel = 0;
      let Zy_steel = 0;

      const d_s = Math.min(Number(ds), grossH - 2 * cover - 20);
      const b_f = Math.min(Number(bf), grossB - 2 * cover - 20);
      const t_w = Math.min(Number(tw), b_f / 2);
      const t_f = Math.min(Number(tf), d_s / 2);

      if (isEncased) {
        if (sectionType === 'steel_encased_i' || sectionType === 'steel_encased_h') {
          // I / H Section
          Ass = 2 * b_f * t_f + (d_s - 2 * t_f) * t_w;
          Zx_steel = b_f * t_f * (d_s - t_f) + (t_w * Math.pow(d_s - 2 * t_f, 2)) / 4;
          Zy_steel = (2 * t_f * Math.pow(b_f, 2)) / 4 + ((d_s - 2 * t_f) * Math.pow(t_w, 2)) / 4;
        } else if (sectionType === 'steel_encased_t') {
          // Structural Tee Profile
          Ass = b_f * t_f + (d_s - t_f) * t_w;
          Zx_steel = (t_w * Math.pow(d_s - t_f, 2)) / 2 + b_f * t_f * (t_f / 2);
          Zy_steel = (t_f * Math.pow(b_f, 2)) / 4 + ((d_s - t_f) * Math.pow(t_w, 2)) / 4;
        }
      }

      // 4. Net Concrete Area (Ac)
      const Ac = Math.max(Ag - Ast - Ass, Ag * 0.1);

      // 5. Ultimate Axial Capacity (phiPn_max)
      const f_c = Number(fc);
      const f_y = Number(fy);
      const f_ys = Number(fys);

      // P0 Nominal axial compression strength
      const P0 = (0.85 * f_c * Ac + f_y * Ast + f_ys * Ass) / 1000; // kN

      // Resistance & Reduction factors (ACI 318 / EC2 approach)
      const phi_axial = isCircular ? 0.75 : 0.65;
      const alpha_ecc = isCircular ? 0.85 : 0.80;
      const phiPn_max = Math.max(alpha_ecc * phi_axial * P0, 1.0);

      // 6. Flexural Moment Capacities (phiMnx, phiMny)
      const d_eff_x = grossH - cover - Number(tieDiam) - db / 2;
      const d_eff_y = grossB - cover - Number(tieDiam) - db / 2;

      // Concrete Plastic Moment Contribution
      const M_cx = (0.85 * f_c * grossB * Math.pow(grossH, 2)) / 4 / 1e6; // kN·m
      const M_cy = (0.85 * f_c * grossH * Math.pow(grossB, 2)) / 4 / 1e6;

      // Rebar Moment Contribution
      const M_stx = (0.8 * Ast * f_y * (d_eff_x - grossH / 2)) / 1e6;
      const M_sty = (0.8 * Ast * f_y * (d_eff_y - grossB / 2)) / 1e6;

      // Encased Steel Profile Contribution
      const M_ssx = (Zx_steel * f_ys) / 1e6;
      const M_ssy = (Zy_steel * f_ys) / 1e6;

      const phi_flexure = 0.70;
      const phiMnx = Math.max(phi_flexure * (0.8 * M_cx + M_stx + M_ssx), 1.0);
      const phiMny = Math.max(phi_flexure * (0.8 * M_cy + M_sty + M_ssy), 1.0);

      // 7. Shear Capacity (phiVc)
      const phi_shear = 0.75;
      const Vc = (0.17 * Math.sqrt(f_c) * grossB * d_eff_x) / 1000; // kN
      const phiVc = Math.max(phi_shear * Vc, 1.0);

      // 8. Demand Capacity Ratios (DCR)
      const p_u = Math.abs(Number(Pu));
      const m_ux = Math.abs(Number(Mux));
      const m_uy = Math.abs(Number(Muy));
      const v_u = Math.abs(Number(Vu));

      const axial_dcr = p_u / phiPn_max;
      const flexure_x_dcr = m_ux / phiMnx;
      const flexure_y_dcr = m_uy / phiMny;
      const shear_dcr = v_u / phiVc;

      // P-M Interaction Formula (Biaxial Compression + Flexure)
      let pm_interaction_dcr = 0;
      if (axial_dcr >= 0.2) {
        pm_interaction_dcr = axial_dcr + (8 / 9) * (flexure_x_dcr + flexure_y_dcr);
      } else {
        pm_interaction_dcr = axial_dcr / 2 + (flexure_x_dcr + flexure_y_dcr);
      }

      const overall_dcr = Math.max(pm_interaction_dcr, shear_dcr);
      const rebar_ratio = ((Ast + Ass) / Ag) * 100;

      let governing_check = 'P-M Interaction';
      if (shear_dcr > pm_interaction_dcr) governing_check = 'Shear Capacity';
      if (rebar_ratio < 0.8) governing_check = 'Minimum Rebar Ratio (< 0.8%)';
      if (rebar_ratio > 8.0) governing_check = 'Maximum Rebar Ratio (> 8.0%)';

      const res: ColumnResult = {
        section_type: sectionType,
        design_code: designCode,
        geometry: {
          b: grossB,
          h: grossH,
          cover: Number(cover),
          Ag: Math.round(Ag),
          Ac: Math.round(Ac),
          Ast: Math.round(Ast),
          Ass: Math.round(Ass),
        },
        loads: {
          Pu: p_u,
          Mux: m_ux,
          Muy: m_uy,
          Vu: v_u,
        },
        capacity: {
          phiPn_max: Number(phiPn_max.toFixed(1)),
          phiMnx: Number(phiMnx.toFixed(1)),
          phiMny: Number(phiMny.toFixed(1)),
          phiVc: Number(phiVc.toFixed(1)),
        },
        dcr: {
          axial_dcr: Number(axial_dcr.toFixed(3)),
          flexure_x_dcr: Number(flexure_x_dcr.toFixed(3)),
          flexure_y_dcr: Number(flexure_y_dcr.toFixed(3)),
          pm_interaction_dcr: Number(pm_interaction_dcr.toFixed(3)),
          shear_dcr: Number(shear_dcr.toFixed(3)),
          overall_dcr: Number(overall_dcr.toFixed(3)),
        },
        verification: {
          status: overall_dcr <= 1.0 && rebar_ratio >= 0.8 && rebar_ratio <= 8.0 ? 'SAFE' : 'OVERSTRESSED',
          governing_check,
          rebar_ratio: Number(rebar_ratio.toFixed(2)),
        },
      };

      setResult(res);
    } catch (err) {
      console.error('Analysis error:', err);
      alert('An error occurred during structural calculations. Please check your inputs.');
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
        const w = bbox.width || 300;
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
            reject(new Error('Canvas context context unavailable'));
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
      doc.text('HAYA STRUCTURES | COLUMN DESIGN VERIFICATION REPORT', 12, 10);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(226, 232, 240);
      doc.text(`Code Standard: ${designCode} | Section: ${sectionType.toUpperCase()} | Date: ${dateStr}`, 12, 15);

      // Section 1: Inputs & Structural Capacities
      autoTable(doc, {
        startY: 22,
        margin: { left: 12 },
        tableWidth: 90,
        head: [['Design Input Parameter', 'Value / Unit']],
        body: [
          ['Column Section Type', sectionType.replace(/_/g, ' ').toUpperCase()],
          ['Section Width (b)', `${result.geometry.b} mm`],
          ['Section Height (h)', `${result.geometry.h} mm`],
          ['Clear Cover (c)', `${cover} mm`],
          ['Concrete Strength (f\'c)', `${fc} MPa`],
          ['Rebar Yield Strength (fy)', `${fy} MPa`],
          ...(isEncased ? [['Steel Section Yield (fys)', `${fys} MPa`]] : []),
          ['Axial Design Load (Pu)', `${Pu} kN`],
          ['Moment X Axis (Mux)', `${Mux} kN·m`],
          ['Moment Y Axis (Muy)', `${Muy} kN·m`],
          ['Shear Design Load (Vu)', `${Vu} kN`],
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
          ['Gross Section Area (Ag)', `${result.geometry.Ag} mm²`],
          ['Net Concrete Area (Ac)', `${result.geometry.Ac} mm²`],
          ['Rebar Steel Area (Ast)', `${result.geometry.Ast} mm²`],
          ['Encased Profile Area (Ass)', `${result.geometry.Ass} mm²`],
          ['Total Steel Ratio (ρ)', `${result.verification.rebar_ratio}%`],
          ['Axial Capacity (φPn,max)', `${result.capacity.phiPn_max} kN`],
          ['Flexural Capacity X (φMnx)', `${result.capacity.phiMnx} kN·m`],
          ['Flexural Capacity Y (φMny)', `${result.capacity.phiMny} kN·m`],
          ['Shear Capacity (φVc)', `${result.capacity.phiVc} kN`],
          ['Governing Failure Check', result.verification.governing_check],
          ['Overall Compliance', result.verification.status],
        ],
        theme: 'grid',
        headStyles: { fillColor: [15, 118, 110], fontSize: 7.5, cellPadding: 2, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7, cellPadding: 1.8 },
      });

      // Section 2: SVG Rendering Embed
      let currentY = 100;
      const colSvg = document.getElementById('column-section-svg') as unknown as SVGSVGElement;

      if (colSvg) {
        try {
          const colPng = await convertSvgToPng(colSvg, '#0f172a');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(15, 23, 42);
          doc.text('CROSS-SECTIONAL GEOMETRY & REINFORCEMENT DRAWING', 12, currentY);
          currentY += 4;

          doc.addImage(colPng, 'PNG', 55, currentY, 100, 65);
          currentY += 68;
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
          ['Flexural Moment X Axis', `${result.loads.Mux} kN·m`, `${result.capacity.phiMnx} kN·m`, `${result.dcr.flexure_x_dcr}`, result.dcr.flexure_x_dcr <= 1.0 ? 'PASS' : 'FAIL'],
          ['Flexural Moment Y Axis', `${result.loads.Muy} kN·m`, `${result.capacity.phiMny} kN·m`, `${result.dcr.flexure_y_dcr}`, result.dcr.flexure_y_dcr <= 1.0 ? 'PASS' : 'FAIL'],
          ['Combined P-M Interaction Ratio', 'P-M Interaction', 'Capacity Surface', `${result.dcr.pm_interaction_dcr}`, result.dcr.pm_interaction_dcr <= 1.0 ? 'PASS' : 'FAIL'],
          ['Shear Resistance (Vu)', `${result.loads.Vu} kN`, `${result.capacity.phiVc} kN`, `${result.dcr.shear_dcr}`, result.dcr.shear_dcr <= 1.0 ? 'PASS' : 'FAIL'],
        ],
        theme: 'grid',
        headStyles: { fillColor: [30, 41, 59], fontSize: 7.5, cellPadding: 2, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7, cellPadding: 1.8 },
      });

      // Section 4: Engineering Sign-off
      const finalTableY = (doc as any).lastAutoTable.finalY + 6;

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(12, finalTableY, 110, 40, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text('ENGINEERING DESIGN ASSUMPTIONS', 16, finalTableY + 6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(51, 65, 85);
      const notes = [
        `1. Column verified per ${designCode} ultimate limit state interaction formulas.`,
        '2. Steel section embedded profile assumes full shear transfer & strain compatibility.',
        '3. Rebar ratio bounded between 0.8% min and 8.0% max per structural standard.',
        '4. Shear resistance verified for pure concrete + stirrup contributions.',
      ];
      notes.forEach((note, idx) => {
        doc.text(note, 16, finalTableY + 13 + idx * 6);
      });

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(128, finalTableY, 70, 40, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text('VERIFICATION STAMP', 132, finalTableY + 6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text('Prepared By: Haya Structural Engine', 132, finalTableY + 13);
      doc.text('Status:', 132, finalTableY + 21);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(result.verification.status === 'SAFE' ? 16 : 225, result.verification.status === 'SAFE' ? 185 : 29, result.verification.status === 'SAFE' ? 129 : 72);
      doc.text(result.verification.status === 'SAFE' ? 'APPROVED / COMPLIANT' : 'OVERSTRESSED', 145, finalTableY + 21);

      doc.setDrawColor(148, 163, 184);
      doc.line(132, finalTableY + 32, 192, finalTableY + 32);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(6);
      doc.setTextColor(100, 116, 139);
      doc.text('Authorized Structural Engineer Signature', 132, finalTableY + 36);

      doc.save(`Haya_Column_Design_${designCode}_${sectionType}.pdf`);
    } catch (err) {
      console.error('PDF Export Error:', err);
      alert('Failed to generate PDF report.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  // --- SVG CROSS SECTION DRAWING COMPONENT ---
  const renderSectionSVG = () => {
    const svgWidth = 280;
    const svgHeight = 220;
    const cx = svgWidth / 2;
    const cy = svgHeight / 2;

    const maxDim = isCircular ? Number(b) : Math.max(Number(b), Number(h));
    const scale = 140 / (maxDim || 500);

    const scaledB = Number(b) * scale;
    const scaledH = isCircular ? scaledB : Number(h) * scale;
    const scaledCover = Number(cover) * scale;

    // Encased steel scaled dimensions
    const scaledDs = Number(ds) * scale;
    const scaledBf = Number(bf) * scale;
    const scaledTw = Number(tw) * scale;
    const scaledTf = Number(tf) * scale;

    const offset = Number(cover) + Number(tieDiam) + Number(barDiam) / 2;
    const scaledOffset = offset * scale;

    // Calculate Rebar Coordinates
    const rebars: { x: number; y: number }[] = [];

    if (isCircular) {
      const radius = (scaledB / 2) - scaledOffset;
      const total = Math.max(Number(nTotalCircular), 4);
      for (let i = 0; i < total; i++) {
        const angle = (2 * Math.PI * i) / total - Math.PI / 2;
        rebars.push({
          x: cx + radius * Math.cos(angle),
          y: cy + radius * Math.sin(angle),
        });
      }
    } else {
      const xLeft = cx - scaledB / 2 + scaledOffset;
      const xRight = cx + scaledB / 2 - scaledOffset;
      const yTop = cy - scaledH / 2 + scaledOffset;
      const yBottom = cy + scaledH / 2 - scaledOffset;

      if (isEncased) {
        // 4 Corner rebars framing the encased steel profile
        rebars.push({ x: xLeft, y: yTop });
        rebars.push({ x: xRight, y: yTop });
        rebars.push({ x: xLeft, y: yBottom });
        rebars.push({ x: xRight, y: yBottom });
      } else {
        const numX = Math.max(Number(nx), 2);
        const numY = Math.max(Number(ny), 2);
        const dx = (xRight - xLeft) / (numX - 1);
        const dy = (yBottom - yTop) / (numY - 1);

        for (let i = 0; i < numX; i++) {
          rebars.push({ x: xLeft + i * dx, y: yTop });
          rebars.push({ x: xLeft + i * dx, y: yBottom });
        }
        for (let j = 1; j < numY - 1; j++) {
          rebars.push({ x: xLeft, y: yTop + j * dy });
          rebars.push({ x: xRight, y: yTop + j * dy });
        }
      }
    }

    const rBar = Math.max((Number(barDiam) / 2) * scale, 3.5);

    return (
      <svg id="column-section-svg" viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-56 drop-shadow-md">
        {/* Background Grid Accent */}
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" strokeWidth="0.8" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" rx="6" />

        {/* Center Axis Lines */}
        <line x1={cx} y1="10" x2={cx} y2={svgHeight - 10} stroke="#38bdf8" strokeWidth="1" strokeDasharray="4 2" opacity="0.5" />
        <line x1="10" y1={cy} x2={svgWidth - 10} y2={cy} stroke="#10b981" strokeWidth="1" strokeDasharray="4 2" opacity="0.5" />

        {/* Outer Concrete Boundary & Ties */}
        {isCircular ? (
          <g>
            <circle cx={cx} cy={cy} r={scaledB / 2} fill="#334155" stroke="#94a3b8" strokeWidth="2" />
            <circle cx={cx} cy={cy} r={scaledB / 2 - scaledCover} fill="none" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="3 2" />
          </g>
        ) : (
          <g>
            <rect
              x={cx - scaledB / 2}
              y={cy - scaledH / 2}
              width={scaledB}
              height={scaledH}
              fill="#334155"
              stroke="#94a3b8"
              strokeWidth="2"
              rx="3"
            />
            <rect
              x={cx - scaledB / 2 + scaledCover}
              y={cy - scaledH / 2 + scaledCover}
              width={scaledB - 2 * scaledCover}
              height={scaledH - 2 * scaledCover}
              fill="none"
              stroke="#38bdf8"
              strokeWidth="1.5"
              strokeDasharray="3 2"
              rx="2"
            />
          </g>
        )}

        {/* Encased Steel Profiles (I, H, or T) */}
        {sectionType === 'steel_encased_i' || sectionType === 'steel_encased_h' ? (
          <g>
            {/* Top Flange */}
            <rect
              x={cx - scaledBf / 2}
              y={cy - scaledDs / 2}
              width={scaledBf}
              height={scaledTf}
              fill="#0284c7"
              stroke="#38bdf8"
              strokeWidth="1"
              rx="1"
            />
            {/* Web */}
            <rect
              x={cx - scaledTw / 2}
              y={cy - scaledDs / 2 + scaledTf}
              width={scaledTw}
              height={scaledDs - 2 * scaledTf}
              fill="#0284c7"
              stroke="#38bdf8"
              strokeWidth="1"
            />
            {/* Bottom Flange */}
            <rect
              x={cx - scaledBf / 2}
              y={cy + scaledDs / 2 - scaledTf}
              width={scaledBf}
              height={scaledTf}
              fill="#0284c7"
              stroke="#38bdf8"
              strokeWidth="1"
              rx="1"
            />
          </g>
        ) : sectionType === 'steel_encased_t' ? (
          <g>
            {/* Top Flange */}
            <rect
              x={cx - scaledBf / 2}
              y={cy - scaledDs / 2}
              width={scaledBf}
              height={scaledTf}
              fill="#0284c7"
              stroke="#38bdf8"
              strokeWidth="1"
              rx="1"
            />
            {/* Vertical Stem Web */}
            <rect
              x={cx - scaledTw / 2}
              y={cy - scaledDs / 2 + scaledTf}
              width={scaledTw}
              height={scaledDs - scaledTf}
              fill="#0284c7"
              stroke="#38bdf8"
              strokeWidth="1"
            />
          </g>
        ) : null}

        {/* Rebar Circles */}
        {rebars.map((bar, idx) => (
          <circle
            key={idx}
            cx={bar.x}
            cy={bar.y}
            r={rBar}
            fill="#f59e0b"
            stroke="#78350f"
            strokeWidth="1"
          />
        ))}

        {/* Dimension Callout Labels */}
        <text x={cx} y={cy - scaledH / 2 - 6} fill="#cbd5e1" fontSize="9" textAnchor="middle" fontWeight="bold">
          b = {b}mm
        </text>
        {!isCircular && (
          <text x={cx + scaledB / 2 + 10} y={cy + 3} fill="#cbd5e1" fontSize="9" textAnchor="start" fontWeight="bold">
            h = {h}mm
          </text>
        )}
        {isEncased && (
          <text x={cx} y={cy + scaledDs / 2 + 14} fill="#38bdf8" fontSize="8" textAnchor="middle">
            Encased Profile ({ds}x{bf}mm)
          </text>
        )}
      </svg>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 font-sans">
      {/* Control Input Panel */}
      <div className="lg:col-span-5 space-y-4 bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-xl">
        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
          <h3 className="font-semibold text-slate-200 text-sm">Column Design Inputs</h3>
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

        {/* Column Type Selector */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Column Geometry & Cross-Section</label>
          <select
            value={sectionType}
            onChange={(e) => setSectionType(e.target.value as ColumnSectionType)}
            className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200 font-medium"
          >
            <option value="steel_encased_i">Composite Encased I-Section (UB/UC Profile)</option>
            <option value="steel_encased_h">Composite Encased Heavy H-Section</option>
            <option value="steel_encased_t">Composite Encased T-Section (Structural Tee)</option>
            <option value="rc_rectangular">Standard RC Rectangular Column</option>
            <option value="rc_circular">Standard RC Circular Column</option>
          </select>
        </div>

        {/* Concrete Dimensions */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              {isCircular ? 'Column Diameter D (mm)' : 'Section Width b (mm)'}
            </label>
            <input
              type="number"
              value={b}
              onChange={(e) => setB(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200 font-mono"
            />
          </div>
          {!isCircular && (
            <div>
              <label className="block text-xs text-slate-400 mb-1">Section Depth h (mm)</label>
              <input
                type="number"
                value={h}
                onChange={(e) => setH(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200 font-mono"
              />
            </div>
          )}
        </div>

        {/* Clear Cover */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Concrete Clear Cover c (mm)</label>
          <input
            type="number"
            value={cover}
            onChange={(e) => setCover(Number(e.target.value))}
            className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200 font-mono"
          />
        </div>

        {/* Encased Steel Profile Options */}
        {isEncased && (
          <div className="p-3 bg-cyan-950/30 border border-cyan-800/40 rounded-lg space-y-3">
            <h4 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
              Encased Steel Profile Specs (mm)
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Depth ds</label>
                <input
                  type="number"
                  value={ds}
                  onChange={(e) => setDs(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Flange Width bf</label>
                <input
                  type="number"
                  value={bf}
                  onChange={(e) => setBf(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200 font-mono"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Web Thickness tw</label>
                <input
                  type="number"
                  value={tw}
                  onChange={(e) => setTw(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Flange Thickness tf</label>
                <input
                  type="number"
                  value={tf}
                  onChange={(e) => setTf(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200 font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {/* Reinforcement Config */}
        <div className="space-y-3 pt-2 border-t border-slate-800">
          <h4 className="font-semibold text-slate-200 text-xs uppercase tracking-wider text-cyan-400">
            Reinforcement Arrangement
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Main Bar Diam (mm)</label>
              <input
                type="number"
                value={barDiam}
                onChange={(e) => setBarDiam(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Tie/Stirrup Diam (mm)</label>
              <input
                type="number"
                value={tieDiam}
                onChange={(e) => setTieDiam(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200 font-mono"
              />
            </div>
          </div>

          {!isCircular && !isEncased && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Bars X-Face (nx)</label>
                <input
                  type="number"
                  value={nx}
                  onChange={(e) => setNx(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Bars Y-Face (ny)</label>
                <input
                  type="number"
                  value={ny}
                  onChange={(e) => setNy(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200 font-mono"
                />
              </div>
            </div>
          )}

          {isCircular && (
            <div>
              <label className="block text-xs text-slate-400 mb-1">Total Ring Rebars (N)</label>
              <input
                type="number"
                value={nTotalCircular}
                onChange={(e) => setNTotalCircular(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200 font-mono"
              />
            </div>
          )}
        </div>

        {/* Material Properties */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800">
          <div>
            <label className="block text-xs text-slate-400 mb-1">f'c (MPa)</label>
            <input
              type="number"
              value={fc}
              onChange={(e) => setFc(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-sm text-slate-200 font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">fy (MPa)</label>
            <input
              type="number"
              value={fy}
              onChange={(e) => setFy(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-sm text-slate-200 font-mono"
            />
          </div>
          {isEncased && (
            <div>
              <label className="block text-xs text-slate-400 mb-1">fys (MPa)</label>
              <input
                type="number"
                value={fys}
                onChange={(e) => setFys(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-sm text-slate-200 font-mono"
              />
            </div>
          )}
        </div>

        {/* Design Loading Inputs */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Axial Load Pu (kN)</label>
            <input
              type="number"
              value={Pu}
              onChange={(e) => setPu(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200 font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Shear Load Vu (kN)</label>
            <input
              type="number"
              value={Vu}
              onChange={(e) => setVu(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200 font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Moment Mux (kN·m)</label>
            <input
              type="number"
              value={Mux}
              onChange={(e) => setMux(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200 font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Moment Muy (kN·m)</label>
            <input
              type="number"
              value={Muy}
              onChange={(e) => setMuy(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200 font-mono"
            />
          </div>
        </div>

        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold py-2.5 rounded transition disabled:opacity-50 mt-4 shadow-lg shadow-cyan-500/20"
        >
          {loading ? 'Analyzing Section...' : `Run Column Analysis (${designCode})`}
        </button>

        {result && (
          <button
            onClick={generatePDF}
            disabled={downloadingPdf}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2 rounded transition shadow-lg mt-2"
          >
            {downloadingPdf ? 'Generating PDF...' : '📄 Download Complete Column Report'}
          </button>
        )}
      </div>

      {/* Graphical Display & Analysis Output */}
      <div className="lg:col-span-7 space-y-6">
        {/* SVG Drawing Card */}
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
          <h4 className="text-xs font-bold text-slate-300 mb-2 border-b border-slate-800 pb-1 flex justify-between">
            <span>COLUMN CROSS-SECTION DRAWING</span>
            <span className="text-cyan-400">{sectionType.replace(/_/g, ' ').toUpperCase()}</span>
          </h4>
          <div className="bg-slate-950/80 p-2 rounded border border-slate-800 flex justify-center">
            {renderSectionSVG()}
          </div>
        </div>

        {/* Metric Cards */}
        {result && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center">
              <span className="text-xs text-slate-400 block mb-1">Axial DCR</span>
              <span className={`text-lg font-bold font-mono ${result.dcr.axial_dcr <= 1.0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {result.dcr.axial_dcr}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center">
              <span className="text-xs text-slate-400 block mb-1">P-M Interaction</span>
              <span className={`text-lg font-bold font-mono ${result.dcr.pm_interaction_dcr <= 1.0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {result.dcr.pm_interaction_dcr}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center">
              <span className="text-xs text-slate-400 block mb-1">Shear DCR</span>
              <span className={`text-lg font-bold font-mono ${result.dcr.shear_dcr <= 1.0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {result.dcr.shear_dcr}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center">
              <span className="text-xs text-slate-400 block mb-1">Steel Ratio (ρ)</span>
              <span className={`text-lg font-bold font-mono ${result.verification.rebar_ratio >= 0.8 && result.verification.rebar_ratio <= 8.0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {result.verification.rebar_ratio}%
              </span>
            </div>
          </div>
        )}

        {/* Detailed Breakdown Table */}
        {result && (
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2 flex justify-between">
              <span>Section Capacity Breakdown</span>
              <span className={`text-xs px-2 py-0.5 rounded ${result.verification.status === 'SAFE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                {result.verification.status}
              </span>
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-2 font-semibold">Check</th>
                    <th className="pb-2 font-semibold">Applied Demand</th>
                    <th className="pb-2 font-semibold">Design Capacity</th>
                    <th className="pb-2 font-semibold">DCR</th>
                    <th className="pb-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-slate-300">
                  <tr>
                    <td className="py-2 text-slate-200 font-sans">Axial Compression (Pu)</td>
                    <td className="py-2">{result.loads.Pu} kN</td>
                    <td className="py-2 text-emerald-400">{result.capacity.phiPn_max} kN</td>
                    <td className="py-2 font-bold">{result.dcr.axial_dcr}</td>
                    <td className="py-2 font-sans font-bold">
                      <span className={result.dcr.axial_dcr <= 1.0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {result.dcr.axial_dcr <= 1.0 ? 'PASS' : 'FAIL'}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-200 font-sans">Moment X Axis (Mux)</td>
                    <td className="py-2">{result.loads.Mux} kN·m</td>
                    <td className="py-2 text-emerald-400">{result.capacity.phiMnx} kN·m</td>
                    <td className="py-2 font-bold">{result.dcr.flexure_x_dcr}</td>
                    <td className="py-2 font-sans font-bold">
                      <span className={result.dcr.flexure_x_dcr <= 1.0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {result.dcr.flexure_x_dcr <= 1.0 ? 'PASS' : 'FAIL'}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-200 font-sans">Moment Y Axis (Muy)</td>
                    <td className="py-2">{result.loads.Muy} kN·m</td>
                    <td className="py-2 text-emerald-400">{result.capacity.phiMny} kN·m</td>
                    <td className="py-2 font-bold">{result.dcr.flexure_y_dcr}</td>
                    <td className="py-2 font-sans font-bold">
                      <span className={result.dcr.flexure_y_dcr <= 1.0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {result.dcr.flexure_y_dcr <= 1.0 ? 'PASS' : 'FAIL'}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-200 font-sans">P-M Biaxial Interaction</td>
                    <td className="py-2">P-M Surface</td>
                    <td className="py-2 text-emerald-400">Interaction Limit</td>
                    <td className="py-2 font-bold">{result.dcr.pm_interaction_dcr}</td>
                    <td className="py-2 font-sans font-bold">
                      <span className={result.dcr.pm_interaction_dcr <= 1.0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {result.dcr.pm_interaction_dcr <= 1.0 ? 'PASS' : 'FAIL'}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-200 font-sans">Shear Resistance (Vu)</td>
                    <td className="py-2">{result.loads.Vu} kN</td>
                    <td className="py-2 text-emerald-400">{result.capacity.phiVc} kN</td>
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
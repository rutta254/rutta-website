// src/lib/reports/foundationPdfReport.ts
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FoundationDesignResult } from '@/lib/structural/foundation';

/**
 * Returns design-code-specific ULS load factors & notation
 */
const getLoadFactors = (code: string) => {
  switch (code) {
    case 'ACI318_19':
      return { gammaD: 1.2, gammaL: 1.6, label: '1.2·D + 1.6·L (ACI 318-19)' };
    case 'EC2_EN1992':
      return { gammaD: 1.35, gammaL: 1.5, label: '1.35·Gk + 1.5·Qk (Eurocode 2)' };
    case 'IS456':
      return { gammaD: 1.5, gammaL: 1.5, label: '1.5·DL + 1.5·LL (IS 456:2000)' };
    case 'AS3600':
      return { gammaD: 1.2, gammaL: 1.5, label: '1.2·G + 1.5·Q (AS 3600)' };
    case 'CSA_A23_3':
      return { gammaD: 1.25, gammaL: 1.5, label: '1.25·D + 1.5·L (CSA A23.3)' };
    case 'BS8110':
    default:
      return { gammaD: 1.4, gammaL: 1.6, label: '1.4·Gk + 1.6·Qk (BS 8110)' };
  }
};

export const generateFoundationPdfReport = (result: FoundationDesignResult) => {
  const doc = new jsPDF();
  const primaryColor: [number, number, number] = [15, 23, 42]; // Slate-900
  const resAny = result as any;

  // Extract core input parameters with safe fallbacks
  const { 
    pDead = 0, 
    pLive = 0, 
    c1 = 400, 
    c2 = 400, 
    fc = 30, 
    fy = 460, 
    cover = 50, 
    qAllow = 200 
  } = resAny.inputs || {};
  
  const { B = 2000, L = 2000, D = 500, d = 430 } = result.geometry || {};
  const rebarDetails = resAny.rebarDetails || {};

  // Load factors & calculations
  const loadFactors = getLoadFactors(result.codeUsed);
  const pUlt = loadFactors.gammaD * pDead + loadFactors.gammaL * pLive;
  const pService = pDead + pLive;
  
  const areaM2 = (B / 1000) * (L / 1000);
  const qActual = areaM2 > 0 ? pService / areaM2 : 0;
  const qUlt = areaM2 > 0 ? pUlt / areaM2 : 0;

  // Cantilever length and ultimate design moment (M_u)
  const aProjMm = (B - c1) / 2;
  const aProjM = aProjMm / 1000;
  const mUlt = (qUlt * (L / 1000) * (aProjM * aProjM)) / 2;

  // -------------------------------------------------------------
  // HEADER BANNER
  // -------------------------------------------------------------
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('STRUCTURAL FOUNDATION DESIGN REPORT', 14, 16);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Design Code: ${result.codeUsed}  |  Type: ${result.typeLabel || 'Foundation'}`, 14, 23);

  let yPos = 36;

  // -------------------------------------------------------------
  // SECTION 1: Design Inputs & Materials
  // -------------------------------------------------------------
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('1. Design Inputs & Material Properties', 14, yPos);
  yPos += 4;

  autoTable(doc, {
    startY: yPos,
    head: [['Parameter', 'Symbol', 'Value', 'Unit']],
    body: [
      ['Concrete Characteristic Strength', "f_cu / f'c", fc, 'MPa'],
      ['Yield Strength of Steel', 'f_y', fy, 'MPa'],
      ['Nominal Concrete Cover', 'c_nom', cover, 'mm'],
      ['Column Dimensions (c1 x c2)', 'c1, c2', `${c1} x ${c2}`, 'mm'],
      ['Axial Dead Load', 'P_Dead (Gk)', pDead, 'kN'],
      ['Axial Live Load', 'P_Live (Qk)', pLive, 'kN'],
      ['Allowable Bearing Capacity', 'q_allow', qAllow ?? 'N/A', 'kPa'],
    ],
    theme: 'striped',
    headStyles: { fillColor: [30, 41, 59] },
    styles: { fontSize: 8.5, cellPadding: 2 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 8;

  // -------------------------------------------------------------
  // SECTION 2: Structural Verification Summary
  // -------------------------------------------------------------
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('2. Executive Structural Status Summary', 14, yPos);
  yPos += 4;

  const bearingDcr = result.structuralChecks?.bearingOrPileDcr ?? 0;
  const punchingDcr = result.structuralChecks?.punchingShearDcr ?? 0;
  const flexureDcr = result.structuralChecks?.flexureDcr ?? 0;

  autoTable(doc, {
    startY: yPos,
    head: [['Structural Check', 'Governing Parameter', 'Demand / Capacity Ratio (DCR)', 'Status']],
    body: [
      ['Soil Bearing Pressure', `q_actual (${qActual.toFixed(1)} kPa) vs q_allow (${qAllow} kPa)`, bearingDcr.toFixed(3), bearingDcr <= 1.0 ? 'PASS' : 'FAIL'],
      ['Punching Shear Resistance', `Critical Perimeter at 1.5d`, punchingDcr.toFixed(3), punchingDcr <= 1.0 ? 'PASS' : 'FAIL'],
      ['Flexural Bending Resistance', `As_req (${rebarDetails.As_req_x || 0} mm²/m)`, flexureDcr.toFixed(3), flexureDcr <= 1.0 ? 'PASS' : 'FAIL'],
    ],
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42] },
    styles: { fontSize: 8.5, cellPadding: 2.5 },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 3) {
        if (data.cell.raw === 'PASS') {
          data.cell.styles.textColor = [16, 185, 129]; // Emerald green
          data.cell.styles.fontStyle = 'bold';
        } else {
          data.cell.styles.textColor = [239, 68, 68]; // Red
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + 8;

  // -------------------------------------------------------------
  // SECTION 3: Step-by-Step Calculation Workflow
  // -------------------------------------------------------------
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`3. Detailed Calculation Workflow (${result.codeUsed})`, 14, yPos);
  yPos += 6;

  const workflowSteps = [
    `Step 1: Ultimate Axial Design Load Combination (ULS)`,
    `   Combination Rule: ${loadFactors.label}`,
    `   P_ult = ${loadFactors.gammaD} × (${pDead}) + ${loadFactors.gammaL} × (${pLive}) = ${pUlt.toFixed(1)} kN`,
    ``,
    `Step 2: Serviceability Soil Bearing Pressure Check (SLS)`,
    `   Footing Plan Area A = B × L = ${(B / 1000).toFixed(2)}m × ${(L / 1000).toFixed(2)}m = ${areaM2.toFixed(2)} m²`,
    `   q_actual = (P_Dead + P_Live) / A = (${pService} kN) / (${areaM2.toFixed(2)} m²) = ${qActual.toFixed(1)} kPa`,
    `   Status: q_actual (${qActual.toFixed(1)} kPa) ${qActual <= qAllow ? '≤' : '>'} q_allow (${qAllow} kPa) → DCR = ${bearingDcr.toFixed(3)} [${bearingDcr <= 1.0 ? 'PASSED' : 'FAILED'}]`,
    ``,
    `Step 3: Ultimate Flexural Bending & Steel Reinforcement`,
    `   Ultimate Soil Reaction q_ult = P_ult / A = ${pUlt.toFixed(1)} / ${areaM2.toFixed(2)} = ${qUlt.toFixed(1)} kPa`,
    `   Cantilever Projection a = (B - c1) / 2 = (${B} - ${c1}) / 2 = ${aProjMm.toFixed(0)} mm (${aProjM.toFixed(3)} m)`,
    `   Ultimate Bending Moment M_u = (q_ult × L × a²) / 2 = ${mUlt.toFixed(1)} kN·m`,
    `   Required Steel Area (As_req) = ${rebarDetails.As_req_x || 0} mm²/m`,
    `   Provided Steel Area (As_prov) = ${rebarDetails.As_prov_x || 0} mm²/m (${rebarDetails.barCalloutX || 'N/A'})`,
    `   Flexure Status: DCR = ${flexureDcr.toFixed(3)} [${flexureDcr <= 1.0 ? 'PASSED' : 'FAILED'}]`,
    ``,
    `Step 4: Shear & Punching Shear Checks`,
    `   Effective Depth (d) = D - cover - (bar_dia / 2) = ${D} - ${cover} - 10 = ${d} mm`,
    `   Critical Punching Perimeter at 1.5d from column face = 2 × (c1 + c2) + 8 × (1.5 × ${d})`,
    `   Punching Shear DCR = ${punchingDcr.toFixed(3)} [${punchingDcr <= 1.0 ? 'PASSED' : 'FAILED'}]`,
  ];

  doc.setFontSize(8.5);

  workflowSteps.forEach((line) => {
    if (yPos > 275) {
      doc.addPage();
      yPos = 20;
    }

    if (line.startsWith('Step')) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
    }

    doc.text(line, 14, yPos);
    yPos += 4.5;
  });

  // -------------------------------------------------------------
  // FOOTER & PAGE NUMBERS
  // -------------------------------------------------------------
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // Slate-400
    doc.text(`Haya Structural Engine — Automated Calculation Sheet`, 14, 288);
    doc.text(`Page ${i} of ${pageCount}`, 196, 288, { align: 'right' });
  }

  // Save PDF file
  doc.save(`Foundation_Design_${result.codeUsed}_${Date.now()}.pdf`);
};
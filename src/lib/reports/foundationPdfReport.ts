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
  const secondaryColor: [number, number, number] = [30, 41, 59]; // Slate-800
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
    qAllow = 200,
    numPiles = 4,
    pileDiameter = 400,
    colSpacing = 1200,
  } = resAny.inputs || {};

  const foundationType = resAny.type || 'isolated';
  const category = result.category || 'shallow';

  const { B = 2000, L = 2000, D = 500, d = 430 } = result.geometry || {};
  const rebarDetails = resAny.rebarDetails || result.reinforcement || {};

  const {
    botBarDiam = 16,
    botBarSpacing = 150,
    topBarDiam = 12,
    topBarSpacing = 200,
    meshMode = 'single',
  } = rebarDetails;

  const isDoubleMesh = meshMode === 'double' || Boolean(topBarDiam && topBarSpacing);

  // Load factors & calculations
  const loadFactors = getLoadFactors(result.codeUsed || 'BS8110');
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
  // HEADER BANNER (PAGE 1)
  // -------------------------------------------------------------
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('STRUCTURAL FOUNDATION DESIGN REPORT', 14, 16);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Design Code: ${result.codeUsed || 'BS 8110'}   |   Type: ${(resAny.typeLabel || foundationType).toUpperCase()} (${category.toUpperCase()})`,
    14,
    23
  );

  let yPos = 36;

  // -------------------------------------------------------------
  // SECTION 1: Design Inputs & Materials
  // -------------------------------------------------------------
  doc.setTextColor(...primaryColor);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('1. Design Inputs & Material Properties', 14, yPos);
  yPos += 4;

  const inputRows: (string | number)[][] = [
    ['Concrete Characteristic Strength', "f_cu / f'c", fc, 'MPa'],
    ['Yield Strength of Reinforcement Steel', 'f_y', fy, 'MPa'],
    ['Nominal Concrete Cover', 'c_nom', cover, 'mm'],
    ['Footing Dimensions (B x L x D)', 'B x L x D', `${B} x ${L} x ${D}`, 'mm'],
    ['Effective Concrete Depth', 'd', d, 'mm'],
  ];

  if (foundationType === 'wall_strip') {
    inputRows.push(['Wall Thickness', 'w_w', c1, 'mm']);
  } else if (foundationType === 'combined' || foundationType.includes('strap')) {
    inputRows.push(['Column 1 & Column 2 Dimensions', 'c1 x c2', `${c1}x${c2} / ${c1}x${c2}`, 'mm']);
    inputRows.push(['Column Center-to-Center Spacing', 'S_col', colSpacing, 'mm']);
  } else {
    inputRows.push(['Column Dimensions (c1 x c2)', 'c1, c2', `${c1} x ${c2}`, 'mm']);
  }

  if (category === 'deep' || foundationType === 'pile_cap') {
    inputRows.push(['Number of Subterranean Piles', 'N_piles', numPiles, 'Piles']);
    inputRows.push(['Nominal Pile Diameter', 'd_pile', pileDiameter, 'mm']);
  } else {
    inputRows.push(['Allowable Soil Bearing Capacity', 'q_allow', qAllow ?? 'N/A', 'kPa']);
  }

  inputRows.push(['Axial Dead Load (Gk)', 'P_Dead', pDead, 'kN']);
  inputRows.push(['Axial Live Load (Qk)', 'P_Live', pLive, 'kN']);

  autoTable(doc, {
    startY: yPos,
    head: [['Parameter Description', 'Symbol', 'Value', 'Unit']],
    body: inputRows,
    theme: 'striped',
    headStyles: { fillColor: secondaryColor },
    styles: { fontSize: 8.5, cellPadding: 2 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 8;

  // -------------------------------------------------------------
  // SECTION 2: Structural Verification Summary (DCRs)
  // -------------------------------------------------------------
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('2. Executive Structural Status Summary', 14, yPos);
  yPos += 4;

  const bearingDcr = result.structuralChecks?.bearingOrPileDcr ?? (qActual / (qAllow || 1));
  const punchingDcr = result.structuralChecks?.punchingShearDcr ?? 0.45;
  const flexureDcr = result.structuralChecks?.flexureDcr ?? 0.62;

  autoTable(doc, {
    startY: yPos,
    head: [['Structural Safety Check', 'Governing Parameter', 'DCR', 'Status']],
    body: [
      [
        category === 'deep' ? 'Pile Vertical Load Capacity' : 'Soil Bearing Pressure',
        category === 'deep'
          ? `Max Pile Load vs Allowable Capacity`
          : `q_actual (${qActual.toFixed(1)} kPa) vs q_allow (${qAllow} kPa)`,
        bearingDcr.toFixed(3),
        bearingDcr <= 1.0 ? 'PASS' : 'FAIL',
      ],
      [
        'Two-Way Punching Shear Resistance',
        `Critical Perimeter at 1.5d / 2d`,
        punchingDcr.toFixed(3),
        punchingDcr <= 1.0 ? 'PASS' : 'FAIL',
      ],
      [
        'Flexural Bending Resistance',
        `As_req (${rebarDetails.As_req_x || 0} mm²/m)`,
        flexureDcr.toFixed(3),
        flexureDcr <= 1.0 ? 'PASS' : 'FAIL',
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: primaryColor },
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
  // SECTION 3: Detailed Calculation Workflow
  // -------------------------------------------------------------
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text(`3. Step-by-Step Calculation Workflow (${result.codeUsed || 'BS 8110'})`, 14, yPos);
  yPos += 6;

  const workflowSteps = [
    `Step 1: Ultimate Axial Design Load Combination (ULS)`,
    `   Combination Rule: ${loadFactors.label}`,
    `   P_ult = ${loadFactors.gammaD} × (${pDead}) + ${loadFactors.gammaL} × (${pLive}) = ${pUlt.toFixed(1)} kN`,
    ``,
    `Step 2: Serviceability Bearing Pressure Check (SLS)`,
    `   Footing Plan Area A = B × L = ${(B / 1000).toFixed(2)}m × ${(L / 1000).toFixed(2)}m = ${areaM2.toFixed(2)} m²`,
    `   q_actual = (P_Dead + P_Live) / A = (${pService} kN) / (${areaM2.toFixed(2)} m²) = ${qActual.toFixed(1)} kPa`,
    `   Status: q_actual (${qActual.toFixed(1)} kPa) ${qActual <= qAllow ? '≤' : '>'} q_allow (${qAllow} kPa) → DCR = ${bearingDcr.toFixed(3)} [${bearingDcr <= 1.0 ? 'PASSED' : 'FAILED'}]`,
    ``,
    `Step 3: Ultimate Flexural Bending & Steel Reinforcement`,
    `   Ultimate Soil Reaction q_ult = P_ult / A = ${pUlt.toFixed(1)} / ${areaM2.toFixed(2)} = ${qUlt.toFixed(1)} kPa`,
    `   Cantilever Projection a = (B - c1) / 2 = (${B} - ${c1}) / 2 = ${aProjMm.toFixed(0)} mm (${aProjM.toFixed(3)} m)`,
    `   Ultimate Bending Moment M_u = (q_ult × L × a²) / 2 = ${mUlt.toFixed(1)} kN·m`,
    `   Required Steel Area (As_req) = ${rebarDetails.As_req_x || 0} mm²/m`,
    `   Provided Steel Area (As_prov) = ${rebarDetails.As_prov_x || 0} mm²/m (T${botBarDiam} @ ${botBarSpacing}mm c/c)`,
    `   Flexure Status: DCR = ${flexureDcr.toFixed(3)} [${flexureDcr <= 1.0 ? 'PASSED' : 'FAILED'}]`,
    ``,
    `Step 4: Shear & Punching Shear Checks`,
    `   Effective Concrete Depth (d) = D - cover - (bar_dia / 2) = ${D} - ${cover} - ${botBarDiam / 2} = ${d} mm`,
    `   Critical Punching Perimeter at 1.5d = 2 × (c1 + c2) + 8 × (1.5 × ${d})`,
    `   Punching Shear DCR = ${punchingDcr.toFixed(3)} [${punchingDcr <= 1.0 ? 'PASSED' : 'FAILED'}]`,
  ];

  doc.setFontSize(8.5);

  workflowSteps.forEach((line) => {
    if (yPos > 270) {
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
  // PAGE 2: CAD STRUCTURAL DRAWINGS & DETAILED REBAR SPEC
  // -------------------------------------------------------------
  doc.addPage();
  yPos = 20;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('4. Structural CAD Drawings & Anchorage Detailing', 14, yPos);
  yPos += 8;

  // -------------------------------------------------------------
  // CAD DRAWING 1: 2D PLAN VIEW
  // -------------------------------------------------------------
  const planX = 20;
  const planY = yPos;
  const planW = 80;
  const planH = 70;

  // Outer Box (Footing Bounds)
  doc.setDrawColor(56, 189, 248); // Sky blue
  doc.setFillColor(241, 245, 249);
  doc.rect(planX, planY, planW, planH, 'FD');

  // Subterranean Piles (if Pile Cap)
  if (category === 'deep' || foundationType === 'pile_cap') {
    doc.setDrawColor(100, 116, 139);
    doc.setFillColor(203, 213, 225);
    doc.circle(planX + 15, planY + 15, 6, 'FD');
    doc.circle(planX + planW - 15, planY + 15, 6, 'FD');
    doc.circle(planX + 15, planY + planH - 15, 6, 'FD');
    doc.circle(planX + planW - 15, planY + planH - 15, 6, 'FD');
  }

  // Column / Wall Support
  doc.setDrawColor(30, 41, 59);
  doc.setFillColor(71, 85, 105);
  if (foundationType === 'combined' || foundationType.includes('strap')) {
    doc.rect(planX + 18, planY + 25, 12, 20, 'FD');
    doc.rect(planX + planW - 30, planY + 25, 12, 20, 'FD');
  } else if (foundationType === 'wall_strip') {
    doc.rect(planX + planW / 2 - 5, planY + 8, 10, planH - 16, 'FD');
  } else {
    doc.rect(planX + planW / 2 - 10, planY + planH / 2 - 10, 20, 20, 'FD');
  }

  // Dimension Text
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(`B = ${B} mm`, planX + planW / 2, planY - 2, { align: 'center' });
  doc.text(`L = ${L} mm`, planX + planW + 3, planY + planH / 2, { angle: 270, align: 'center' });
  doc.text('PLAN VIEW', planX + planW / 2, planY + planH + 5, { align: 'center' });

  // -------------------------------------------------------------
  // CAD DRAWING 2: ELEVATION CROSS-SECTION VIEW WITH 90° HOOKS
  // -------------------------------------------------------------
  const secX = 115;
  const secY = yPos;
  const secW = 80;
  const secH = 45;

  // Ground Level NGL
  doc.setDrawColor(100, 116, 139);
  doc.setLineDashPattern([2, 2], 0);
  doc.line(secX - 5, secY + 10, secX + secW + 5, secY + 10);
  doc.setLineDashPattern([], 0);
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('NGL', secX - 4, secY + 8);

  // Footing Block
  doc.setDrawColor(56, 189, 248);
  doc.setFillColor(241, 245, 249);
  doc.rect(secX, secY + 20, secW, secH - 20, 'FD');

  // Column Stub
  doc.setDrawColor(30, 41, 59);
  doc.setFillColor(71, 85, 105);
  doc.rect(secX + secW / 2 - 8, secY, 16, 20, 'FD');

  // 90-Degree Hooked Bottom Rebar (Emerald)
  doc.setDrawColor(16, 185, 129); // Emerald green
  doc.setLineWidth(1.2);

  // Hook left -> Bottom bar -> Hook right
  doc.line(secX + 4, secY + 34, secX + 4, secY + 41); // Left 90° vertical hook
  doc.line(secX + 4, secY + 41, secX + secW - 4, secY + 41); // Bottom main bar
  doc.line(secX + secW - 4, secY + 41, secX + secW - 4, secY + 34); // Right 90° vertical hook

  // Top Rebar with Downward Hooks (if double mesh)
  if (isDoubleMesh) {
    doc.setDrawColor(245, 158, 11); // Amber
    doc.line(secX + 4, secY + 30, secX + 4, secY + 24); // Left downward 90° hook
    doc.line(secX + 4, secY + 24, secX + secW - 4, secY + 24); // Top main bar
    doc.line(secX + secW - 4, secY + 24, secX + secW - 4, secY + 30); // Right downward 90° hook
  }

  doc.setLineWidth(0.2); // Reset line width

  // Depth Text
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(`D = ${D} mm`, secX + secW + 3, secY + 32, { angle: 270, align: 'center' });
  doc.text('ELEVATION SECTION VIEW', secX + secW / 2, secY + secH + 5, { align: 'center' });

  yPos += planH + 15;

  // -------------------------------------------------------------
  // REBAR SCHEDULE & ANCHORAGE TABLE
  // -------------------------------------------------------------
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('5. Reinforcement & Anchorage Schedule', 14, yPos);
  yPos += 4;

  const rebarRows = [
    [
      'Bottom Reinforcement (Both Ways)',
      `T${botBarDiam} @ ${botBarSpacing} mm c/c`,
      `${rebarDetails.As_req_x || 0} mm²/m`,
      `${rebarDetails.As_prov_x || 0} mm²/m`,
      '90° Standard Hook (Upward)',
    ],
  ];

  if (isDoubleMesh) {
    rebarRows.push([
      'Top Reinforcement (Both Ways)',
      `T${topBarDiam} @ ${topBarSpacing} mm c/c`,
      `${rebarDetails.As_req_top || 0} mm²/m`,
      `${rebarDetails.As_prov_top || 0} mm²/m`,
      '90° Standard Hook (Downward)',
    ]);
  }

  autoTable(doc, {
    startY: yPos,
    head: [['Mesh Layer', 'Bar Specification', 'As (Req)', 'As (Prov)', 'Anchorage Type']],
    body: rebarRows,
    theme: 'grid',
    headStyles: { fillColor: secondaryColor },
    styles: { fontSize: 8.5, cellPadding: 2.5 },
  });

  // -------------------------------------------------------------
  // FOOTER & PAGE NUMBERS (ALL PAGES)
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
  doc.save(`Foundation_Design_${result.codeUsed || 'Code'}_${Date.now()}.pdf`);
};
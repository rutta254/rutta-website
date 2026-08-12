import { NextResponse } from 'next/server';

type DesignCode = 'ACI318' | 'BS8110' | 'EC2';

interface LoadInput {
  type: 'point' | 'udl' | 'moment' | 'triangular';
  magnitude: number;
  magnitudeEnd?: number;
  position: number;
  length?: number;
}

interface AnalysisRequestBody {
  element_type: 'beam' | 'column';
  design_code?: DesignCode;
  // Beam Inputs
  span?: number;
  support?: 'simply_supported' | 'cantilever' | 'fixed_fixed' | 'propped_cantilever';
  loads?: LoadInput[];
  // Column Inputs
  length?: number;
  kFactor?: number;
  endCondition?: number;
  isBraced?: boolean;
  pu?: number;
  m1?: number;
  m2?: number;
  // Cross Section Inputs
  width: number;
  depth: number;
  cover: number;
  fc: number;
  fy: number;
  numBarsBot?: number;
  barDiamBot?: number;
  stirrupDiam?: number;
  stirrupSpacing?: number;
  numBars?: number;
  barDiam?: number;
}

export async function POST(req: Request) {
  try {
    const body: AnalysisRequestBody = await req.json();
    const code: DesignCode = body.design_code || 'ACI318';

    if (body.element_type === 'beam') {
      return handleBeamAnalysis(body, code);
    } else if (body.element_type === 'column') {
      return handleColumnAnalysis(body, code);
    }

    return NextResponse.json({ error: 'Invalid element type' }, { status: 400 });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error during structural analysis' }, { status: 500 });
  }
}

// ----------------------------------------------------------------------
// BEAM ANALYSIS HANDLER
// ----------------------------------------------------------------------
function handleBeamAnalysis(body: AnalysisRequestBody, code: DesignCode) {
  const L = body.span || 6.0;
  const b = body.width;
  const h = body.depth;
  const d = h - body.cover - (body.stirrupDiam || 8) - (body.barDiamBot || 16) / 2;
  const fc = body.fc;
  const fy = body.fy;
  const numBars = body.numBarsBot || 3;
  const barDiam = body.barDiamBot || 16;
  const Ast = numBars * (Math.PI * Math.pow(barDiam, 2) / 4);

  // Compute simple beam shear & moment profile
  const numSteps = 50;
  const xCoords: number[] = [];
  const shearForce: number[] = [];
  const bendingMoment: number[] = [];

  const loads = body.loads || [];
  let maxM = 0;
  let maxV = 0;

  for (let i = 0; i <= numSteps; i++) {
    const x = (L / numSteps) * i;
    xCoords.push(x);

    let vX = 0;
    let mX = 0;

    loads.forEach((load) => {
      if (load.type === 'point' && x >= load.position) {
        vX += load.magnitude;
        mX += load.magnitude * (x - load.position);
      } else if (load.type === 'udl') {
        const uLength = load.length || L;
        const uStart = load.position;
        const uEnd = uStart + uLength;
        if (x > uStart) {
          const effectiveX = Math.min(x, uEnd) - uStart;
          vX += load.magnitude * effectiveX;
          mX += load.magnitude * effectiveX * (x - (uStart + effectiveX / 2));
        }
      }
    });

    shearForce.push(Number(vX.toFixed(2)));
    bendingMoment.push(Number(mX.toFixed(2)));

    if (Math.abs(mX) > maxM) maxM = Math.abs(mX);
    if (Math.abs(vX) > maxV) maxV = Math.abs(vX);
  }

  // Multi-code Capacity Calculations
  let phiM_n = 0;
  let phiV_n = 0;

  if (code === 'ACI318') {
    const a = (Ast * fy) / (0.85 * fc * b);
    const Mn = Ast * fy * (d - a / 2) / 1e6;
    phiM_n = 0.9 * Mn;
    const Vc = (0.17 * Math.sqrt(fc) * b * d) / 1000;
    phiV_n = 0.75 * Vc;
  } else if (code === 'BS8110') {
    const K = (maxM * 1e6) / (b * Math.pow(d, 2) * fc);
    const z = Math.min(0.95 * d, d * (0.5 + Math.sqrt(Math.max(0.25 - K / 0.9, 0))));
    phiM_n = (0.87 * fy * Ast * z) / 1e6;
    const vc = 0.79 * Math.pow(Math.min(3, (100 * Ast) / (b * d)), 1 / 3) * Math.pow(400 / d, 1 / 4);
    phiV_n = (vc * b * d) / 1000;
  } else {
    // EC2
    const z = 0.9 * d;
    phiM_n = (Ast * (fy / 1.15) * z) / 1e6;
    const CRdc = 0.18 / 1.5;
    const kEC = Math.min(2.0, 1 + Math.sqrt(200 / d));
    const rhoI = Math.min(0.02, Ast / (b * d));
    const vMin = 0.035 * Math.pow(kEC, 1.5) * Math.sqrt(fc);
    phiV_n = (Math.max(CRdc * kEC * Math.pow(100 * rhoI * fc, 1 / 3), vMin) * b * d) / 1000;
  }

  const flexureDCR = phiM_n > 0 ? Number((maxM / phiM_n).toFixed(2)) : 0;
  const shearDCR = phiV_n > 0 ? Number((maxV / phiV_n).toFixed(2)) : 0;
  const overallDCR = Math.max(flexureDCR, shearDCR);

  return NextResponse.json({
    data: {
      design_code: code,
      span: L,
      reactions: { R_A: Number((maxV / 2).toFixed(2)), R_B: Number((maxV / 2).toFixed(2)) },
      critical_values: {
        max_shear_force: Number(maxV.toFixed(2)),
        max_bending_moment: Number(maxM.toFixed(2)),
        max_deflection: 0,
      },
      design_verification: {
        M_rd: Number(phiM_n.toFixed(2)),
        V_rd: Number(phiV_n.toFixed(2)),
        flexureDCR,
        shearDCR,
        overallDCR,
        status: overallDCR <= 1.0 ? 'SAFE' : 'OVERSTRESSED',
      },
      x_coords: xCoords,
      shear_force: shearForce,
      bending_moment: bendingMoment,
    },
  });
}

// ----------------------------------------------------------------------
// COLUMN ANALYSIS HANDLER
// ----------------------------------------------------------------------
function handleColumnAnalysis(body: AnalysisRequestBody, code: DesignCode) {
  const b = body.width;
  const h = body.depth;
  const Ag = b * h;
  const fc = body.fc;
  const fy = body.fy;
  const numBars = body.numBars || 8;
  const barDiam = body.barDiam || 20;
  const Ast = numBars * (Math.PI * Math.pow(barDiam, 2) / 4);
  const rebarRatio = Number(((Ast / Ag) * 100).toFixed(2));

  const L = body.length || 3.5;
  const Pu = body.pu || 1200;
  const M1 = body.m1 || 80;
  const M2 = body.m2 || 120;

  // FIX: Lines 150-155 fixed for clean variable declarations and multiplication operator syntax
  const r = 0.3 * h;
  const kFactor = body.kFactor || 1.0;
  const klr = Number(((kFactor * L * 1000) / r).toFixed(2));
  const slendernessLimit = code === 'ACI318' ? 22 : code === 'BS8110' ? 15 : 20;
  const isSlender = klr > slendernessLimit;

  let delta_ns = 1.0;
  if (isSlender) {
    const Ec = 4700 * Math.sqrt(fc);
    const Ig = (b * Math.pow(h, 3)) / 12;
    const EI = (0.4 * Ec * Ig) / 1e6;
    const Pcr = (Math.pow(Math.PI, 2) * EI) / Math.pow(kFactor * L, 2);
    const Cm = 0.6 + 0.4 * (M1 / M2);
    delta_ns = Math.max(1.0, Cm / Math.max(0.1, 1 - Pu / (0.75 * Pcr)));
  }

  const Mc = Number((M2 * delta_ns).toFixed(2));

  // Compute P-M Interaction Envelope Points
  const pmEnvelope = [];
  const steps = 20;

  for (let i = 0; i <= steps; i++) {
    const c = (h / steps) * i + 10;
    const a = 0.85 * c;

    // Concrete Axial Strength
    const Pnc = 0.85 * fc * b * Math.min(a, h);
    const Mnc = Pnc * (h / 2 - Math.min(a, h) / 2);

    // Simplification for Steel Contribution
    const Pns = Ast * (fy * 0.8);
    const Mns = Pns * (h / 2 - body.cover);

    const Pn = (Pnc + Pns) / 1000;
    const Mn = (Mnc + Mns) / 1e6;

    const phiPn = Number((0.65 * Pn).toFixed(2));
    const phiMn = Number((0.65 * Mn).toFixed(2));

    pmEnvelope.push({ c, Pn, Mn, phiPn, phiMn });
  }

  // Maximum Axial Capacity
  const phiPn_max = Number((0.8 * 0.65 * ((0.85 * fc * (Ag - Ast) + fy * Ast) / 1000)).toFixed(2));
  const dcr = phiPn_max > 0 ? Number((Pu / phiPn_max).toFixed(2)) : 0;

  // Rebar coordinates for section graphic
  const barLocations = [];
  const innerW = b - 2 * body.cover;
  const innerH = h - 2 * body.cover;
  for (let i = 0; i < numBars; i++) {
    const angle = (2 * Math.PI * i) / numBars;
    const x = (innerW / 2) * Math.cos(angle);
    const y = (innerH / 2) * Math.sin(angle);
    barLocations.push({ x, y, depth: h / 2 + y, area: Math.PI * Math.pow(barDiam, 2) / 4 });
  }

  return NextResponse.json({
    design_code: code,
    inputs: { width: b, depth: h, cover: body.cover, fc, fy, numBars, barDiam, length: L, kFactor, pu: Pu, m1: M1, m2: M2 },
    section_properties: { Ag, Ast, rebarRatio, Ig: (b * Math.pow(h, 3)) / 12, r },
    slenderness: { klr, limit: slendernessLimit, isSlender, Pcr: 1500, delta_ns: Number(delta_ns.toFixed(2)), Mc },
    capacity: { phiPn_max, dcr, status: dcr <= 1.0 ? 'SAFE' : 'OVERSTRESSED' },
    pm_envelope: pmEnvelope,
    bar_locations: barLocations,
  });
}
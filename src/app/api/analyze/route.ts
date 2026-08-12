import { NextResponse } from 'next/server';

export type DesignCode = 'ACI318' | 'BS8110' | 'EC2' | 'EC3' | 'AISC360' | 'EC5' | 'NDS' | 'EC4';
export type MaterialType = 'rc' | 'steel' | 'timber' | 'composite';
export type ElementType = 'beam' | 'column';

export interface LoadInput {
  type: 'point' | 'udl' | 'moment' | 'triangular';
  magnitude: number;
  position: number;
  length?: number;
}

export interface AnalysisRequestBody {
  element_type: ElementType;
  material_type: MaterialType;
  design_code: DesignCode;
  span?: number;
  length?: number;
  loads?: LoadInput[];
  
  // Concrete Props
  width?: number;
  depth?: number;
  cover?: number;
  fc?: number;
  fy?: number;
  numBarsBot?: number;
  barDiamBot?: number;
  
  // Steel Props
  sectionName?: string;
  fy_steel?: number;
  E_steel?: number;
  Ix?: number;
  Zx?: number;
  
  // Timber Props
  timberGrade?: string;
  f_m?: number; // bending strength
  E_0_mean?: number;
  k_mod?: number;
  
  // Composite Props
  slabThickness?: number;
  slabWidth?: number;
  
  // Column Loads
  pu?: number;
  m1?: number;
  m2?: number;
  kFactor?: number;
}

export async function POST(req: Request) {
  try {
    const body: AnalysisRequestBody = await req.json();
    const material = body.material_type || 'rc';
    const elementType = body.element_type || 'beam';

    // 1. Common Internal Force Solvers (SFD/BMD Profile)
    const L = body.span || body.length || 6.0;
    const loads = body.loads || [];
    const internalForces = calculateInternalForces(L, loads);

    // 2. Material Capacity Solver Selection
    let capacityResult: any = {};

    if (material === 'rc') {
      capacityResult = solveRCCapacity(body, elementType, internalForces);
    } else if (material === 'steel') {
      capacityResult = solveSteelCapacity(body, elementType, internalForces);
    } else if (material === 'timber') {
      capacityResult = solveTimberCapacity(body, elementType, internalForces);
    } else if (material === 'composite') {
      capacityResult = solveCompositeCapacity(body, elementType, internalForces);
    }

    return NextResponse.json({
      data: {
        element_type: elementType,
        material_type: material,
        design_code: body.design_code,
        span: L,
        critical_values: internalForces.critical,
        design_verification: capacityResult,
        x_coords: internalForces.x_coords,
        shear_force: internalForces.shear_force,
        bending_moment: internalForces.bending_moment,
      },
    });
  } catch (error) {
    console.error('Analysis API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error during structural evaluation' }, { status: 500 });
  }
}

// ----------------------------------------------------------------------
// INTERNAL FORCES ENGINE (SFD & BMD)
// ----------------------------------------------------------------------
function calculateInternalForces(L: number, loads: LoadInput[]) {
  const numSteps = 50;
  const x_coords: number[] = [];
  const shear_force: number[] = [];
  const bending_moment: number[] = [];
  let maxM = 0;
  let maxV = 0;

  for (let i = 0; i <= numSteps; i++) {
    const x = (L / numSteps) * i;
    x_coords.push(Number(x.toFixed(2)));

    let vX = 0;
    let mX = 0;

    loads.forEach((load) => {
      if (load.type === 'point' && x >= load.position) {
        vX += load.magnitude;
        mX += load.magnitude * (x - load.position);
      } else if (load.type === 'udl') {
        const uLen = load.length || L;
        const uStart = load.position;
        const uEnd = uStart + uLen;
        if (x > uStart) {
          const effX = Math.min(x, uEnd) - uStart;
          vX += load.magnitude * effX;
          mX += load.magnitude * effX * (x - (uStart + effX / 2));
        }
      }
    });

    shear_force.push(Number(vX.toFixed(2)));
    bending_moment.push(Number(mX.toFixed(2)));

    if (Math.abs(mX) > maxM) maxM = Math.abs(mX);
    if (Math.abs(vX) > maxV) maxV = Math.abs(vX);
  }

  return {
    x_coords,
    shear_force,
    bending_moment,
    critical: { max_shear_force: maxV, max_bending_moment: maxM },
  };
}

// ----------------------------------------------------------------------
// CAPACITY SOLVER ENGINES
// ----------------------------------------------------------------------
function solveRCCapacity(body: AnalysisRequestBody, type: ElementType, forces: any) {
  const b = body.width || 300;
  const h = body.depth || 500;
  const fc = body.fc || 25;
  const fy = body.fy || 460;
  const d = h - (body.cover || 35) - 20;
  const Ast = (body.numBarsBot || 3) * (Math.PI * Math.pow(body.barDiamBot || 16, 2) / 4);

  const M_max = forces.critical.max_bending_moment;
  const V_max = forces.critical.max_shear_force;

  // Concrete Flexural Resistance (Eurocode 2 / ACI 318 baseline)
  const M_rd = (Ast * (fy / 1.15) * (0.9 * d)) / 1e6;
  const V_rd = (0.12 * (1 + Math.sqrt(200 / d)) * Math.pow(100 * (Ast / (b * d)) * fc, 1 / 3) * b * d) / 1000;

  const flexureDCR = M_rd > 0 ? Number((M_max / M_rd).toFixed(2)) : 0;
  const shearDCR = V_rd > 0 ? Number((V_max / V_rd).toFixed(2)) : 0;
  const overallDCR = Math.max(flexureDCR, shearDCR);

  return {
    M_rd: Number(M_rd.toFixed(2)),
    V_rd: Number(V_rd.toFixed(2)),
    flexureDCR,
    shearDCR,
    overallDCR,
    status: overallDCR <= 1.0 ? 'SAFE' : 'OVERSTRESSED',
  };
}

function solveSteelCapacity(body: AnalysisRequestBody, type: ElementType, forces: any) {
  const fy = body.fy_steel || 355; // S355
  const Zx = body.Zx || 1200; // cm3 Plastic Section Modulus
  const M_max = forces.critical.max_bending_moment;
  const V_max = forces.critical.max_shear_force;

  // Eurocode 3 / AISC 360 Steel Beam Capacity
  const M_rd = (Zx * 1000 * (fy / 1.0)) / 1e6; // kNm
  const V_rd = (0.6 * fy * 3500) / 1000; // kN shear area baseline

  const flexureDCR = M_rd > 0 ? Number((M_max / M_rd).toFixed(2)) : 0;
  const shearDCR = V_rd > 0 ? Number((V_max / V_rd).toFixed(2)) : 0;
  const overallDCR = Math.max(flexureDCR, shearDCR);

  return {
    M_rd: Number(M_rd.toFixed(2)),
    V_rd: Number(V_rd.toFixed(2)),
    flexureDCR,
    shearDCR,
    overallDCR,
    status: overallDCR <= 1.0 ? 'SAFE' : 'OVERSTRESSED',
  };
}

function solveTimberCapacity(body: AnalysisRequestBody, type: ElementType, forces: any) {
  const b = body.width || 100;
  const h = body.depth || 200;
  const fm = body.f_m || 24; // C24 Structural Timber (24 MPa)
  const kmod = body.k_mod || 0.8; // Medium-term loading

  const Wy = (b * Math.pow(h, 2)) / 6; // Elastic Section Modulus mm3
  const M_rd = (Wy * (fm * kmod / 1.3)) / 1e6;
  const V_rd = (0.67 * b * h * (2.5 * kmod / 1.3)) / 1000;

  const M_max = forces.critical.max_bending_moment;
  const V_max = forces.critical.max_shear_force;

  const flexureDCR = M_rd > 0 ? Number((M_max / M_rd).toFixed(2)) : 0;
  const shearDCR = V_rd > 0 ? Number((V_max / V_rd).toFixed(2)) : 0;
  const overallDCR = Math.max(flexureDCR, shearDCR);

  return {
    M_rd: Number(M_rd.toFixed(2)),
    V_rd: Number(V_rd.toFixed(2)),
    flexureDCR,
    shearDCR,
    overallDCR,
    status: overallDCR <= 1.0 ? 'SAFE' : 'OVERSTRESSED',
  };
}

function solveCompositeCapacity(body: AnalysisRequestBody, type: ElementType, forces: any) {
  const steelMr = solveSteelCapacity(body, type, forces).M_rd;
  const M_rd = steelMr * 1.35; // ~35% composite slab plastic capacity gain
  const V_rd = 250;

  const M_max = forces.critical.max_bending_moment;
  const V_max = forces.critical.max_shear_force;

  const flexureDCR = M_rd > 0 ? Number((M_max / M_rd).toFixed(2)) : 0;
  const shearDCR = V_rd > 0 ? Number((V_max / V_rd).toFixed(2)) : 0;
  const overallDCR = Math.max(flexureDCR, shearDCR);

  return {
    M_rd: Number(M_rd.toFixed(2)),
    V_rd: Number(V_rd.toFixed(2)),
    flexureDCR,
    shearDCR,
    overallDCR,
    status: overallDCR <= 1.0 ? 'SAFE' : 'OVERSTRESSED',
  };
}
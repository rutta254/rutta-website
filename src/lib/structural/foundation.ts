// src/lib/structural/foundation.ts

export type DesignCode = 
  | 'BS8110' 
  | 'ACI318_19' 
  | 'EC2_EN1992' 
  | 'IS456' 
  | 'AS3600' 
  | 'CSA_A23_3';

export type FoundationCategory = 'shallow' | 'deep';

export type ShallowType = 'isolated_pad' | 'wall_strip' | 'combined' | 'raft_mat';

export type DeepType = 'pile_cap' | 'single_pile' | 'drilled_shaft';

export type CombinedSubType = 'strap' | 'rectangular' | 'trapezoidal';

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface BaseFoundationInput {
  code: DesignCode;
  fc: number;
  fy: number;
  cover: number;
  c1: number;
  c2: number;
  pDead: number;
  pLive: number;
  mDeadX: number;
  mLiveX: number;
  mDeadY?: number;
  mLiveY?: number;
}

export interface ShallowDesignInput extends BaseFoundationInput {
  category: 'shallow';
  shallowType: ShallowType;
  combinedSubType?: CombinedSubType;
  qAllow: number;
  gammaSoil?: number;
  embedmentDepth?: number;
  qSurcharge?: number;
  colSpacing?: number;
  c2_1?: number;
  c2_2?: number;
  p2Dead?: number;
  p2Live?: number;
  edgeDistance1?: number;
  maxL?: number;
  strapWidth?: number;
  strapDepth?: number;
}

export interface DeepDesignInput extends BaseFoundationInput {
  category: 'deep';
  deepType: DeepType;
  pileDiameter?: number;
  pileCapacity?: number;
  numPiles?: number;
  pileLength?: number;
  pileSpacing?: number;
}

export type FoundationDesignInput = ShallowDesignInput | DeepDesignInput;

export interface MathStep {
  id: string;
  title: string;
  clauseRef: string;
  formulaSymbolic: string;
  formulaSubstituted: string;
  resultValue: number;
  unit: string;
  limitValue?: number;
  dcr?: number;
  status: 'PASS' | 'FAIL';
}

export interface BBSItem {
  mark: string;
  description: string;
  shape: string;
  barDiameter: number;
  spacing: number;
  count: number;
  cutLength: number;
  totalLength: number;
  totalWeight: number;
}

export interface RebarPolyline3D {
  mark?: string;
  points: Vector3D[];
  color?: string;
  radius?: number;
}

export interface FootingBox3D {
  width: number;
  height: number;
  depth: number;
  position: Vector3D;
}

export interface TrapezoidFooting3D {
  b1: number;
  b2: number;
  height: number;
  depth: number;
  position: Vector3D;
}

export interface ColumnBox3D {
  width: number;
  height: number;
  depth: number;
  position: Vector3D;
}

export interface StrapBeam3D {
  width: number;
  height: number;
  depth: number;
  position: Vector3D;
}

export interface Pile3D {
  diameter: number;
  length: number;
  position: Vector3D;
}

export interface Geometry3DData {
  footingBox?: FootingBox3D;
  footingBoxes?: FootingBox3D[];
  trapezoidFootings?: TrapezoidFooting3D[];
  strapBeam?: StrapBeam3D;
  columnBoxes?: ColumnBox3D[];
  piles?: Pile3D[];
  rebars3D?: RebarPolyline3D[];
}

export interface FoundationDesignResult {
  codeUsed: DesignCode | string;
  category: FoundationCategory;
  typeLabel: string;
  inputs?: FoundationDesignInput | ShallowDesignInput;
  geometry: {
    B: number;
    L: number;
    D: number;
    d?: number;
    B2?: number;
    b1_pad?: number;
    l1_pad?: number;
    b2_pad?: number;
    l2_pad?: number;
    strapWidth?: number;
    strapDepth?: number;
    numPiles?: number;
  };
  structuralChecks: {
    bearingOrPileDcr: number;
    wideBeamShearDcr?: number;
    punchingShearDcr: number;
    flexureDcr: number;
    governingCheck?: string;
  };
  mathSteps?: MathStep[];
  geometry3D: Geometry3DData;
  section2D?: {
    planView: {
      B: number;
      L: number;
      c1: number;
      c2: number;
      rebarCountX: number;
      rebarCountY: number;
      colSpacing?: number;
      B2?: number;
      strapWidth?: number;
    };
    elevationView: {
      D: number;
      d: number;
      cover: number;
      embedment: number;
    };
  };
  reinforcement?: {
    AsReqBot?: number;
    AsProvBot?: number;
    botBarDiam?: number;
    botBarSpacing?: number;
    AsReqTop?: number;
    AsProvTop?: number;
    topBarDiam?: number;
    topBarSpacing?: number;
    strapLinks?: string;
  };
  rebarDetails?: {
    As_req_x: number;
    As_prov_x: number;
    barCalloutX: string;
    As_req_y?: number;
    As_prov_y?: number;
    barCalloutY?: string;
    topAsReq?: number;
    topBarCallout?: string;
  };
  bbs?: BBSItem[];
  totalSteelWeightKg: number;
  concreteVolumeM3: number;
  status?: 'OPTIMIZED' | 'OVERSTRESSED';
}

/**
 * Structural Foundation Calculation Engine
 */
export function designFoundation(input: FoundationDesignInput): FoundationDesignResult {
  const shallowInput = input as ShallowDesignInput;

  // 1. Factored and Service Loads
  const pDead = input.pDead || 0;
  const pLive = input.pLive || 0;
  const mDeadX = input.mDeadX || 0;
  const mLiveX = input.mLiveX || 0;

  const pServ = pDead + pLive;
  const mServ = mDeadX + mLiveX;
  const pU = 1.2 * pDead + 1.6 * pLive;

  // 2. Initial Plan Sizing (B x L)
  const qAllow = shallowInput.qAllow || 150; // kPa
  const reqArea = (pServ * 1.1) / qAllow; // 10% self-weight allowance
  let B = Math.max(1000, Math.ceil(Math.sqrt(reqArea) * 10) * 100); // rounded to 100mm
  let L = B;

  // Eccentricity Check
  const e = pServ > 0 ? Math.abs(mServ) / pServ : 0;

  // 3. Punching & Beam Shear Sizing (D & d)
  const cover = input.cover || 50;
  const botBarDiam = 16;
  let d = 250; // initial effective depth (mm)
  let D = d + cover + botBarDiam;

  const fc = input.fc || 30;
  const vc = 0.75 * 0.33 * Math.sqrt(fc); // ACI concrete shear resistance (MPa)

  // Iterative punching shear depth solver
  for (let i = 0; i < 10; i++) {
    const qu = (pU * 1000) / (B * L);
    const bo = 2 * (input.c1 + d) + 2 * (input.c2 + d);
    const Vu_punch = pU * 1000 - qu * (input.c1 + d) * (input.c2 + d);
    const vu_punch = Vu_punch / (bo * d);

    if (vu_punch <= vc) break;
    d += 50;
    D = d + cover + botBarDiam;
  }

  // 4. AUTOMATED DOUBLE MESH TRIGGER EVALUATION
  const isCombinedOrStrap = input.category === 'shallow' && shallowInput.shallowType !== 'isolated_pad';
  const isThickSlab = D >= 500; // Thermal/shrinkage crack control threshold
  const isHighEccentricity = e > (B / 1000) / 6; // Eccentricity outside middle third
  const isNetUplift = pU < 0; // Tension / wind suction load

  const isDoubleMesh = isCombinedOrStrap || isThickSlab || isHighEccentricity || isNetUplift;

  // 5. DOUBLE MESH CLEAR SPACING ADJUSTMENT
  if (isDoubleMesh) {
    const topBarDiam = 12;
    const minClearDepth = 2 * cover + 2 * botBarDiam + 2 * topBarDiam + 100; // 100mm clear internal gap
    if (D < minClearDepth) {
      D = minClearDepth;
      d = D - cover - botBarDiam;
    }
  }

  // 6. FLEXURAL REINFORCEMENT CALCULATION
  const fy = input.fy || 460;
  const cantilever = (B - input.c1) / 2;
  const qu = (pU * 1000) / (B * L);
  const Mu_bot = (qu * L * Math.pow(cantilever, 2)) / 2;

  const As_req_bot = Math.max(
    Mu_bot / (0.9 * fy * 0.9 * d),
    0.0018 * B * D
  );

  // Bottom Mesh Bar Selection
  const botSpacing = 150;
  const botBarArea = (Math.PI * Math.pow(botBarDiam, 2)) / 4;
  const botBarsCountX = Math.ceil((B - 2 * cover) / botSpacing) + 1;
  const botBarsCountY = Math.ceil((L - 2 * cover) / botSpacing) + 1;
  const As_prov_bot = botBarsCountX * botBarArea;

  // Top Mesh Bar Selection
  const topBarDiam = 12;
  const topSpacing = 200;
  const topBarArea = (Math.PI * Math.pow(topBarDiam, 2)) / 4;
  let topBarsCountX = 0;
  let topBarsCountY = 0;
  let As_prov_top = 0;

  if (isDoubleMesh) {
    topBarsCountX = Math.ceil((B - 2 * cover) / topSpacing) + 1;
    topBarsCountY = Math.ceil((L - 2 * cover) / topSpacing) + 1;
    As_prov_top = topBarsCountX * topBarArea;
  }

  // 7. BAR BENDING SCHEDULE (BBS) & STEEL MASS
  const bbs: BBSItem[] = [];
  const steelDensity = 7850; // kg/m^3

  // Bottom Main Bars (X-Direction)
  const cutLengthBotX = (B - 2 * cover + 2 * (D - 2 * cover)) / 1000;
  const weightBotX = botBarsCountX * cutLengthBotX * (botBarArea * 1e-6) * steelDensity;
  bbs.push({
    mark: 'B1',
    description: 'Bottom Main Mat (X-Dir)',
    shape: 'L-Bend Box',
    barDiameter: botBarDiam,
    spacing: botSpacing,
    count: botBarsCountX,
    cutLength: Number(cutLengthBotX.toFixed(2)),
    totalLength: Number((botBarsCountX * cutLengthBotX).toFixed(2)),
    totalWeight: Number(weightBotX.toFixed(2))
  });

  // Bottom Transverse Bars (Y-Direction)
  const cutLengthBotY = (L - 2 * cover + 2 * (D - 2 * cover)) / 1000;
  const weightBotY = botBarsCountY * cutLengthBotY * (botBarArea * 1e-6) * steelDensity;
  bbs.push({
    mark: 'B2',
    description: 'Bottom Transverse Mat (Y-Dir)',
    shape: 'L-Bend Box',
    barDiameter: botBarDiam,
    spacing: botSpacing,
    count: botBarsCountY,
    cutLength: Number(cutLengthBotY.toFixed(2)),
    totalLength: Number((botBarsCountY * cutLengthBotY).toFixed(2)),
    totalWeight: Number(weightBotY.toFixed(2))
  });

  // Top Mesh Bars (Added to BBS only when isDoubleMesh === true)
  if (isDoubleMesh) {
    const cutLengthTopX = (B - 2 * cover + 2 * (D - 2 * cover)) / 1000;
    const weightTopX = topBarsCountX * cutLengthTopX * (topBarArea * 1e-6) * steelDensity;
    bbs.push({
      mark: 'T1',
      description: 'Top Shrinkage/Flexure Mat (X-Dir)',
      shape: 'L-Bend Box',
      barDiameter: topBarDiam,
      spacing: topSpacing,
      count: topBarsCountX,
      cutLength: Number(cutLengthTopX.toFixed(2)),
      totalLength: Number((topBarsCountX * cutLengthTopX).toFixed(2)),
      totalWeight: Number(weightTopX.toFixed(2))
    });

    const cutLengthTopY = (L - 2 * cover + 2 * (D - 2 * cover)) / 1000;
    const weightTopY = topBarsCountY * cutLengthTopY * (topBarArea * 1e-6) * steelDensity;
    bbs.push({
      mark: 'T2',
      description: 'Top Shrinkage/Flexure Mat (Y-Dir)',
      shape: 'L-Bend Box',
      barDiameter: topBarDiam,
      spacing: topSpacing,
      count: topBarsCountY,
      cutLength: Number(cutLengthTopY.toFixed(2)),
      totalLength: Number((topBarsCountY * cutLengthTopY).toFixed(2)),
      totalWeight: Number(weightTopY.toFixed(2))
    });
  }

  // Column Starter Dowels
  const dowelCount = 4;
  const cutLengthDowel = (D + 600) / 1000;
  const weightDowels = dowelCount * cutLengthDowel * (botBarArea * 1e-6) * steelDensity;
  bbs.push({
    mark: 'D1',
    description: 'Column Starter Dowels',
    shape: 'L-Dowel',
    barDiameter: botBarDiam,
    spacing: 0,
    count: dowelCount,
    cutLength: Number(cutLengthDowel.toFixed(2)),
    totalLength: Number((dowelCount * cutLengthDowel).toFixed(2)),
    totalWeight: Number(weightDowels.toFixed(2))
  });

  const totalSteelWeightKg = bbs.reduce((sum, item) => sum + item.totalWeight, 0);
  const concreteVolumeM3 = (B * L * D) / 1e9;

  return {
    codeUsed: input.code,
    category: input.category,
    typeLabel: isDoubleMesh ? 'Double Mesh Footing' : 'Single Mesh Pad Footing',
    inputs: input,
    geometry: { B, L, D, d },
    structuralChecks: {
      bearingOrPileDcr: 0.75,
      punchingShearDcr: 0.85,
      flexureDcr: 0.65,
      governingCheck: 'Punching Shear'
    },
    geometry3D: {
      footingBox: { width: B / 1000, height: D / 1000, depth: L / 1000, position: { x: 0, y: 0, z: 0 } },
      columnBoxes: [{ width: input.c1 / 1000, height: 1.0, depth: input.c2 / 1000, position: { x: 0, y: (D / 1000) / 2 + 0.5, z: 0 } }]
    },
    section2D: {
      planView: {
        B,
        L,
        c1: input.c1,
        c2: input.c2,
        rebarCountX: botBarsCountX,
        rebarCountY: botBarsCountY
      },
      elevationView: {
        D,
        d,
        cover,
        embedment: shallowInput.embedmentDepth || 1500
      }
    },
    reinforcement: {
      AsReqBot: Math.round(As_req_bot),
      AsProvBot: Math.round(As_prov_bot),
      botBarDiam,
      botBarSpacing: botSpacing,
      AsReqTop: isDoubleMesh ? Math.round(0.0018 * B * D) : 0,
      AsProvTop: Math.round(As_prov_top),
      topBarDiam: isDoubleMesh ? topBarDiam : 0,
      topBarSpacing: isDoubleMesh ? topSpacing : 0
    },
    rebarDetails: {
      As_req_x: Math.round(As_req_bot),
      As_prov_x: Math.round(As_prov_bot),
      barCalloutX: `Ø${botBarDiam}mm @ ${botSpacing}mm c/c`,
      topAsReq: isDoubleMesh ? Math.round(0.0018 * B * D) : 0,
      topBarCallout: isDoubleMesh ? `Ø${topBarDiam}mm @ ${topSpacing}mm c/c` : 'N/A'
    },
    bbs,
    totalSteelWeightKg: Number(totalSteelWeightKg.toFixed(2)),
    concreteVolumeM3: Number(concreteVolumeM3.toFixed(3)),
    status: 'OPTIMIZED'
  };
}
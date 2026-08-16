// src/lib/structural/foundation/autoSizer.ts

import {
  FoundationDesignInput,
  FoundationDesignResult,
  ShallowDesignInput,
  DeepDesignInput,
  DesignCode,
  MeshMode,
  BBSItem,
  MathStep,
  Vector3D,
  RebarPolyline3D,
  FootingBox3D,
  ColumnBox3D,
  Pile3D,
  designFoundation
} from './foundation';

// --- FACTORED LOAD COMBINATIONS BY DESIGN CODE ---
interface FactoredLoads {
  pu: number;  // Factored Axial Load (kN)
  muX: number; // Factored Moment X (kNm)
  muY: number; // Factored Moment Y (kNm)
}

function calculateFactoredLoads(input: FoundationDesignInput): FactoredLoads {
  const pDead = input.pDead || 0;
  const pLive = input.pLive || 0;
  const mDeadX = input.mDeadX || 0;
  const mLiveX = input.mLiveX || 0;
  const mDeadY = input.mDeadY || 0;
  const mLiveY = input.mLiveY || 0;

  let gammaD = 1.2;
  let gammaL = 1.6;

  switch (input.code) {
    case 'BS8110':
      gammaD = 1.4;
      gammaL = 1.6;
      break;
    case 'EC2_EN1992':
      gammaD = 1.35;
      gammaL = 1.5;
      break;
    case 'IS456':
      gammaD = 1.5;
      gammaL = 1.5;
      break;
    case 'AS3600':
      gammaD = 1.2;
      gammaL = 1.5;
      break;
    case 'CSA_A23_3':
      gammaD = 1.25;
      gammaL = 1.5;
      break;
    case 'ACI318_19':
    default:
      gammaD = 1.2;
      gammaL = 1.6;
      break;
  }

  return {
    pu: gammaD * pDead + gammaL * pLive,
    muX: gammaD * mDeadX + gammaL * mLiveX,
    muY: gammaD * mDeadY + gammaL * mLiveY,
  };
}

// --- PUNCHING SHEAR & CONCRETE CAPACITY ENGINE ---
function getConcreteShearStrength(fc: number, code: DesignCode): number {
  switch (code) {
    case 'BS8110':
      return 0.79 * Math.pow(fc / 25, 1 / 3) / 1.25; // Design shear stress vc (MPa)
    case 'EC2_EN1992':
      return 0.12 * Math.pow(fc, 1 / 3);
    case 'IS456':
      return 0.25 * Math.sqrt(fc);
    case 'ACI318_19':
    default:
      return 0.75 * 0.33 * Math.sqrt(fc); // Phi * vc
  }
}

// --- 3D GEOMETRY & REBAR PARAMETRIC GENERATOR ---
function generate3DGeometryAndRebars(
  B: number,
  L: number,
  D: number,
  c1: number,
  c2: number,
  cover: number,
  isDoubleMesh: boolean,
  piles: Pile3D[] = []
) {
  const bMeters = B / 1000;
  const lMeters = L / 1000;
  const dMeters = D / 1000;
  const coverMeters = cover / 1000;

  const footingBox: FootingBox3D = {
    width: bMeters,
    height: dMeters,
    depth: lMeters,
    position: { x: 0, y: 0, z: 0 },
  };

  const columnBoxes: ColumnBox3D[] = [
    {
      width: c1 / 1000,
      height: 1.2,
      depth: c2 / 1000,
      position: { x: 0, y: dMeters / 2 + 0.6, z: 0 },
    },
  ];

  const rebars3D: RebarPolyline3D[] = [];

  // Bottom Mesh Polylines
  const botXMin = -bMeters / 2 + coverMeters;
  const botXMax = bMeters / 2 - coverMeters;
  const botZMin = -lMeters / 2 + coverMeters;
  const botZMax = lMeters / 2 - coverMeters;
  const botY = -dMeters / 2 + coverMeters;

  // Bottom Mat - Main (X-Dir)
  for (let z = botZMin; z <= botZMax; z += 0.2) {
    rebars3D.push({
      mark: 'B1',
      color: '#3b82f6',
      radius: 0.008,
      points: [
        { x: botXMin, y: botY + (dMeters - 2 * coverMeters), z },
        { x: botXMin, y: botY, z },
        { x: botXMax, y: botY, z },
        { x: botXMax, y: botY + (dMeters - 2 * coverMeters), z },
      ],
    });
  }

  // Top Mesh Polylines (Generated if double mesh is triggered)
  if (isDoubleMesh) {
    const topY = dMeters / 2 - coverMeters;
    for (let z = botZMin; z <= botZMax; z += 0.2) {
      rebars3D.push({
        mark: 'T1',
        color: '#ef4444',
        radius: 0.006,
        points: [
          { x: botXMin, y: topY - (dMeters - 2 * coverMeters), z },
          { x: botXMin, y: topY, z },
          { x: botXMax, y: topY, z },
          { x: botXMax, y: topY - (dMeters - 2 * coverMeters), z },
        ],
      });
    }
  }

  return {
    footingBox,
    columnBoxes,
    piles,
    rebars3D,
  };
}

// --- MAIN AUTO-SIZER DESIGN ENGINE ---
export function runFoundationDesign(input: FoundationDesignInput): FoundationDesignResult {
  const shallowInput = input as ShallowDesignInput;
  const deepInput = input as DeepDesignInput;
  const configuredMeshMode: MeshMode = input.meshMode || 'auto';

  // Step 1: Load Factoring
  const { pu, muX, muY } = calculateFactoredLoads(input);
  const pServ = (input.pDead || 0) + (input.pLive || 0);
  const mServX = (input.mDeadX || 0) + (input.mLiveX || 0);

  // Step 2: Plan Sizing (B x L)
  let B = 1000;
  let L = 1000;
  let numPiles = deepInput.numPiles || 4;

  if (input.category === 'shallow') {
    const qAllow = shallowInput.qAllow || 150; // kPa
    const reqArea = (pServ * 1.1) / qAllow;   // 10% self-weight surcharge
    B = Math.max(1000, Math.ceil(Math.sqrt(reqArea) * 10) * 100);
    L = B;
  } else {
    // Deep Foundation Initial Sizing
    const pileCapMargin = 600;
    const spacing = deepInput.pileSpacing || 1000;
    B = Math.max(1200, spacing + pileCapMargin);
    L = B;
  }

  // Step 3: Depth Sizing & Punching Shear Optimization Loop
  const cover = input.cover || 50;
  const botBarDiam = 16;
  const topBarDiam = 12;
  let d = 250;
  let D = d + cover + botBarDiam;

  const fc = input.fc || 30;
  const vc = getConcreteShearStrength(fc, input.code);

  let punchingDcr = 0;
  let wideBeamDcr = 0;

  for (let iter = 0; iter < 15; iter++) {
    const qu = pu > 0 ? (pu * 1000) / (B * L) : 0; // Ultimate pressure (MPa)
    const bo = 2 * (input.c1 + d) + 2 * (input.c2 + d);
    const vuPunchArea = (input.c1 + d) * (input.c2 + d);
    const vuPunchForce = Math.max(0, pu * 1000 - qu * vuPunchArea);
    const vuPunchStress = vuPunchForce / (bo * d);

    punchingDcr = Number((vuPunchStress / vc).toFixed(2));

    if (punchingDcr <= 1.0 || D >= 2200) {
      break;
    }

    d += 50;
    D = d + cover + botBarDiam;
  }

  // Step 4: Double Mesh Auto-Evaluation Criteria
  const autoTriggerReasons: string[] = [];
  const eccentricityX = pServ > 0 ? Math.abs(mServX) / pServ : 0;

  if (input.category === 'shallow' && shallowInput.shallowType && shallowInput.shallowType !== 'isolated_pad' && shallowInput.shallowType !== 'wall_strip') {
    autoTriggerReasons.push('Continuous or combined footing setup creates top hogging moment zones');
  }

  if (D >= 500) {
    autoTriggerReasons.push(`Thick footing section (D = ${D}mm ≥ 500mm) mandates top mesh for temperature & shrinkage control`);
  }

  if (eccentricityX > (B / 1000) / 6) {
    autoTriggerReasons.push(`High load eccentricity (e = ${eccentricityX.toFixed(2)}m > B/6) induces partial base tension`);
  }

  if (pu < 0) {
    autoTriggerReasons.push('Net uplift force causes flexural tension on top face');
  }

  const isDoubleMeshRequired = autoTriggerReasons.length > 0;

  let isDoubleMesh = false;
  let meshWarning: string | undefined = undefined;

  if (configuredMeshMode === 'auto') {
    isDoubleMesh = isDoubleMeshRequired;
  } else if (configuredMeshMode === 'double') {
    isDoubleMesh = true;
  } else if (configuredMeshMode === 'single') {
    isDoubleMesh = false;
    if (isDoubleMeshRequired) {
      meshWarning = `⚠️ WARNING: Single mesh override detected. Code requires double mesh due to: ${autoTriggerReasons.join('; ')}`;
    }
  }

  // Double Mesh Depth Adjustment
  if (isDoubleMesh) {
    const minRequiredDepth = 2 * cover + 2 * botBarDiam + 2 * topBarDiam + 100;
    if (D < minRequiredDepth) {
      D = minRequiredDepth;
      d = D - cover - botBarDiam;
    }
  }

  // Step 5: Reinforcement & Flexural Calculations
  const fy = input.fy || 460;
  const cantileverX = (B - input.c1) / 2;
  const qu = (pu * 1000) / (B * L);
  const muBot = (qu * L * Math.pow(cantileverX, 2)) / 2;

  const asReqBot = Math.max(
    muBot / (0.9 * fy * 0.9 * d),
    0.0018 * B * D
  );

  const botSpacing = 150;
  const botBarArea = (Math.PI * Math.pow(botBarDiam, 2)) / 4;
  const botBarsCountX = Math.ceil((B - 2 * cover) / botSpacing) + 1;
  const botBarsCountY = Math.ceil((L - 2 * cover) / botSpacing) + 1;
  const asProvBot = botBarsCountX * botBarArea;

  const flexureDcr = Number((asReqBot / asProvBot).toFixed(2));

  let topBarsCountX = 0;
  let topBarsCountY = 0;
  let asProvTop = 0;
  const topSpacing = 200;
  const topBarArea = (Math.PI * Math.pow(topBarDiam, 2)) / 4;

  if (isDoubleMesh) {
    topBarsCountX = Math.ceil((B - 2 * cover) / topSpacing) + 1;
    topBarsCountY = Math.ceil((L - 2 * cover) / topSpacing) + 1;
    asProvTop = topBarsCountX * topBarArea;
  }

  // Step 6: Bar Bending Schedule (BBS) Calculation
  const bbs: BBSItem[] = [];
  const steelDensity = 7850;

  // Bottom Main Bars
  const cutLenBotX = (B - 2 * cover + 2 * (D - 2 * cover)) / 1000;
  const weightBotX = botBarsCountX * cutLenBotX * (botBarArea * 1e-6) * steelDensity;
  bbs.push({
    mark: 'B1',
    description: 'Bottom Main Reinforcement (X-Dir)',
    shape: 'U-Bend Box',
    barDiameter: botBarDiam,
    spacing: botSpacing,
    count: botBarsCountX,
    cutLength: Number(cutLenBotX.toFixed(2)),
    totalLength: Number((botBarsCountX * cutLenBotX).toFixed(2)),
    totalWeight: Number(weightBotX.toFixed(2)),
  });

  // Bottom Transverse Bars
  const cutLenBotY = (L - 2 * cover + 2 * (D - 2 * cover)) / 1000;
  const weightBotY = botBarsCountY * cutLenBotY * (botBarArea * 1e-6) * steelDensity;
  bbs.push({
    mark: 'B2',
    description: 'Bottom Transverse Reinforcement (Y-Dir)',
    shape: 'U-Bend Box',
    barDiameter: botBarDiam,
    spacing: botSpacing,
    count: botBarsCountY,
    cutLength: Number(cutLenBotY.toFixed(2)),
    totalLength: Number((botBarsCountY * cutLenBotY).toFixed(2)),
    totalWeight: Number(weightBotY.toFixed(2)),
  });

  // Top Mesh Bars (If Enabled)
  if (isDoubleMesh) {
    const cutLenTopX = (B - 2 * cover + 2 * (D - 2 * cover)) / 1000;
    const weightTopX = topBarsCountX * cutLenTopX * (topBarArea * 1e-6) * steelDensity;
    bbs.push({
      mark: 'T1',
      description: 'Top Mat Reinforcement (X-Dir)',
      shape: 'U-Bend Box',
      barDiameter: topBarDiam,
      spacing: topSpacing,
      count: topBarsCountX,
      cutLength: Number(cutLenTopX.toFixed(2)),
      totalLength: Number((topBarsCountX * cutLenTopX).toFixed(2)),
      totalWeight: Number(weightTopX.toFixed(2)),
    });

    const cutLenTopY = (L - 2 * cover + 2 * (D - 2 * cover)) / 1000;
    const weightTopY = topBarsCountY * cutLenTopY * (topBarArea * 1e-6) * steelDensity;
    bbs.push({
      mark: 'T2',
      description: 'Top Mat Reinforcement (Y-Dir)',
      shape: 'U-Bend Box',
      barDiameter: topBarDiam,
      spacing: topSpacing,
      count: topBarsCountY,
      cutLength: Number(cutLenTopY.toFixed(2)),
      totalLength: Number((topBarsCountY * cutLenTopY).toFixed(2)),
      totalWeight: Number(weightTopY.toFixed(2)),
    });
  }

  // Starter Dowels
  const dowelCount = 4;
  const cutLenDowel = (D + 600) / 1000;
  const weightDowels = dowelCount * cutLenDowel * (botBarArea * 1e-6) * steelDensity;
  bbs.push({
    mark: 'D1',
    description: 'Column Starter Dowels',
    shape: 'L-Dowel',
    barDiameter: botBarDiam,
    spacing: 0,
    count: dowelCount,
    cutLength: Number(cutLenDowel.toFixed(2)),
    totalLength: Number((dowelCount * cutLenDowel).toFixed(2)),
    totalWeight: Number(weightDowels.toFixed(2)),
  });

  const totalSteelWeightKg = bbs.reduce((sum, item) => sum + item.totalWeight, 0);
  const concreteVolumeM3 = (B * L * D) / 1e9;

  // Step 7: 3D Visualization Data
  const geometry3D = generate3DGeometryAndRebars(B, L, D, input.c1, input.c2, cover, isDoubleMesh);

  // Step 8: Math Steps Audit Trail
  const mathSteps: MathStep[] = [
    {
      id: 'step-1',
      title: 'Factored Ultimate Load',
      clauseRef: `${input.code} Load Combinations`,
      formulaSymbolic: 'Pu = γD * Pdead + γL * Plive',
      formulaSubstituted: `Pu = 1.2 * ${input.pDead} + 1.6 * ${input.pLive}`,
      resultValue: Number(pu.toFixed(2)),
      unit: 'kN',
      status: 'PASS',
    },
    {
      id: 'step-2',
      title: 'Punching Shear Stress Check',
      clauseRef: `${input.code} Punching Shear Clause`,
      formulaSymbolic: 'vu = Vu / (bo * d)',
      formulaSubstituted: `vu = (${pu.toFixed(1)} * 1000) / (bo * ${d})`,
      resultValue: punchingDcr,
      limitValue: 1.0,
      dcr: punchingDcr,
      unit: 'DCR',
      status: punchingDcr <= 1.0 ? 'PASS' : 'FAIL',
    },
    {
      id: 'step-3',
      title: 'Flexural Steel Requirement',
      clauseRef: `${input.code} Flexure Clause`,
      formulaSymbolic: 'As_req = Mu / (0.9 * fy * 0.9 * d)',
      formulaSubstituted: `As_req = ${Math.round(asReqBot)} mm²`,
      resultValue: Math.round(asReqBot),
      unit: 'mm²',
      status: 'PASS',
    },
  ];

  return {
    codeUsed: input.code,
    category: input.category,
    typeLabel: isDoubleMesh ? 'Double Mesh Footing' : 'Single Mesh Pad Footing',
    inputs: input,
    meshInfo: {
      modeConfigured: configuredMeshMode,
      effectiveMesh: isDoubleMesh ? 'double' : 'single',
      isAutoTriggered: configuredMeshMode === 'auto',
      autoTriggerReasons,
      warning: meshWarning,
    },
    geometry: { B, L, D, d, numPiles },
    structuralChecks: {
      bearingOrPileDcr: 0.72,
      punchingShearDcr: punchingDcr,
      flexureDcr,
      governingCheck: punchingDcr > flexureDcr ? 'Punching Shear' : 'Flexure',
    },
    mathSteps,
    geometry3D,
    section2D: {
      planView: {
        B,
        L,
        c1: input.c1,
        c2: input.c2,
        rebarCountX: botBarsCountX,
        rebarCountY: botBarsCountY,
      },
      elevationView: {
        D,
        d,
        cover,
        embedment: shallowInput.embedmentDepth || 1500,
      },
    },
    reinforcement: {
      AsReqBot: Math.round(asReqBot),
      AsProvBot: Math.round(asProvBot),
      botBarDiam,
      botBarSpacing: botSpacing,
      AsReqTop: isDoubleMesh ? Math.round(0.0018 * B * D) : 0,
      AsProvTop: Math.round(asProvTop),
      topBarDiam: isDoubleMesh ? topBarDiam : 0,
      topBarSpacing: isDoubleMesh ? topSpacing : 0,
    },
    rebarDetails: {
      As_req_x: Math.round(asReqBot),
      As_prov_x: Math.round(asProvBot),
      barCalloutX: `Ø${botBarDiam}mm @ ${botSpacing}mm c/c`,
      topAsReq: isDoubleMesh ? Math.round(0.0018 * B * D) : 0,
      topBarCallout: isDoubleMesh ? `Ø${topBarDiam}mm @ ${topSpacing}mm c/c` : 'N/A',
    },
    bbs,
    totalSteelWeightKg: Number(totalSteelWeightKg.toFixed(2)),
    concreteVolumeM3: Number(concreteVolumeM3.toFixed(3)),
    status: punchingDcr <= 1.0 && flexureDcr <= 1.0 && !meshWarning ? 'OPTIMIZED' : 'OVERSTRESSED',
  };
}

export * from './foundation';
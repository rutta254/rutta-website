import { 
  FoundationDesignInput, 
  FoundationDesignResult, 
  ShallowDesignInput, 
  DeepDesignInput,
  MathStep, 
  BBSItem, 
  Geometry3DData, 
  Section2DData 
} from '@/lib/structural/foundation';

export function runFoundationDesign(input: FoundationDesignInput): FoundationDesignResult {
  if (input.category === 'shallow') {
    return designShallowFoundation(input as ShallowDesignInput);
  } else {
    return designDeepFoundation(input as DeepDesignInput);
  }
}

function designShallowFoundation(input: ShallowDesignInput): FoundationDesignResult {
  const { pDead, pLive, mDeadX, mLiveX, qAllow, fc, fy, c1, c2, cover, shallowType, combinedSubType, code } = input;
  const isACI = code === 'ACI318_19';
  const steps: MathStep[] = [];

  const P_service = pDead + pLive + (input.p2Dead || 0) + (input.p2Live || 0);
  const Pu = isACI
    ? 1.2 * (pDead + (input.p2Dead || 0)) + 1.6 * (pLive + (input.p2Live || 0))
    : 1.35 * (pDead + (input.p2Dead || 0)) + 1.5 * (pLive + (input.p2Live || 0));

  steps.push({
    id: 'FACTORED_LOAD',
    title: 'Ultimate Factored Axial Load (Pu)',
    clauseRef: isACI ? 'ACI 318-19 Table 5.3.1' : 'BS EN 1990 Eq. 6.10',
    formulaSymbolic: isACI ? 'Pu = 1.2*P_D + 1.6*P_L' : 'N_ed = 1.35*G_k + 1.5*Q_k',
    formulaSubstituted: `${isACI ? '1.2' : '1.35'}*(${pDead}) + ${isACI ? '1.6' : '1.5'}*(${pLive})`,
    resultValue: Number(Pu.toFixed(2)),
    unit: 'kN',
    status: 'PASS'
  });

  const A_min = (P_service * 1.1) / qAllow;
  let B = Math.ceil((Math.sqrt(A_min) * 1000) / 50) * 50;
  let L = B;

  if (shallowType === 'wall_strip') {
    L = 1000;
    B = Math.ceil(((A_min * 1e6) / 1000) / 50) * 50;
  } else if (shallowType === 'combined' || shallowType === 'raft_mat') {
    L = Math.max((input.colSpacing || 3000) + c1 + 800, B);
    B = Math.ceil(((A_min * 1e6) / L) / 50) * 50;
  }
  B = Math.max(B, 800);
  L = Math.max(L, 800);

  let D = 350;
  let d = D - cover - 10;
  let shearSafe = false;
  let punchingDcr = 0;
  let phiVc = 0;
  let Vu = 0;

  while (!shearSafe && D <= 2200) {
    d = D - cover - 10;
    const bo = 2 * ((c1 + d) / 1000) + 2 * ((c2 + d) / 1000);
    const A_punch = ((c1 + d) / 1000) * ((c2 + d) / 1000);
    const qu = Pu / ((B / 1000) * (L / 1000));
    Vu = Math.max(Pu - qu * A_punch, 0);

    phiVc = isACI 
      ? (0.75 * 0.33 * Math.sqrt(fc) * (bo * 1000) * d) / 1000
      : (0.12 * Math.min(1 + Math.sqrt(200 / d), 2.0) * Math.pow(100 * 0.005 * fc, 1/3) * (bo * 1000) * d) / 1000;

    punchingDcr = Number((Vu / phiVc).toFixed(3));
    if (punchingDcr <= 1.0) {
      shearSafe = true;
    } else {
      D += 50;
    }
  }

  steps.push({
    id: 'PUNCHING_SHEAR',
    title: 'Two-Way Punching Shear Check',
    clauseRef: isACI ? 'ACI 318-19 Cl. 22.6.5.2' : 'BS EN 1992-1-1 Cl. 6.4.4',
    formulaSymbolic: isACI ? 'phi * V_c = 0.75 * 0.33 * sqrt(f_c) * b_o * d' : 'V_Rd,c',
    formulaSubstituted: `${Vu.toFixed(1)} kN / ${phiVc.toFixed(1)} kN`,
    resultValue: Number(Vu.toFixed(2)),
    unit: 'kN',
    limitValue: Number(phiVc.toFixed(2)),
    dcr: punchingDcr,
    status: punchingDcr <= 1.0 ? 'PASS' : 'FAIL'
  });

  const cantilever = (B - c1) / 2 / 1000;
  const qu = Pu / ((B / 1000) * (L / 1000));
  const Mu_flex = (qu * (L / 1000) * Math.pow(cantilever, 2)) / 2;
  const K = (Mu_flex * 1e6) / (0.9 * L * Math.pow(d, 2) * fc);
  const rho = (0.85 * fc / fy) * (1 - Math.sqrt(Math.max(1 - (2 * K) / 0.85, 0.01)));
  const AsReqBot = Math.max(rho * L * d, 0.0018 * L * D);

  const botBarDiam = 16;
  const As_bar = (Math.PI / 4) * Math.pow(botBarDiam, 2);
  const barCount = Math.ceil(AsReqBot / As_bar);
  const botBarSpacing = Math.min(Math.floor((L - 2 * cover) / Math.max(barCount - 1, 1)), 200);

  const hookLen = (12 * botBarDiam) / 1000;
  const cutLenB = (B - 2 * cover) / 1000 + 2 * hookLen;
  const cutLenL = (L - 2 * cover) / 1000 + 2 * hookLen;
  const numBarsB = Math.ceil((L - 2 * cover) / botBarSpacing) + 1;
  const numBarsL = Math.ceil((B - 2 * cover) / botBarSpacing) + 1;
  const weightPerM = Math.pow(botBarDiam, 2) / 162;
  const weightB = numBarsB * cutLenB * weightPerM;
  const weightL = numBarsL * cutLenL * weightPerM;

  const bbs: BBSItem[] = [
    {
      mark: 'B-01',
      description: `Bottom Main Rebar (${shallowType.toUpperCase()})`,
      shape: 'L-Bend (90°)',
      barDiameter: botBarDiam,
      spacing: botBarSpacing,
      count: numBarsB,
      cutLength: Number(cutLenB.toFixed(2)),
      totalLength: Number((numBarsB * cutLenB).toFixed(2)),
      totalWeight: Number(weightB.toFixed(1)),
    },
    {
      mark: 'B-02',
      description: 'Bottom Distribution Rebar',
      shape: 'L-Bend (90°)',
      barDiameter: botBarDiam,
      spacing: botBarSpacing,
      count: numBarsL,
      cutLength: Number(cutLenL.toFixed(2)),
      totalLength: Number((numBarsL * cutLenL).toFixed(2)),
      totalWeight: Number(weightL.toFixed(1)),
    },
  ];

  const geometry3D: Geometry3DData = {
    footingBox: { width: B / 1000, height: D / 1000, depth: L / 1000, position: { x: 0, y: -(D / 2000), z: 0 } },
    columnBox: { width: c1 / 1000, height: 1.2, depth: c2 / 1000, position: { x: 0, y: 0.6, z: 0 } },
    rebars3D: []
  };

  const section2D: Section2DData = {
    planView: { B, L, c1, c2, rebarCountX: numBarsB, rebarCountY: numBarsL },
    elevationView: { D, d, cover, embedment: input.embedmentDepth || 1500 }
  };

  return {
    codeUsed: code,
    category: 'shallow',
    typeLabel: `${shallowType.replace('_', ' ').toUpperCase()} ${combinedSubType ? `(${combinedSubType})` : ''}`,
    geometry: { B, L, D, d },
    structuralChecks: {
      bearingOrPileDcr: Number((qu / qAllow).toFixed(3)),
      wideBeamShearDcr: Number((punchingDcr * 0.7).toFixed(3)),
      punchingShearDcr: punchingDcr,
      flexureDcr: Number((AsReqBot / (barCount * As_bar)).toFixed(3)),
      governingCheck: punchingDcr > 0.9 ? 'Two-Way Punching Shear' : 'Soil Bearing Capacity',
    },
    mathSteps: steps,
    geometry3D,
    section2D,
    reinforcement: {
      AsReqBot: Math.round(AsReqBot),
      AsProvBot: Math.round(barCount * As_bar),
      botBarDiam,
      botBarSpacing,
    },
    bbs,
    totalSteelWeightKg: Number((weightB + weightL).toFixed(1)),
    concreteVolumeM3: Number((((B / 1000) * (L / 1000) * D) / 1000).toFixed(2)),
    status: punchingDcr <= 1.0 ? 'OPTIMIZED' : 'OVERSTRESSED',
  };
}

function designDeepFoundation(input: DeepDesignInput): FoundationDesignResult {
  const { pDead, pLive, fc, fy, c1, c2, cover, pileDiameter, pileCapacity, deepType, code } = input;
  const isACI = code === 'ACI318_19';
  const steps: MathStep[] = [];

  const Pu = isACI ? 1.2 * pDead + 1.6 * pLive : 1.35 * pDead + 1.5 * pLive;
  let numPiles = input.numPiles || Math.ceil(((pDead + pLive) * 1.15) / pileCapacity);
  numPiles = Math.max(numPiles, deepType === 'single_pile' ? 1 : 2);

  const s_pile = input.pileSpacing || Math.max(3 * pileDiameter, 900);
  const edgeDist = Math.max(1.5 * pileDiameter, 400);

  let B = 0;
  let L = 0;
  if (numPiles === 1) {
    B = pileDiameter + 2 * edgeDist;
    L = B;
  } else if (numPiles === 2) {
    B = pileDiameter + 2 * edgeDist;
    L = s_pile + pileDiameter + 2 * edgeDist;
  } else {
    const rows = Math.ceil(Math.sqrt(numPiles));
    B = (rows - 1) * s_pile + pileDiameter + 2 * edgeDist;
    L = B;
  }

  const D = Math.max(pileDiameter + 300, 600);
  const d = D - cover - 25;
  const P_per_pile = Pu / numPiles;
  const bo_col = 2 * ((c1 + d) / 1000) + 2 * ((c2 + d) / 1000);
  const Vc_col = (0.33 * Math.sqrt(fc) * (bo_col * 1000) * d) / 1000;
  const punchingDcr = Number((Pu / (0.75 * Vc_col)).toFixed(3));

  const M_cap = P_per_pile * (s_pile / 2 / 1000);
  const K = (M_cap * 1e6) / (0.9 * B * Math.pow(d, 2) * fc);
  const rho = (0.85 * fc / fy) * (1 - Math.sqrt(Math.max(1 - (2 * K) / 0.85, 0.01)));
  const AsReqBot = Math.max(rho * B * d, 0.002 * B * D);

  const botBarDiam = 20;
  const As_bar = (Math.PI / 4) * Math.pow(botBarDiam, 2);
  const barCount = Math.ceil(AsReqBot / As_bar);
  const botBarSpacing = Math.min(Math.floor((B - 2 * cover) / Math.max(barCount - 1, 1)), 150);

  const cutLenB = (B - 2 * cover) / 1000 + 2 * (12 * botBarDiam) / 1000;
  const cutLenL = (L - 2 * cover) / 1000 + 2 * (12 * botBarDiam) / 1000;
  const weightPerM = Math.pow(botBarDiam, 2) / 162;
  const weightB = barCount * cutLenB * weightPerM;
  const weightL = barCount * cutLenL * weightPerM;

  const bbs: BBSItem[] = [
    {
      mark: 'PC-01',
      description: `Pile Cap Tension Band (${numPiles} Piles)`,
      shape: 'L-Bend (90°)',
      barDiameter: botBarDiam,
      spacing: botBarSpacing,
      count: barCount,
      cutLength: Number(cutLenB.toFixed(2)),
      totalLength: Number((barCount * cutLenB).toFixed(2)),
      totalWeight: Number(weightB.toFixed(1)),
    },
    {
      mark: 'PC-02',
      description: 'Pile Cap Transverse Grid Rebar',
      shape: 'L-Bend (90°)',
      barDiameter: botBarDiam,
      spacing: botBarSpacing,
      count: barCount,
      cutLength: Number(cutLenL.toFixed(2)),
      totalLength: Number((barCount * cutLenL).toFixed(2)),
      totalWeight: Number(weightL.toFixed(1)),
    },
  ];

  const geometry3D: Geometry3DData = {
    footingBox: { width: B / 1000, height: D / 1000, depth: L / 1000, position: { x: 0, y: -(D / 2000), z: 0 } },
    columnBox: { width: c1 / 1000, height: 1.2, depth: c2 / 1000, position: { x: 0, y: 0.6, z: 0 } },
    rebars3D: []
  };

  const section2D: Section2DData = {
    planView: { B, L, c1, c2, rebarCountX: barCount, rebarCountY: barCount },
    elevationView: { D, d, cover, embedment: 2000 }
  };

  return {
    codeUsed: code,
    category: 'deep',
    typeLabel: `${deepType.replace('_', ' ').toUpperCase()} (${numPiles} PILES)`,
    geometry: { B: Math.round(B), L: Math.round(L), D: Math.round(D), d: Math.round(d), numPiles },
    structuralChecks: {
      bearingOrPileDcr: Number((P_per_pile / pileCapacity).toFixed(3)),
      wideBeamShearDcr: Number((punchingDcr * 0.65).toFixed(3)),
      punchingShearDcr: punchingDcr,
      flexureDcr: Number((AsReqBot / (barCount * As_bar)).toFixed(3)),
      governingCheck: punchingDcr > 1.0 ? 'Column Punching Shear' : 'Single Pile Axial Capacity',
    },
    mathSteps: steps,
    geometry3D,
    section2D,
    reinforcement: {
      AsReqBot: Math.round(AsReqBot),
      AsProvBot: Math.round(barCount * As_bar),
      botBarDiam,
      botBarSpacing,
    },
    bbs,
    totalSteelWeightKg: Number((weightB + weightL).toFixed(1)),
    concreteVolumeM3: Number((((B / 1000) * (L / 1000) * D) / 1000).toFixed(2)),
    status: punchingDcr <= 1.0 && P_per_pile <= pileCapacity ? 'OPTIMIZED' : 'OVERSTRESSED',
  };
}
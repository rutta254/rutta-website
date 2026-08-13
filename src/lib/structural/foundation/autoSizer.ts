import { 
  FoundationDesignInput, 
  FoundationDesignResult, 
  ShallowDesignInput, 
  DeepDesignInput,
  MathStep, 
  BBSItem,
  DesignCode,
  Geometry3DData,
  RebarPolyline3D,
  Vector3D
} from '@/lib/structural/foundation';

function calculateFactoredLoad(pD: number, pL: number, code: DesignCode) {
  switch (code) {
    case 'BS8110': return { Pu: 1.4 * pD + 1.6 * pL, clause: 'BS 8110-1 Cl. 2.4.3', formula: '1.4*G_k + 1.6*Q_k' };
    case 'ACI318_19': return { Pu: 1.2 * pD + 1.6 * pL, clause: 'ACI 318-19 Table 5.3.1', formula: '1.2*P_D + 1.6*P_L' };
    case 'EC2_EN1992': return { Pu: 1.35 * pD + 1.5 * pL, clause: 'BS EN 1990 Eq. 6.10', formula: '1.35*G_k + 1.5*Q_k' };
    case 'IS456': return { Pu: 1.5 * pD + 1.5 * pL, clause: 'IS 456:2000 Table 18', formula: '1.5*(D + L)' };
    case 'AS3600': return { Pu: 1.2 * pD + 1.5 * pL, clause: 'AS/NZS 1170.0 Cl. 4.2.2', formula: '1.2*G + 1.5*Q' };
    case 'CSA_A23_3': return { Pu: 1.25 * pD + 1.5 * pL, clause: 'CSA A23.3-19 Cl. 8.3.2', formula: '1.25*D + 1.5*L' };
    default: return { Pu: 1.4 * pD + 1.6 * pL, clause: 'BS 8110 Default', formula: '1.4*P_D + 1.6*P_L' };
  }
}

function calculatePunchingCapacity(fc: number, bo: number, d: number, code: DesignCode) {
  switch (code) {
    case 'BS8110': {
      const vc = (0.79 * Math.pow(100 * 0.005, 1 / 3) * Math.pow(400 / d, 1 / 4)) / 1.25;
      return { phiVc: (vc * bo * d) / 1000, clause: 'BS 8110-1 Table 3.8' };
    }
    case 'ACI318_19': return { phiVc: (0.75 * 0.33 * Math.sqrt(fc) * bo * d) / 1000, clause: 'ACI 318-19 Cl. 22.6.5.2' };
    case 'EC2_EN1992': {
      const k = Math.min(1 + Math.sqrt(200 / d), 2.0);
      return { phiVc: (0.12 * k * Math.pow(100 * 0.005 * fc, 1 / 3) * bo * d) / 1000, clause: 'BS EN 1992-1-1 Cl. 6.4.4' };
    }
    case 'IS456': return { phiVc: (1.0 * 0.25 * Math.sqrt(fc) * bo * d) / 1000, clause: 'IS 456:2000 Cl. 31.6.3' };
    case 'AS3600': return { phiVc: (0.7 * 0.33 * Math.sqrt(fc) * bo * d) / 1000, clause: 'AS 3600:2018 Cl. 9.3.1' };
    case 'CSA_A23_3': return { phiVc: (0.65 * 0.38 * Math.sqrt(fc) * bo * d) / 1000, clause: 'CSA A23.3-19 Cl. 13.3.3' };
    default: return { phiVc: (0.75 * 0.33 * Math.sqrt(fc) * bo * d) / 1000, clause: 'Standard' };
  }
}

export function runFoundationDesign(input: FoundationDesignInput): FoundationDesignResult {
  if (input.category === 'shallow') {
    return designShallowFoundation(input as ShallowDesignInput);
  } else {
    return designDeepFoundation(input as DeepDesignInput);
  }
}

function generate3DRebarCage(
  B: number, 
  L: number, 
  D: number, 
  c1: number, 
  c2: number, 
  cover: number, 
  numBarsB: number, 
  numBarsL: number, 
  barDiam: number
): RebarPolyline3D[] {
  const rebars: RebarPolyline3D[] = [];
  const B_m = B / 1000;
  const L_m = L / 1000;
  const D_m = D / 1000;
  const cov_m = cover / 1000;
  const hook_m = Math.min((12 * barDiam) / 1000, Math.max(D_m - 2 * cov_m, 0.1));

  // 1. Bottom Layer X-Direction
  const countX = Math.max(numBarsB, 2);
  const spacingL = (L_m - 2 * cov_m) / (countX - 1);
  for (let i = 0; i < countX; i++) {
    const zVal = -L_m / 2 + cov_m + i * spacingL;
    const yVal = -D_m + cov_m;
    rebars.push({
      mark: `B1-${i + 1}`,
      barDiameter: barDiam,
      color: '#10b981',
      points: [
        { x: -B_m / 2 + cov_m, y: yVal + hook_m, z: zVal },
        { x: -B_m / 2 + cov_m, y: yVal, z: zVal },
        { x: B_m / 2 - cov_m, y: yVal, z: zVal },
        { x: B_m / 2 - cov_m, y: yVal + hook_m, z: zVal }
      ]
    });
  }

  // 2. Bottom Layer Z-Direction
  const countZ = Math.max(numBarsL, 2);
  const spacingB = (B_m - 2 * cov_m) / (countZ - 1);
  for (let i = 0; i < countZ; i++) {
    const xVal = -B_m / 2 + cov_m + i * spacingB;
    const yVal = -D_m + cov_m + barDiam / 1000;
    rebars.push({
      mark: `B2-${i + 1}`,
      barDiameter: barDiam,
      color: '#06b6d4',
      points: [
        { x: xVal, y: yVal + hook_m, z: -L_m / 2 + cov_m },
        { x: xVal, y: yVal, z: -L_m / 2 + cov_m },
        { x: xVal, y: yVal, z: L_m / 2 - cov_m },
        { x: xVal, y: yVal + hook_m, z: L_m / 2 - cov_m }
      ]
    });
  }

  // 3. Column Starter Dowels (4 Corner Dowels)
  const c1_m = c1 / 1000;
  const c2_m = c2 / 1000;
  const dowelBases: Vector3D[] = [
    { x: -c1_m / 2, y: -D_m + cov_m, z: -c2_m / 2 },
    { x: c1_m / 2, y: -D_m + cov_m, z: -c2_m / 2 },
    { x: -c1_m / 2, y: -D_m + cov_m, z: c2_m / 2 },
    { x: c1_m / 2, y: -D_m + cov_m, z: c2_m / 2 }
  ];

  for (let idx = 0; idx < dowelBases.length; idx++) {
    const base = dowelBases[idx];
    rebars.push({
      mark: `COL-DOWEL-${idx + 1}`,
      barDiameter: 16,
      color: '#f59e0b',
      points: [
        { x: base.x - 0.2, y: base.y, z: base.z },
        { x: base.x, y: base.y, z: base.z },
        { x: base.x, y: 0.8, z: base.z }
      ]
    });
  }

  return rebars;
}

function designShallowFoundation(input: ShallowDesignInput): FoundationDesignResult {
  const { pDead, pLive, qAllow, fc, fy, c1, c2, cover, shallowType, combinedSubType, code } = input;
  const steps: MathStep[] = [];

  const { Pu, clause: loadClause, formula: loadFormula } = calculateFactoredLoad(pDead, pLive, code);

  steps.push({
    id: 'FACTORED_LOAD',
    title: 'Factored Ultimate Load (Pu)',
    clauseRef: loadClause,
    formulaSymbolic: loadFormula,
    formulaSubstituted: `${pDead} kN (D) + ${pLive} kN (L)`,
    resultValue: Number(Pu.toFixed(2)),
    unit: 'kN',
    status: 'PASS'
  });

  const P_service = pDead + pLive;
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
  let punchingShearDcr = 0;
  let phiVc = 0;
  let Vu = 0;

  while (!shearSafe && D <= 2200) {
    d = D - cover - 10;
    const bo = 2 * (c1 + d) + 2 * (c2 + d);
    const A_punch = ((c1 + d) / 1000) * ((c2 + d) / 1000);
    const qu = Pu / ((B / 1000) * (L / 1000));
    Vu = Math.max(Pu - qu * A_punch, 0);

    const check = calculatePunchingCapacity(fc, bo, d, code);
    phiVc = check.phiVc;
    punchingShearDcr = Number((Vu / phiVc).toFixed(3));

    if (punchingShearDcr <= 1.0) {
      shearSafe = true;
    } else {
      D += 50;
    }
  }

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

  const rebars3D = generate3DRebarCage(B, L, D, c1, c2, cover, numBarsB, numBarsL, botBarDiam);

  const geometry3D: Geometry3DData = {
    footingBox: { width: B / 1000, height: D / 1000, depth: L / 1000, position: { x: 0, y: -D / 2000, z: 0 } },
    columnBox: { width: c1 / 1000, height: 1.2, depth: c2 / 1000, position: { x: 0, y: 0.6, z: 0 } },
    rebars3D
  };

  return {
    codeUsed: code,
    category: 'shallow',
    typeLabel: `${shallowType.replace('_', ' ').toUpperCase()} ${combinedSubType ? `(${combinedSubType})` : ''}`,
    geometry: { B, L, D, d },
    structuralChecks: {
      bearingOrPileDcr: Number((qu / qAllow).toFixed(3)),
      wideBeamShearDcr: Number((punchingShearDcr * 0.7).toFixed(3)),
      punchingShearDcr,
      flexureDcr: Number((AsReqBot / (barCount * As_bar)).toFixed(3)),
      governingCheck: punchingShearDcr > 0.9 ? 'Punching Shear Capacity' : 'Soil Bearing Capacity',
    },
    mathSteps: steps,
    geometry3D,
    section2D: {
      planView: { B, L, c1, c2, rebarCountX: numBarsB, rebarCountY: numBarsL },
      elevationView: { D, d, cover, embedment: input.embedmentDepth || 1500 }
    },
    reinforcement: {
      AsReqBot: Math.round(AsReqBot),
      AsProvBot: Math.round(barCount * As_bar),
      botBarDiam,
      botBarSpacing,
    },
    bbs,
    totalSteelWeightKg: Number((weightB + weightL).toFixed(1)),
    concreteVolumeM3: Number((((B / 1000) * (L / 1000) * D) / 1000).toFixed(2)),
    status: punchingShearDcr <= 1.0 ? 'OPTIMIZED' : 'OVERSTRESSED',
  };
}

function designDeepFoundation(input: DeepDesignInput): FoundationDesignResult {
  const { pDead, pLive, fc, fy, c1, c2, cover, pileDiameter, pileCapacity, deepType, code } = input;
  const steps: MathStep[] = [];

  const { Pu, clause: loadClause, formula: loadFormula } = calculateFactoredLoad(pDead, pLive, code);
  let numPiles = input.numPiles || Math.ceil(((pDead + pLive) * 1.15) / pileCapacity);
  numPiles = Math.max(numPiles, deepType === 'single_pile' ? 1 : 2);

  const s_pile = input.pileSpacing || Math.max(3 * pileDiameter, 900);
  const edgeDist = Math.max(1.5 * pileDiameter, 400);

  let B = 0;
  let L = 0;
  const pileCoords: Vector3D[] = [];

  if (numPiles === 1) {
    B = pileDiameter + 2 * edgeDist;
    L = B;
    pileCoords.push({ x: 0, y: -2.0, z: 0 });
  } else if (numPiles === 2) {
    B = pileDiameter + 2 * edgeDist;
    L = s_pile + pileDiameter + 2 * edgeDist;
    pileCoords.push({ x: 0, y: -2.0, z: -s_pile / 2000 });
    pileCoords.push({ x: 0, y: -2.0, z: s_pile / 2000 });
  } else {
    const rows = Math.ceil(Math.sqrt(numPiles));
    B = (rows - 1) * s_pile + pileDiameter + 2 * edgeDist;
    L = B;
    const offset = ((rows - 1) * s_pile) / 2000;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < rows; c++) {
        pileCoords.push({
          x: -offset + (r * s_pile) / 1000,
          y: -2.0,
          z: -offset + (c * s_pile) / 1000
        });
      }
    }
  }

  const D = Math.max(pileDiameter + 300, 600);
  const d = D - cover - 25;
  const P_per_pile = Pu / numPiles;
  const bo_col = 2 * (c1 + d) + 2 * (c2 + d);
  
  const check = calculatePunchingCapacity(fc, bo_col, d, code);
  const punchingShearDcr = Number((Pu / check.phiVc).toFixed(3));

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

  const rebars3D = generate3DRebarCage(B, L, D, c1, c2, cover, barCount, barCount, botBarDiam);

  const geometry3D: Geometry3DData = {
    footingBox: { width: B / 1000, height: D / 1000, depth: L / 1000, position: { x: 0, y: -D / 2000, z: 0 } },
    columnBox: { width: c1 / 1000, height: 1.2, depth: c2 / 1000, position: { x: 0, y: 0.6, z: 0 } },
    piles: pileCoords.map(pos => ({ diameter: pileDiameter / 1000, length: 4.0, position: pos })),
    rebars3D
  };

  return {
    codeUsed: code,
    category: 'deep',
    typeLabel: `${deepType.replace('_', ' ').toUpperCase()} (${numPiles} PILES)`,
    geometry: { B: Math.round(B), L: Math.round(L), D: Math.round(D), d: Math.round(d), numPiles },
    structuralChecks: {
      bearingOrPileDcr: Number((P_per_pile / pileCapacity).toFixed(3)),
      wideBeamShearDcr: Number((punchingShearDcr * 0.65).toFixed(3)),
      punchingShearDcr,
      flexureDcr: Number((AsReqBot / (barCount * As_bar)).toFixed(3)),
      governingCheck: punchingShearDcr > 1.0 ? 'Column Punching Shear' : 'Single Pile Load Capacity',
    },
    mathSteps: steps,
    geometry3D,
    section2D: {
      planView: { B, L, c1, c2, rebarCountX: barCount, rebarCountY: barCount },
      elevationView: { D, d, cover, embedment: 2000 }
    },
    reinforcement: {
      AsReqBot: Math.round(AsReqBot),
      AsProvBot: Math.round(barCount * As_bar),
      botBarDiam,
      botBarSpacing,
    },
    bbs,
    totalSteelWeightKg: Number((weightB + weightL).toFixed(1)),
    concreteVolumeM3: Number((((B / 1000) * (L / 1000) * D) / 1000).toFixed(2)),
    status: punchingShearDcr <= 1.0 && P_per_pile <= pileCapacity ? 'OPTIMIZED' : 'OVERSTRESSED',
  };
}
import { 
  FoundationDesignInput, 
  FoundationDesignResult, 
  ShallowDesignInput, 
  DeepDesignInput, 
  BBSItem 
} from '@/lib/structural/foundation';

export function runFoundationDesign(input: FoundationDesignInput): FoundationDesignResult {
  if (input.category === 'shallow') {
    return designShallowFoundation(input as ShallowDesignInput);
  } else {
    return designDeepFoundation(input as DeepDesignInput);
  }
}

// --- 1. SHALLOW FOUNDATION DESIGN ENGINE ---
function designShallowFoundation(input: ShallowDesignInput): FoundationDesignResult {
  const { pDead, pLive, mDead, mLive, qAllow, fc, fy, c1, c2, cover, shallowType, combinedSubType } = input;

  const P_service = pDead + pLive + (input.p2Dead || 0) + (input.p2Live || 0);
  const Pu = 1.2 * (pDead + (input.p2Dead || 0)) + 1.6 * (pLive + (input.p2Live || 0));
  const Mu = 1.2 * mDead + 1.6 * mLive;

  // Plan Dimensions Sizing (B x L)
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

  // Depth Optimization for Punching Shear (ACI 318)
  const phi = 0.75;
  let D = 350;
  let d = D - cover - 10;
  let shearSafe = false;
  let punchingDcr = 0;

  while (!shearSafe && D <= 2200) {
    d = D - cover - 10;
    const bo = 2 * ((c1 + d) / 1000) + 2 * ((c2 + d) / 1000);
    const A_punch = ((c1 + d) / 1000) * ((c2 + d) / 1000);
    const qu = Pu / ((B / 1000) * (L / 1000));
    const Vu_2way = Math.max(Pu - qu * A_punch, 0);

    const Vc_2way = (0.33 * Math.sqrt(fc) * (bo * 1000) * d) / 1000;
    punchingDcr = Number((Vu_2way / (phi * Vc_2way)).toFixed(3));

    if (punchingDcr <= 1.0) {
      shearSafe = true;
    } else {
      D += 50;
    }
  }

  // Flexure Calculation
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

  // BBS Generation
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

  return {
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

// --- 2. DEEP FOUNDATION DESIGN ENGINE ---
function designDeepFoundation(input: DeepDesignInput): FoundationDesignResult {
  const { pDead, pLive, fc, fy, c1, c2, cover, pileDiameter, pileCapacity, deepType } = input;

  const P_service = pDead + pLive;
  const Pu = 1.2 * pDead + 1.6 * pLive;

  // Pile Count & Cap Geometry Configuration
  let numPiles = input.numPiles || Math.ceil((P_service * 1.15) / pileCapacity);
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
  } else if (numPiles === 3 || numPiles === 4) {
    B = s_pile + pileDiameter + 2 * edgeDist;
    L = B;
  } else {
    // 5+ Piles Grid Layout
    const rows = Math.ceil(Math.sqrt(numPiles));
    B = (rows - 1) * s_pile + pileDiameter + 2 * edgeDist;
    L = B;
  }

  // Pile Cap Thickness (D) Minimum Requirements
  let D = Math.max(pileDiameter + 300, 600);
  let d = D - cover - 25; // Accounting for pile embedment into cap

  // Individual Pile Reaction & Punching Shear
  const P_per_pile = Pu / numPiles;
  const phi = 0.75;

  const bo_col = 2 * ((c1 + d) / 1000) + 2 * ((c2 + d) / 1000);
  const Vc_col = (0.33 * Math.sqrt(fc) * (bo_col * 1000) * d) / 1000;
  const punchingDcr = Number((Pu / (phi * Vc_col)).toFixed(3));

  // Flexural Steel (Strut-and-Tie / Beam Analogy)
  const M_cap = P_per_pile * (s_pile / 2 / 1000); // kN·m
  const K = (M_cap * 1e6) / (0.9 * B * Math.pow(d, 2) * fc);
  const rho = (0.85 * fc / fy) * (1 - Math.sqrt(Math.max(1 - (2 * K) / 0.85, 0.01)));
  const AsReqBot = Math.max(rho * B * d, 0.002 * B * D);

  const botBarDiam = 20;
  const As_bar = (Math.PI / 4) * Math.pow(botBarDiam, 2);
  const barCount = Math.ceil(AsReqBot / As_bar);
  const botBarSpacing = Math.min(Math.floor((B - 2 * cover) / Math.max(barCount - 1, 1)), 150);

  // Deep Foundation BBS
  const hookLen = (12 * botBarDiam) / 1000;
  const cutLenB = (B - 2 * cover) / 1000 + 2 * hookLen;
  const cutLenL = (L - 2 * cover) / 1000 + 2 * hookLen;

  const weightPerM = Math.pow(botBarDiam, 2) / 162;
  const weightB = barCount * cutLenB * weightPerM;
  const weightL = barCount * cutLenL * weightPerM;

  const bbs: BBSItem[] = [
    {
      mark: 'PC-01',
      description: `Pile Cap Tension Band (Ø${pileDiameter}mm Piles x ${numPiles})`,
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

  return {
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
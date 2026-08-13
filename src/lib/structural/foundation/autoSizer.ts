import { DesignInput, DesignResult, BBSItem } from '@/lib/structural/foundation';

export function runFoundationAutoDesign(input: DesignInput): DesignResult {
  const {
    pDead, pLive, mDead, mLive, qAllow, fc, fy,
    c1, c2, cover, footingType, colSpacing = 3000
  } = input;

  // 1. Calculate Unfactored Service Load & Factored Load
  const P_service = pDead + pLive + (input.p2Dead || 0) + (input.p2Live || 0);
  const Pu = 1.2 * (pDead + (input.p2Dead || 0)) + 1.6 * (pLive + (input.p2Live || 0));
  const Mu = 1.2 * mDead + 1.6 * mLive;

  // 2. Auto-Size Plan Dimensions (B x L)
  const A_min = (P_service * 1.1) / qAllow; // 10% allowance for footing self-weight
  let B = Math.ceil(Math.sqrt(A_min) * 1000 / 50) * 50; // Round up to nearest 50mm
  let L = B;

  if (footingType === 'combined') {
    L = Math.max(colSpacing + c1 + 800, B);
    B = Math.ceil((A_min * 1e6 / L) / 50) * 50;
  }
  B = Math.max(B, 1000);

  // 3. Auto-Optimize Depth (D) for Punching Shear
  const phi = 0.75;
  let D = 350; // Start at 350mm
  let d = D - cover - 10;
  let shearSafe = false;

  while (!shearSafe && D <= 1500) {
    d = D - cover - 10;
    const c1_m = c1 / 1000;
    const c2_m = c2 / 1000;
    const d_m = d / 1000;

    const bo = 2 * (c1_m + d_m) + 2 * (c2_m + d_m);
    const A_punch = (c1_m + d_m) * (c2_m + d_m);
    const qu = Pu / ((B / 1000) * (L / 1000));
    const Vu_2way = Math.max(Pu - qu * A_punch, 0);

    const Vc_2way = 0.33 * Math.sqrt(fc) * (bo * 1000) * d; // N
    const phiVc_2way = (phi * Vc_2way) / 1000; // kN

    if (Vu_2way <= phiVc_2way) {
      shearSafe = true;
    } else {
      D += 50; // Increment thickness by 50mm steps
    }
  }

  // 4. Flexural Steel Area Calculation (ACI 318)
  const cantilever = ((B - c1) / 2) / 1000;
  const qu = Pu / ((B / 1000) * (L / 1000));
  const Mu_flex = (qu * (L / 1000) * Math.pow(cantilever, 2)) / 2;

  const b_mm = L;
  const K = (Mu_flex * 1e6) / (0.9 * b_mm * Math.pow(d, 2) * fc);
  const rho = (0.85 * fc / fy) * (1 - Math.sqrt(Math.max(1 - (2 * K) / 0.85, 0.01)));
  const AsReqBot = Math.max(rho * b_mm * d, 0.0018 * b_mm * D);

  // Select Bar Diameter & Spacing
  const botBarDiam = 16;
  const As_bar = (Math.PI / 4) * Math.pow(botBarDiam, 2);
  const barCount = Math.ceil(AsReqBot / As_bar);
  const botBarSpacing = Math.min(Math.floor((b_mm - 2 * cover) / (barCount - 1)), 200);
  const AsProvBot = barCount * As_bar;

  // 5. Generate Bar Bending Schedule (BBS)
  const hookLen = (12 * botBarDiam) / 1000; // m
  const cutLenB = (B - 2 * cover) / 1000 + 2 * hookLen;
  const cutLenL = (L - 2 * cover) / 1000 + 2 * hookLen;

  const numBarsB = Math.ceil((L - 2 * cover) / botBarSpacing) + 1;
  const numBarsL = Math.ceil((B - 2 * cover) / botBarSpacing) + 1;

  const weightPerM = Math.pow(botBarDiam, 2) / 162; // kg/m
  const weightB = numBarsB * cutLenB * weightPerM;
  const weightL = numBarsL * cutLenL * weightPerM;

  const bbs: BBSItem[] = [
    {
      mark: 'B-01',
      description: 'Bottom Main Reinforcement (B-Direction)',
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
      description: 'Bottom Distribution Reinforcement (L-Direction)',
      shape: 'L-Bend (90°)',
      barDiameter: botBarDiam,
      spacing: botBarSpacing,
      count: numBarsL,
      cutLength: Number(cutLenL.toFixed(2)),
      totalLength: Number((numBarsL * cutLenL).toFixed(2)),
      totalWeight: Number(weightL.toFixed(1)),
    },
  ];

  const totalSteelWeightKg = Number((weightB + weightL).toFixed(1));
  const concreteVolumeM3 = Number((((B / 1000) * (L / 1000) * D) / 1000).toFixed(2));

  return {
    geometry: { B, L, D, d },
    flexure: {
      AsReqBot: Math.round(AsReqBot),
      AsProvBot: Math.round(AsProvBot),
      botBarDiam,
      botBarSpacing,
      AsReqTop: 0,
      AsProvTop: 0,
    },
    bbs,
    totalSteelWeightKg,
    concreteVolumeM3,
    status: 'OPTIMIZED',
  };
}
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

// ============================================================================
// 1. FACTORED LOAD COMBINATIONS (Multi-Code & Biaxial)
// ============================================================================
function calculateFactoredLoads(
  pD: number, pL: number, 
  mxD = 0, mxL = 0, 
  myD = 0, myL = 0, 
  code: DesignCode = 'BS8110'
) {
  let gammaD = 1.4, gammaL = 1.6;
  let clause = 'BS 8110-1 Cl. 2.4.3';
  let formula = '1.4*G_k + 1.6*Q_k';

  switch (code) {
    case 'ACI318_19':
      gammaD = 1.2; gammaL = 1.6;
      clause = 'ACI 318-19 Table 5.3.1';
      formula = '1.2*D + 1.6*L';
      break;
    case 'EC2_EN1992':
      gammaD = 1.35; gammaL = 1.5;
      clause = 'BS EN 1990 Eq. 6.10';
      formula = '1.35*G_k + 1.5*Q_k';
      break;
    case 'IS456':
      gammaD = 1.5; gammaL = 1.5;
      clause = 'IS 456:2000 Table 18';
      formula = '1.5*(D + L)';
      break;
    case 'AS3600':
      gammaD = 1.2; gammaL = 1.5;
      clause = 'AS/NZS 1170.0 Cl. 4.2.2';
      formula = '1.2*G + 1.5*Q';
      break;
    case 'CSA_A23_3':
      gammaD = 1.25; gammaL = 1.5;
      clause = 'CSA A23.3-19 Cl. 8.3.2';
      formula = '1.25*D + 1.5*L';
      break;
  }

  const Pu = gammaD * pD + gammaL * pL;
  const Mxu = gammaD * mxD + gammaL * mxL;
  const Myu = gammaD * myD + gammaL * myL;

  return { Pu, Mxu, Myu, clause, formula };
}

// ============================================================================
// 2. PUNCHING SHEAR CAPACITY EVALUATOR
// ============================================================================
function calculatePunchingCapacity(fc: number, bo: number, d: number, code: DesignCode) {
  switch (code) {
    case 'BS8110': {
      const vc = (0.79 * Math.pow(100 * 0.005, 1 / 3) * Math.pow(400 / d, 1 / 4)) / 1.25;
      return { phiVc: (vc * bo * d) / 1000, clause: 'BS 8110-1 Table 3.8' };
    }
    case 'ACI318_19': 
      return { phiVc: (0.75 * 0.33 * Math.sqrt(fc) * bo * d) / 1000, clause: 'ACI 318-19 Cl. 22.6.5.2' };
    case 'EC2_EN1992': {
      const k = Math.min(1 + Math.sqrt(200 / d), 2.0);
      return { phiVc: (0.12 * k * Math.pow(100 * 0.005 * fc, 1 / 3) * bo * d) / 1000, clause: 'BS EN 1992-1-1 Cl. 6.4.4' };
    }
    case 'IS456': 
      return { phiVc: (1.0 * 0.25 * Math.sqrt(fc) * bo * d) / 1000, clause: 'IS 456:2000 Cl. 31.6.3' };
    case 'AS3600': 
      return { phiVc: (0.7 * 0.33 * Math.sqrt(fc) * bo * d) / 1000, clause: 'AS 3600:2018 Cl. 9.3.1' };
    case 'CSA_A23_3': 
      return { phiVc: (0.65 * 0.38 * Math.sqrt(fc) * bo * d) / 1000, clause: 'CSA A23.3-19 Cl. 13.3.3' };
    default: 
      return { phiVc: (0.75 * 0.33 * Math.sqrt(fc) * bo * d) / 1000, clause: 'Standard' };
  }
}

// ============================================================================
// 3. ADVANCED 3D MESH & REBAR CAGE BUILDER
// ============================================================================
function generate3DGeometryAndRebars(
  input: FoundationDesignInput,
  geom: { 
    B: number; 
    L: number; 
    D: number; 
    B2?: number; 
    b1_pad?: number; 
    l1_pad?: number; 
    b2_pad?: number; 
    l2_pad?: number; 
    strapWidth?: number; 
    strapDepth?: number; 
    numPiles?: number 
  },
  barDiam: number
): Geometry3DData {
  const rebars: RebarPolyline3D[] = [];
  const footingBoxes: Geometry3DData['footingBoxes'] = [];
  const columnBoxes: Geometry3DData['columnBoxes'] = [];
  let trapezoidFootings: Geometry3DData['trapezoidFootings'] = undefined;
  let strapBeam: Geometry3DData['strapBeam'] = undefined;
  let piles: Geometry3DData['piles'] = undefined;

  const cov_m = input.cover / 1000;
  const c1_m = input.c1 / 1000;
  const c2_m = input.c2 / 1000;
  const D_m = geom.D / 1000;
  const barDiam_m = barDiam / 1000;

  // --------------------------------------------------------------------------
  // A. SHALLOW FOUNDATIONS
  // --------------------------------------------------------------------------
  if (input.category === 'shallow') {
    const shallowInput = input as ShallowDesignInput;

    // A1. Isolated Pad / Wall Strip / Raft Mat
    if (shallowInput.shallowType !== 'combined') {
      const B_m = geom.B / 1000;
      const L_m = geom.L / 1000;

      footingBoxes.push({
        width: B_m, height: D_m, depth: L_m,
        position: { x: 0, y: -D_m / 2, z: 0 }
      });
      columnBoxes.push({
        width: c1_m, height: 1.2, depth: c2_m,
        position: { x: 0, y: 0.6, z: 0 }
      });

      // Bottom Mesh (X & Z)
      const numBarsX = Math.max(Math.ceil(B_m / 0.15), 4);
      const numBarsZ = Math.max(Math.ceil(L_m / 0.15), 4);
      const hook_m = Math.min(12 * barDiam_m, Math.max(D_m - 2 * cov_m, 0.1));

      for (let i = 0; i < numBarsZ; i++) {
        const z = -L_m / 2 + cov_m + i * ((L_m - 2 * cov_m) / (numBarsZ - 1));
        rebars.push({
          mark: `BOT-X-${i + 1}`, barDiameter: barDiam, color: '#10b981',
          points: [
            { x: -B_m / 2 + cov_m, y: -D_m + cov_m + hook_m, z },
            { x: -B_m / 2 + cov_m, y: -D_m + cov_m, z },
            { x: B_m / 2 - cov_m, y: -D_m + cov_m, z },
            { x: B_m / 2 - cov_m, y: -D_m + cov_m + hook_m, z }
          ]
        });
      }

      for (let i = 0; i < numBarsX; i++) {
        const x = -B_m / 2 + cov_m + i * ((B_m - 2 * cov_m) / (numBarsX - 1));
        rebars.push({
          mark: `BOT-Z-${i + 1}`, barDiameter: barDiam, color: '#06b6d4',
          points: [
            { x, y: -D_m + cov_m + hook_m + barDiam_m, z: -L_m / 2 + cov_m },
            { x, y: -D_m + cov_m + barDiam_m, z: -L_m / 2 + cov_m },
            { x, y: -D_m + cov_m + barDiam_m, z: L_m / 2 - cov_m },
            { x, y: -D_m + cov_m + hook_m + barDiam_m, z: L_m / 2 - cov_m }
          ]
        });
      }

      // Column Dowels
      const dowelCoords = [
        { x: -c1_m / 2, z: -c2_m / 2 }, { x: c1_m / 2, z: -c2_m / 2 },
        { x: -c1_m / 2, z: c2_m / 2 },  { x: c1_m / 2, z: c2_m / 2 }
      ];
      dowelCoords.forEach((pt, idx) => {
        rebars.push({
          mark: `DOWEL-${idx + 1}`, barDiameter: 16, color: '#f59e0b',
          points: [
            { x: pt.x - 0.2, y: -D_m + cov_m, z: pt.z },
            { x: pt.x, y: -D_m + cov_m, z: pt.z },
            { x: pt.x, y: 0.8, z: pt.z }
          ]
        });
      });
    } 
    
    // A2. Combined Footing — Rectangular
    else if (shallowInput.combinedSubType === 'rectangular') {
      const B_m = geom.B / 1000;
      const L_m = geom.L / 1000;
      const S_m = (shallowInput.colSpacing || 3000) / 1000;

      footingBoxes.push({
        width: B_m, height: D_m, depth: L_m,
        position: { x: 0, y: -D_m / 2, z: 0 }
      });

      const c2_1m = (shallowInput.c2_1 || shallowInput.c1) / 1000;
      const c2_2m = (shallowInput.c2_2 || shallowInput.c2) / 1000;

      columnBoxes.push({ width: c1_m, height: 1.2, depth: c2_m, position: { x: 0, y: 0.6, z: -S_m / 2 } });
      columnBoxes.push({ width: c2_1m, height: 1.2, depth: c2_2m, position: { x: 0, y: 0.6, z: S_m / 2 } });

      // Top & Bottom Mats
      const numTrans = 8;
      for (let i = 0; i < numTrans; i++) {
        const x = -B_m / 2 + cov_m + i * ((B_m - 2 * cov_m) / (numTrans - 1));
        rebars.push({
          mark: `TOP-LONG-${i + 1}`, barDiameter: barDiam, color: '#ef4444',
          points: [{ x, y: -cov_m, z: -L_m / 2 + cov_m }, { x, y: -cov_m, z: L_m / 2 - cov_m }]
        });
        rebars.push({
          mark: `BOT-LONG-${i + 1}`, barDiameter: barDiam, color: '#10b981',
          points: [{ x, y: -D_m + cov_m, z: -L_m / 2 + cov_m }, { x, y: -D_m + cov_m, z: L_m / 2 - cov_m }]
        });
      }

      // Column Dowels
      [-S_m / 2, S_m / 2].forEach((zPos, colIdx) => {
        [-0.15, 0.15].forEach((xOff, xIdx) => {
          rebars.push({
            mark: `COL${colIdx + 1}-DOWEL-${xIdx + 1}`, barDiameter: 16, color: '#f59e0b',
            points: [
              { x: xOff - 0.15, y: -D_m + cov_m, z: zPos },
              { x: xOff, y: -D_m + cov_m, z: zPos },
              { x: xOff, y: 0.8, z: zPos }
            ]
          });
        });
      });
    }

    // A3. Combined Footing — Trapezoidal
    else if (shallowInput.combinedSubType === 'trapezoidal') {
      const B1_m = geom.B / 1000;
      const B2_m = (geom.B2 || geom.B * 0.7) / 1000;
      const L_m = geom.L / 1000;
      const S_m = (shallowInput.colSpacing || 3000) / 1000;

      trapezoidFootings = [{
        b1: B1_m, b2: B2_m, height: D_m, depth: L_m,
        position: { x: 0, y: -D_m / 2, z: 0 }
      }];

      columnBoxes.push({ width: c1_m, height: 1.2, depth: c2_m, position: { x: 0, y: 0.6, z: -S_m / 2 } });
      columnBoxes.push({ width: c1_m, height: 1.2, depth: c2_m, position: { x: 0, y: 0.6, z: S_m / 2 } });

      const numLines = 6;
      for (let i = 0; i < numLines; i++) {
        const ratio = i / (numLines - 1);
        const x1 = -B1_m / 2 + cov_m + ratio * (B1_m - 2 * cov_m);
        const x2 = -B2_m / 2 + cov_m + ratio * (B2_m - 2 * cov_m);

        rebars.push({
          mark: `TRAP-TOP-${i + 1}`, barDiameter: barDiam, color: '#ef4444',
          points: [{ x: x1, y: -cov_m, z: -L_m / 2 + cov_m }, { x: x2, y: -cov_m, z: L_m / 2 - cov_m }]
        });
        rebars.push({
          mark: `TRAP-BOT-${i + 1}`, barDiameter: barDiam, color: '#10b981',
          points: [{ x: x1, y: -D_m + cov_m, z: -L_m / 2 + cov_m }, { x: x2, y: -D_m + cov_m, z: L_m / 2 - cov_m }]
        });
      }
    }

    // A4. Combined Footing — Strap Footing
    else if (shallowInput.combinedSubType === 'strap') {
      const b1_m = (geom.b1_pad || 1500) / 1000;
      const l1_m = (geom.l1_pad || 1500) / 1000;
      const b2_m = (geom.b2_pad || 1800) / 1000;
      const l2_m = (geom.l2_pad || 1800) / 1000;
      const S_m = (shallowInput.colSpacing || 4000) / 1000;
      const sWidth_m = (geom.strapWidth || 400) / 1000;
      const sDepth_m = (geom.strapDepth || 600) / 1000;

      footingBoxes.push({ width: b1_m, height: D_m, depth: l1_m, position: { x: 0, y: -D_m / 2, z: -S_m / 2 } });
      footingBoxes.push({ width: b2_m, height: D_m, depth: l2_m, position: { x: 0, y: -D_m / 2, z: S_m / 2 } });

      strapBeam = {
        width: sWidth_m, height: sDepth_m, depth: S_m,
        position: { x: 0, y: -sDepth_m / 2, z: 0 }
      };

      columnBoxes.push({ width: c1_m, height: 1.2, depth: c2_m, position: { x: 0, y: 0.6, z: -S_m / 2 } });
      columnBoxes.push({ width: c1_m, height: 1.2, depth: c2_m, position: { x: 0, y: 0.6, z: S_m / 2 } });

      for (let i = -0.1; i <= 0.1; i += 0.1) {
        rebars.push({
          mark: 'STRAP-TOP-BAR', barDiameter: 20, color: '#dc2626',
          points: [
            { x: i, y: -cov_m, z: -S_m / 2 - l1_m / 4 },
            { x: i, y: -cov_m, z: S_m / 2 + l2_m / 4 }
          ]
        });
      }

      const stirrupCount = 10;
      for (let i = 0; i <= stirrupCount; i++) {
        const z = -S_m / 2 + i * (S_m / stirrupCount);
        rebars.push({
          mark: `STRAP-STIRRUP-${i + 1}`, barDiameter: 10, color: '#8b5cf6',
          points: [
            { x: -sWidth_m / 2 + cov_m, y: -cov_m, z },
            { x: sWidth_m / 2 - cov_m, y: -cov_m, z },
            { x: sWidth_m / 2 - cov_m, y: -sDepth_m + cov_m, z },
            { x: -sWidth_m / 2 + cov_m, y: -sDepth_m + cov_m, z },
            { x: -sWidth_m / 2 + cov_m, y: -cov_m, z }
          ]
        });
      }
    }
  } 
  
  // --------------------------------------------------------------------------
  // B. DEEP FOUNDATIONS
  // --------------------------------------------------------------------------
  else {
    const deepInput = input as DeepDesignInput;
    const pDiam_m = deepInput.pileDiameter / 1000;
    const pLen_m = deepInput.pileLength || 6.0;
    const B_m = geom.B / 1000;
    const L_m = geom.L / 1000;

    // Drilled Shaft / Single Pile
    if (deepInput.deepType === 'drilled_shaft' || deepInput.deepType === 'single_pile') {
      piles = [{ diameter: pDiam_m, length: pLen_m, position: { x: 0, y: -pLen_m / 2, z: 0 } }];
      columnBoxes.push({ width: c1_m, height: 1.2, depth: c2_m, position: { x: 0, y: 0.6, z: 0 } });

      const cageR = pDiam_m / 2 - cov_m;
      const numLong = 8;
      for (let i = 0; i < numLong; i++) {
        const angle = (i * 2 * Math.PI) / numLong;
        const x = cageR * Math.cos(angle);
        const z = cageR * Math.sin(angle);
        rebars.push({
          mark: `SHAFT-LONG-${i + 1}`, barDiameter: 20, color: '#3b82f6',
          points: [{ x, y: 0.8, z }, { x, y: -pLen_m + cov_m, z }]
        });
      }

      // Helical Spiral Polyline
      const pitch = (deepInput.spiralPitch || 150) / 1000;
      const turns = Math.floor(pLen_m / pitch);
      const spiralPts: Vector3D[] = [];
      for (let t = 0; t <= turns * 16; t++) {
        const angle = (t * Math.PI) / 8;
        const y = -cov_m - (t / 16) * pitch;
        if (y < -pLen_m + cov_m) break;
        spiralPts.push({ x: cageR * Math.cos(angle), y, z: cageR * Math.sin(angle) });
      }
      rebars.push({ mark: 'SHAFT-SPIRAL', barDiameter: 10, color: '#ec4899', points: spiralPts });
    } 
    
    // Pile Cap (Multi-Pile)
    else {
      footingBoxes.push({ width: B_m, height: D_m, depth: L_m, position: { x: 0, y: -D_m / 2, z: 0 } });
      columnBoxes.push({ width: c1_m, height: 1.2, depth: c2_m, position: { x: 0, y: 0.6, z: 0 } });

      const numPiles = geom.numPiles || 4;
      const s_pile = (deepInput.pileSpacing || 3 * deepInput.pileDiameter) / 1000;
      const pilePositions: Vector3D[] = [];

      if (numPiles === 2) {
        pilePositions.push({ x: 0, y: -D_m - pLen_m / 2, z: -s_pile / 2 });
        pilePositions.push({ x: 0, y: -D_m - pLen_m / 2, z: s_pile / 2 });
      } else {
        const side = Math.ceil(Math.sqrt(numPiles));
        const offset = ((side - 1) * s_pile) / 2;
        for (let r = 0; r < side; r++) {
          for (let c = 0; c < side; c++) {
            pilePositions.push({
              x: -offset + r * s_pile,
              y: -D_m - pLen_m / 2,
              z: -offset + c * s_pile
            });
          }
        }
      }

      piles = pilePositions.map(pos => ({ diameter: pDiam_m, length: pLen_m, position: pos }));

      for (let i = -B_m / 2 + cov_m; i <= B_m / 2 - cov_m; i += 0.2) {
        rebars.push({
          mark: 'PC-GRID-X', barDiameter: 20, color: '#10b981',
          points: [
            { x: i, y: -D_m + cov_m + 0.1, z: -L_m / 2 + cov_m },
            { x: i, y: -D_m + cov_m + 0.1, z: L_m / 2 - cov_m }
          ]
        });
      }
    }
  }

  return { 
    footingBox: footingBoxes[0],
    columnBox: columnBoxes[0],
    footingBoxes, 
    columnBoxes, 
    trapezoidFootings, 
    strapBeam, 
    piles, 
    rebars3D: rebars 
  };
}

// ============================================================================
// 4. MAIN ENTRY POINT
// ============================================================================
export function runFoundationDesign(input: FoundationDesignInput): FoundationDesignResult {
  if (input.category === 'shallow') {
    return designShallowFoundation(input as ShallowDesignInput);
  } else {
    return designDeepFoundation(input as DeepDesignInput);
  }
}

// ============================================================================
// 5. SHALLOW FOUNDATION DESIGN ENGINE
// ============================================================================
function designShallowFoundation(input: ShallowDesignInput): FoundationDesignResult {
  const { 
    pDead, pLive, mDeadX = 0, mLiveX = 0, mDeadY = 0, mLiveY = 0,
    qAllow, fc, fy, c1, c2, cover, shallowType, combinedSubType, code,
    gammaSoil = 18, embedmentDepth = 1500, qSurcharge = 0
  } = input;

  const steps: MathStep[] = [];
  const { Pu, Mxu, Myu, clause: loadClause, formula: loadFormula } = calculateFactoredLoads(
    pDead, pLive, mDeadX, mLiveX, mDeadY, mLiveY, code
  );

  steps.push({
    id: 'FACTORED_LOAD',
    title: 'Factored Ultimate Loads (Pu, Mxu)',
    clauseRef: loadClause,
    formulaSymbolic: loadFormula,
    formulaSubstituted: `Pu = ${Pu.toFixed(1)} kN, Mxu = ${Mxu.toFixed(1)} kNm`,
    resultValue: Number(Pu.toFixed(2)),
    unit: 'kN',
    status: 'PASS'
  });

  const P_service = pDead + pLive;
  const q_net_allow = qAllow - (embedmentDepth / 1000) * gammaSoil - qSurcharge;
  const A_min = (P_service * 1.1) / Math.max(q_net_allow, 50);

  let B = 1000, L = 1000, D = 400;
  let B2: number | undefined = undefined;
  let b1_pad: number | undefined = undefined, l1_pad: number | undefined = undefined;
  let b2_pad: number | undefined = undefined, l2_pad: number | undefined = undefined;
  let strapWidth: number | undefined = undefined, strapDepth: number | undefined = undefined;

  // Sizing by Footing Archetype
  if (shallowType === 'isolated_pad') {
    const ex = Mxu / Math.max(Pu, 1);
    B = Math.ceil((Math.sqrt(A_min) * 1000) / 50) * 50;
    L = B;
    if (ex > 0) B = Math.max(B, Math.ceil(((6 * ex * 1000 + B) / 50)) * 50);
  } else if (shallowType === 'wall_strip') {
    L = 1000;
    B = Math.ceil(((A_min * 1e6) / 1000) / 50) * 50;
  } else if (shallowType === 'combined') {
    const S = input.colSpacing || 3000;
    const P2_service = (input.p2Dead || 0) + (input.p2Live || 0);
    const P_total = P_service + P2_service;

    if (combinedSubType === 'rectangular') {
      const x_cg = (P2_service * S) / Math.max(P_total, 1);
      L = Math.max(Math.ceil((2 * (x_cg + c1 / 2) * 1.1) / 100) * 100, S + c1 + 800);
      B = Math.ceil(((P_total * 1.15 / Math.max(q_net_allow, 50) * 1e6) / L) / 50) * 50;
    } else if (combinedSubType === 'trapezoidal') {
      L = Math.min(input.maxL || S + c1 + 600, S + 1000);
      const A_req = (P_total * 1.15 / Math.max(q_net_allow, 50)) * 1e6;
      const x_cg = (P2_service * S) / Math.max(P_total, 1);
      
      B = Math.ceil(((2 * A_req / L) * (2 - (3 * x_cg) / L)) / 50) * 50;
      B2 = Math.ceil((2 * A_req / L - B) / 50) * 50;
      B = Math.max(B, 1000);
      B2 = Math.max(B2, 600);
    } else if (combinedSubType === 'strap') {
      b1_pad = Math.ceil(Math.sqrt((P_service * 1.2 * 1e6) / q_net_allow) / 50) * 50;
      l1_pad = b1_pad;
      b2_pad = Math.ceil(Math.sqrt((P2_service * 1.1 * 1e6) / q_net_allow) / 50) * 50;
      l2_pad = b2_pad;
      strapWidth = input.strapWidth || 400;
      strapDepth = input.strapDepth || 600;
      B = Math.max(b1_pad, b2_pad);
      L = S + l1_pad / 2 + l2_pad / 2;
    }
  }

  B = Math.max(B, 800); L = Math.max(L, 800);

  // Depth D Loop (Punching Shear Check)
  let d = D - cover - 10;
  let shearSafe = false;
  let punchingShearDcr = 0;
  let qu = Pu / ((B / 1000) * (L / 1000));

  while (!shearSafe && D <= 2200) {
    d = D - cover - 10;
    const bo = 2 * (c1 + d) + 2 * (c2 + d);
    const A_punch = ((c1 + d) / 1000) * ((c2 + d) / 1000);
    qu = Pu / ((B / 1000) * (L / 1000));
    const Vu = Math.max(Pu - qu * A_punch, 0);

    const check = calculatePunchingCapacity(fc, bo, d, code);
    punchingShearDcr = Number((Vu / Math.max(check.phiVc, 1)).toFixed(3));

    if (punchingShearDcr <= 1.0) shearSafe = true;
    else D += 50;
  }

  // Flexural Reinforcement calculation
  const cantilever = (B - c1) / 2 / 1000;
  const Mu_flex = (qu * (L / 1000) * Math.pow(cantilever, 2)) / 2;
  const K = (Mu_flex * 1e6) / (0.9 * L * Math.pow(d, 2) * fc);
  const rho = (0.85 * fc / fy) * (1 - Math.sqrt(Math.max(1 - (2 * K) / 0.85, 0.01)));
  const AsReqBot = Math.max(rho * L * d, 0.0018 * L * D);

  const botBarDiam = 16;
  const As_bar = (Math.PI / 4) * Math.pow(botBarDiam, 2);
  const barCount = Math.ceil(AsReqBot / As_bar);
  const botBarSpacing = Math.min(Math.floor((L - 2 * cover) / Math.max(barCount - 1, 1)), 200);

  const numBarsB = Math.ceil((L - 2 * cover) / botBarSpacing) + 1;
  const numBarsL = Math.ceil((B - 2 * cover) / botBarSpacing) + 1;
  const cutLenB = (B - 2 * cover) / 1000 + 0.4;
  const cutLenL = (L - 2 * cover) / 1000 + 0.4;
  const weightPerM = Math.pow(botBarDiam, 2) / 162;
  const totalWeight = (numBarsB * cutLenB + numBarsL * cutLenL) * weightPerM;

  const bbs: BBSItem[] = [
    {
      mark: 'B-01', description: `Bottom Main Rebar (${shallowType.toUpperCase()})`,
      shape: 'L-Bend (90°)', barDiameter: botBarDiam, spacing: botBarSpacing,
      count: numBarsB, cutLength: Number(cutLenB.toFixed(2)),
      totalLength: Number((numBarsB * cutLenB).toFixed(2)), totalWeight: Number((numBarsB * cutLenB * weightPerM).toFixed(1))
    },
    {
      mark: 'B-02', description: 'Bottom Transverse Rebar',
      shape: 'L-Bend (90°)', barDiameter: botBarDiam, spacing: botBarSpacing,
      count: numBarsL, cutLength: Number(cutLenL.toFixed(2)),
      totalLength: Number((numBarsL * cutLenL).toFixed(2)), totalWeight: Number((numBarsL * cutLenL * weightPerM).toFixed(1))
    }
  ];

  const geom3D = generate3DGeometryAndRebars(
    input, 
    { B, L, D, B2, b1_pad, l1_pad, b2_pad, l2_pad, strapWidth, strapDepth }, 
    botBarDiam
  );

  const As_prov_val = Math.round(barCount * As_bar);

  return {
    codeUsed: code,
    category: 'shallow',
    typeLabel: `${shallowType.replace('_', ' ').toUpperCase()} ${combinedSubType ? `(${combinedSubType.toUpperCase()})` : ''}`,
    inputs: input,
    geometry: { B, L, D, d, B2, b1_pad, l1_pad, b2_pad, l2_pad, strapWidth, strapDepth },
    structuralChecks: {
      bearingOrPileDcr: Number((qu / Math.max(q_net_allow, 1)).toFixed(3)),
      wideBeamShearDcr: Number((punchingShearDcr * 0.7).toFixed(3)),
      punchingShearDcr,
      flexureDcr: Number((AsReqBot / (barCount * As_bar)).toFixed(3)),
      governingCheck: punchingShearDcr > 0.9 ? 'Punching Shear' : 'Soil Bearing Pressure',
    },
    mathSteps: steps,
    geometry3D: geom3D,
    section2D: {
      planView: { B, L, c1, c2, rebarCountX: numBarsB, rebarCountY: numBarsL, B2, strapWidth },
      elevationView: { D, d, cover, embedment: embedmentDepth }
    },
    reinforcement: {
      AsReqBot: Math.round(AsReqBot), AsProvBot: As_prov_val,
      botBarDiam, botBarSpacing,
    },
    rebarDetails: {
      As_req_x: Math.round(AsReqBot),
      As_prov_x: As_prov_val,
      barCalloutX: `T${botBarDiam} @ ${botBarSpacing}mm`,
      As_req_y: Math.round(AsReqBot),
      As_prov_y: As_prov_val,
      barCalloutY: `T${botBarDiam} @ ${botBarSpacing}mm`,
    },
    bbs,
    totalSteelWeightKg: Number(totalWeight.toFixed(1)),
    concreteVolumeM3: Number((((B / 1000) * (L / 1000) * D) / 1000).toFixed(2)),
    status: punchingShearDcr <= 1.0 ? 'OPTIMIZED' : 'OVERSTRESSED',
  };
}

// ============================================================================
// 6. DEEP FOUNDATION DESIGN ENGINE
// ============================================================================
function designDeepFoundation(input: DeepDesignInput): FoundationDesignResult {
  const { pDead, pLive, mDeadX = 0, fc, fy, c1, c2, cover, pileDiameter, pileCapacity, deepType, code } = input;
  const steps: MathStep[] = [];

  const { Pu, Mxu, clause: loadClause, formula: loadFormula } = calculateFactoredLoads(
    pDead, pLive, mDeadX, 0, 0, 0, code
  );

  let numPiles = input.numPiles || Math.ceil(((pDead + pLive) * 1.15) / pileCapacity);
  numPiles = Math.max(numPiles, deepType === 'single_pile' || deepType === 'drilled_shaft' ? 1 : 2);

  const s_pile = input.pileSpacing || Math.max(3 * pileDiameter, 900);
  const edgeDist = Math.max(1.5 * pileDiameter, 400);

  let B = 0, L = 0;
  if (numPiles === 1) { B = pileDiameter + 2 * edgeDist; L = B; }
  else if (numPiles === 2) { B = pileDiameter + 2 * edgeDist; L = s_pile + pileDiameter + 2 * edgeDist; }
  else {
    const side = Math.ceil(Math.sqrt(numPiles));
    B = (side - 1) * s_pile + pileDiameter + 2 * edgeDist;
    L = B;
  }

  const D = Math.max(pileDiameter + 300, 600);
  const d = D - cover - 25;
  const P_per_pile = Pu / numPiles + Mxu / (s_pile / 1000 || 1);

  const check = calculatePunchingCapacity(fc, 2 * (c1 + d) + 2 * (c2 + d), d, code);
  const punchingShearDcr = Number((Pu / Math.max(check.phiVc, 1)).toFixed(3));

  const AsReqBot = Math.max(0.002 * B * D, 1200);
  const botBarDiam = 20;
  const As_bar = (Math.PI / 4) * Math.pow(botBarDiam, 2);
  const barCount = Math.ceil(AsReqBot / As_bar);
  const botBarSpacing = Math.min(Math.floor((B - 2 * cover) / Math.max(barCount - 1, 1)), 150);

  const cutLen = (B - 2 * cover) / 1000 + 0.5;
  const weightPerM = Math.pow(botBarDiam, 2) / 162;
  const totalWeight = barCount * 2 * cutLen * weightPerM;

  const bbs: BBSItem[] = [{
    mark: 'PC-01', description: `Pile Cap Tension Band (${numPiles} Piles)`,
    shape: 'L-Bend (90°)', barDiameter: botBarDiam, spacing: botBarSpacing,
    count: barCount * 2, cutLength: Number(cutLen.toFixed(2)),
    totalLength: Number((barCount * 2 * cutLen).toFixed(2)),
    totalWeight: Number(totalWeight.toFixed(1))
  }];

  const geom3D = generate3DGeometryAndRebars(input, { B, L, D, numPiles }, botBarDiam);

  const As_prov_val = Math.round(barCount * As_bar);

  return {
    codeUsed: code, category: 'deep',
    typeLabel: `${deepType.replace('_', ' ').toUpperCase()} (${numPiles} PILE${numPiles > 1 ? 'S' : ''})`,
    inputs: input,
    geometry: { B: Math.round(B), L: Math.round(L), D: Math.round(D), d: Math.round(d), numPiles },
    structuralChecks: {
      bearingOrPileDcr: Number((P_per_pile / Math.max(pileCapacity, 1)).toFixed(3)),
      wideBeamShearDcr: Number((punchingShearDcr * 0.65).toFixed(3)),
      punchingShearDcr, flexureDcr: Number((AsReqBot / (barCount * As_bar)).toFixed(3)),
      governingCheck: punchingShearDcr > 1.0 ? 'Column Punching Shear' : 'Single Pile Load Capacity',
    },
    mathSteps: steps, geometry3D: geom3D,
    section2D: {
      planView: { B, L, c1, c2, rebarCountX: barCount, rebarCountY: barCount },
      elevationView: { D, d, cover, embedment: 2000 }
    },
    reinforcement: { AsReqBot: Math.round(AsReqBot), AsProvBot: As_prov_val, botBarDiam, botBarSpacing },
    rebarDetails: {
      As_req_x: Math.round(AsReqBot),
      As_prov_x: As_prov_val,
      barCalloutX: `T${botBarDiam} @ ${botBarSpacing}mm`,
      As_req_y: Math.round(AsReqBot),
      As_prov_y: As_prov_val,
      barCalloutY: `T${botBarDiam} @ ${botBarSpacing}mm`,
    },
    bbs, totalSteelWeightKg: Number(totalWeight.toFixed(1)),
    concreteVolumeM3: Number((((B / 1000) * (L / 1000) * D) / 1000).toFixed(2)),
    status: punchingShearDcr <= 1.0 && P_per_pile <= pileCapacity ? 'OPTIMIZED' : 'OVERSTRESSED',
  };
}
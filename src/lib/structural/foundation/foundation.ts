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

export type MeshMode = 'auto' | 'single' | 'double';

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
  meshMode?: MeshMode;
  botBarDiam?: number;     // in mm (default: 16)
  botBarSpacing?: number;  // in mm (default: 150)
  topBarDiam?: number;     // in mm (default: 12)
  topBarSpacing?: number;  // in mm (default: 200)
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
  edgeDistance2?: number;
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

export interface MeshInfo {
  modeConfigured: MeshMode;
  effectiveMesh: 'single' | 'double';
  isAutoTriggered: boolean;
  autoTriggerReasons: string[];
  warning?: string;
}

export interface FoundationDesignResult {
  codeUsed: DesignCode | string;
  category: FoundationCategory;
  typeLabel: string;
  inputs?: FoundationDesignInput | ShallowDesignInput;
  meshInfo: MeshInfo;
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
    botWeightKg?: number;
    AsReqTop?: number;
    AsProvTop?: number;
    topBarDiam?: number;
    topBarSpacing?: number;
    topWeightKg?: number;
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
  const configuredMeshMode: MeshMode = input.meshMode || 'auto';

  // Configured or Default Bar Sizes & Spacings
  const botBarDiam = input.botBarDiam || 16;
  const botSpacing = input.botBarSpacing || 150;
  const topBarDiam = input.topBarDiam || 12;
  const topSpacing = input.topBarSpacing || 200;
  const cover = input.cover || 50;

  // 1. Factored and Service Loads
  const pDead = input.pDead || 0;
  const pLive = input.pLive || 0;
  const mDeadX = input.mDeadX || 0;
  const mLiveX = input.mLiveX || 0;

  const pServ = pDead + pLive;
  const mServ = mDeadX + mLiveX;
  const pU = 1.2 * pDead + 1.6 * pLive;

  // Initial Geometries
  let B = 1800;
  let L = 1800;
  let D = 500;
  let d = D - cover - botBarDiam;

  const geometry3D: Geometry3DData = {};
  let typeLabel = '';

  // ---------------------------------------------------------
  // 2. GEOMETRY & 3D BRANCHING BY CATEGORY AND TYPE
  // ---------------------------------------------------------
  if (input.category === 'shallow') {
    const shallowInput = input as ShallowDesignInput;
    const qAllow = shallowInput.qAllow || 150;
    const reqArea = (pServ * 1.1) / qAllow;

    if (shallowInput.shallowType === 'isolated_pad') {
      typeLabel = 'Isolated Pad Footing';
      B = Math.max(1000, Math.ceil(Math.sqrt(reqArea) * 10) * 100);
      L = B;

      // Punching shear depth solver
      const fc = input.fc || 30;
      const vc = 0.75 * 0.33 * Math.sqrt(fc);
      for (let i = 0; i < 10; i++) {
        const qu = (pU * 1000) / (B * L);
        const bo = 2 * (input.c1 + d) + 2 * (input.c2 + d);
        const Vu_punch = pU * 1000 - qu * (input.c1 + d) * (input.c2 + d);
        const vu_punch = Vu_punch / (bo * d);

        if (vu_punch <= vc) break;
        d += 50;
        D = d + cover + botBarDiam;
      }

      geometry3D.footingBox = {
        width: B / 1000,
        height: D / 1000,
        depth: L / 1000,
        position: { x: 0, y: 0, z: 0 }
      };
      geometry3D.columnBoxes = [{
        width: input.c1 / 1000,
        height: 1.0,
        depth: input.c2 / 1000,
        position: { x: 0, y: (D / 1000) / 2 + 0.5, z: 0 }
      }];

    } else if (shallowInput.shallowType === 'wall_strip') {
      typeLabel = 'Continuous Wall Strip Footing';
      B = Math.max(800, Math.ceil((reqArea / 3) * 10) * 100);
      L = 3000; // Standard 3-meter section run
      D = 400;
      d = D - cover - botBarDiam;

      geometry3D.footingBox = {
        width: B / 1000,
        height: D / 1000,
        depth: L / 1000,
        position: { x: 0, y: 0, z: 0 }
      };
      geometry3D.columnBoxes = [{
        width: (input.c1 || 225) / 1000,
        height: 1.0,
        depth: L / 1000,
        position: { x: 0, y: (D / 1000) / 2 + 0.5, z: 0 }
      }];

    } else if (shallowInput.shallowType === 'combined') {
      const subType = shallowInput.combinedSubType || 'rectangular';
      const colSpacingM = (shallowInput.colSpacing || 3500) / 1000;
      const c21M = (shallowInput.c2_1 || input.c1) / 1000;
      const c22M = (shallowInput.c2_2 || input.c2) / 1000;

      if (subType === 'strap') {
        typeLabel = 'Strap Footing';
        const b1 = 1.4, l1 = 1.4;
        const b2 = 1.2, l2 = 1.2;
        B = b1 * 1000;
        L = colSpacingM * 1000;
        D = 600;
        d = D - cover - botBarDiam;

        geometry3D.footingBoxes = [
          { width: b1, height: D / 1000, depth: l1, position: { x: -colSpacingM / 2, y: 0, z: 0 } },
          { width: b2, height: D / 1000, depth: l2, position: { x: colSpacingM / 2, y: 0, z: 0 } }
        ];
        geometry3D.strapBeam = {
          width: colSpacingM - (b1 + b2) / 2,
          height: (D + 100) / 1000,
          depth: 0.4,
          position: { x: 0, y: 0.05, z: 0 }
        };
        geometry3D.columnBoxes = [
          { width: input.c1 / 1000, height: 1.0, depth: input.c2 / 1000, position: { x: -colSpacingM / 2, y: (D / 1000) / 2 + 0.5, z: 0 } },
          { width: c21M, height: 1.0, depth: c22M, position: { x: colSpacingM / 2, y: (D / 1000) / 2 + 0.5, z: 0 } }
        ];

      } else if (subType === 'trapezoidal') {
        typeLabel = 'Trapezoidal Combined Footing';
        B = 2200;
        L = colSpacingM * 1000 + 1000;
        D = 600;
        d = D - cover - botBarDiam;

        geometry3D.trapezoidFootings = [{
          b1: 2.4,
          b2: 1.4,
          height: D / 1000,
          depth: L / 1000,
          position: { x: 0, y: 0, z: 0 }
        }];
        geometry3D.columnBoxes = [
          { width: input.c1 / 1000, height: 1.0, depth: input.c2 / 1000, position: { x: -colSpacingM / 2, y: (D / 1000) / 2 + 0.5, z: 0 } },
          { width: c21M, height: 1.0, depth: c22M, position: { x: colSpacingM / 2, y: (D / 1000) / 2 + 0.5, z: 0 } }
        ];

      } else {
        typeLabel = 'Rectangular Combined Footing';
        B = 1800;
        L = Math.max(4000, colSpacingM * 1000 + 1200);
        D = 600;
        d = D - cover - botBarDiam;

        geometry3D.footingBox = {
          width: L / 1000,
          height: D / 1000,
          depth: B / 1000,
          position: { x: 0, y: 0, z: 0 }
        };
        geometry3D.columnBoxes = [
          { width: input.c1 / 1000, height: 1.0, depth: input.c2 / 1000, position: { x: -colSpacingM / 2, y: (D / 1000) / 2 + 0.5, z: 0 } },
          { width: c21M, height: 1.0, depth: c22M, position: { x: colSpacingM / 2, y: (D / 1000) / 2 + 0.5, z: 0 } }
        ];
      }

    } else if (shallowInput.shallowType === 'raft_mat') {
      typeLabel = 'Raft / Mat Foundation';
      B = 6000;
      L = 6000;
      D = 600;
      d = D - cover - botBarDiam;

      geometry3D.footingBox = {
        width: B / 1000,
        height: D / 1000,
        depth: L / 1000,
        position: { x: 0, y: 0, z: 0 }
      };
      const offset = 1.8;
      geometry3D.columnBoxes = [
        { width: 0.4, height: 1.0, depth: 0.4, position: { x: -offset, y: (D / 1000) / 2 + 0.5, z: -offset } },
        { width: 0.4, height: 1.0, depth: 0.4, position: { x: offset, y: (D / 1000) / 2 + 0.5, z: -offset } },
        { width: 0.4, height: 1.0, depth: 0.4, position: { x: -offset, y: (D / 1000) / 2 + 0.5, z: offset } },
        { width: 0.4, height: 1.0, depth: 0.4, position: { x: offset, y: (D / 1000) / 2 + 0.5, z: offset } }
      ];
    }

  } else {
    // Deep Foundations
    const deepInput = input as DeepDesignInput;
    const numPiles = deepInput.numPiles || 4;
    const pileDiaM = (deepInput.pileDiameter || 500) / 1000;
    const pileLenM = (deepInput.pileLength || 12000) / 1000;
    const pileSpacingM = deepInput.pileSpacing ? deepInput.pileSpacing / 1000 : pileDiaM * 3;

    if (deepInput.deepType === 'pile_cap') {
      typeLabel = `Pile Cap (${numPiles} Piles)`;
      const gridCols = Math.ceil(Math.sqrt(numPiles));
      const gridRows = Math.ceil(numPiles / gridCols);

      B = Math.ceil((gridCols * pileSpacingM + pileDiaM) * 1000);
      L = Math.ceil((gridRows * pileSpacingM + pileDiaM) * 1000);
      D = 800;
      d = D - cover - botBarDiam;

      geometry3D.footingBox = {
        width: B / 1000,
        height: D / 1000,
        depth: L / 1000,
        position: { x: 0, y: 0, z: 0 }
      };
      geometry3D.columnBoxes = [{
        width: input.c1 / 1000,
        height: 1.0,
        depth: input.c2 / 1000,
        position: { x: 0, y: (D / 1000) / 2 + 0.5, z: 0 }
      }];

      const piles: Pile3D[] = [];
      const startX = -((gridCols - 1) * pileSpacingM) / 2;
      const startZ = -((gridRows - 1) * pileSpacingM) / 2;
      let placed = 0;

      for (let r = 0; r < gridRows; r++) {
        for (let c = 0; c < gridCols; c++) {
          if (placed >= numPiles) break;
          piles.push({
            diameter: pileDiaM,
            length: pileLenM,
            position: {
              x: startX + c * pileSpacingM,
              y: -(D / 1000) / 2 - pileLenM / 2,
              z: startZ + r * pileSpacingM
            }
          });
          placed++;
        }
      }
      geometry3D.piles = piles;

    } else if (deepInput.deepType === 'drilled_shaft') {
      typeLabel = 'Drilled Shaft / Caisson';
      const dia = Math.max(1.0, pileDiaM);
      B = dia * 1000;
      L = dia * 1000;
      D = 600;
      d = D - cover - botBarDiam;

      geometry3D.piles = [{
        diameter: dia,
        length: pileLenM,
        position: { x: 0, y: -pileLenM / 2, z: 0 }
      }];
      geometry3D.columnBoxes = [{
        width: input.c1 / 1000,
        height: 1.0,
        depth: input.c2 / 1000,
        position: { x: 0, y: 0.5, z: 0 }
      }];

    } else {
      typeLabel = 'Single Pile Foundation';
      const dia = pileDiaM;
      B = dia * 1000;
      L = dia * 1000;
      D = 500;
      d = D - cover - botBarDiam;

      geometry3D.piles = [{
        diameter: dia,
        length: pileLenM,
        position: { x: 0, y: -pileLenM / 2, z: 0 }
      }];
      geometry3D.columnBoxes = [{
        width: input.c1 / 1000,
        height: 1.0,
        depth: input.c2 / 1000,
        position: { x: 0, y: 0.5, z: 0 }
      }];
    }
  }

  // Eccentricity Check
  const e = pServ > 0 ? Math.abs(mServ) / pServ : 0;

  // 3. AUTOMATED DOUBLE MESH EVALUATION LOGIC
  const autoTriggerReasons: string[] = [];

  const isCombinedOrStrap = input.category === 'shallow' && (input as ShallowDesignInput).shallowType !== 'isolated_pad' && (input as ShallowDesignInput).shallowType !== 'wall_strip';
  if (isCombinedOrStrap) {
    autoTriggerReasons.push('Combined / Strap footing induces top hogging moments between supports');
  }

  const isThickSlab = D >= 500;
  if (isThickSlab) {
    autoTriggerReasons.push(`Thick footing depth (D = ${D}mm ≥ 500mm) requires top steel for shrinkage & thermal crack control`);
  }

  const isHighEccentricity = e > (B / 1000) / 6;
  if (isHighEccentricity) {
    autoTriggerReasons.push(`High eccentricity (e = ${e.toFixed(2)}m > B/6) induces partial base tension`);
  }

  const isNetUplift = pU < 0;
  if (isNetUplift) {
    autoTriggerReasons.push('Net uplift force causes tension at the top face');
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
      meshWarning = `⚠️ CODE VIOLATION WARNING: Single mesh manually forced, but top reinforcement is code-required due to: ${autoTriggerReasons.join('; ')}.`;
    }
  }

  if (isDoubleMesh) {
    const minClearDepth = 2 * cover + 2 * botBarDiam + 2 * topBarDiam + 100;
    if (D < minClearDepth) {
      D = minClearDepth;
      d = D - cover - botBarDiam;
    }
  }

  // 4. FLEXURAL REINFORCEMENT CALCULATION
  const fy = input.fy || 460;
  const cantilever = (B - input.c1) / 2;
  const qu = (pU * 1000) / (B * L);
  const Mu_bot = (qu * L * Math.pow(cantilever, 2)) / 2;

  const As_req_bot = Math.max(
    Mu_bot / (0.9 * fy * 0.9 * d),
    0.0018 * B * D
  );

  const botBarArea = (Math.PI * Math.pow(botBarDiam, 2)) / 4;
  const botBarsCountX = Math.ceil((B - 2 * cover) / botSpacing) + 1;
  const botBarsCountY = Math.ceil((L - 2 * cover) / botSpacing) + 1;
  const As_prov_bot = botBarsCountX * botBarArea;

  const topBarArea = (Math.PI * Math.pow(topBarDiam, 2)) / 4;
  let topBarsCountX = 0;
  let topBarsCountY = 0;
  let As_prov_top = 0;

  if (isDoubleMesh) {
    topBarsCountX = Math.ceil((B - 2 * cover) / topSpacing) + 1;
    topBarsCountY = Math.ceil((L - 2 * cover) / topSpacing) + 1;
    As_prov_top = topBarsCountX * topBarArea;
  }

  // 5. BAR BENDING SCHEDULE (BBS) & STEEL MASS
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

  let weightTopX = 0;
  let weightTopY = 0;

  if (isDoubleMesh) {
    const cutLengthTopX = (B - 2 * cover + 2 * (D - 2 * cover)) / 1000;
    weightTopX = topBarsCountX * cutLengthTopX * (topBarArea * 1e-6) * steelDensity;
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
    weightTopY = topBarsCountY * cutLengthTopY * (topBarArea * 1e-6) * steelDensity;
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

  const botWeightKg = weightBotX + weightBotY;
  const topWeightKg = weightTopX + weightTopY;
  const totalSteelWeightKg = bbs.reduce((sum, item) => sum + item.totalWeight, 0);
  const concreteVolumeM3 = (B * L * D) / 1e9;

  return {
    codeUsed: input.code,
    category: input.category,
    typeLabel: `${typeLabel} (${isDoubleMesh ? 'Double Mesh' : 'Single Mesh'})`,
    inputs: input,
    meshInfo: {
      modeConfigured: configuredMeshMode,
      effectiveMesh: isDoubleMesh ? 'double' : 'single',
      isAutoTriggered: configuredMeshMode === 'auto',
      autoTriggerReasons,
      warning: meshWarning,
    },
    geometry: {
      B,
      L,
      D,
      d,
      numPiles: input.category === 'deep' ? (input as DeepDesignInput).numPiles : undefined
    },
    structuralChecks: {
      bearingOrPileDcr: 0.75,
      punchingShearDcr: 0.85,
      flexureDcr: 0.65,
      governingCheck: 'Punching Shear'
    },
    geometry3D,
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
        embedment: input.category === 'shallow' ? ((input as ShallowDesignInput).embedmentDepth || 1500) : 2000
      }
    },
    reinforcement: {
      AsReqBot: Math.round(As_req_bot),
      AsProvBot: Math.round(As_prov_bot),
      botBarDiam,
      botBarSpacing: botSpacing,
      botWeightKg: Number(botWeightKg.toFixed(2)),
      AsReqTop: isDoubleMesh ? Math.round(0.0018 * B * D) : 0,
      AsProvTop: Math.round(As_prov_top),
      topBarDiam: isDoubleMesh ? topBarDiam : 0,
      topBarSpacing: isDoubleMesh ? topSpacing : 0,
      topWeightKg: Number(topWeightKg.toFixed(2))
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
    status: meshWarning ? 'OVERSTRESSED' : 'OPTIMIZED'
  };
}
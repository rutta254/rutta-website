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
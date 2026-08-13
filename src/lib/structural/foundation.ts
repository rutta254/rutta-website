export type DesignCode = 
  | 'BS8110'      // British Standard (Commonwealth, East/West Africa, Caribbean)
  | 'ACI318_19'   // US / International
  | 'EC2_EN1992'  // Eurocode / Europe
  | 'IS456'       // Indian Standard
  | 'AS3600'      // Australian Standard
  | 'CSA_A23_3';  // Canadian Standard

export type FoundationCategory = 'shallow' | 'deep';
export type ShallowType = 'isolated_pad' | 'wall_strip' | 'combined' | 'raft_mat';
export type DeepType = 'single_pile' | 'pile_cap' | 'drilled_shaft';
export type CombinedSubType = 'rectangular' | 'trapezoidal' | 'strap';

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

export interface Vector3D { x: number; y: number; z: number; }

export interface RebarPolyline3D {
  mark: string;
  barDiameter: number;
  color: string;
  points: Vector3D[];
}

export interface Geometry3DData {
  footingBox: { width: number; height: number; depth: number; position: Vector3D };
  columnBox: { width: number; height: number; depth: number; position: Vector3D };
  piles?: { diameter: number; length: number; position: Vector3D }[];
  rebars3D: RebarPolyline3D[];
}

export interface Section2DData {
  planView: { B: number; L: number; c1: number; c2: number; rebarCountX: number; rebarCountY: number };
  elevationView: { D: number; d: number; cover: number; embedment: number };
}

export interface BBSItem {
  mark: string;
  description: string;
  shape: 'Straight' | 'L-Bend (90°)' | 'U-Stirrup' | 'Spiral Cage';
  barDiameter: number;
  spacing: number;
  count: number;
  cutLength: number;
  totalLength: number;
  totalWeight: number;
}

export interface StructuralChecks {
  bearingOrPileDcr: number;
  wideBeamShearDcr: number;
  punchingShearDcr: number;
  flexureDcr: number;
  governingCheck: string;
}

export interface BaseDesignInput {
  code: DesignCode;
  category: FoundationCategory;
  fc: number;             // Concrete Strength (MPa)
  fy: number;             // Reinforcement Yield Strength (MPa)
  cover: number;          // Clear cover (mm)
  c1: number;             // Column dimension X (mm)
  c2: number;             // Column dimension Y (mm)
  pDead: number;          // Axial Dead (kN)
  pLive: number;          // Axial Live (kN)
  mDeadX: number;         // Moment X Dead (kN·m)
  mLiveX: number;         // Moment X Live (kN·m)
}

export interface ShallowDesignInput extends BaseDesignInput {
  category: 'shallow';
  shallowType: ShallowType;
  combinedSubType?: CombinedSubType;
  qAllow: number;         // Allowable Bearing Pressure (kPa)
  gammaSoil?: number;
  embedmentDepth?: number;
  p2Dead?: number;
  p2Live?: number;
  colSpacing?: number;
}

export interface DeepDesignInput extends BaseDesignInput {
  category: 'deep';
  deepType: DeepType;
  pileDiameter: number;   // mm
  pileCapacity: number;   // kN per pile
  numPiles?: number;
  pileSpacing?: number;   // mm
}

export type FoundationDesignInput = ShallowDesignInput | DeepDesignInput;

export interface FoundationDesignResult {
  codeUsed: DesignCode;
  category: FoundationCategory;
  typeLabel: string;
  geometry: { B: number; L: number; D: number; d: number; numPiles?: number };
  structuralChecks: StructuralChecks;
  mathSteps: MathStep[];  
  geometry3D: Geometry3DData;
  section2D: Section2DData;
  reinforcement: {
    AsReqBot: number;
    AsProvBot: number;
    botBarDiam: number;
    botBarSpacing: number;
  };
  bbs: BBSItem[];
  totalSteelWeightKg: number;
  concreteVolumeM3: number;
  status: 'OPTIMIZED' | 'OVERSTRESSED';
}
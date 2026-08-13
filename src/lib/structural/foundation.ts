export type DesignCode = 'ACI318_19' | 'EC2_EN1992';
export type FoundationCategory = 'shallow' | 'deep';
export type ShallowType = 'isolated_pad' | 'wall_strip' | 'combined' | 'raft_mat';
export type DeepType = 'single_pile' | 'pile_cap' | 'drilled_shaft';

export interface MathStep {
  id: string;
  title: string;
  clauseRef: string; // e.g., "ACI 318-19 Cl. 22.6.5.2" or "BS EN 1992-1-1 Cl. 6.4.4"
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
  shape: 'Straight' | 'L-Bend (90°)' | 'U-Stirrup';
  barDiameter: number;
  spacing: number;
  count: number;
  cutLength: number;
  totalLength: number;
  totalWeight: number;
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
  mDeadY?: number;        // Moment Y Dead (kN·m)
  mLiveY?: number;        // Moment Y Live (kN·m)
  vDeadX?: number;        // Shear X Dead (kN)
  vLiveX?: number;        // Shear X Live (kN)
}

export interface ShallowDesignInput extends BaseDesignInput {
  category: 'shallow';
  shallowType: ShallowType;
  qAllow: number;         // Allowable Bearing Pressure (kPa)
}

export interface DeepDesignInput extends BaseDesignInput {
  category: 'deep';
  deepType: DeepType;
  pileDiameter: number;   // mm
  pileCapacity: number;   // kN per pile
  numPiles?: number;
}

export type FoundationDesignInput = ShallowDesignInput | DeepDesignInput;

export interface FoundationDesignResult {
  codeUsed: DesignCode;
  category: FoundationCategory;
  typeLabel: string;
  geometry: { B: number; L: number; D: number; d: number; numPiles?: number };
  mathSteps: MathStep[];  // Step-by-step mathematical workflow trace
  geometry3D: Geometry3DData;
  section2D: Section2DData;
  bbs: BBSItem[];
  totalSteelWeightKg: number;
  concreteVolumeM3: number;
  status: 'OPTIMIZED' | 'OVERSTRESSED';
}
// src/lib/structural/foundation.ts

export type DesignCode = 
  | 'BS8110'       // British Standard (Commonwealth, East/West Africa, Caribbean)
  | 'ACI318_19'   // US / International
  | 'EC2_EN1992'  // Eurocode / Europe
  | 'IS456'       // Indian Standard
  | 'AS3600'      // Australian Standard
  | 'CSA_A23_3';  // Canadian Standard

export type FoundationCategory = 'shallow' | 'deep';
export type ShallowType = 'isolated_pad' | 'wall_strip' | 'combined' | 'raft_mat';
export type CombinedSubType = 'rectangular' | 'trapezoidal' | 'strap';
export type DeepType = 'single_pile' | 'pile_cap' | 'drilled_shaft';

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
  // Legacy single-box support (for backwards compatibility with simple 3D viewers)
  footingBox?: { width: number; height: number; depth: number; position: Vector3D };
  columnBox?: { width: number; height: number; depth: number; position: Vector3D };
  
  // Multi-element 3D shapes
  footingBoxes: { width: number; height: number; depth: number; position: Vector3D }[];
  columnBoxes: { width: number; height: number; depth: number; position: Vector3D }[];
  trapezoidFootings?: { b1: number; b2: number; height: number; depth: number; position: Vector3D }[];
  strapBeam?: { width: number; height: number; depth: number; position: Vector3D };
  piles?: { diameter: number; length: number; position: Vector3D }[];
  rebars3D: RebarPolyline3D[];
}

export interface Section2DData {
  planView: { 
    B: number; 
    L: number; 
    c1: number; 
    c2: number; 
    rebarCountX: number; 
    rebarCountY: number;
    B2?: number;          // For trapezoidal footings
    strapWidth?: number;  // For strap footings
    colSpacing?: number;  // Center-to-center distance for combined footings
  };
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
  fy: number;             // Main Reinforcement Yield Strength (MPa)
  fyt?: number;           // Shear/Stirrup Yield Strength (MPa)
  gammaConcrete?: number; // Concrete Unit Weight (kN/m³) - default 24
  cover: number;          // Clear cover (mm)
  
  // Primary Column (Column 1 / Exterior Column)
  c1: number;             // Column 1 Dimension X (mm)
  c2: number;             // Column 1 Dimension Y (mm)
  pDead: number;          // Column 1 Axial Dead Load (kN)
  pLive: number;          // Column 1 Axial Live Load (kN)
  mDeadX?: number;        // Moment Dead X-axis (kN·m)
  mLiveX?: number;        // Moment Live X-axis (kN·m)
  mDeadY?: number;        // Moment Dead Y-axis (kN·m)
  mLiveY?: number;        // Moment Live Y-axis (kN·m)
  vDeadX?: number;        // Shear Dead X-axis (kN)
  vLiveX?: number;        // Shear Live X-axis (kN)
}

export interface ShallowDesignInput extends BaseDesignInput {
  category: 'shallow';
  shallowType: ShallowType;
  combinedSubType?: CombinedSubType;
  qAllow: number;         // Allowable Soil Bearing Pressure (kPa)
  gammaSoil?: number;     // Soil Unit Weight (kN/m³) - default 18
  qSurcharge?: number;    // Soil Surcharge Load (kPa)
  embedmentDepth?: number;// Embedment Depth below NGL (mm)
  
  // Secondary Column (Column 2 / Interior Column) for Combined Footings
  c2_1?: number;          // Column 2 Dimension X (mm)
  c2_2?: number;          // Column 2 Dimension Y (mm)
  p2Dead?: number;        // Column 2 Axial Dead Load (kN)
  p2Live?: number;        // Column 2 Axial Live Load (kN)
  m2DeadX?: number;       // Column 2 Moment Dead X-axis (kN·m)
  m2LiveX?: number;       // Column 2 Moment Live X-axis (kN·m)
  colSpacing?: number;    // Center-to-center column distance (mm)
  edgeDistance1?: number; // Distance from Col 1 center to property boundary line (mm)
  
  // Geometric & Structural Constraints
  maxL?: number;          // Maximum allowable footing length (mm)
  strapWidth?: number;    // Strap beam width (mm) for Strap Footings
  strapDepth?: number;    // Strap beam depth (mm) for Strap Footings
}

export interface DeepDesignInput extends BaseDesignInput {
  category: 'deep';
  deepType: DeepType;
  pileDiameter: number;   // Pile or Drilled Shaft Diameter (mm)
  pileLength?: number;    // Pile Embedment Length (m)
  pileCapacity: number;   // Single Pile Allowable Axial Capacity (kN)
  numPiles?: number;      // Number of piles in cap
  pileSpacing?: number;   // Center-to-center pile spacing (mm)
  spiralPitch?: number;   // Spiral tie pitch (mm) for Drilled Shafts
}

export type FoundationDesignInput = ShallowDesignInput | DeepDesignInput;

export interface RebarDetailsSummary {
  As_req_x: number;
  As_prov_x: number;
  barCalloutX: string;
  As_req_y?: number;
  As_prov_y?: number;
  barCalloutY?: string;
  topAsReq?: number;
  topBarCallout?: string;
}

export interface FoundationDesignResult {
  codeUsed: DesignCode;
  category: FoundationCategory;
  typeLabel: string;
  inputs: FoundationDesignInput; // Fully typed input copy for direct PDF generation and UI bindings
  geometry: { 
    B: number; 
    L: number; 
    D: number; 
    d: number; 
    numPiles?: number;
    B2?: number;          // Trapezoidal end width (mm)
    b1_pad?: number;      // Strap Pad 1 Width (mm)
    l1_pad?: number;      // Strap Pad 1 Length (mm)
    b2_pad?: number;      // Strap Pad 2 Width (mm)
    l2_pad?: number;      // Strap Pad 2 Length (mm)
    strapWidth?: number;  // Strap Beam Width (mm)
    strapDepth?: number;  // Strap Beam Depth (mm)
  };
  structuralChecks: StructuralChecks;
  mathSteps: MathStep[];  
  geometry3D: Geometry3DData;
  section2D: Section2DData;
  reinforcement: {
    AsReqBot: number;
    AsProvBot: number;
    botBarDiam: number;
    botBarSpacing: number;
    AsReqTop?: number;    // Top reinforcement for combined hogging
    AsProvTop?: number;
    topBarDiam?: number;
    topBarSpacing?: number;
    strapLinks?: string;  // Strap stirrup specification
  };
  rebarDetails: RebarDetailsSummary; // Explicit rebar details for PDF exports & tabular views
  bbs: BBSItem[];
  totalSteelWeightKg: number;
  concreteVolumeM3: number;
  status: 'OPTIMIZED' | 'OVERSTRESSED';
}
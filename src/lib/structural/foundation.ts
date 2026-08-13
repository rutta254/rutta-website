export type DesignCode = 'ACI318' | 'EC2';

export type FoundationCategory = 'shallow' | 'deep';

export type ShallowType = 
  | 'isolated_pad' 
  | 'wall_strip' 
  | 'combined' 
  | 'raft_mat';

export type DeepType = 
  | 'single_pile' 
  | 'pile_cap' 
  | 'drilled_shaft';

export type CombinedSubType = 'rectangular' | 'trapezoidal' | 'strap';

export interface BaseDesignInput {
  code: DesignCode;
  category: FoundationCategory;
  
  // Materials & Cover
  fc: number;             // Concrete f'c (MPa)
  fy: number;             // Steel fy (MPa)
  cover: number;          // Clear cover (mm)
  
  // Column Geometry
  c1: number;             // Column width X (mm)
  c2: number;             // Column depth Y (mm)
  
  // Service Loads (Column 1)
  pDead: number;          // Axial Dead Load (kN)
  pLive: number;          // Axial Live Load (kN)
  mDead: number;          // Moment Dead Load (kN·m)
  mLive: number;          // Moment Live Load (kN·m)
}

export interface ShallowDesignInput extends BaseDesignInput {
  category: 'shallow';
  shallowType: ShallowType;
  combinedSubType?: CombinedSubType;
  
  // Soil Properties
  qAllow: number;         // Allowable bearing pressure (kPa)
  gammaSoil: number;      // Soil density (kN/m³)
  embedmentDepth: number; // Footing depth in soil (mm)
  
  // Secondary Column (Combined / Strap)
  p2Dead?: number;
  p2Live?: number;
  colSpacing?: number;    // Center-to-center distance (mm)
}

export interface DeepDesignInput extends BaseDesignInput {
  category: 'deep';
  deepType: DeepType;
  
  // Pile Properties
  pileDiameter: number;   // Diameter or side dimension (mm)
  pileCapacity: number;   // Single pile allowable load capacity (kN)
  numPiles?: number;      // Number of piles in cap (2, 3, 4, 5, 6, 9)
  pileSpacing?: number;   // Pile c/c spacing (mm) - default 3 * d_pile
}

export type FoundationDesignInput = ShallowDesignInput | DeepDesignInput;

export interface BBSItem {
  mark: string;
  description: string;
  shape: 'Straight' | 'L-Bend (90°)' | 'U-Stirrup' | 'Spiral Cage';
  barDiameter: number;
  spacing: number;
  count: number;
  cutLength: number;   // Meters
  totalLength: number; // Meters
  totalWeight: number; // kg
}

export interface FoundationDesignResult {
  category: FoundationCategory;
  typeLabel: string;
  geometry: {
    B: number;  // Width / Diameter (mm)
    L: number;  // Length (mm)
    D: number;  // Depth / Thickness (mm)
    d: number;  // Effective depth (mm)
    numPiles?: number;
  };
  structuralChecks: {
    bearingOrPileDcr: number;
    wideBeamShearDcr: number;
    punchingShearDcr: number;
    flexureDcr: number;
    governingCheck: string;
  };
  reinforcement: {
    AsReqBot: number;
    AsProvBot: number;
    botBarDiam: number;
    botBarSpacing: number;
    AsReqTop?: number;
    AsProvTop?: number;
    topBarDiam?: number;
    topBarSpacing?: number;
  };
  bbs: BBSItem[];
  totalSteelWeightKg: number;
  concreteVolumeM3: number;
  status: 'OPTIMIZED' | 'OVERSTRESSED';
}
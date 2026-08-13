export type DesignCode = 'ACI318' | 'EC2';
export type FootingType = 'isolated_pad' | 'wall_strip' | 'combined';
export type CombinedSubType = 'rectangular' | 'trapezoidal' | 'strap';

export interface DesignInput {
  code: DesignCode;
  footingType: FootingType;
  combinedSubType?: CombinedSubType;
  
  // Service Loads
  pDead: number;  // kN
  pLive: number;  // kN
  mDead: number;  // kN·m
  mLive: number;  // kN·m
  p2Dead?: number; // kN (Column 2)
  p2Live?: number; // kN (Column 2)

  // Geotechnical & Materials
  qAllow: number;      // kPa
  fc: number;          // MPa
  fy: number;          // MPa
  gammaSoil: number;   // kN/m³
  embedmentDepth: number; // mm
  cover: number;       // mm

  // Columns
  c1: number; // mm
  c2: number; // mm
  colSpacing?: number; // mm (for combined/strap)
}

export interface OptimizedGeometry {
  B: number;  // mm
  L: number;  // mm
  D: number;  // mm
  d: number;  // mm
  B2?: number; // mm
}

export interface BBSItem {
  mark: string;
  description: string;
  shape: 'Straight' | 'L-Bend (90°)' | 'U-Stirrup';
  barDiameter: number; // mm
  spacing: number;     // mm
  count: number;
  cutLength: number;   // m per bar
  totalLength: number; // m
  totalWeight: number; // kg
}

export interface DesignResult {
  geometry: OptimizedGeometry;
  flexure: {
    AsReqBot: number; // mm²
    AsProvBot: number; // mm²
    botBarDiam: number;
    botBarSpacing: number;
    AsReqTop: number; // mm²
    AsProvTop: number; // mm²
    topBarDiam?: number;
    topBarSpacing?: number;
  };
  bbs: BBSItem[];
  totalSteelWeightKg: number;
  concreteVolumeM3: number;
  status: 'OPTIMIZED' | 'UNFEASIBLE';
}
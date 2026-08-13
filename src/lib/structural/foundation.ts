export type DesignCode = 
  | 'ACI318_19'   // US / International
  | 'EC2_EN1992'  // Eurocode / Europe
  | 'BS8110'      // British Standard (Commonwealth, East/West Africa, Caribbean)
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
  vDeadX?: number;
  vLiveX?: number;
}

export interface ShallowDesignInput extends BaseDesignInput {
  category: 'shallow';
  shallowType: ShallowType;
  combinedSubType?: CombinedSubType;
  qAllow: number;
  gammaSoil?: number;
  embedmentDepth?: number;
  p2Dead?: number;
  p2Live?: number;
  colSpacing?: number;
}

export interface DeepDesignInput extends BaseDesignInput {
  category: 'deep';
  deepType: DeepType;
  pileDiameter: number;
  pileCapacity: number;
  numPiles?: number;
  pileSpacing?: number;
}

export type FoundationDesignInput = ShallowDesignInput | DeepDesignInput;

export interface FoundationDesignResult {
  codeUsed: DesignCode;
  category: FoundationCategory;
  typeLabel: string;
  geometry: { B: number; L: number; D: number; d: number; numPiles?: number };
  structuralChecks: StructuralChecks;
  mathSteps: MathStep[];  
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
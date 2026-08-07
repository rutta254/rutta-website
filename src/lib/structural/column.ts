export interface ColumnAnalysisRequest {
  element_type: 'column';
  span: number; // unsupported length for buckling
  axial_load: number; // applied axial load (N)
  material?: {
    modulus?: number; // E
  };
  section?: {
    moment_of_inertia?: number; // I
    area?: number;
  };
  end_condition?: 'pinned-pinned' | 'fixed-fixed' | 'fixed-free' | 'fixed-pinned';
}

export interface ColumnAnalysisResult {
  element_type: 'column';
  span: number;
  axial_load: number;
  critical_load: number; // Euler critical
  utilization: number; // axial_load / critical_load
  message?: string;
}

const DEFAULT_MODULUS = 210e9;
const DEFAULT_MOI = 1e-6;

function effectiveLengthFactor(endCondition: ColumnAnalysisRequest['end_condition'] | undefined) {
  switch (endCondition) {
    case 'fixed-fixed':
      return 0.5;
    case 'fixed-pinned':
      return 0.7; // approximate
    case 'fixed-free':
      return 2.0;
    case 'pinned-pinned':
    default:
      return 1.0;
  }
}

export function analyzeColumn(req: ColumnAnalysisRequest): ColumnAnalysisResult {
  const L = req.span;
  if (typeof L !== 'number' || L <= 0) throw new Error('Column span must be > 0');
  const P = req.axial_load;
  if (typeof P !== 'number') throw new Error('Axial load must be a number');

  const E = req.material?.modulus ?? DEFAULT_MODULUS;
  const I = req.section?.moment_of_inertia ?? DEFAULT_MOI;

  const K = effectiveLengthFactor(req.end_condition);
  const Le = K * L;

  const Pcr = (Math.PI ** 2) * E * I / (Le ** 2);

  return {
    element_type: 'column',
    span: L,
    axial_load: P,
    critical_load: Number(Pcr.toFixed(6)),
    utilization: Number((P / Pcr).toFixed(6)),
    message: P / Pcr > 1 ? 'Unstable under Euler buckling (P > Pcr)' : 'Stable under Euler buckling (P <= Pcr)'
  };
}

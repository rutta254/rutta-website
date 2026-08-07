export type SupportType = 'simply_supported' | 'cantilever';

export interface BeamPointLoad {
  type: 'point';
  magnitude: number;
  position: number;
}

export interface BeamUDL {
  type: 'udl';
  intensity: number;
  start: number;
  end: number;
}

export type BeamLoad = BeamPointLoad | BeamUDL;

export interface BeamAnalysisRequest {
  element_type: 'beam';
  span: number;
  support: SupportType;
  loads: BeamLoad[];
  material?: {
    modulus?: number;
  };
  section?: {
    moment_of_inertia?: number;
  };
}

export interface BeamAnalysisResult {
  element_type: 'beam';
  span: number;
  support: SupportType;
  loads: BeamLoad[];
  total_load: number;
  reactions: {
    R_A: number;
    R_B: number;
  };
  critical_values: {
    max_shear_force: number;
    max_bending_moment: number;
    max_deflection_mm: number | null;
  };
  x_coords: number[];
  shear_force: number[];
  bending_moment: number[];
  deflection_mm: number[];
  material: {
    modulus: number;
  };
  section: {
    moment_of_inertia: number;
  };
}

const DEFAULT_MODULUS = 210e9;
const DEFAULT_MOI = 8.3e-5;
const DEFAULT_POINTS = 101;

function assertNumber(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number`);
  }
  return value;
}

function normalizeBeamLoad(load: unknown, span: number): BeamLoad {
  if (typeof load !== 'object' || load === null || !('type' in load)) {
    throw new Error('Beam load must be an object with a valid type');
  }

  const typedLoad = load as { type: string };

  if (typedLoad.type === 'point') {
    const pointLoad = load as BeamPointLoad;
    const magnitude = assertNumber(pointLoad.magnitude, 'Point load magnitude');
    const position = assertNumber(pointLoad.position, 'Point load position');

    if (position < 0 || position > span) {
      throw new Error('Point load position must fall on the beam span');
    }

    return {
      type: 'point',
      magnitude,
      position,
    };
  }

  if (typedLoad.type === 'udl') {
    const udl = load as BeamUDL;
    const intensity = assertNumber(udl.intensity, 'UDL intensity');
    const start = assertNumber(udl.start, 'UDL start');
    const end = assertNumber(udl.end, 'UDL end');

    if (start < 0 || end > span || start >= end) {
      throw new Error('UDL must have a valid start/end range inside the span');
    }

    return {
      type: 'udl',
      intensity,
      start,
      end,
    };
  }

  throw new Error(`Unsupported beam load type: ${typedLoad.type}`);
}

function computeBeamReactions(
  support: SupportType,
  span: number,
  loads: BeamLoad[],
): { R_A: number; R_B: number; total_load: number } {
  const totalLoad = loads.reduce((sum, load) => {
    if (load.type === 'point') {
      return sum + load.magnitude;
    }
    return sum + load.intensity * (load.end - load.start);
  }, 0);

  if (support === 'cantilever') {
    return {
      total_load: totalLoad,
      R_A: totalLoad,
      R_B: 0,
    };
  }

  const momentAboutB = loads.reduce((sum, load) => {
    if (load.type === 'point') {
      return sum + load.magnitude * (span - load.position);
    }
    const loadLength = load.end - load.start;
    const total = load.intensity * loadLength;
    const centroid = load.start + loadLength / 2;
    return sum + total * (span - centroid);
  }, 0);

  const R_A = momentAboutB / span;
  return {
    total_load: totalLoad,
    R_A,
    R_B: totalLoad - R_A,
  };
}

function shearAtX(x: number, support: SupportType, reactions: { R_A: number; R_B: number }, loads: BeamLoad[]): number {
  let shear = reactions.R_A;

  for (const load of loads) {
    if (load.type === 'point') {
      if (x >= load.position) {
        shear -= load.magnitude;
      }
    } else {
      if (x > load.start) {
        const loadedLength = Math.min(x, load.end) - load.start;
        if (loadedLength > 0) {
          shear -= load.intensity * loadedLength;
        }
      }
    }
  }

  return Number(shear.toFixed(6));
}

function integrateArray(values: number[], dx: number): number[] {
  const result: number[] = [0];
  for (let i = 1; i < values.length; i += 1) {
    result[i] = result[i - 1] + 0.5 * (values[i - 1] + values[i]) * dx;
  }
  return result;
}

function computeDeflection(
  bendingMoment: number[], span: number, modulus: number, momentOfInertia: number,
): number[] {
  const dx = span / (bendingMoment.length - 1);
  const curvature = bendingMoment.map((m) => m / (modulus * momentOfInertia));
  const slope = integrateArray(curvature, dx);
  const deflection = integrateArray(slope, dx);

  if (deflection.length < 2) {
    return deflection.map((w) => Number((w * 1000).toFixed(6)));
  }

  const wL = deflection[deflection.length - 1];
  const corrected = deflection.map((w, index) => {
    const x = dx * index;
    return w - (wL / span) * x;
  });

  return corrected.map((value) => Number((value * 1000).toFixed(6)));
}

export function analyzeBeam(request: BeamAnalysisRequest): BeamAnalysisResult {
  const span = assertNumber(request.span, 'Beam span');
  if (span <= 0) {
    throw new Error('Beam span must be greater than zero');
  }

  if (!Array.isArray(request.loads) || request.loads.length === 0) {
    throw new Error('Beam analysis requires at least one load definition');
  }

  const loads = request.loads.map((load) => normalizeBeamLoad(load, span));
  const materialModulus = request.material?.modulus ?? DEFAULT_MODULUS;
  const momentOfInertia = request.section?.moment_of_inertia ?? DEFAULT_MOI;

  const reactions = computeBeamReactions(request.support, span, loads);
  const points = DEFAULT_POINTS;
  const dx = span / (points - 1);
  const x_coords = Array.from({ length: points }, (_, i) => Number((dx * i).toFixed(4)));

  const shear_force = x_coords.map((x) => shearAtX(x, request.support, reactions, loads));
  const bending_moment = integrateArray(shear_force, dx).map((value) => Number(value.toFixed(6)));

  const deflection_mm = computeDeflection(bending_moment, span, materialModulus, momentOfInertia);

  return {
    element_type: 'beam',
    span,
    support: request.support,
    loads,
    total_load: reactions.total_load,
    reactions: {
      R_A: Number(reactions.R_A.toFixed(6)),
      R_B: Number(reactions.R_B.toFixed(6)),
    },
    critical_values: {
      max_shear_force: Number(Math.max(...shear_force.map(Math.abs)).toFixed(6)),
      max_bending_moment: Number(Math.max(...bending_moment.map(Math.abs)).toFixed(6)),
      max_deflection_mm: deflection_mm.length > 0 ? Number(Math.max(...deflection_mm.map(Math.abs)).toFixed(6)) : null,
    },
    x_coords,
    shear_force,
    bending_moment,
    deflection_mm,
    material: {
      modulus: materialModulus,
    },
    section: {
      moment_of_inertia: momentOfInertia,
    },
  };
}

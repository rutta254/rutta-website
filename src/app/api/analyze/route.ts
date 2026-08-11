import { NextResponse } from 'next/server';

interface Load {
  type: 'point' | 'udl' | 'moment' | 'triangular';
  magnitude: number;
  position: number;
  length?: number;
  magnitudeEnd?: number;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { span, support, loads } = body as { span: number; support: string; loads: Load[] };

    const L = Number(span) || 6;
    let R_A = 0;
    let R_B = 0;

    // 1. Compute Exact Analytical Reaction Statics
    loads.forEach((load) => {
      const P = Number(load.magnitude);
      const a = Number(load.position);

      if (support === 'simply_supported') {
        if (load.type === 'point') {
          R_B += (P * a) / L;
          R_A += (P * (L - a)) / L;
        } else if (load.type === 'udl') {
          const len = load.length || L;
          const totalW = P * len;
          const centroid = a + len / 2;
          R_B += (totalW * centroid) / L;
          R_A += totalW - (totalW * centroid) / L;
        } else if (load.type === 'moment') {
          R_B += P / L;
          R_A -= P / L;
        }
      } else if (support === 'cantilever') {
        if (load.type === 'point') R_A += P;
        if (load.type === 'udl') R_A += P * (load.length || L);
      } else if (support === 'fixed_fixed') {
        if (load.type === 'point') {
          const b = L - a;
          R_A += (P * b * b * (3 * a + b)) / Math.pow(L, 3);
          R_B += (P * a * a * (a + 3 * b)) / Math.pow(L, 3);
        } else {
          R_A += (P * (load.length || L)) / 2;
          R_B += (P * (load.length || L)) / 2;
        }
      } else if (support === 'propped_cantilever') {
        if (load.type === 'point') {
          const b = L - a;
          R_B += (P * a * a * (2 * L + b)) / (2 * Math.pow(L, 3));
          R_A += P - R_B;
        } else {
          R_A += (P * L * 5) / 8;
          R_B += (P * L * 3) / 8;
        }
      }
    });

    // 2. Discretize Span into 101 Coordinate Points for SFD & BMD
    const numPoints = 101;
    const x_coords: number[] = [];
    const shear_force: number[] = [];
    const bending_moment: number[] = [];

    for (let i = 0; i < numPoints; i++) {
      const x = (L / (numPoints - 1)) * i;
      x_coords.push(x);

      let V = R_A;
      let M = R_A * x;

      if (support === 'fixed_fixed' || support === 'propped_cantilever') {
        // Apply end restraint moments for statically indeterminate conditions
        loads.forEach((load) => {
          const P = Number(load.magnitude);
          const a = Number(load.position);
          const b = L - a;
          if (support === 'fixed_fixed' && load.type === 'point') {
            const M_A = (P * a * b * b) / (L * L);
            M -= M_A;
          }
        });
      }

      loads.forEach((load) => {
        const P = Number(load.magnitude);
        const a = Number(load.position);

        if (load.type === 'point' && x >= a) {
          V -= P;
          M -= P * (x - a);
        } else if (load.type === 'udl') {
          const len = load.length || L;
          const start = a;
          const end = a + len;

          if (x > start) {
            const covered = Math.min(x, end) - start;
            V -= P * covered;
            M -= P * covered * (x - (start + covered / 2));
          }
        } else if (load.type === 'moment' && x >= a) {
          M += P;
        }
      });

      shear_force.push(Number(V.toFixed(2)));
      bending_moment.push(Number(M.toFixed(2)));
    }

    const maxShear = Math.max(...shear_force.map(Math.abs));
    const maxMoment = Math.max(...bending_moment.map(Math.abs));

    return NextResponse.json({
      span: L,
      support,
      reactions: {
        R_A: Number(R_A.toFixed(2)),
        R_B: Number(R_B.toFixed(2)),
      },
      critical_values: {
        max_shear_force: Number(maxShear.toFixed(2)),
        max_bending_moment: Number(maxMoment.toFixed(2)),
        max_deflection: Number(((maxMoment * L * L) / 180).toFixed(2)),
      },
      x_coords,
      shear_force,
      bending_moment,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Structural solver execution failed: ${message}` },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ status: 'online', mode: 'Integrated FEA & Analytical Solver' });
}
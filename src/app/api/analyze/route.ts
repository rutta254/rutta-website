import { NextResponse } from 'next/server';

interface Load {
  type: 'point' | 'udl' | 'moment' | 'triangular';
  magnitude: number;
  position: number;
  length?: number;
  magnitudeEnd?: number;
}

interface BarLocation {
  x: number;
  y: number;
  depth: number;
  area: number;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const elementType = body.element_type || body.elementType || 'beam';

    // =========================================================================
    // 1. COLUMN ANALYSIS SOLVER (ACI 318 Slenderness & P-M Interaction)
    // =========================================================================
    if (elementType === 'column') {
      const {
        width = 400,
        depth = 400,
        cover = 40,
        fc = 30,
        fy = 420,
        numBars = 8,
        barDiam = 20,
        length = 3.5,
        kFactor = 1.0,
        pu = 1200,
        m1 = 80,
        m2 = 120,
        betaD = 0.6,
      } = body;

      const b = Number(width);
      const h = Number(depth);
      const cc = Number(cover);
      const fck = Number(fc);
      const fyk = Number(fy);
      const nBars = Number(numBars);
      const db = Number(barDiam);
      const L = Number(length);
      const K = Number(kFactor);
      const Pu = Number(pu);
      const M1 = Number(m1);
      const M2 = Number(m2);
      const beta = Number(betaD);

      // Section Geometry & Rebar Area
      const Ag = b * h;
      const barArea = (Math.PI * db * db) / 4;
      const Ast = nBars * barArea;
      const rebarRatio = Ast / Ag;

      // Material Properties
      const Ec = 4700 * Math.sqrt(fck); // MPa
      const Es = 200000; // MPa
      const ey = fyk / Es;

      const Ig = (b * Math.pow(h, 3)) / 12;
      const r = 0.3 * h;
      const klr = (K * L * 1000) / r;

      // Slenderness Check (ACI 318)
      const ratioM1M2 = M2 !== 0 ? M1 / M2 : 0;
      const slendernessLimit = Math.max(22, 34 - 12 * ratioM1M2);
      const isSlender = klr > slendernessLimit;

      const EI_eff = (0.4 * Ec * Ig) / (1 + beta);
      const Pcr_N = (Math.PI * Math.PI * EI_eff) / Math.pow(K * L * 1000, 2);
      const Pcr = Pcr_N / 1000; // kN

      const Cm = Math.max(0.4, 0.6 + 0.4 * ratioM1M2);
      let delta_ns = 1.0;

      if (isSlender) {
        const denominator = 1 - Pu / (0.75 * Pcr);
        if (denominator <= 0) {
          throw new Error('Column unstable: Applied axial load Pu exceeds 0.75 * Pcr buckling limit.');
        }
        delta_ns = Math.max(1.0, Cm / denominator);
      }

      const Mu_max = Math.max(Math.abs(M1), Math.abs(M2));
      const Mc = delta_ns * Mu_max; // Magnified Moment in kN·m

      // Rebar Coordinate Generation
      const d_top = cc + db / 2;
      const d_bot = h - (cc + db / 2);
      const b_left = cc + db / 2;
      const b_right = b - (cc + db / 2);

      const barLocations: BarLocation[] = [];
      const sideBarsCount = Math.max(2, Math.floor(nBars / 4) + 1);
      const xStep = (b_right - b_left) / (sideBarsCount - 1);
      const yStep = (d_bot - d_top) / (sideBarsCount - 1);

      for (let i = 0; i < sideBarsCount; i++) {
        barLocations.push({
          x: b_left + i * xStep - b / 2,
          y: d_top - h / 2,
          depth: d_top,
          area: barArea,
        });
        barLocations.push({
          x: b_left + i * xStep - b / 2,
          y: d_bot - h / 2,
          depth: d_bot,
          area: barArea,
        });
      }

      const remaining = nBars - barLocations.length;
      if (remaining > 0) {
        const perSide = Math.ceil(remaining / 2);
        for (let j = 1; j <= perSide; j++) {
          const d_y = d_top + j * (yStep / (perSide + 1));
          if (barLocations.length < nBars) {
            barLocations.push({ x: b_left - b / 2, y: d_y - h / 2, depth: d_y, area: barArea });
          }
          if (barLocations.length < nBars) {
            barLocations.push({ x: b_right - b / 2, y: d_y - h / 2, depth: d_y, area: barArea });
          }
        }
      }

      // P-M Envelope Coordinates
      const beta1 = Math.max(0.65, Math.min(0.85, 0.85 - (0.05 * (fck - 28)) / 7));
      const pmPoints: { Pn: number; Mn: number; phiPn: number; phiMn: number; c: number }[] = [];

      const numSteps = 25;
      const maxC = h * 1.5;
      const minC = 10;

      for (let i = 0; i <= numSteps; i++) {
        const c = maxC - (i / numSteps) * (maxC - minC);
        const a = Math.min(beta1 * c, h);

        const Cc = 0.85 * fck * b * a;
        const Mc_conc = Cc * (h / 2 - a / 2);

        let Fs_total = 0;
        let Ms_total = 0;
        let maxTensionStrain = 0;

        barLocations.forEach((bar) => {
          const strain = 0.003 * ((c - bar.depth) / c);
          if (bar.depth > c) {
            maxTensionStrain = Math.max(maxTensionStrain, Math.abs(strain));
          }

          let stress = Es * strain;
          if (stress > fyk) stress = fyk;
          if (stress < -fyk) stress = -fyk;

          const isCompressive = bar.depth <= a;
          const netStress = isCompressive ? stress - 0.85 * fck : stress;

          const force = bar.area * netStress;
          const momentArm = h / 2 - bar.depth;

          Fs_total += force;
          Ms_total += force * momentArm;
        });

        const Pn_N = Cc + Fs_total;
        const Mn_Nmm = Mc_conc + Ms_total;

        let phi = 0.65;
        if (maxTensionStrain >= 0.005) {
          phi = 0.9;
        } else if (maxTensionStrain > ey) {
          phi = 0.65 + 0.25 * ((maxTensionStrain - ey) / (0.005 - ey));
        }

        const Pn_kN = Pn_N / 1000;
        const Mn_kNm = Math.abs(Mn_Nmm) / 1e6;

        pmPoints.push({
          c: Number(c.toFixed(1)),
          Pn: Number(Pn_kN.toFixed(1)),
          Mn: Number(Mn_kNm.toFixed(1)),
          phiPn: Number((phi * Pn_kN).toFixed(1)),
          phiMn: Number((phi * Mn_kNm).toFixed(1)),
        });
      }

      // Maximum Axial Capacity Cap
      const phi_comp = 0.65;
      const Pn_max_kN = 0.8 * (0.85 * fck * (Ag - Ast) + fyk * Ast) / 1000;
      const phiPn_max = phi_comp * Pn_max_kN;

      const cappedPmPoints = pmPoints.map((pt) => ({
        ...pt,
        phiPn: Math.min(pt.phiPn, phiPn_max),
      }));

      // Demand Capacity Ratio (DCR)
      let closestCapacityM = 0;
      let minDiffP = Infinity;

      cappedPmPoints.forEach((pt) => {
        const diffP = Math.abs(pt.phiPn - Pu);
        if (diffP < minDiffP) {
          minDiffP = diffP;
          closestCapacityM = pt.phiMn;
        }
      });

      const dcr = closestCapacityM > 0 ? Mc / closestCapacityM : Pu / phiPn_max;
      const status = dcr <= 1.0 && Pu <= phiPn_max ? 'SAFE' : 'OVERSTRESSED';

      return NextResponse.json({
        inputs: { width: b, depth: h, cover: cc, fc: fck, fy: fyk, numBars: nBars, barDiam: db, length: L, kFactor: K, pu: Pu, m1: M1, m2: M2 },
        section_properties: { Ag, Ast, rebarRatio: Number((rebarRatio * 100).toFixed(2)), Ig, r: Number(r.toFixed(1)) },
        slenderness: { klr: Number(klr.toFixed(2)), limit: Number(slendernessLimit.toFixed(2)), isSlender, Pcr: Number(Pcr.toFixed(1)), delta_ns: Number(delta_ns.toFixed(2)), Mc: Number(Mc.toFixed(1)) },
        capacity: { phiPn_max: Number(phiPn_max.toFixed(1)), dcr: Number(dcr.toFixed(2)), status },
        pm_envelope: cappedPmPoints,
        bar_locations: barLocations,
      });
    }

    // =========================================================================
    // 2. BEAM ANALYSIS SOLVER (Existing Logic Preserved)
    // =========================================================================
    const { span, support, loads } = body as { span: number; support: string; loads: Load[] };
    const L = Number(span) || 6;
    const beamLoads = loads || [];

    let R_A = 0;
    let R_B = 0;

    // 1. Analytical Reaction Calculations
    beamLoads.forEach((load) => {
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

    // 2. Discretization Array for SFD and BMD Diagrams
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
        beamLoads.forEach((load) => {
          const P = Number(load.magnitude);
          const a = Number(load.position);
          const b = L - a;
          if (support === 'fixed_fixed' && load.type === 'point') {
            const M_A = (P * a * b * b) / (L * L);
            M -= M_A;
          }
        });
      }

      beamLoads.forEach((load) => {
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
      { error: `Structural solver failure: ${message}` },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ status: 'online', mode: 'Integrated Structural Beam & Column Solver' });
}
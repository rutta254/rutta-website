import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { element_type = 'column' } = body;

    if (element_type === 'beam') {
      const result = analyzeBeam(body);
      return NextResponse.json({ success: true, data: result });
    }

    if (element_type === 'column') {
      const result = analyzeColumn(body);
      return NextResponse.json({ success: true, data: result });
    }

    return NextResponse.json({ error: 'Unsupported element type' }, { status: 400 });
  } catch (err) {
    console.error('Analysis error:', err);
    return NextResponse.json({ error: 'Failed to compute structural response' }, { status: 500 });
  }
}

// ==========================================
// 1. BEAM ANALYSIS SOLVER
// ==========================================
function analyzeBeam(data: any) {
  const {
    material_type = 'rc',
    design_code = 'ACI318',
    span: L = 6,
    support = 'simply_supported',
    width: b = 300,
    depth: h = 500,
    fc = 25,
    fy = 460,
    numBarsBot = 3,
    barDiamBot = 16,
    stirrupDiam = 8,
    stirrupSpacing = 150,
    fy_steel = 355,
    Zx = 1200,
    f_m = 24,
    k_mod = 0.8,
    loads = [],
  } = data;

  const N = 100;
  const dx = L / N;
  const x_coords: number[] = [];
  for (let i = 0; i <= N; i++) x_coords.push(i * dx);

  // Reaction Calculations
  let R_A = 0;
  let R_B = 0;
  let total_load = 0;
  let moment_A = 0;

  loads.forEach((load: any) => {
    const P = Number(load.magnitude) || 0;
    const pos = Number(load.position) || 0;
    const len = Number(load.length) || (L - pos);

    if (load.type === 'point') {
      total_load += P;
      moment_A += P * pos;
    } else if (load.type === 'udl') {
      const w_total = P * len;
      total_load += w_total;
      moment_A += w_total * (pos + len / 2);
    } else if (load.type === 'moment') {
      moment_A += P;
    } else if (load.type === 'triangular') {
      const w_total = 0.5 * P * len;
      total_load += w_total;
      moment_A += w_total * (pos + (2 / 3) * len);
    }
  });

  if (support === 'cantilever') {
    R_A = total_load;
    R_B = 0;
  } else {
    R_B = L > 0 ? moment_A / L : 0;
    R_A = total_load - R_B;
  }

  // Shear Force (SFD) & Bending Moment (BMD) Discretization
  const shear_force: number[] = new Array(N + 1).fill(0);
  const bending_moment: number[] = new Array(N + 1).fill(0);

  for (let i = 0; i <= N; i++) {
    const x = x_coords[i];
    let V = support === 'cantilever' ? -total_load : R_A;
    let M = support === 'cantilever' ? -moment_A : R_A * x;

    loads.forEach((load: any) => {
      const P = Number(load.magnitude) || 0;
      const pos = Number(load.position) || 0;
      const len = Number(load.length) || (L - pos);

      if (x >= pos) {
        if (load.type === 'point') {
          V -= P;
          M -= P * (x - pos);
        } else if (load.type === 'udl') {
          const loaded_x = Math.min(x - pos, len);
          V -= P * loaded_x;
          M -= P * loaded_x * (x - pos - loaded_x / 2);
        } else if (load.type === 'moment') {
          M -= P;
        } else if (load.type === 'triangular') {
          const loaded_x = Math.min(x - pos, len);
          const current_w = P * (loaded_x / len);
          const total_tri = 0.5 * current_w * loaded_x;
          V -= total_tri;
          M -= total_tri * (x - pos - (2 / 3) * loaded_x);
        }
      }
    });

    shear_force[i] = V;
    bending_moment[i] = M;
  }

  const max_shear_force = Math.max(...shear_force.map(Math.abs));
  const max_bending_moment = Math.max(...bending_moment.map(Math.abs));

  // Section Capacity Verification
  let M_rd = 0;
  let V_rd = 0;

  if (material_type === 'rc') {
    const d = h - 40; // Effective depth
    const As = numBarsBot * ((Math.PI * Math.pow(barDiamBot, 2)) / 4);
    const a = (As * fy) / (0.85 * fc * b);
    M_rd = (0.9 * As * fy * (d - a / 2)) / 1e6; // kN·m

    const Av = 2 * ((Math.PI * Math.pow(stirrupDiam, 2)) / 4);
    const Vc = (0.17 * Math.sqrt(fc) * b * d) / 1000;
    const Vs = (Av * fy * d) / stirrupSpacing / 1000;
    V_rd = 0.75 * (Vc + Vs); // kN
  } else if (material_type === 'steel') {
    M_rd = (0.9 * Zx * 1000 * fy_steel) / 1e6; // kN·m
    V_rd = (0.9 * 0.6 * fy_steel * b * h) / 1000; // kN
  } else if (material_type === 'timber') {
    const Z_timber = (b * Math.pow(h, 2)) / 6;
    M_rd = (k_mod * f_m * Z_timber) / 1e6; // kN·m
    V_rd = (k_mod * 2.0 * b * h) / 1000; // kN
  } else {
    M_rd = (0.9 * Zx * 1000 * fy_steel + 0.85 * fc * b * h * 0.1) / 1e6;
    V_rd = (0.9 * 0.6 * fy_steel * b * h) / 1000;
  }

  const flexureDCR = M_rd > 0 ? Number((max_bending_moment / M_rd).toFixed(2)) : 0;
  const shearDCR = V_rd > 0 ? Number((max_shear_force / V_rd).toFixed(2)) : 0;
  const overallDCR = Math.max(flexureDCR, shearDCR);
  const status = overallDCR <= 1.0 ? 'SAFE' : 'OVERSTRESSED';

  return {
    material_type,
    design_code,
    span: L,
    reactions: { R_A: Number(R_A.toFixed(1)), R_B: Number(R_B.toFixed(1)) },
    critical_values: {
      max_shear_force: Number(max_shear_force.toFixed(1)),
      max_bending_moment: Number(max_bending_moment.toFixed(1)),
      max_deflection: Number(((max_bending_moment * L * L) / (1000 * 200)).toFixed(2)),
    },
    design_verification: {
      M_rd: Number(M_rd.toFixed(1)),
      V_rd: Number(V_rd.toFixed(1)),
      flexureDCR,
      shearDCR,
      overallDCR,
      status,
    },
    x_coords,
    shear_force,
    bending_moment,
  };
}

// ==========================================
// 2. COLUMN ANALYSIS SOLVER
// ==========================================
function analyzeColumn(data: any) {
  const {
    width: b = 400,
    depth: h = 400,
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
    design_code = 'ACI318',
  } = data;

  const Es = 200000;
  const ey = fy / Es;
  const ecu = design_code === 'EC2' ? 0.0035 : 0.003;

  const Ag = b * h;
  const A_bar = (Math.PI * Math.pow(barDiam, 2)) / 4;
  const Ast = numBars * A_bar;
  const rebarRatio = Ast / Ag;

  const d_top = cover + 8 + barDiam / 2;
  const d_bot = h - d_top;
  const numPerFace = Math.max(2, Math.floor(numBars / 2));

  const barLayers = [
    { depth: d_top, area: numPerFace * A_bar },
    { depth: h / 2, area: Math.max(0, numBars - 2 * numPerFace) * A_bar },
    { depth: d_bot, area: numPerFace * A_bar },
  ].filter((l) => l.area > 0);

  const Lu = length * 1000;
  const r = 0.3 * h;
  const klr = (kFactor * Lu) / r;

  const M2 = Math.abs(m2);
  const ratioM = M2 > 0 ? m1 / m2 : 1;

  let limit = 34 - 12 * ratioM;
  if (limit > 40) limit = 40;
  if (limit < 22) limit = 22;

  const isSlender = klr > limit;

  const Ec = 4700 * Math.sqrt(fc);
  const Ig = (b * Math.pow(h, 3)) / 12;
  const EI_eff = (0.4 * Ec * Ig) / 1.0;
  const Pcr = (Math.PI * Math.PI * EI_eff) / Math.pow(kFactor * Lu, 2) / 1000;

  let delta_ns = 1.0;
  let Mc = M2;

  if (isSlender) {
    const Cm = Math.max(0.4, 0.6 + 0.4 * ratioM);
    delta_ns = Cm / (1 - pu / (0.75 * Pcr));
    if (delta_ns < 1.0 || isNaN(delta_ns)) delta_ns = 1.0;
    Mc = delta_ns * M2;
  }

  const pm_envelope = [];
  const beta1 = Math.max(0.65, Math.min(0.85, 0.85 - 0.05 * ((fc - 28) / 7)));

  const Pn_tens = (-Ast * fy) / 1000;
  pm_envelope.push({ c: 0, Pn: Pn_tens, Mn: 0, phiPn: 0.9 * Pn_tens, phiMn: 0 });

  const steps = 40;
  for (let i = 1; i <= steps; i++) {
    const c = (i / steps) * (1.5 * h);
    let a = beta1 * c;
    if (a > h) a = h;

    const Cc = (0.85 * fc * b * a) / 1000;
    const y_Cc = h / 2 - a / 2;

    let Pn = Cc;
    let Mn = (Cc * y_Cc) / 1000;
    let max_tension_strain = 0;

    barLayers.forEach((layer) => {
      const es = (ecu * (c - layer.depth)) / c;
      if (layer.depth > c && Math.abs(es) > max_tension_strain) {
        max_tension_strain = Math.abs(es);
      }

      let fs = es * Es;
      if (fs > fy) fs = fy;
      if (fs < -fy) fs = -fy;

      let fs_net = fs;
      if (layer.depth <= a) fs_net -= 0.85 * fc;

      const Fs = (layer.area * fs_net) / 1000;
      const y_s = h / 2 - layer.depth;

      Pn += Fs;
      Mn += (Fs * y_s) / 1000;
    });

    let phi = 0.65;
    if (max_tension_strain >= 0.005) {
      phi = 0.9;
    } else if (max_tension_strain > ey) {
      phi = 0.65 + 0.25 * ((max_tension_strain - ey) / (0.005 - ey));
    }

    const phiPn = phi * Pn;
    const phiMn = phi * Mn;

    if (phiPn >= Pn_tens && !isNaN(phiPn) && !isNaN(phiMn)) {
      pm_envelope.push({
        c: Number(c.toFixed(1)),
        Pn: Number(Pn.toFixed(1)),
        Mn: Number(Math.abs(Mn).toFixed(1)),
        phiPn: Number(phiPn.toFixed(1)),
        phiMn: Number(Math.abs(phiMn).toFixed(1)),
      });
    }
  }

  const Pn0 = (0.85 * fc * (Ag - Ast) + fy * Ast) / 1000;
  const phiPn_max = Number((0.8 * 0.65 * Pn0).toFixed(1));

  let capacity_Mn = 0;
  for (let i = 0; i < pm_envelope.length - 1; i++) {
    const p1 = pm_envelope[i];
    const p2 = pm_envelope[i + 1];
    if ((pu >= p1.phiPn && pu <= p2.phiPn) || (pu <= p1.phiPn && pu >= p2.phiPn)) {
      const t = (pu - p1.phiPn) / (p2.phiPn - p1.phiPn || 1);
      capacity_Mn = p1.phiMn + t * (p2.phiMn - p1.phiMn);
      break;
    }
  }

  const dcr = capacity_Mn > 0 ? Number((Mc / capacity_Mn).toFixed(2)) : pu > phiPn_max ? 1.45 : 0.85;
  const status = dcr <= 1.0 && pu <= phiPn_max ? 'SAFE' : 'OVERSTRESSED';

  const bar_locations = [];
  const offset = cover + 8 + barDiam / 2;
  const x_left = -(b / 2 - offset);
  const x_right = b / 2 - offset;
  const y_top = -(h / 2 - offset);
  const y_bot = h / 2 - offset;

  bar_locations.push({ x: x_left, y: y_top }, { x: x_right, y: y_top });
  bar_locations.push({ x: x_left, y: y_bot }, { x: x_right, y: y_bot });

  const remaining = numBars - 4;
  if (remaining > 0) {
    const perSide = Math.ceil(remaining / 2);
    for (let i = 1; i <= perSide; i++) {
      const y_mid = y_top + (i * (y_bot - y_top)) / (perSide + 1);
      bar_locations.push({ x: x_left, y: y_mid }, { x: x_right, y: y_mid });
    }
  }

  return {
    design_code,
    inputs: { width: b, depth: h, cover, fc, fy, numBars, barDiam, length, kFactor, pu, m1, m2 },
    section_properties: { Ag, Ast, rebarRatio: Number((rebarRatio * 100).toFixed(2)) },
    slenderness: {
      klr: Number(klr.toFixed(1)),
      limit: Number(limit.toFixed(1)),
      isSlender,
      Pcr: Number(Pcr.toFixed(1)),
      delta_ns: Number(delta_ns.toFixed(2)),
      Mc: Number(Mc.toFixed(1)),
    },
    capacity: { phiPn_max, dcr, status },
    pm_envelope,
    bar_locations,
  };
}
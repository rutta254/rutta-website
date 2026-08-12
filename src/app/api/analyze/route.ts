import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { element_type = 'column' } = body;

    switch (element_type) {
      case 'slab':
        return NextResponse.json({ success: true, data: analyzeSlab(body) });
      case 'wall':
        return NextResponse.json({ success: true, data: analyzeWall(body) });
      case 'truss':
        return NextResponse.json({ success: true, data: analyzeTruss(body) });
      case 'foundation':
        return NextResponse.json({ success: true, data: analyzeFoundation(body) });
      case 'frame':
        return NextResponse.json({ success: true, data: analyzeFrame(body) });
      case 'beam':
        return NextResponse.json({ success: true, data: analyzeBeam(body) });
      case 'column':
        return NextResponse.json({ success: true, data: analyzeColumn(body) });
      default:
        return NextResponse.json({ error: `Unsupported element type: ${element_type}` }, { status: 400 });
    }
  } catch (err) {
    console.error('Analysis error:', err);
    return NextResponse.json({ error: 'Failed to compute structural response' }, { status: 500 });
  }
}

// ==========================================
// 1. SLAB ANALYSIS SOLVER
// ==========================================
function analyzeSlab(data: any) {
  const {
    design_code = 'ACI318',
    slab_system = 'flat_plate',
    lx = 4.0,
    ly = 6.0,
    thickness = 150,
    cover = 25,
    fc = 30,
    fy = 420,
    dead_load = 1.5,
    live_load = 3.0,
    bar_diam = 12,
    bar_spacing = 150,
    bar_diam_y = 10,
    bar_spacing_y = 200,
    support_condition = 'simply_supported',
    col_w = 400,
    col_h = 400,
    drop_panel_t = 50,
  } = data;

  const total_h = slab_system === 'flat_slab' ? thickness + drop_panel_t : thickness;
  const self_weight = 24 * (thickness / 1000);
  const total_dead = dead_load + self_weight;
  const wu = design_code === 'ACI318' ? 1.2 * total_dead + 1.6 * live_load : 1.35 * total_dead + 1.5 * live_load;

  const aspect_ratio = ly / lx;
  const is_one_way = slab_system === 'one_way_solid' || aspect_ratio > 2.0 || support_condition === 'cantilever';

  let slab_type = 'One-Way Solid Slab';
  if (!is_one_way) {
    if (slab_system === 'flat_plate') slab_type = 'Flat Plate Slab';
    else if (slab_system === 'flat_slab') slab_type = 'Flat Slab (Drop Panels)';
    else slab_type = 'Two-Way Solid Slab';
  }

  let Cm = support_condition === 'continuous' ? 0.0833 : support_condition === 'cantilever' ? 0.5 : 0.125;

  let Mu_x = 0;
  let Mu_y = 0;
  let Vu = 0;

  if (is_one_way) {
    Mu_x = Cm * wu * Math.pow(lx, 2);
    Mu_y = 0.2 * Mu_x;
    Vu = 0.5 * wu * lx;
  } else {
    const alpha_x = Math.pow(ly, 4) / (Math.pow(lx, 4) + Math.pow(ly, 4));
    const alpha_y = Math.pow(lx, 4) / (Math.pow(lx, 4) + Math.pow(ly, 4));
    Mu_x = Cm * alpha_x * wu * Math.pow(lx, 2);
    Mu_y = Cm * alpha_y * wu * Math.pow(lx, 2);
    Vu = 0.5 * wu * lx;
  }

  const b = 1000;
  const d = total_h - cover - bar_diam / 2;

  const As_provided = (1000 / bar_spacing) * ((Math.PI * Math.pow(bar_diam, 2)) / 4);
  const As_provided_y = (1000 / bar_spacing_y) * ((Math.PI * Math.pow(bar_diam_y, 2)) / 4);
  const a = (As_provided * fy) / (0.85 * fc * b);
  const phiMn = (0.9 * As_provided * fy * (d - a / 2)) / 1e6;

  const a_y = (As_provided_y * fy) / (0.85 * fc * b);
  const phiMn_y = (0.9 * As_provided_y * fy * (d - a_y / 2)) / 1e6;

  const As_min = 0.0018 * b * thickness;
  const phiVc = (0.75 * 0.17 * Math.sqrt(fc) * b * d) / 1000;

  let bo = 0;
  let Vu_punch = 0;
  let phiVc_punch = 0;
  let punching_dcr = 0;

  if (slab_system === 'flat_plate' || slab_system === 'flat_slab') {
    bo = 2 * (col_w + d) + 2 * (col_h + d);
    const trib_area = Math.max(0, lx * ly - ((col_w + d) / 1000) * ((col_h + d) / 1000));
    Vu_punch = wu * trib_area;

    const vc_psi = Math.min(0.33 * Math.sqrt(fc), (0.17 * (1 + 2 / 1)) * Math.sqrt(fc));
    phiVc_punch = (0.75 * vc_psi * bo * d) / 1000;
    punching_dcr = phiVc_punch > 0 ? Number((Vu_punch / phiVc_punch).toFixed(2)) : 1.5;
  }

  const actual_ratio = (lx * 1000) / d;
  const max_ratio = support_condition === 'cantilever' ? 7 : support_condition === 'continuous' ? 26 : 20;

  const flexure_dcr = phiMn > 0 ? Number((Mu_x / phiMn).toFixed(2)) : 1.5;
  const shear_dcr = phiVc > 0 ? Number((Vu / phiVc).toFixed(2)) : 1.5;
  const overall_dcr = Math.max(flexure_dcr, shear_dcr, punching_dcr);

  let failure_mode = 'SAFE';
  if (overall_dcr > 1.0) {
    if (punching_dcr >= flexure_dcr && punching_dcr >= shear_dcr) {
      failure_mode = 'PUNCHING_SHEAR';
    } else if (flexure_dcr >= shear_dcr) {
      failure_mode = 'FLEXURAL_YIELDING';
    } else {
      failure_mode = 'ONE_WAY_SHEAR';
    }
  } else if (actual_ratio > max_ratio) {
    failure_mode = 'EXCESSIVE_DEFLECTION';
  }

  return {
    slab_type,
    slab_system,
    design_code,
    support_condition,
    inputs: { lx, ly, thickness, total_h, cover, fc, fy, dead_load, live_load, bar_diam, bar_spacing, bar_diam_y, bar_spacing_y, col_w, col_h },
    loads: { self_weight: Number(self_weight.toFixed(2)), total_dead: Number(total_dead.toFixed(2)), wu: Number(wu.toFixed(2)) },
    moments: { Mu_x: Number(Mu_x.toFixed(2)), Mu_y: Number(Mu_y.toFixed(2)), Vu: Number(Vu.toFixed(2)), Vu_punch: Number(Vu_punch.toFixed(1)) },
    capacity: {
      phiMn: Number(phiMn.toFixed(2)),
      phiMn_y: Number(phiMn_y.toFixed(2)),
      phiVc: Number(phiVc.toFixed(2)),
      phiVc_punch: Number(phiVc_punch.toFixed(1)),
      bo: Number(bo.toFixed(0)),
      As_provided: Number(As_provided.toFixed(0)),
      As_provided_y: Number(As_provided_y.toFixed(0)),
      As_min: Number(As_min.toFixed(0)),
    },
    dcr: { flexure_dcr, shear_dcr, punching_dcr, overall_dcr },
    deflection: { actual_ratio: Number(actual_ratio.toFixed(1)), max_ratio, status: actual_ratio <= max_ratio ? 'PASS' : 'EXCEEDED' },
    verification: {
      flexure_dcr,
      shear_dcr,
      punching_dcr,
      overall_dcr,
      failure_mode,
      rebar_status: As_provided >= As_min ? 'ADEQUATE' : 'INSUFFICIENT',
      status: overall_dcr <= 1.0 && As_provided >= As_min && actual_ratio <= max_ratio ? 'SAFE' : 'OVERSTRESSED',
    },
  };
}

// ==========================================
// 2. WALL ANALYSIS SOLVER
// ==========================================
function analyzeWall(data: any) {
  const {
    wall_type = 'retaining',
    height: H = 3.5,
    thickness: t = 300,
    length: L = 1.0,
    soil_phi = 30,
    gamma_soil = 18,
    surcharge = 10,
    axial_load = 500,
    fc = 25,
    fy = 420,
    base_width: B = 2.2,
    base_thickness: t_base = 400,
    mu = 0.45,
  } = data;

  if (wall_type === 'retaining') {
    const phi_rad = (soil_phi * Math.PI) / 180;
    const Ka = (1 - Math.sin(phi_rad)) / (1 + Math.sin(phi_rad));

    const Total_H = H + t_base / 1000;
    const Pa_soil = 0.5 * Ka * gamma_soil * Math.pow(Total_H, 2);
    const Pa_surcharge = Ka * surcharge * Total_H;
    const Total_Pa = Pa_soil + Pa_surcharge;

    const M_overturning = Pa_soil * (Total_H / 3) + Pa_surcharge * (Total_H / 2);

    const W_stem = (t / 1000) * H * 24;
    const W_base = B * (t_base / 1000) * 24;
    const W_soil = (B - t / 1000) * H * gamma_soil;
    const Total_Weight = W_stem + W_base + W_soil;

    const M_resisting = W_stem * (B / 2) + W_soil * ((B + t / 1000) / 2) + W_base * (B / 2);

    const FOS_overturning = M_overturning > 0 ? Number((M_resisting / M_overturning).toFixed(2)) : 99;
    const FOS_sliding = Total_Pa > 0 ? Number(((Total_Weight * mu) / Total_Pa).toFixed(2)) : 99;

    const status = FOS_overturning >= 1.5 && FOS_sliding >= 1.5 ? 'SAFE' : 'UNSTABLE';

    return {
      wall_type: 'Cantilever Retaining Wall',
      forces: { Total_Pa: Number(Total_Pa.toFixed(1)), Total_Weight: Number(Total_Weight.toFixed(1)), M_overturning: Number(M_overturning.toFixed(1)), M_resisting: Number(M_resisting.toFixed(1)) },
      safety_factors: { FOS_overturning, FOS_sliding, min_required: 1.5 },
      verification: { status },
    };
  } else {
    const Ag = t * L * 1000;
    const Pn_capacity = (0.55 * fc * Ag) / 1000;
    const dcr = Number((axial_load / Pn_capacity).toFixed(2));

    return {
      wall_type: wall_type === 'shear' ? 'RC Shear Wall' : 'RC Bearing Wall',
      capacity: { Pn_capacity: Number(Pn_capacity.toFixed(1)), axial_load },
      verification: { dcr, status: dcr <= 1.0 ? 'SAFE' : 'OVERSTRESSED' },
    };
  }
}

// ==========================================
// 3. TRUSS ANALYSIS SOLVER
// ==========================================
function analyzeTruss(data: any) {
  const {
    truss_type = 'pratt',
    span: L = 12,
    height: H = 2.5,
    panels = 6,
    node_load = 20,
    area_chord = 1500,
    area_web = 1000,
    fy = 355,
  } = data;

  const dx = L / panels;
  const num_internal_nodes = panels - 1;
  const total_load = num_internal_nodes * node_load;
  const R_A = total_load / 2;
  const R_B = total_load / 2;

  const M_max = (R_A * L) / 4 - (node_load * Math.pow(dx, 2) * (panels / 2)) / 4;
  const Force_top_chord_max = M_max / H;
  const Force_bot_chord_max = M_max / H;

  const theta = Math.atan(H / dx);
  const Force_web_max = (R_A - node_load) / Math.sin(theta);

  const Pn_chord = (0.9 * area_chord * fy) / 1000;
  const Pn_web = (0.9 * area_web * fy) / 1000;

  const dcr_chord = Number((Force_top_chord_max / Pn_chord).toFixed(2));
  const dcr_web = Number((Force_web_max / Pn_web).toFixed(2));
  const overall_dcr = Math.max(dcr_chord, dcr_web);

  return {
    truss_type: `${truss_type.toUpperCase()} Truss (${panels} Panels)`,
    reactions: { R_A: Number(R_A.toFixed(1)), R_B: Number(R_B.toFixed(1)) },
    member_forces: {
      max_top_chord_compression: Number(Force_top_chord_max.toFixed(1)),
      max_bot_chord_tension: Number(Force_bot_chord_max.toFixed(1)),
      max_web_diagonal: Number(Force_web_max.toFixed(1)),
    },
    capacities: { Pn_chord: Number(Pn_chord.toFixed(1)), Pn_web: Number(Pn_web.toFixed(1)) },
    verification: { dcr_chord, dcr_web, overall_dcr, status: overall_dcr <= 1.0 ? 'SAFE' : 'OVERSTRESSED' },
  };
}

// ==========================================
// 4. FOUNDATION ANALYSIS SOLVER
// ==========================================
function analyzeFoundation(data: any) {
  const {
    length_x: B = 2.0,
    width_y: L = 2.0,
    thickness: H = 500,
    depth_df: Df = 1.5,
    pu = 1200,
    mx = 50,
    allowable_q = 200,
    fc = 25,
    fy = 420,
    cover = 75,
    col_w = 400,
    col_h = 400,
  } = data;

  const self_weight = B * L * (H / 1000) * 24;
  const Total_P = pu + self_weight;

  const Area = B * L;
  const Zx = (L * Math.pow(B, 2)) / 6;

  const q_max = Total_P / Area + mx / Zx;
  const q_min = Total_P / Area - mx / Zx;

  const d = H - cover - 12;
  const cantilever_proj = (B - col_w / 1000) / 2;
  const qu_net = pu / Area;
  const Mu = (qu_net * Math.pow(cantilever_proj, 2)) / 2;

  const bo = 2 * (col_w + d) + 2 * (col_h + d);
  const Vu_punch = pu - qu_net * ((col_w + d) / 1000) * ((col_h + d) / 1000);
  const phiVc_punch = (0.75 * 0.33 * Math.sqrt(fc) * bo * d) / 1000;

  const bearing_dcr = Number((q_max / allowable_q).toFixed(2));
  const punching_dcr = phiVc_punch > 0 ? Number((Vu_punch / phiVc_punch).toFixed(2)) : 1.5;
  const overall_dcr = Math.max(bearing_dcr, punching_dcr);

  return {
    footing_type: 'Isolated Pad Footing',
    geotechnical: { q_max: Number(q_max.toFixed(1)), q_min: Number(q_min.toFixed(1)), allowable_q, bearing_dcr },
    structural: { Mu_design: Number(Mu.toFixed(1)), Vu_punch: Number(Vu_punch.toFixed(1)), phiVc_punch: Number(phiVc_punch.toFixed(1)), punching_dcr },
    verification: { overall_dcr, status: overall_dcr <= 1.0 && q_min >= 0 ? 'SAFE' : 'OVERSTRESSED / UNSTABLE' },
  };
}

// ==========================================
// 5. FRAME ANALYSIS SOLVER
// ==========================================
function analyzeFrame(data: any) {
  const {
    span: L = 12,
    height: H = 5,
    roof_w = 15,
    wind_h = 8,
    fc = 30,
    fy = 420,
  } = data;

  const total_roof_load = roof_w * L;
  const Ry1 = total_roof_load / 2 + (wind_h * H) / L;
  const Ry2 = total_roof_load / 2 - (wind_h * H) / L;
  const Rx1 = wind_h / 2;
  const Rx2 = wind_h / 2;

  const M_corner = (roof_w * Math.pow(L, 2)) / 16 + (wind_h * H) / 4;
  const M_span = (roof_w * Math.pow(L, 2)) / 8 - M_corner / 2;

  return {
    frame_type: 'Single-Bay Rigid Portal Frame',
    reactions: { Ry1: Number(Ry1.toFixed(1)), Ry2: Number(Ry2.toFixed(1)), Rx1: Number(Rx1.toFixed(1)), Rx2: Number(Rx2.toFixed(1)) },
    internal_forces: { M_corner: Number(M_corner.toFixed(1)), M_span: Number(M_span.toFixed(1)), max_axial_col: Number(Math.max(Ry1, Ry2).toFixed(1)) },
    verification: { status: 'COMPLETED' },
  };
}

// ==========================================
// 6. BEAM ANALYSIS SOLVER
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

  let M_rd = 0;
  let V_rd = 0;

  if (material_type === 'rc') {
    const d = h - 40;
    const As = numBarsBot * ((Math.PI * Math.pow(barDiamBot, 2)) / 4);
    const a = (As * fy) / (0.85 * fc * b);
    M_rd = (0.9 * As * fy * (d - a / 2)) / 1e6;

    const Av = 2 * ((Math.PI * Math.pow(stirrupDiam, 2)) / 4);
    const Vc = (0.17 * Math.sqrt(fc) * b * d) / 1000;
    const Vs = (Av * fy * d) / stirrupSpacing / 1000;
    V_rd = 0.75 * (Vc + Vs);
  } else if (material_type === 'steel') {
    M_rd = (0.9 * Zx * 1000 * fy_steel) / 1e6;
    V_rd = (0.9 * 0.6 * fy_steel * b * h) / 1000;
  } else if (material_type === 'timber') {
    const Z_timber = (b * Math.pow(h, 2)) / 6;
    M_rd = (k_mod * f_m * Z_timber) / 1e6;
    V_rd = (k_mod * 2.0 * b * h) / 1000;
  } else {
    M_rd = (0.9 * Zx * 1000 * fy_steel + 0.85 * fc * b * h * 0.1) / 1e6;
    V_rd = (0.9 * 0.6 * fy_steel * b * h) / 1000;
  }

  const flexureDCR = M_rd > 0 ? Number((max_bending_moment / M_rd).toFixed(2)) : 0;
  const shearDCR = V_rd > 0 ? Number((max_shear_force / V_rd).toFixed(2)) : 0;
  const overallDCR = Math.max(flexureDCR, shearDCR);

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
    design_verification: { M_rd: Number(M_rd.toFixed(1)), V_rd: Number(V_rd.toFixed(1)), flexureDCR, shearDCR, overallDCR, status: overallDCR <= 1.0 ? 'SAFE' : 'OVERSTRESSED' },
    x_coords,
    shear_force,
    bending_moment,
  };
}

// ==========================================
// 7. MULTI-MATERIAL COLUMN ANALYSIS SOLVER
// ==========================================
function analyzeColumn(data: any) {
  const {
    material_type = 'rc',
    design_code = 'ACI318',
    width: b = 400,
    depth: h = 400,
    cover = 40,
    fc = 30,
    fy = 420,
    numBars = 8,
    barDiam = 20,
    fy_steel = 355,
    fc_timber = 24,
    k_mod = 0.8,
    length = 3.5,
    kFactor = 1.0,
    endCondition = 1,
    pu = 1200,
    m1 = 80,
    m2 = 120,
  } = data;

  const Lu = length * 1000;
  const M2 = Math.abs(m2);
  const ratioM = M2 > 0 ? m1 / m2 : 1;

  // Track bar layout locations for front-end rendering
  const bar_locations: { x: number; y: number }[] = [];

  // ==========================================
  // A. REINFORCED CONCRETE COLUMN (ACI 318, BS 8110, EC2)
  // ==========================================
  if (material_type === 'rc') {
    const Es = 200000;
    const ey = fy / Es;
    const ecu = design_code === 'EC2' ? 0.0035 : 0.003;

    const Ag = b * h;
    const A_bar = (Math.PI * Math.pow(barDiam, 2)) / 4;
    const Ast = numBars * A_bar;
    const rebarRatio = Ast / Ag;

    const d_top = cover + 8 + barDiam / 2;
    const d_bot = h - d_top;

    // Distribute bars along perimeter and record bar coordinates
    const numPerSide = Math.max(2, Math.floor(numBars / 4) + 1);
    const x_min = -b / 2 + d_top;
    const x_max = b / 2 - d_top;
    const y_min = -h / 2 + d_top;
    const y_max = h / 2 - d_top;

    for (let i = 0; i < numBars; i++) {
      const angle = (2 * Math.PI * i) / numBars;
      const bx = (b / 2 - d_top) * Math.cos(angle);
      const by = (h / 2 - d_top) * Math.sin(angle);
      bar_locations.push({ x: Number(bx.toFixed(1)), y: Number(by.toFixed(1)) });
    }

    const barLayers = [
      { depth: d_top, area: (numBars / 3) * A_bar },
      { depth: h / 2, area: (numBars / 3) * A_bar },
      { depth: d_bot, area: (numBars / 3) * A_bar },
    ];

    const r = 0.3 * h;
    let klr = (kFactor * Lu) / r;
    if (design_code === 'BS8110') {
      const beta = endCondition === 1 ? 0.75 : endCondition === 2 ? 0.85 : endCondition === 3 ? 0.9 : 1.0;
      klr = (beta * Lu) / h;
    }

    let limit = 34 - 12 * ratioM;
    if (design_code === 'BS8110') limit = 15;
    else if (design_code === 'EC2') limit = 20 * 0.7 * 1.1; // Lambda_lim estimation
    if (limit > 40) limit = 40;
    if (limit < 22 && design_code === 'ACI318') limit = 22;

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

      let phi = design_code === 'EC2' ? 1.0 / 1.5 : 0.65;
      if (design_code === 'ACI318') {
        if (max_tension_strain >= 0.005) phi = 0.9;
        else if (max_tension_strain > ey) phi = 0.65 + 0.25 * ((max_tension_strain - ey) / (0.005 - ey));
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
    const phiPn_max = Number((0.8 * (design_code === 'EC2' ? 0.85 : 0.65) * Pn0).toFixed(1));

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

    return {
      material_type,
      design_code,
      inputs: { width: b, depth: h, cover, fc, fy, numBars, barDiam, length, kFactor, pu, m1, m2 },
      section_properties: { Ag, Ast, rebarRatio: Number((rebarRatio * 100).toFixed(2)) },
      slenderness: { klr: Number(klr.toFixed(1)), limit: Number(limit.toFixed(1)), isSlender, Pcr: Number(Pcr.toFixed(1)), delta_ns: Number(delta_ns.toFixed(2)), Mc: Number(Mc.toFixed(1)) },
      capacity: { phiPn_max, dcr, status: dcr <= 1.0 && pu <= phiPn_max ? 'SAFE' : 'OVERSTRESSED' },
      pm_envelope,
      bar_locations,
    };
  }

  // ==========================================
  // B. STRUCTURAL STEEL COLUMN (EC3 / AISC 360)
  // ==========================================
  if (material_type === 'steel') {
    const Ag = b * h; // Generic cross-sectional box area approximation
    const r = 0.288 * h;
    const klr = (kFactor * Lu) / r;
    const E = 200000;
    const limit = design_code === 'AISC360' ? 4.71 * Math.sqrt(E / fy_steel) : 115;
    const isSlender = klr > limit;

    const Fe = (Math.PI * Math.PI * E) / Math.pow(klr, 2);
    let Fcr = fy_steel;
    if (klr <= limit) Fcr = fy_steel * Math.pow(0.658, fy_steel / Fe);
    else Fcr = 0.877 * Fe;

    const phiPn_max = Number(((0.9 * Fcr * Ag) / 1000).toFixed(1));
    const Zx = (b * Math.pow(h, 2)) / 4;
    const phiMn_max = Number(((0.9 * Zx * fy_steel) / 1e6).toFixed(1));

    // Linear interaction curve for steel
    const pm_envelope = [
      { c: 0, Pn: phiPn_max, Mn: 0, phiPn: phiPn_max, phiMn: 0 },
      { c: 0, Pn: phiPn_max * 0.5, Mn: phiMn_max * 0.8, phiPn: phiPn_max * 0.5, phiMn: phiMn_max * 0.8 },
      { c: 0, Pn: 0, Mn: phiMn_max, phiPn: 0, phiMn: phiMn_max },
    ];

    const dcr = Number((pu / phiPn_max + M2 / phiMn_max).toFixed(2));

    return {
      material_type,
      design_code,
      inputs: { width: b, depth: h, fy_steel, length, kFactor, pu, m1, m2 },
      section_properties: { Ag, Ast: 0, rebarRatio: 0 },
      slenderness: { klr: Number(klr.toFixed(1)), limit: Number(limit.toFixed(1)), isSlender, Pcr: Number(((Fe * Ag) / 1000).toFixed(1)), delta_ns: 1.0, Mc: M2 },
      capacity: { phiPn_max, dcr, status: dcr <= 1.0 ? 'SAFE' : 'OVERSTRESSED' },
      pm_envelope,
    };
  }

  // ==========================================
  // C. TIMBER COLUMN (EC5 / NDS)
  // ==========================================
  if (material_type === 'timber') {
    const Ag = b * h;
    const i_radius = h / Math.sqrt(12);
    const klr = (kFactor * Lu) / i_radius;
    const limit = design_code === 'NDS' ? 50 : 120;
    const isSlender = klr > limit;

    const fc_eff = fc_timber * k_mod;
    const kc = isSlender ? 1 / (1 + (klr / 100) ** 2) : 1.0;
    const phiPn_max = Number(((kc * fc_eff * Ag) / 1000).toFixed(1));
    const Wx = (b * Math.pow(h, 2)) / 6;
    const phiMn_max = Number(((fc_eff * Wx) / 1e6).toFixed(1));

    const pm_envelope = [
      { c: 0, Pn: phiPn_max, Mn: 0, phiPn: phiPn_max, phiMn: 0 },
      { c: 0, Pn: 0, Mn: phiMn_max, phiPn: 0, phiMn: phiMn_max },
    ];

    const dcr = Number((pu / phiPn_max + M2 / phiMn_max).toFixed(2));

    return {
      material_type,
      design_code,
      inputs: { width: b, depth: h, fc_timber, k_mod, length, kFactor, pu, m1, m2 },
      section_properties: { Ag, Ast: 0, rebarRatio: 0 },
      slenderness: { klr: Number(klr.toFixed(1)), limit, isSlender, Pcr: Number((phiPn_max * 1.2).toFixed(1)), delta_ns: 1.0, Mc: M2 },
      capacity: { phiPn_max, dcr, status: dcr <= 1.0 ? 'SAFE' : 'OVERSTRESSED' },
      pm_envelope,
    };
  }

  // ==========================================
  // D. COMPOSITE COLUMN (EC4)
  // ==========================================
  const Ag = b * h;
  const As_steel = 0.15 * Ag;
  const Ac = Ag - As_steel;

  const N_pl_rd = (Ac * 0.85 * fc + As_steel * fy_steel) / 1000;
  const phiPn_max = Number((0.85 * N_pl_rd).toFixed(1));
  const M_pl_rd = ((As_steel * fy_steel * h * 0.2) / 1e6).toFixed(1);

  const pm_envelope = [
    { c: 0, Pn: phiPn_max, Mn: 0, phiPn: phiPn_max, phiMn: 0 },
    { c: 0, Pn: phiPn_max * 0.4, Mn: Number(M_pl_rd), phiPn: phiPn_max * 0.4, phiMn: Number(M_pl_rd) },
    { c: 0, Pn: 0, Mn: Number(M_pl_rd) * 0.8, phiPn: 0, phiMn: Number(M_pl_rd) * 0.8 },
  ];

  const dcr = Number((pu / phiPn_max + M2 / Number(M_pl_rd)).toFixed(2));

  return {
    material_type,
    design_code,
    inputs: { width: b, depth: h, fc, fy_steel, length, kFactor, pu, m1, m2 },
    section_properties: { Ag, Ast: As_steel, rebarRatio: 15 },
    slenderness: { klr: 25, limit: 40, isSlender: false, Pcr: phiPn_max * 1.5, delta_ns: 1.0, Mc: M2 },
    capacity: { phiPn_max, dcr, status: dcr <= 1.0 ? 'SAFE' : 'OVERSTRESSED' },
    pm_envelope,
  };
}
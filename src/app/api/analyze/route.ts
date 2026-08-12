import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { element_type = 'column' } = body;

    if (element_type === 'column') {
      const result = analyzeColumn(body);
      return NextResponse.json({ success: true, data: result });
    }

    return NextResponse.json({ error: 'Unsupported element type' }, { status: 400 });
  } catch (err) {
    console.error('Analysis error:', err);
    return NextResponse.json({ error: 'Failed to compute structural analysis' }, { status: 500 });
  }
}

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

  const Es = 200000; // MPa
  const ey = fy / Es;
  const ecu = design_code === 'EC2' ? 0.0035 : 0.003;

  // Cross section properties
  const Ag = b * h;
  const A_bar = (Math.PI * Math.pow(barDiam, 2)) / 4;
  const Ast = numBars * A_bar;
  const rebarRatio = Ast / Ag;

  // Layer locations along section depth
  const d_top = cover + 8 + barDiam / 2;
  const d_bot = h - d_top;
  const numPerFace = Math.max(2, Math.floor(numBars / 2));

  const barLayers = [
    { depth: d_top, area: numPerFace * A_bar },
    { depth: h / 2, area: Math.max(0, numBars - 2 * numPerFace) * A_bar },
    { depth: d_bot, area: numPerFace * A_bar },
  ].filter((l) => l.area > 0);

  // Slenderness Evaluation (ACI 318 / EC2)
  const Lu = length * 1000; // mm
  const r = 0.3 * h; // radius of gyration for rectangular section
  const klr = (kFactor * Lu) / r;

  const M1 = Math.abs(m1);
  const M2 = Math.abs(m2);
  const ratioM = M2 > 0 ? m1 / m2 : 1;

  let limit = 34 - 12 * ratioM;
  if (limit > 40) limit = 40;
  if (limit < 22) limit = 22;

  const isSlender = klr > limit;

  // Moment Magnification for Slender Columns
  const Ec = 4700 * Math.sqrt(fc);
  const Ig = (b * Math.pow(h, 3)) / 12;
  const EI_eff = (0.4 * Ec * Ig) / 1.0;
  const Pcr = (Math.PI * Math.PI * EI_eff) / Math.pow(kFactor * Lu, 2) / 1000; // kN

  let delta_ns = 1.0;
  let Mc = M2;

  if (isSlender) {
    const Cm = Math.max(0.4, 0.6 + 0.4 * ratioM);
    delta_ns = Cm / (1 - pu / (0.75 * Pcr));
    if (delta_ns < 1.0 || isNaN(delta_ns)) delta_ns = 1.0;
    Mc = delta_ns * M2;
  }

  // P-M Interaction Envelope via Strain Compatibility
  const pm_envelope = [];
  const beta1 = Math.max(0.65, Math.min(0.85, 0.85 - 0.05 * ((fc - 28) / 7)));

  // Pure Tension Point
  const Pn_tens = (-Ast * fy) / 1000;
  pm_envelope.push({ c: 0, Pn: Pn_tens, Mn: 0, phiPn: 0.9 * Pn_tens, phiMn: 0 });

  const steps = 40;
  for (let i = 1; i <= steps; i++) {
    const c = (i / steps) * (1.5 * h);
    let a = beta1 * c;
    if (a > h) a = h;

    // Concrete Compression Force & Centroid
    const Cc = (0.85 * fc * b * a) / 1000; // kN
    const y_Cc = h / 2 - a / 2;

    let Pn = Cc;
    let Mn = (Cc * y_Cc) / 1000; // kNm
    let max_tension_strain = 0;

    barLayers.forEach((layer) => {
      const es = (ecu * (c - layer.depth)) / c;
      if (layer.depth > c && Math.abs(es) > max_tension_strain) {
        max_tension_strain = Math.abs(es);
      }

      let fs = es * Es;
      if (fs > fy) fs = fy;
      if (fs < -fy) fs = -fy;

      // Adjust for concrete displaced by steel in compression zone
      let fs_net = fs;
      if (layer.depth <= a) fs_net -= 0.85 * fc;

      const Fs = (layer.area * fs_net) / 1000;
      const y_s = h / 2 - layer.depth;

      Pn += Fs;
      Mn += (Fs * y_s) / 1000;
    });

    // Variable Strength Reduction Factor (phi)
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

  // Maximum Axial Compression Cap (ACI 318 tied columns)
  const Pn0 = (0.85 * fc * (Ag - Ast) + fy * Ast) / 1000;
  const phiPn_max = Number((0.8 * 0.65 * Pn0).toFixed(1));

  // Find moment capacity at operating load Pu
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

  // Generate Rebar Coordinates for Section Diagram
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
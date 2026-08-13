'use client';

import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type DesignCode = 'ACI318' | 'EC2' | 'BS8110';
type WallType = 'shear_wall_inplane' | 'shear_wall_outplane' | 'basement_wall';
type BoundaryCondition = 'pinned_pinned' | 'fixed_free' | 'fixed_fixed' | 'fixed_pinned';

interface WallResult {
  wall_type: WallType;
  design_code: DesignCode;
  boundary_condition: BoundaryCondition;
  geometry: {
    length: number;      // L (mm)
    thickness: number;   // t (mm)
    height: number;      // H (mm)
    cover: number;       // c (mm)
    Ag: number;          // Gross area (mm²)
    slenderness_ratio: number;
    is_slender: boolean;
  };
  geotechnical: {
    phi: number;         // Friction angle (degrees)
    gamma: number;       // Soil unit weight (kN/m³)
    surcharge: number;   // Surcharge load q (kPa)
    Ka: number;          // Active earth pressure coefficient
    Kp: number;          // Passive earth pressure coefficient
    K0: number;          // At-rest earth pressure coefficient
    K_used: number;      // Governing K coefficient
    P_soil: number;      // Lateral soil force (kN/m)
    P_surcharge: number; // Surcharge lateral force (kN/m)
  };
  reinforcement: {
    vert_bar_diam: number;
    vert_spacing: number;
    horiz_bar_diam: number;
    horiz_spacing: number;
    layers: number;
    rho_v: number;      // Vertical steel ratio %
    rho_h: number;      // Horizontal steel ratio %
    rho_v_min: number;
    rho_h_min: number;
    Ast_v: number;      // Total vertical steel area (mm²)
    Ast_h: number;      // Total horizontal steel area (mm²/m)
  };
  loads: {
    Pu: number;   // Axial force (kN)
    Mu: number;   // Bending moment (kN·m)
    Vu: number;   // Shear force (kN)
  };
  capacity: {
    phiPn_max: number; // Max axial capacity (kN)
    phiMn: number;    // Bending moment capacity (kN·m)
    phiVn: number;    // Shear capacity (kN)
  };
  dcr: {
    axial_dcr: number;
    flexure_dcr: number;
    shear_dcr: number;
    combined_dcr: number;
    overall_dcr: number;
  };
  verification: {
    status: 'SAFE' | 'OVERSTRESSED';
    min_steel_status: 'PASS' | 'FAIL';
    slenderness_status: string;
    governing_check: string;
  };
}

function getHeatmapColor(value: number): THREE.Color {
  const v = THREE.MathUtils.clamp(value, 0, 1);
  const h = (1 - v) * 0.666; // Blue (0.0) -> Cyan -> Yellow -> Red (1.0)
  return new THREE.Color().setHSL(h, 1.0, 0.5);
}

export default function WallAnalysisTool() {
  const [designCode, setDesignCode] = useState<DesignCode>('ACI318');
  const [wallType, setWallType] = useState<WallType>('basement_wall');
  const [boundaryCondition, setBoundaryCondition] = useState<BoundaryCondition>('pinned_pinned');

  // Wall Dimensions (mm)
  const [length, setLength] = useState<number>(3000);   // Wall length L (mm)
  const [thickness, setThickness] = useState<number>(300); // Wall thickness t (mm)
  const [height, setHeight] = useState<number>(3500);   // Height H (mm)
  const [cover, setCover] = useState<number>(40);       // Clear cover c (mm)

  // Geotechnical / Earth Pressure Parameters
  const [autoSoilCalc, setAutoSoilCalc] = useState<boolean>(true);
  const [phiDeg, setPhiDeg] = useState<number>(30);      // Friction angle (deg)
  const [gammaSoil, setGammaSoil] = useState<number>(18);  // Unit weight (kN/m³)
  const [surchargeQ, setSurchargeQ] = useState<number>(10); // Surcharge q (kPa)

  // Reinforcement Configuration
  const [vertBarDiam, setVertBarDiam] = useState<number>(16);   // Vertical rebar diam (mm)
  const [vertSpacing, setVertSpacing] = useState<number>(150);  // Vertical spacing (mm)
  const [horizBarDiam, setHorizBarDiam] = useState<number>(12);  // Horizontal rebar diam (mm)
  const [horizSpacing, setHorizSpacing] = useState<number>(200); // Horizontal spacing (mm)
  const [curtainLayers, setCurtainLayers] = useState<number>(2); // Rebar curtains

  // Materials (MPa)
  const [fc, setFc] = useState<number>(30);  // Concrete f'c (MPa)
  const [fy, setFy] = useState<number>(420); // Steel fy (MPa)

  // Applied Design Loads
  const [Pu, setPu] = useState<number>(300);  // Axial Load (kN)
  const [Mu, setMu] = useState<number>(180);  // Bending Moment (kN·m)
  const [Vu, setVu] = useState<number>(120);  // Shear Force (kN)

  // 3D Visualizer State
  const [viewMode, setViewMode] = useState<'3d' | '2d_section' | '2d_elevation' | 'split'>('split');
  const [deflectionScale, setDeflectionScale] = useState<number>(100);
  const [showRebarCage, setShowRebarCage] = useState<boolean>(true);
  const [showWireframe, setShowWireframe] = useState<boolean>(true);

  const [result, setResult] = useState<WallResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [downloadingPdf, setDownloadingPdf] = useState<boolean>(false);

  const mountRef = useRef<HTMLDivElement>(null);

  // --- STRUCTURAL & GEOTECHNICAL ANALYSIS ENGINE ---
  const runAnalysis = (): WallResult => {
    const L = Math.max(Number(length), 300);
    const t = Math.max(Number(thickness), 100);
    const H_mm = Math.max(Number(height), 500);
    const H_m = H_mm / 1000;
    const c = Number(cover);
    const f_c = Number(fc);
    const f_y = Number(fy);

    const isOutPlane = wallType === 'shear_wall_outplane' || wallType === 'basement_wall';
    const b_eff = isOutPlane ? 1000 : L;

    // 1. Earth Pressure Calculations
    const phiRad = (Math.min(Math.max(Number(phiDeg), 5), 45) * Math.PI) / 180;
    const gamma = Math.max(Number(gammaSoil), 10);
    const q = Math.max(Number(surchargeQ), 0);

    const Ka = Math.pow(Math.tan(Math.PI / 4 - phiRad / 2), 2);
    const Kp = 1 / Ka;
    const K0 = 1 - Math.sin(phiRad);

    let K_used = wallType === 'basement_wall' ? K0 : Ka;
    if (wallType === 'shear_wall_inplane') K_used = 0;

    const P_soil_strip = 0.5 * K_used * gamma * Math.pow(H_m, 2);
    const P_surcharge_strip = K_used * q * H_m;

    const M_soil_strip = P_soil_strip * (H_m / 3);
    const M_surcharge_strip = P_surcharge_strip * (H_m / 2);

    let calc_Vu = (P_soil_strip + P_surcharge_strip) * (b_eff / 1000);
    let calc_Mu = (M_soil_strip + M_surcharge_strip) * (b_eff / 1000);

    if (autoSoilCalc && isOutPlane) {
      calc_Vu = Number((calc_Vu * 1.6).toFixed(1));
      calc_Mu = Number((calc_Mu * 1.6).toFixed(1));
    }

    const p_u = Math.abs(Number(Pu));
    const m_u = autoSoilCalc && isOutPlane ? calc_Mu : Math.abs(Number(Mu));
    const v_u = autoSoilCalc && isOutPlane ? calc_Vu : Math.abs(Number(Vu));

    // 2. Geometry & Slenderness
    const Ag = b_eff * t;
    let k = 1.0;
    if (boundaryCondition === 'fixed_free') k = 2.0;
    if (boundaryCondition === 'fixed_fixed') k = 0.5;
    if (boundaryCondition === 'fixed_pinned') k = 0.7;

    const slenderness_ratio = (k * H_mm) / t;
    const isSlender = slenderness_ratio > 25;

    // 3. Reinforcement Calculations
    const db_v = Number(vertBarDiam);
    const s_v = Math.max(Number(vertSpacing), 50);
    const db_h = Number(horizBarDiam);
    const s_h = Math.max(Number(horizSpacing), 50);
    const numLayers = Math.max(Number(curtainLayers), 1);

    const A_bar_v = (Math.PI / 4) * Math.pow(db_v, 2);
    const A_bar_h = (Math.PI / 4) * Math.pow(db_h, 2);

    const vertBarsCount = Math.floor(b_eff / s_v) + 1;
    const Ast_v = vertBarsCount * A_bar_v * numLayers;

    const horizBarsPerMeter = Math.floor(1000 / s_h);
    const Ast_h = horizBarsPerMeter * A_bar_h * numLayers;

    const rho_v = Ast_v / Ag;
    const rho_h = Ast_h / (1000 * t);

    const rho_v_min = db_v <= 16 && f_y >= 400 ? 0.0012 : 0.0015;
    const rho_h_min = db_h <= 16 && f_y >= 400 ? 0.0020 : 0.0025;

    const min_steel_status = rho_v >= rho_v_min && rho_h >= rho_h_min ? 'PASS' : 'FAIL';

    // 4. Structural Capacity Evaluation
    const phi_axial = designCode === 'ACI318' ? 0.65 : 0.70;
    const phi_flexure = designCode === 'ACI318' ? 0.90 : 0.85;
    const phi_shear = designCode === 'ACI318' ? 0.75 : 0.85;

    let phiPn_max = 0;
    if (slenderness_ratio <= 25) {
      const pn_factor = 1 - Math.pow((k * H_mm) / (32 * t), 2);
      phiPn_max = (0.55 * phi_axial * f_c * Ag * Math.max(pn_factor, 0.1)) / 1000;
    } else {
      const P0 = (0.85 * f_c * (Ag - Ast_v) + f_y * Ast_v) / 1000;
      phiPn_max = 0.80 * phi_axial * P0;
    }

    const d_eff = isOutPlane ? t - c - db_h - db_v / 2 : L - c - db_v / 2;
    const a = (Ast_v * f_y) / (0.85 * f_c * b_eff);
    const Mn = (Ast_v * f_y * (d_eff - a / 2)) / 1e6;
    const phiMn = Math.max(phi_flexure * Mn, 0.1);

    const Vc = (0.17 * Math.sqrt(f_c) * b_eff * d_eff) / 1000;
    const Vs = (Ast_h * f_y * d_eff) / (s_h * 1000);
    const phiVn = Math.max(phi_shear * (Vc + Vs), 0.1);

    // 5. Demand Capacity Ratios (DCR)
    const axial_dcr = Number((p_u / phiPn_max).toFixed(3));
    const flexure_dcr = Number((m_u / phiMn).toFixed(3));
    const shear_dcr = Number((v_u / phiVn).toFixed(3));

    const combined_dcr = Number((
      axial_dcr >= 0.2 
        ? axial_dcr + (8 / 9) * flexure_dcr 
        : axial_dcr / 2 + flexure_dcr
    ).toFixed(3));

    const overall_dcr = Math.max(combined_dcr, shear_dcr);

    let governing_check = 'P-M Flexural Interaction';
    if (shear_dcr > combined_dcr) governing_check = 'Lateral Shear Capacity';
    if (min_steel_status === 'FAIL') governing_check = `Minimum Reinforcement Limit (< ${(rho_v_min * 100).toFixed(2)}%)`;
    if (isSlender) governing_check = 'Slender Wall 2nd Order Effects';

    return {
      wall_type: wallType,
      design_code: designCode,
      boundary_condition: boundaryCondition,
      geometry: {
        length: L,
        thickness: t,
        height: H_mm,
        cover: c,
        Ag: Math.round(Ag),
        slenderness_ratio: Number(slenderness_ratio.toFixed(1)),
        is_slender: isSlender,
      },
      geotechnical: {
        phi: Number(phiDeg),
        gamma,
        surcharge: q,
        Ka: Number(Ka.toFixed(3)),
        Kp: Number(Kp.toFixed(3)),
        K0: Number(K0.toFixed(3)),
        K_used: Number(K_used.toFixed(3)),
        P_soil: Number(P_soil_strip.toFixed(1)),
        P_surcharge: Number(P_surcharge_strip.toFixed(1)),
      },
      reinforcement: {
        vert_bar_diam: db_v,
        vert_spacing: s_v,
        horiz_bar_diam: db_h,
        horiz_spacing: s_h,
        layers: numLayers,
        rho_v: Number((rho_v * 100).toFixed(3)),
        rho_h: Number((rho_h * 100).toFixed(3)),
        rho_v_min: Number((rho_v_min * 100).toFixed(3)),
        rho_h_min: Number((rho_h_min * 100).toFixed(3)),
        Ast_v: Math.round(Ast_v),
        Ast_h: Math.round(Ast_h),
      },
      loads: {
        Pu: p_u,
        Mu: m_u,
        Vu: v_u,
      },
      capacity: {
        phiPn_max: Number(phiPn_max.toFixed(1)),
        phiMn: Number(phiMn.toFixed(1)),
        phiVn: Number(phiVn.toFixed(1)),
      },
      dcr: {
        axial_dcr,
        flexure_dcr,
        shear_dcr,
        combined_dcr,
        overall_dcr: Number(overall_dcr.toFixed(3)),
      },
      verification: {
        status: overall_dcr <= 1.0 && min_steel_status === 'PASS' ? 'SAFE' : 'OVERSTRESSED',
        min_steel_status,
        slenderness_status: isSlender ? 'SLENDER (2nd Order Effects)' : 'SHORT WALL',
        governing_check,
      },
    };
  };

  const handleAnalyze = () => {
    setLoading(true);
    try {
      setResult(runAnalysis());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setResult(runAnalysis());
  }, [designCode, wallType, boundaryCondition, length, thickness, height, cover, autoSoilCalc, phiDeg, gammaSoil, surchargeQ, vertBarDiam, vertSpacing, horizBarDiam, horizSpacing, curtainLayers, fc, fy, Pu, Mu, Vu]);

  // --- 3D INTERACTIVE WEBGL DEFLECTION & STRESS HEATMAP ENGINE ---
  useEffect(() => {
    if (viewMode === '2d_section' || viewMode === '2d_elevation') return;
    const mount = mountRef.current;
    if (!mount) return;

    const widthVal = mount.clientWidth || 400;
    const heightVal = mount.clientHeight || 280;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);

    const wallL_m = length / 1000;
    const wallH_m = height / 1000;
    const wallT_m = thickness / 1000;

    const camera = new THREE.PerspectiveCamera(45, widthVal / heightVal, 0.1, 1000);
    camera.position.set(wallL_m * 1.3, wallH_m * 0.8, Math.max(wallL_m, wallH_m) * 1.6);

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(widthVal, heightVal);
    renderer.setPixelRatio(window.devicePixelRatio);
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(wallL_m / 2, wallH_m / 2, 0);
    controls.update();

    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(wallL_m * 2, wallH_m * 2, wallL_m * 2);
    scene.add(dirLight);

    // Foundation Grid
    const grid = new THREE.GridHelper(Math.max(wallL_m, wallH_m) * 2.5, 20, 0x334155, 0x1e293b);
    grid.position.set(wallL_m / 2, -0.05, 0);
    scene.add(grid);

    // Subdivided Bending Parametric Surface Mesh
    const segX = 30;
    const segY = 30;
    const wallGeo = new THREE.PlaneGeometry(wallL_m, wallH_m, segX, segY);
    wallGeo.translate(wallL_m / 2, wallH_m / 2, 0);

    const posAttr = wallGeo.attributes.position;
    const count = posAttr.count;
    const colors = new Float32Array(count * 3);

    const maxDelta = ((result?.loads.Mu || 10) / (result?.capacity.phiMn || 100)) * 0.02;
    const amp = maxDelta * deflectionScale;

    for (let i = 0; i < count; i++) {
      const y = posAttr.getY(i);
      const normY = y / wallH_m;

      let wNorm = 0;
      if (boundaryCondition === 'fixed_free') {
        wNorm = Math.pow(normY, 2);
      } else if (boundaryCondition === 'fixed_fixed') {
        wNorm = Math.pow(Math.sin(Math.PI * normY), 2);
      } else {
        wNorm = Math.sin(Math.PI * normY);
      }

      const dispZ = wNorm * amp;
      posAttr.setZ(i, dispZ);

      const vertexColor = getHeatmapColor(wNorm);
      colors[i * 3] = vertexColor.r;
      colors[i * 3 + 1] = vertexColor.g;
      colors[i * 3 + 2] = vertexColor.b;
    }

    wallGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    wallGeo.computeVertexNormals();

    const surfaceMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      roughness: 0.3,
      metalness: 0.1,
    });
    const wallMesh = new THREE.Mesh(wallGeo, surfaceMat);
    scene.add(wallMesh);

    if (showWireframe) {
      const wireMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.15 });
      const wireMesh = new THREE.Mesh(wallGeo, wireMat);
      scene.add(wireMesh);
    }

    // 3D REINFORCEMENT CAGE
    if (showRebarCage) {
      const cov_m = cover / 1000;
      const rebarMatV = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.8, roughness: 0.2 });
      const rebarMatH = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.8, roughness: 0.2 });

      const numVertBars = Math.floor(length / vertSpacing);
      const zOffsets = curtainLayers === 2 ? [-wallT_m / 2 + cov_m, wallT_m / 2 - cov_m] : [0];

      zOffsets.forEach((zPos) => {
        // Vertical Bars
        for (let i = 0; i <= numVertBars; i++) {
          const xPos = cov_m + (i * (wallL_m - 2 * cov_m)) / Math.max(numVertBars, 1);
          const barGeo = new THREE.CylinderGeometry(0.008, 0.008, wallH_m, 8);
          const barMesh = new THREE.Mesh(barGeo, rebarMatV);
          barMesh.position.set(xPos, wallH_m / 2, zPos);
          scene.add(barMesh);
        }

        // Horizontal Bars
        const numHorizBars = Math.floor(height / horizSpacing);
        for (let j = 0; j <= numHorizBars; j++) {
          const yPos = cov_m + (j * (wallH_m - 2 * cov_m)) / Math.max(numHorizBars, 1);
          const barGeo = new THREE.CylinderGeometry(0.006, 0.006, wallL_m - 2 * cov_m, 8);
          const barMesh = new THREE.Mesh(barGeo, rebarMatH);
          barMesh.rotateZ(Math.PI / 2);
          barMesh.position.set(wallL_m / 2, yPos, zPos);
          scene.add(barMesh);
        }
      });
    }

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [height, length, thickness, cover, vertSpacing, horizSpacing, curtainLayers, boundaryCondition, viewMode, result, deflectionScale, showRebarCage, showWireframe]);

  // --- SVG TO PNG CONVERTER FOR PDF REPORT ---
  const convertSvgToPng = (svgElement: SVGSVGElement, bgColor = '#0f172a'): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
        const bbox = svgElement.getBoundingClientRect();
        const w = bbox.width || 380;
        const h = bbox.height || 220;

        clonedSvg.setAttribute('width', w.toString());
        clonedSvg.setAttribute('height', h.toString());
        if (!clonedSvg.getAttribute('viewBox')) {
          clonedSvg.setAttribute('viewBox', `0 0 ${w} ${h}`);
        }

        const serializer = new XMLSerializer();
        let svgString = serializer.serializeToString(clonedSvg);
        if (!svgString.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
          svgString = svgString.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
        }

        const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const img = new Image();

        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = w * 2;
          canvas.height = h * 2;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/png'));
          } else {
            reject(new Error('Canvas context unavailable'));
          }
          URL.revokeObjectURL(url);
        };
        img.onerror = (e) => {
          URL.revokeObjectURL(url);
          reject(e);
        };
        img.src = url;
      } catch (err) {
        reject(err);
      }
    });
  };

  // --- PDF REPORT GENERATION ---
  const generatePDF = async () => {
    if (!result) return;
    setDownloadingPdf(true);

    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const dateStr = new Date().toLocaleDateString();

      // Header Banner
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 18, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(56, 189, 248);
      doc.text('HAYA STRUCTURES | RC WALL & EARTH PRESSURE REPORT', 12, 10);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(226, 232, 240);
      doc.text(`Code: ${designCode} | Type: ${wallType.replace(/_/g, ' ').toUpperCase()} | Date: ${dateStr}`, 12, 15);

      // Section 1: Inputs & Design Summary Tables
      autoTable(doc, {
        startY: 22,
        margin: { left: 12 },
        tableWidth: 90,
        head: [['Geotechnical & Wall Input', 'Value / Unit']],
        body: [
          ['Wall Application', wallType.replace(/_/g, ' ').toUpperCase()],
          ['Wall Height (H)', `${result.geometry.height} mm`],
          ['Wall Length (L)', `${result.geometry.length} mm`],
          ['Wall Thickness (t)', `${result.geometry.thickness} mm`],
          ['Clear Cover (c)', `${result.geometry.cover} mm`],
          ['Soil Friction Angle (φ)', `${result.geotechnical.phi}°`],
          ['Soil Unit Weight (γ)', `${result.geotechnical.gamma} kN/m³`],
          ['Surcharge Load (q)', `${result.geotechnical.surcharge} kPa`],
          ['Earth Coeff (K)', `${result.geotechnical.K_used}`],
          ['Vertical Rebar', `T${result.reinforcement.vert_bar_diam} @ ${result.reinforcement.vert_spacing}mm`],
          ['Horizontal Rebar', `T${result.reinforcement.horiz_bar_diam} @ ${result.reinforcement.horiz_spacing}mm`],
          ['Rebar Curtains', `${result.reinforcement.layers} Curtain Layer(s)`],
        ],
        theme: 'grid',
        headStyles: { fillColor: [14, 116, 144], fontSize: 7.5, cellPadding: 2, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7, cellPadding: 1.8 },
      });

      autoTable(doc, {
        startY: 22,
        margin: { left: 108 },
        tableWidth: 90,
        head: [['Structural Capacity Check', 'Result / Status']],
        body: [
          ['Gross Area (Ag)', `${result.geometry.Ag} mm²`],
          ['Slenderness (kH/t)', `${result.geometry.slenderness_ratio} (${result.verification.slenderness_status})`],
          ['Soil Force (P_soil)', `${result.geotechnical.P_soil} kN/m`],
          ['Ultimate Axial Demand (Pu)', `${result.loads.Pu} kN`],
          ['Ultimate Moment Demand (Mu)', `${result.loads.Mu} kN·m`],
          ['Ultimate Shear Demand (Vu)', `${result.loads.Vu} kN`],
          ['Axial Capacity (φPn,max)', `${result.capacity.phiPn_max} kN`],
          ['Flexural Capacity (φMn)', `${result.capacity.phiMn} kN·m`],
          ['Shear Capacity (φVn)', `${result.capacity.phiVn} kN`],
          ['Vert. Steel Ratio (ρv)', `${result.reinforcement.rho_v}% (Min: ${result.reinforcement.rho_v_min}%)`],
          ['Governing Failure Check', result.verification.governing_check],
          ['Overall Compliance', result.verification.status],
        ],
        theme: 'grid',
        headStyles: { fillColor: [15, 118, 110], fontSize: 7.5, cellPadding: 2, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7, cellPadding: 1.8 },
      });

      // Section 2: Diagrams
      let currentY = 100;
      const planSvg = document.getElementById('wall-section-svg') as unknown as SVGSVGElement;
      const canvas3D = mountRef.current?.querySelector('canvas');

      if (planSvg || canvas3D) {
        try {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(15, 23, 42);
          doc.text('3D DEFLECTION HEATMAP & 2D REINFORCEMENT SECTION', 12, currentY);
          currentY += 4;

          if (canvas3D) {
            const img3D = canvas3D.toDataURL('image/png');
            doc.addImage(img3D, 'PNG', 12, currentY, 90, 50);
          }

          if (planSvg) {
            const planPng = await convertSvgToPng(planSvg, '#0f172a');
            doc.addImage(planPng, 'PNG', 108, currentY, 90, 50);
          }
          currentY += 54;
        } catch (e) {
          console.warn('PDF diagram export warning:', e);
          currentY += 10;
        }
      }

      // Section 3: Verification Matrix
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text('LIMIT STATE COMPLIANCE & DEMAND CAPACITY RATIO (DCR) MATRIX', 12, currentY);
      currentY += 3;

      autoTable(doc, {
        startY: currentY,
        margin: { left: 12, right: 12 },
        head: [['Structural Limit State Check', 'Design Demand', 'Design Capacity', 'DCR Ratio', 'Verdict']],
        body: [
          ['Axial Compression Capacity', `${result.loads.Pu} kN`, `${result.capacity.phiPn_max} kN`, `${result.dcr.axial_dcr}`, result.dcr.axial_dcr <= 1.0 ? 'PASS' : 'FAIL'],
          ['Out-of-Plane Flexure Resistance', `${result.loads.Mu} kN·m`, `${result.capacity.phiMn} kN·m`, `${result.dcr.flexure_dcr}`, result.dcr.flexure_dcr <= 1.0 ? 'PASS' : 'FAIL'],
          ['Out-of-Plane Shear Resistance', `${result.loads.Vu} kN`, `${result.capacity.phiVn} kN`, `${result.dcr.shear_dcr}`, result.dcr.shear_dcr <= 1.0 ? 'PASS' : 'FAIL'],
          ['Combined P-M Interaction Ratio', '-', '-', `${result.dcr.combined_dcr}`, result.dcr.combined_dcr <= 1.0 ? 'PASS' : 'FAIL'],
          ['Minimum Steel Ratio Check', `ρv = ${result.reinforcement.rho_v}%`, `Min ${result.reinforcement.rho_v_min}%`, `${(result.reinforcement.rho_v / result.reinforcement.rho_v_min).toFixed(2)}`, result.verification.min_steel_status],
        ],
        theme: 'grid',
        headStyles: { fillColor: [30, 41, 59], fontSize: 7.5, cellPadding: 2, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7, cellPadding: 1.8 },
      });

      // Section 4: Engineering Sign-off Block
      const finalTableY = (doc as any).lastAutoTable.finalY + 6;

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(12, finalTableY, 110, 36, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text('ENGINEERING ASSUMPTIONS & DESIGN NOTES', 16, finalTableY + 5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(51, 65, 85);
      const notes = [
        `1. Earth pressure calculated via Rankine Theory (K_used = ${result.geotechnical.K_used}).`,
        `2. Uniform surcharge pressure distribution: σ_q = K * q (${result.geotechnical.surcharge} kPa).`,
        '3. Ultimate lateral loads factored with 1.6 factor per ACI 318 ULS combinations.',
        '4. Verification assumes rigid non-yielding basement wall restraints.',
      ];
      notes.forEach((note, idx) => {
        doc.text(note, 16, finalTableY + 11 + idx * 5.5);
      });

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(128, finalTableY, 70, 36, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text('VERIFICATION STAMP', 132, finalTableY + 5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text('Engineered By: Haya Wall Engine', 132, finalTableY + 12);
      doc.text('Status:', 132, finalTableY + 19);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(result.verification.status === 'SAFE' ? 16 : 225, result.verification.status === 'SAFE' ? 185 : 29, result.verification.status === 'SAFE' ? 129 : 72);
      doc.text(result.verification.status === 'SAFE' ? 'APPROVED / COMPLIANT' : 'OVERSTRESSED', 145, finalTableY + 19);

      doc.setDrawColor(148, 163, 184);
      doc.line(132, finalTableY + 28, 192, finalTableY + 28);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(6);
      doc.setTextColor(100, 116, 139);
      doc.text('Authorized Geotechnical & Structural Seal', 132, finalTableY + 32);

      doc.save(`Haya_RC_Wall_Analysis_${designCode}_${wallType}.pdf`);
    } catch (err) {
      console.error('Wall PDF Export Error:', err);
      alert('Failed to generate RC Wall PDF report.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-950 p-6 rounded-2xl border border-slate-800 text-slate-100 font-sans">
      {/* Control Input Panel */}
      <div className="lg:col-span-5 space-y-4 bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-xl">
        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
          <h3 className="font-semibold text-slate-200 text-sm">Wall & Soil Parameters</h3>
          <select
            value={designCode}
            onChange={(e) => setDesignCode(e.target.value as DesignCode)}
            className="bg-cyan-500/20 text-cyan-400 font-bold border border-cyan-500/30 rounded px-2 py-1 text-xs"
          >
            <option value="ACI318">ACI 318-19</option>
            <option value="EC2">Eurocode 2 (EN 1992)</option>
            <option value="BS8110">BS 8110:1997</option>
          </select>
        </div>

        {/* Wall Application Type Selector */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Wall Application</label>
            <select
              value={wallType}
              onChange={(e) => setWallType(e.target.value as WallType)}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 font-medium"
            >
              <option value="basement_wall">Basement Wall (K0)</option>
              <option value="shear_wall_outplane">Retaining Wall (Ka)</option>
              <option value="shear_wall_inplane">In-Plane Core Wall</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Support Boundary</label>
            <select
              value={boundaryCondition}
              onChange={(e) => setBoundaryCondition(e.target.value as BoundaryCondition)}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200"
            >
              <option value="pinned_pinned">Pinned - Pinned (k = 1.0)</option>
              <option value="fixed_pinned">Fixed - Pinned (k = 0.7)</option>
              <option value="fixed_fixed">Fixed - Fixed (k = 0.5)</option>
              <option value="fixed_free">Fixed - Free Cantilever (k = 2.0)</option>
            </select>
          </div>
        </div>

        {/* Auto Soil Calculation Toggle */}
        <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded border border-slate-800">
          <span className="text-xs text-slate-300 font-medium">Auto Rankine Earth Pressure</span>
          <input
            type="checkbox"
            checked={autoSoilCalc}
            onChange={(e) => setAutoSoilCalc(e.target.checked)}
            className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
          />
        </div>

        {/* Geotechnical Parameters Section */}
        {autoSoilCalc && (
          <div className="space-y-3 p-3 bg-slate-950/60 rounded border border-slate-800">
            <h4 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">Geotechnical Parameters</h4>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Soil φ (°)</label>
                <input
                  type="number"
                  value={phiDeg}
                  onChange={(e) => setPhiDeg(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">γ (kN/m³)</label>
                <input
                  type="number"
                  value={gammaSoil}
                  onChange={(e) => setGammaSoil(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">q Surcharge (kPa)</label>
                <input
                  type="number"
                  value={surchargeQ}
                  onChange={(e) => setSurchargeQ(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {/* Geometry Dimensions */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Length L (mm)</label>
            <input
              type="number"
              value={length}
              onChange={(e) => setLength(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Thickness t (mm)</label>
            <input
              type="number"
              value={thickness}
              onChange={(e) => setThickness(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Height H (mm)</label>
            <input
              type="number"
              value={height}
              onChange={(e) => setHeight(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 font-mono"
            />
          </div>
        </div>

        {/* Reinforcement Configuration */}
        <div className="space-y-3 pt-2 border-t border-slate-800">
          <div className="flex justify-between items-center">
            <h4 className="font-semibold text-xs uppercase tracking-wider text-cyan-400">Reinforcement Config</h4>
            <select
              value={curtainLayers}
              onChange={(e) => setCurtainLayers(Number(e.target.value))}
              className="bg-slate-950 text-slate-200 text-xs border border-slate-800 rounded px-2 py-0.5"
            >
              <option value={1}>1 Rebar Layer</option>
              <option value={2}>2 Rebar Layers (Double)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Vert Bar Ø (mm)</label>
              <input
                type="number"
                value={vertBarDiam}
                onChange={(e) => setVertBarDiam(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Vert Spacing (mm)</label>
              <input
                type="number"
                value={vertSpacing}
                onChange={(e) => setVertSpacing(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Horiz Bar Ø (mm)</label>
              <input
                type="number"
                value={horizBarDiam}
                onChange={(e) => setHorizBarDiam(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Horiz Spacing (mm)</label>
              <input
                type="number"
                value={horizSpacing}
                onChange={(e) => setHorizSpacing(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Materials & Direct Loads */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
          <div>
            <label className="block text-xs text-slate-400 mb-1">f'c (MPa)</label>
            <input
              type="number"
              value={fc}
              onChange={(e) => setFc(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">fy (MPa)</label>
            <input
              type="number"
              value={fy}
              onChange={(e) => setFy(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 p-3 bg-cyan-950/20 border border-cyan-800/30 rounded-lg">
          <div>
            <label className="block text-[10px] text-slate-400 mb-1">Pu (kN)</label>
            <input
              type="number"
              value={Pu}
              onChange={(e) => setPu(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-mono"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-400 mb-1">Mu (kN·m)</label>
            <input
              type="number"
              disabled={autoSoilCalc && wallType !== 'shear_wall_inplane'}
              value={Mu}
              onChange={(e) => setMu(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-mono disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-400 mb-1">Vu (kN)</label>
            <input
              type="number"
              disabled={autoSoilCalc && wallType !== 'shear_wall_inplane'}
              value={Vu}
              onChange={(e) => setVu(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-mono disabled:opacity-50"
            />
          </div>
        </div>

        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold py-2.5 rounded transition disabled:opacity-50 mt-4 shadow-lg shadow-cyan-500/20 text-xs uppercase tracking-wider"
        >
          {loading ? 'Analyzing RC Wall...' : 'Run Wall Verification'}
        </button>

        {result && (
          <div className="mt-4 pt-3 border-t border-slate-800 space-y-2 text-xs bg-slate-950 p-3.5 rounded-lg border border-slate-800">
            <div className="flex justify-between items-center mb-1">
              <span className="text-slate-400 font-bold uppercase">{designCode} Status:</span>
              <span
                className={`px-2 py-0.5 rounded font-bold ${
                  result.verification.status === 'SAFE'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                }`}
              >
                {result.verification.status}
              </span>
            </div>
            <p>Slenderness Ratio: <span className="text-cyan-400 font-mono">{result.geometry.slenderness_ratio}</span> ({result.verification.slenderness_status})</p>
            <p>Axial Capacity (φPn): <span className="text-emerald-400 font-mono">{result.capacity.phiPn_max} kN</span></p>
            <p>Flexural Capacity (φMn): <span className="text-emerald-400 font-mono">{result.capacity.phiMn} kN·m</span></p>
            <p>Combined P-M DCR: <span className="text-cyan-400 font-mono">{result.dcr.combined_dcr}</span></p>

            <button
              onClick={generatePDF}
              disabled={downloadingPdf}
              className="w-full mt-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2 rounded transition shadow-lg text-xs"
            >
              {downloadingPdf ? 'Generating PDF...' : '📄 Export Complete PDF Report'}
            </button>
          </div>
        )}
      </div>

      {/* Graphical & 3D WebGL Viewport Panel */}
      <div className="lg:col-span-7 space-y-6">
        {result && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center">
              <span className="text-[10px] text-slate-400 block mb-1">Axial DCR</span>
              <span className={`text-base font-bold font-mono ${result.dcr.axial_dcr <= 1.0 ? 'text-emerald-400' : 'text-red-400'}`}>{result.dcr.axial_dcr}</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center">
              <span className="text-[10px] text-slate-400 block mb-1">Flexure DCR</span>
              <span className={`text-base font-bold font-mono ${result.dcr.flexure_dcr <= 1.0 ? 'text-emerald-400' : 'text-red-400'}`}>{result.dcr.flexure_dcr}</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center">
              <span className="text-[10px] text-slate-400 block mb-1">Shear DCR</span>
              <span className={`text-base font-bold font-mono ${result.dcr.shear_dcr <= 1.0 ? 'text-emerald-400' : 'text-red-400'}`}>{result.dcr.shear_dcr}</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center">
              <span className="text-[10px] text-slate-400 block mb-1">Combined P-M</span>
              <span className={`text-base font-bold font-mono ${result.dcr.combined_dcr <= 1.0 ? 'text-cyan-400' : 'text-rose-400'}`}>{result.dcr.combined_dcr}</span>
            </div>
          </div>
        )}

        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-3">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">3D BENDING HEATMAP & SECTION DETAIL</h3>
            <div className="flex items-center space-x-1 bg-slate-950 p-0.5 rounded border border-slate-800">
              <button
                onClick={() => setViewMode('2d_section')}
                className={`px-2 py-1 text-[10px] font-bold rounded ${viewMode === '2d_section' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'}`}
              >
                2D Cross-Section
              </button>
              <button
                onClick={() => setViewMode('2d_elevation')}
                className={`px-2 py-1 text-[10px] font-bold rounded ${viewMode === '2d_elevation' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'}`}
              >
                2D Elevation
              </button>
              <button
                onClick={() => setViewMode('3d')}
                className={`px-2 py-1 text-[10px] font-bold rounded ${viewMode === '3d' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'}`}
              >
                3D Deflection
              </button>
              <button
                onClick={() => setViewMode('split')}
                className={`px-2 py-1 text-[10px] font-bold rounded ${viewMode === 'split' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Dual View
              </button>
            </div>
          </div>

          {(viewMode === '3d' || viewMode === 'split') && (
            <div className="flex flex-wrap items-center justify-between gap-4 p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs">
              <div className="flex items-center space-x-2 flex-1 min-w-[180px]">
                <span className="text-slate-400 text-[10px] whitespace-nowrap">Exaggeration ({deflectionScale}x):</span>
                <input
                  type="range"
                  min="10"
                  max="500"
                  value={deflectionScale}
                  onChange={(e) => setDeflectionScale(Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>
              <div className="flex items-center space-x-3 text-[10px] text-slate-300">
                <label className="flex items-center space-x-1 cursor-pointer">
                  <input type="checkbox" checked={showRebarCage} onChange={(e) => setShowRebarCage(e.target.checked)} className="accent-cyan-500 rounded" />
                  <span>Rebar Cage</span>
                </label>
                <label className="flex items-center space-x-1 cursor-pointer">
                  <input type="checkbox" checked={showWireframe} onChange={(e) => setShowWireframe(e.target.checked)} className="accent-cyan-500 rounded" />
                  <span>Mesh Wire</span>
                </label>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 min-h-[280px]">
            {/* 3D WebGL Viewport */}
            {(viewMode === '3d' || viewMode === 'split') && (
              <div
                ref={mountRef}
                className={`w-full h-full min-h-[260px] bg-slate-950 border border-slate-800 rounded-lg overflow-hidden relative ${
                  viewMode === '3d' ? 'md:col-span-2' : ''
                }`}
              >
                <div className="absolute bottom-2 left-2 bg-slate-950/80 px-2 py-1 rounded text-[10px] text-slate-400 pointer-events-none z-10 border border-slate-800">
                  Orbit: Drag | Zoom: Scroll
                </div>
                <div className="absolute top-2 right-2 bg-slate-950/80 px-2 py-1 rounded text-[9px] text-cyan-400 pointer-events-none z-10 border border-slate-800 font-mono">
                  Heatmap: Blue (Zero) → Red (Max δ)
                </div>
              </div>
            )}

            {/* 2D Plan Cross-Section Diagram */}
            {(viewMode === '2d_section' || viewMode === 'split') && (
              <div
                className={`w-full bg-slate-950 border border-slate-800 rounded-lg p-2 flex flex-col items-center justify-center relative ${
                  viewMode === '2d_section' ? 'md:col-span-2' : ''
                }`}
              >
                <div className="absolute top-2 left-2 text-[10px] font-semibold text-slate-400">2D Plan Cross-Section (Thickness vs Length)</div>
                <svg id="wall-section-svg" viewBox="0 0 500 240" className="w-full h-56 max-w-[380px]">
                  <rect x="40" y="70" width="420" height="100" fill="#1e293b" stroke="#38bdf8" strokeWidth="2.5" rx="3" />

                  {curtainLayers === 2 ? (
                    <>
                      <line x1="55" y1="88" x2="445" y2="88" stroke="#38bdf8" strokeWidth="2" strokeDasharray="6 4" />
                      <line x1="55" y1="152" x2="445" y2="152" stroke="#38bdf8" strokeWidth="2" strokeDasharray="6 4" />

                      <circle cx="70" cy="88" r="4" fill="#ef4444" />
                      <circle cx="170" cy="88" r="4" fill="#ef4444" />
                      <circle cx="270" cy="88" r="4" fill="#ef4444" />
                      <circle cx="370" cy="88" r="4" fill="#ef4444" />
                      <circle cx="430" cy="88" r="4" fill="#ef4444" />

                      <circle cx="70" cy="152" r="4" fill="#ef4444" />
                      <circle cx="170" cy="152" r="4" fill="#ef4444" />
                      <circle cx="270" cy="152" r="4" fill="#ef4444" />
                      <circle cx="370" cy="152" r="4" fill="#ef4444" />
                      <circle cx="430" cy="152" r="4" fill="#ef4444" />

                      <rect x="62" y="80" width="16" height="80" fill="none" stroke="#f59e0b" strokeWidth="1.5" />
                      <rect x="422" y="80" width="16" height="80" fill="none" stroke="#f59e0b" strokeWidth="1.5" />
                    </>
                  ) : (
                    <>
                      <line x1="55" y1="120" x2="445" y2="120" stroke="#38bdf8" strokeWidth="2" strokeDasharray="6 4" />
                      <circle cx="70" cy="120" r="4" fill="#ef4444" />
                      <circle cx="170" cy="120" r="4" fill="#ef4444" />
                      <circle cx="270" cy="120" r="4" fill="#ef4444" />
                      <circle cx="370" cy="120" r="4" fill="#ef4444" />
                      <circle cx="430" cy="120" r="4" fill="#ef4444" />
                    </>
                  )}

                  <text x="250" y="195" fill="#94a3b8" fontSize="11" textAnchor="middle">
                    Wall Length L = {length} mm
                  </text>
                  <text x="25" y="124" fill="#94a3b8" fontSize="11" textAnchor="middle" transform="rotate(-90 25 124)">
                    t = {thickness} mm
                  </text>
                </svg>
              </div>
            )}

            {/* 2D Elevation View Diagram */}
            {viewMode === '2d_elevation' && (
              <div className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 flex flex-col items-center justify-center relative md:col-span-2">
                <div className="absolute top-2 left-2 text-[10px] font-semibold text-slate-400">2D Elevation View (Length vs Height & Load Vectors)</div>
                <svg id="wall-elevation-svg" viewBox="0 0 500 260" className="w-full h-60 max-w-[420px]">
                  <rect x="80" y="40" width="340" height="170" fill="#1e293b" stroke="#38bdf8" strokeWidth="2.5" />

                  <line x1="120" y1="40" x2="120" y2="210" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4 3" />
                  <line x1="200" y1="40" x2="200" y2="210" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4 3" />
                  <line x1="280" y1="40" x2="280" y2="210" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4 3" />
                  <line x1="360" y1="40" x2="360" y2="210" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4 3" />

                  <line x1="80" y1="80" x2="420" y2="80" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="4 3" />
                  <line x1="80" y1="125" x2="420" y2="125" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="4 3" />
                  <line x1="80" y1="170" x2="420" y2="170" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="4 3" />

                  <polygon points="250,38 245,28 255,28" fill="#10b981" />
                  <text x="250" y="20" fill="#10b981" fontSize="10" textAnchor="middle" fontWeight="bold">
                    Pu = {Pu} kN
                  </text>

                  <path d="M 430 110 A 15 15 0 0 1 430 140" fill="none" stroke="#f59e0b" strokeWidth="2.5" />
                  <polygon points="433,142 425,137 433,132" fill="#f59e0b" />
                  <text x="445" y="128" fill="#f59e0b" fontSize="10" fontWeight="bold">
                    Mu = {result?.loads.Mu} kN·m
                  </text>

                  <line x1="60" y1="210" x2="440" y2="210" stroke="#64748b" strokeWidth="3" />

                  <text x="250" y="232" fill="#94a3b8" fontSize="11" textAnchor="middle">
                    L = {length} mm
                  </text>
                  <text x="55" y="125" fill="#94a3b8" fontSize="11" textAnchor="middle" transform="rotate(-90 55 125)">
                    H = {height} mm
                  </text>
                </svg>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
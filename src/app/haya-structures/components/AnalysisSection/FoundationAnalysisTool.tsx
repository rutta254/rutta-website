'use client';

import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type DesignCode = 'ACI318' | 'EC2';
type FootingType = 'isolated_pad' | 'wall_strip' | 'combined';
type CombinedSubType = 'rectangular' | 'trapezoidal' | 'strap';
type MeshType = 'single_mesh' | 'double_mesh';

interface FootingResult {
  code: DesignCode;
  footing_type: FootingType;
  combined_subtype?: CombinedSubType;
  mesh_type: MeshType;
  geometry: {
    B: number;
    B2?: number;
    L: number;
    D: number;
    d: number;
    c1: number;
    c2: number;
    S?: number;
  };
  geotechnical: {
    q_max: number;
    q_min: number;
    q_allow: number;
    uplift: boolean;
  };
  structural: {
    Pu: number;
    Mux: number;
    qu_max: number;
    Vu_1way: number;
    phiVc_1way: number;
    Vu_2way: number;
    phiVc_2way: number;
    Mu_flexure: number;
    phiMn: number;
    As_req_bot: number;
    As_prov_bot: number;
    As_req_top: number;
    As_prov_top: number;
  };
  dcr: {
    bearing_dcr: number;
    shear_1way_dcr: number;
    shear_2way_dcr: number;
    flexure_dcr: number;
  };
  status: 'SAFE' | 'OVERSTRESSED';
  governing_check: string;
}

function getHeatmapColor(value: number): THREE.Color {
  const v = THREE.MathUtils.clamp(value, 0, 1);
  const h = (1 - v) * 0.666; // Blue (0.0) -> Cyan -> Yellow -> Red (1.0)
  return new THREE.Color().setHSL(h, 1.0, 0.5);
}

export default function FootingAnalysisTool() {
  const [code, setCode] = useState<DesignCode>('ACI318');
  const [footingType, setFootingType] = useState<FootingType>('isolated_pad');
  const [combinedSubType, setCombinedSubType] = useState<CombinedSubType>('rectangular');
  const [meshType, setMeshType] = useState<MeshType>('single_mesh');

  // Footing Geometry (mm)
  const [footingB, setFootingB] = useState<number>(2500);
  const [footingB2, setFootingB2] = useState<number>(1800);
  const [footingL, setFootingL] = useState<number>(2500);
  const [footingD, setFootingD] = useState<number>(550);
  const [cover, setCover] = useState<number>(75);

  // Combined / Strap Geometry (mm)
  const [colSpacing, setColSpacing] = useState<number>(3500);
  const [strapW, setStrapW] = useState<number>(450);
  const [strapH, setStrapH] = useState<number>(750);

  // Column / Pier Geometry (mm)
  const [colC1, setColC1] = useState<number>(400);
  const [colC2, setColC2] = useState<number>(400);

  // Soil Properties
  const [qAllow, setQAllow] = useState<number>(220);
  const [gammaSoil, setGammaSoil] = useState<number>(18);
  const [embedmentDepth, setEmbedmentDepth] = useState<number>(1500);

  // Rebar Details
  const [barDiam, setBarDiam] = useState<number>(16);
  const [barSpacing, setBarSpacing] = useState<number>(150);
  const [topBarDiam, setTopBarDiam] = useState<number>(12);
  const [topBarSpacing, setTopBarSpacing] = useState<number>(200);

  // Materials (MPa)
  const [fc, setFc] = useState<number>(28);
  const [fy, setFy] = useState<number>(420);

  // Loads - Col 1 / Single Footing
  const [P_Dead, setP_Dead] = useState<number>(700);
  const [P_Live, setP_Live] = useState<number>(400);
  const [M_Dead, setM_Dead] = useState<number>(90);
  const [M_Live, setM_Live] = useState<number>(50);

  // Loads - Col 2 (For Combined Footings)
  const [P2_Dead, setP2_Dead] = useState<number>(900);
  const [P2_Live, setP2_Live] = useState<number>(550);

  // 3D Visualization States
  const [viewMode, setViewMode] = useState<'3d' | '2d_composite' | 'split'>('split');
  const [showWireframe, setShowWireframe] = useState<boolean>(true);
  const [showRebarCage, setShowRebarCage] = useState<boolean>(true);
  const [soilPressureExag, setSoilPressureExag] = useState<number>(1.5);

  const [result, setResult] = useState<FootingResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [pdfGenerating, setPdfGenerating] = useState<boolean>(false);

  const mountRef = useRef<HTMLDivElement>(null);

  // Auto-adjust footing length L when switching to combined footings if L <= S
  useEffect(() => {
    if (footingType === 'combined' && footingL <= colSpacing) {
      setFootingL(colSpacing + colC1 + 1000);
    }
  }, [footingType, colSpacing, colC1, footingL]);

  // --- ANALYSIS ENGINE ---
  const calculateFoundation = (): FootingResult => {
    const isStrip = footingType === 'wall_strip';
    const isCombined = footingType === 'combined';

    const B = Math.max(Number(footingB), 400) / 1000;
    const B2 = isCombined && combinedSubType !== 'rectangular' ? Math.max(Number(footingB2), 400) / 1000 : B;
    const L = isStrip ? 1.0 : Math.max(Number(footingL), 400) / 1000;
    const D = Math.max(Number(footingD), 200) / 1000;
    const c = Number(cover) / 1000;
    const db = Number(barDiam) / 1000;
    const d = D - c - db / 2;

    const c1 = Math.max(Number(colC1), 100) / 1000;
    const c2 = isStrip ? B : Math.max(Number(colC2), 100) / 1000;
    const S_m = colSpacing / 1000;

    const f_c = Number(fc);
    const f_y = Number(fy);
    const q_all = Number(qAllow);

    let P_service = Number(P_Dead) + Number(P_Live);
    let M_service = Number(M_Dead) + Number(M_Live);
    let Pu = 1.2 * Number(P_Dead) + 1.6 * Number(P_Live);
    let Mux = 1.2 * Number(M_Dead) + 1.6 * Number(M_Live);

    if (isCombined) {
      const P2_service = Number(P2_Dead) + Number(P2_Live);
      P_service += P2_service;
      Pu += 1.2 * Number(P2_Dead) + 1.6 * Number(P2_Live);
    }

    let A_footing = B * L;
    if (isCombined) {
      if (combinedSubType === 'trapezoidal') {
        A_footing = ((B + B2) / 2) * L;
      } else if (combinedSubType === 'strap') {
        const L1 = L * 0.35;
        const L2 = L * 0.35;
        A_footing = B * L1 + B2 * L2;
      }
    }

    const S_footing = (L * Math.pow(B, 2)) / 6;

    const footingWeight = A_footing * D * 24;
    const soilWeight = A_footing * (Number(embedmentDepth) / 1000 - D) * Number(gammaSoil);
    const P_total_service = P_service + footingWeight + soilWeight;

    const q_avg = P_total_service / A_footing;
    const q_flexure = isStrip ? 0 : M_service / S_footing;

    const q_max = q_avg + q_flexure;
    const q_min = Math.max(q_avg - q_flexure, 0);
    const uplift = q_avg - q_flexure < 0;

    const qu_avg = Pu / A_footing;
    const qu_flex = isStrip ? 0 : Mux / S_footing;
    const qu_max = qu_avg + qu_flex;

    const cantilever = (B - c1) / 2;
    const dist_to_d = cantilever - d;
    const Vu_1way = dist_to_d > 0 ? qu_max * L * dist_to_d : 0;
    
    const phi_shear = 0.75;
    const Vc_1way = (0.17 * Math.sqrt(f_c) * (L * 1000) * (d * 1000)) / 1000;
    const phiVc_1way = phi_shear * Vc_1way;

    let Vu_2way = 0;
    let phiVc_2way = 1.0;

    if (!isStrip) {
      const bo = 2 * (c1 + d) + 2 * (c2 + d);
      const A_punching = (c1 + d) * (c2 + d);
      Vu_2way = Math.max(Pu - qu_max * A_punching, 0);

      const beta = Math.max(c1 / c2, c2 / c1);
      const Vc_2way_1 = 0.17 * (1 + 2 / beta) * Math.sqrt(f_c) * (bo * 1000) * (d * 1000);
      const Vc_2way_2 = 0.33 * Math.sqrt(f_c) * (bo * 1000) * (d * 1000);
      phiVc_2way = phi_shear * (Math.min(Vc_2way_1, Vc_2way_2) / 1000);
    } else {
      phiVc_2way = 9999;
    }

    const Mu_flexure = (qu_max * L * Math.pow(cantilever, 2)) / 2;
    const phi_flex = 0.90;
    const b_mm = L * 1000;
    const d_mm = d * 1000;

    const K_val = (Mu_flexure * 1e6) / (phi_flex * b_mm * Math.pow(d_mm, 2) * f_c);
    const rho_req = (0.85 * f_c / f_y) * (1 - Math.sqrt(Math.max(1 - (2 * K_val) / 0.85, 0.01)));
    const As_req_bot = Math.max(rho_req * b_mm * d_mm, 0.0018 * b_mm * (D * 1000));

    const s_bar_bot = Math.max(Number(barSpacing), 50);
    const As_bar_bot = (Math.PI / 4) * Math.pow(Number(barDiam), 2);
    
    const As_prov_bot = isStrip 
      ? (1000 / s_bar_bot) * As_bar_bot 
      : (Math.floor((b_mm - 2 * Number(cover)) / s_bar_bot) + 1) * As_bar_bot;

    const a_block_bot = (As_prov_bot * f_y) / (0.85 * f_c * b_mm);
    const Mn_bot = (As_prov_bot * f_y * (d_mm - a_block_bot / 2)) / 1e6;
    const phiMn = phi_flex * Mn_bot;

    let As_req_top = 0;
    let As_prov_top = 0;

    if (meshType === 'double_mesh' || isCombined) {
      As_req_top = 0.0018 * b_mm * (D * 1000);
      const s_bar_top = Math.max(Number(topBarSpacing), 50);
      const As_bar_top = (Math.PI / 4) * Math.pow(Number(topBarDiam), 2);
      As_prov_top = isStrip 
        ? (1000 / s_bar_top) * As_bar_top 
        : (Math.floor((b_mm - 2 * Number(cover)) / s_bar_top) + 1) * As_bar_top;
    }

    const bearing_dcr = q_max / q_all;
    const shear_1way_dcr = Vu_1way / phiVc_1way;
    const shear_2way_dcr = isStrip ? 0 : Vu_2way / phiVc_2way;
    const flexure_dcr = Mu_flexure / phiMn;

    const max_dcr = Math.max(bearing_dcr, shear_1way_dcr, shear_2way_dcr, flexure_dcr);
    let governing_check = 'Soil Bearing Capacity';
    if (max_dcr === shear_1way_dcr) governing_check = 'One-Way Wide Beam Shear';
    if (max_dcr === shear_2way_dcr) governing_check = 'Two-Way Punching Shear';
    if (max_dcr === flexure_dcr) governing_check = 'Bottom Flexural Bending';
    if (uplift && meshType === 'single_mesh') governing_check = 'Uplift Tension (Top Mesh Required!)';

    return {
      code,
      footing_type: footingType,
      combined_subtype: isCombined ? combinedSubType : undefined,
      mesh_type: meshType,
      geometry: {
        B: Math.round(B * 1000),
        B2: Math.round(B2 * 1000),
        L: Math.round(L * 1000),
        D: Math.round(D * 1000),
        d: Math.round(d_mm),
        c1: Math.round(c1 * 1000),
        c2: Math.round(c2 * 1000),
        S: Math.round(S_m * 1000),
      },
      geotechnical: {
        q_max: Number(q_max.toFixed(1)),
        q_min: Number(q_min.toFixed(1)),
        q_allow: q_all,
        uplift,
      },
      structural: {
        Pu,
        Mux,
        qu_max: Number(qu_max.toFixed(1)),
        Vu_1way: Number(Vu_1way.toFixed(1)),
        phiVc_1way: Number(phiVc_1way.toFixed(1)),
        Vu_2way: Number(Vu_2way.toFixed(1)),
        phiVc_2way: Number(phiVc_2way.toFixed(1)),
        Mu_flexure: Number(Mu_flexure.toFixed(1)),
        phiMn: Number(phiMn.toFixed(1)),
        As_req_bot: Math.round(As_req_bot),
        As_prov_bot: Math.round(As_prov_bot),
        As_req_top: Math.round(As_req_top),
        As_prov_top: Math.round(As_prov_top),
      },
      dcr: {
        bearing_dcr: Number(bearing_dcr.toFixed(3)),
        shear_1way_dcr: Number(shear_1way_dcr.toFixed(3)),
        shear_2way_dcr: Number(shear_2way_dcr.toFixed(3)),
        flexure_dcr: Number(flexure_dcr.toFixed(3)),
      },
      status: max_dcr <= 1.0 && (!uplift || meshType === 'double_mesh') ? 'SAFE' : 'OVERSTRESSED',
      governing_check,
    };
  };

  const handleAnalyze = () => {
    setLoading(true);
    try {
      setResult(calculateFoundation());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setResult(calculateFoundation());
  }, [code, footingType, combinedSubType, meshType, footingB, footingB2, footingL, footingD, cover, colC1, colC2, colSpacing, strapW, strapH, qAllow, gammaSoil, embedmentDepth, barDiam, barSpacing, topBarDiam, topBarSpacing, fc, fy, P_Dead, P_Live, M_Dead, M_Live, P2_Dead, P2_Live]);

  // --- 3D THREE.JS WEBGL ENGINE ---
  useEffect(() => {
    if (viewMode === '2d_composite') return;
    const mount = mountRef.current;
    if (!mount) return;

    const widthVal = mount.clientWidth || 400;
    const heightVal = mount.clientHeight || 280;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);

    const isStrip = footingType === 'wall_strip';
    const isCombined = footingType === 'combined';

    const fB_m = footingB / 1000;
    const fB2_m = footingB2 / 1000;
    const fL_m = isStrip ? 2.5 : footingL / 1000;
    const fD_m = footingD / 1000;
    const c1_m = colC1 / 1000;
    const c2_m = isStrip ? fB_m : colC2 / 1000;
    const S_m = colSpacing / 1000;

    const camera = new THREE.PerspectiveCamera(45, widthVal / heightVal, 0.1, 1000);
    camera.position.set(fB_m * 1.8, fD_m * 4 + 2.0, fL_m * 1.6);

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(widthVal, heightVal);
    renderer.setPixelRatio(window.devicePixelRatio);
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, fD_m / 2, 0);
    controls.update();

    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(fB_m * 2, fD_m * 10, fL_m * 2);
    scene.add(dirLight);

    const grid = new THREE.GridHelper(Math.max(fB_m, fL_m) * 2.5, 20, 0x334155, 0x1e293b);
    grid.position.set(0, -0.05, 0);
    scene.add(grid);

    const slabMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      transparent: true,
      opacity: 0.45,
      roughness: 0.4,
    });
    const colMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3 });

    // 1. Footing Concrete Geometries
    if (!isCombined || combinedSubType === 'rectangular') {
      const slabGeo = new THREE.BoxGeometry(fB_m, fD_m, fL_m);
      const slabMesh = new THREE.Mesh(slabGeo, slabMat);
      slabMesh.position.set(0, fD_m / 2, 0);
      scene.add(slabMesh);

      if (showWireframe) {
        const wireGeo = new THREE.EdgesGeometry(slabGeo);
        const wireMesh = new THREE.LineSegments(wireGeo, new THREE.LineBasicMaterial({ color: 0x38bdf8 }));
        wireMesh.position.set(0, fD_m / 2, 0);
        scene.add(wireMesh);
      }
    } else if (combinedSubType === 'trapezoidal') {
      const shape = new THREE.Shape();
      shape.moveTo(-fB_m / 2, -fL_m / 2);
      shape.lineTo(fB_m / 2, -fL_m / 2);
      shape.lineTo(fB2_m / 2, fL_m / 2);
      shape.lineTo(-fB2_m / 2, fL_m / 2);
      shape.closePath();

      const extrudeSettings = { depth: fD_m, bevelEnabled: false };
      const trapGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      trapGeo.rotateX(Math.PI / 2);

      const trapMesh = new THREE.Mesh(trapGeo, slabMat);
      trapMesh.position.set(0, fD_m, 0);
      scene.add(trapMesh);

      if (showWireframe) {
        const wireGeo = new THREE.EdgesGeometry(trapGeo);
        const wireMesh = new THREE.LineSegments(wireGeo, new THREE.LineBasicMaterial({ color: 0xf59e0b }));
        wireMesh.position.set(0, fD_m, 0);
        scene.add(wireMesh);
      }
    } else if (combinedSubType === 'strap') {
      const L1_m = fL_m * 0.35;
      const L2_m = fL_m * 0.35;

      const pad1Geo = new THREE.BoxGeometry(fB_m, fD_m, L1_m);
      const pad1Mesh = new THREE.Mesh(pad1Geo, slabMat);
      pad1Mesh.position.set(0, fD_m / 2, -S_m / 2);
      scene.add(pad1Mesh);

      const pad2Geo = new THREE.BoxGeometry(fB2_m, fD_m, L2_m);
      const pad2Mesh = new THREE.Mesh(pad2Geo, slabMat);
      pad2Mesh.position.set(0, fD_m / 2, S_m / 2);
      scene.add(pad2Mesh);

      const stW_m = strapW / 1000;
      const stH_m = strapH / 1000;
      const strapGeo = new THREE.BoxGeometry(stW_m, stH_m, S_m);
      const strapMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, transparent: true, opacity: 0.65 });
      const strapMesh = new THREE.Mesh(strapGeo, strapMat);
      strapMesh.position.set(0, fD_m + stH_m / 2 - 0.1, 0);
      scene.add(strapMesh);
    }

    // 2. Columns Placement
    const colH_m = 0.6;
    if (!isCombined) {
      const colGeo = new THREE.BoxGeometry(c2_m, colH_m, c1_m);
      const colMesh = new THREE.Mesh(colGeo, colMat);
      colMesh.position.set(0, fD_m + colH_m / 2, 0);
      scene.add(colMesh);
    } else {
      const col1Geo = new THREE.BoxGeometry(c1_m, colH_m, c1_m);
      const col1Mesh = new THREE.Mesh(col1Geo, colMat);
      col1Mesh.position.set(0, fD_m + colH_m / 2, -S_m / 2);
      scene.add(col1Mesh);

      const col2Geo = new THREE.BoxGeometry(c1_m, colH_m, c1_m);
      const col2Mesh = new THREE.Mesh(col2Geo, colMat);
      const stH_m = combinedSubType === 'strap' ? strapH / 1000 : 0;
      col2Mesh.position.set(0, fD_m + stH_m + colH_m / 2, S_m / 2);
      scene.add(col2Mesh);
    }

    // 3. Dynamic Rebar Cage Generation
    if (showRebarCage) {
      const cov_m = cover / 1000;
      const db_bot_m = Math.max(barDiam / 1000, 0.012);
      const db_top_m = Math.max(topBarDiam / 1000, 0.01);

      const rebarMatBot = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.8, roughness: 0.2 });
      const rebarMatTop = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.8, roughness: 0.2 });

      if (combinedSubType !== 'strap') {
        const segZ = 12;
        for (let j = 0; j <= segZ; j++) {
          const zPos = -fL_m / 2 + cov_m + (j * (fL_m - 2 * cov_m)) / segZ;
          let localB = fB_m;
          if (combinedSubType === 'trapezoidal') {
            const normZ = (zPos + fL_m / 2) / fL_m;
            localB = fB_m + normZ * (fB2_m - fB_m);
          }

          const barGeo = new THREE.CylinderGeometry(db_bot_m / 2, db_bot_m / 2, Math.max(localB - 2 * cov_m, 0.2), 8);
          barGeo.rotateZ(Math.PI / 2);
          const barMesh = new THREE.Mesh(barGeo, rebarMatBot);
          barMesh.position.set(0, cov_m + db_bot_m / 2, zPos);
          scene.add(barMesh);

          if (meshType === 'double_mesh' || isCombined) {
            const topY = fD_m - cov_m;
            const topBarGeo = new THREE.CylinderGeometry(db_top_m / 2, db_top_m / 2, Math.max(localB - 2 * cov_m, 0.2), 8);
            topBarGeo.rotateZ(Math.PI / 2);
            const topBarMesh = new THREE.Mesh(topBarGeo, rebarMatTop);
            topBarMesh.position.set(0, topY - db_top_m / 2, zPos);
            scene.add(topBarMesh);
          }
        }
      } else {
        // Strap Footing Rebar
        const L1_m = fL_m * 0.35;
        const L2_m = fL_m * 0.35;

        // Pad 1 Bot Mesh
        for (let j = 0; j <= 6; j++) {
          const zPos = -S_m / 2 - L1_m / 2 + cov_m + (j * (L1_m - 2 * cov_m)) / 6;
          const barGeo = new THREE.CylinderGeometry(db_bot_m / 2, db_bot_m / 2, fB_m - 2 * cov_m, 8);
          barGeo.rotateZ(Math.PI / 2);
          const barMesh = new THREE.Mesh(barGeo, rebarMatBot);
          barMesh.position.set(0, cov_m + db_bot_m / 2, zPos);
          scene.add(barMesh);
        }

        // Pad 2 Bot Mesh
        for (let j = 0; j <= 6; j++) {
          const zPos = S_m / 2 - L2_m / 2 + cov_m + (j * (L2_m - 2 * cov_m)) / 6;
          const barGeo = new THREE.CylinderGeometry(db_bot_m / 2, db_bot_m / 2, fB2_m - 2 * cov_m, 8);
          barGeo.rotateZ(Math.PI / 2);
          const barMesh = new THREE.Mesh(barGeo, rebarMatBot);
          barMesh.position.set(0, cov_m + db_bot_m / 2, zPos);
          scene.add(barMesh);
        }
      }
    }

    // 4. Soil Contact Stress Heatmap Plane
    if (result) {
      const qMax = result.geotechnical.q_max;
      const qMin = result.geotechnical.q_min;
      const qAllowVal = result.geotechnical.q_allow;

      if (combinedSubType !== 'strap') {
        const segX = 20;
        const segZ = 20;
        const soilGeo = new THREE.PlaneGeometry(1, 1, segX, segZ);
        soilGeo.rotateX(-Math.PI / 2);

        const posAttr = soilGeo.attributes.position;
        const count = posAttr.count;
        const colors = new Float32Array(count * 3);

        for (let i = 0; i < count; i++) {
          const normX = posAttr.getX(i);
          const normZ = posAttr.getY(i); // Z axis on plane after rotation

          const actualZ = normZ * fL_m;
          const zRatio = normZ + 0.5;

          let localWidth = fB_m;
          if (combinedSubType === 'trapezoidal') {
            localWidth = fB_m + zRatio * (fB2_m - fB_m);
          }

          posAttr.setX(i, normX * localWidth);
          posAttr.setZ(i, actualZ);

          const qLocal = qMin + zRatio * (qMax - qMin);
          const ratio = qLocal / Math.max(qAllowVal, 1);
          const color = getHeatmapColor(ratio);

          colors[i * 3] = color.r;
          colors[i * 3 + 1] = color.g;
          colors[i * 3 + 2] = color.b;

          posAttr.setY(i, -0.02 - (qLocal / Math.max(qMax, 1)) * 0.2 * soilPressureExag);
        }

        soilGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        soilGeo.computeVertexNormals();

        const soilMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
        const soilMesh = new THREE.Mesh(soilGeo, soilMat);
        scene.add(soilMesh);
      } else {
        // Dual Heatmaps for Strap Footing Pads
        const L1_m = fL_m * 0.35;
        const L2_m = fL_m * 0.35;

        [ { width: fB_m, len: L1_m, posZ: -S_m / 2 }, { width: fB2_m, len: L2_m, posZ: S_m / 2 } ].forEach((pad) => {
          const padGeo = new THREE.PlaneGeometry(pad.width, pad.len, 10, 10);
          padGeo.rotateX(-Math.PI / 2);

          const posAttr = padGeo.attributes.position;
          const count = posAttr.count;
          const colors = new Float32Array(count * 3);

          for (let i = 0; i < count; i++) {
            const color = getHeatmapColor(qMax / Math.max(qAllowVal, 1));
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
            posAttr.setY(i, -0.02 - 0.1 * soilPressureExag);
          }

          padGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
          const padMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
          const padMesh = new THREE.Mesh(padGeo, padMat);
          padMesh.position.set(0, 0, pad.posZ);
          scene.add(padMesh);
        });
      }
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
  }, [footingB, footingB2, footingL, footingD, cover, colC1, colC2, colSpacing, strapW, strapH, footingType, combinedSubType, meshType, barSpacing, topBarSpacing, barDiam, topBarDiam, viewMode, result, showWireframe, showRebarCage, soilPressureExag]);

  // --- PDF REPORT GENERATION ---
  const convertSvgToPng = (svgElement: SVGSVGElement, bgColor = '#0f172a'): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
        const bbox = svgElement.getBoundingClientRect();
        const w = bbox.width || 420;
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
            reject(new Error('Canvas unavailable'));
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

  const generatePDF = async () => {
    if (!result) return;
    setPdfGenerating(true);

    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const dateStr = new Date().toLocaleDateString();

      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 18, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(56, 189, 248);
      doc.text('HAYA STRUCTURES | FOUNDATION & REINFORCEMENT REPORT', 12, 10);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(226, 232, 240);
      doc.text(`Code: ${code} | Type: ${footingType.toUpperCase()} | Mesh: ${meshType.toUpperCase()} | Date: ${dateStr}`, 12, 15);

      autoTable(doc, {
        startY: 22,
        margin: { left: 12 },
        tableWidth: 90,
        head: [['Input Parameter', 'Value / Unit']],
        body: [
          ['Footing Type', footingType.replace(/_/g, ' ').toUpperCase()],
          ['Sub-Type / Layout', combinedSubType ? combinedSubType.toUpperCase() : meshType.toUpperCase()],
          ['Footing Size (B x L)', `${result.geometry.B} x ${result.geometry.L} mm`],
          ['Thickness (D) / Depth (d)', `${result.geometry.D} / ${result.geometry.d} mm`],
          ['Column Size (c1 x c2)', `${result.geometry.c1} x ${result.geometry.c2} mm`],
          ['Allowable Soil Capacity', `${result.geotechnical.q_allow} kPa`],
          ['Service Load (P / M)', `${Number(P_Dead) + Number(P_Live)} kN / ${Number(M_Dead) + Number(M_Live)} kN·m`],
          ['Concrete / Steel Strength', `${fc} / ${fy} MPa`],
          ['Bottom Mesh Rebar', `Ø${barDiam} @ ${barSpacing}mm (${result.structural.As_prov_bot} mm²)`],
          ['Top Mesh Rebar', meshType === 'double_mesh' || footingType === 'combined' ? `Ø${topBarDiam} @ ${topBarSpacing}mm (${result.structural.As_prov_top} mm²)` : 'None (Single Mesh)'],
        ],
        theme: 'grid',
        headStyles: { fillColor: [14, 116, 144], fontSize: 7.5, cellPadding: 2, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7, cellPadding: 1.8 },
      });

      autoTable(doc, {
        startY: 22,
        margin: { left: 108 },
        tableWidth: 90,
        head: [['Design Check & Capacity Summary', 'Result / Status']],
        body: [
          ['Max Soil Pressure (q_max)', `${result.geotechnical.q_max} kPa`],
          ['Min Soil Pressure (q_min)', `${result.geotechnical.q_min} kPa (${result.geotechnical.uplift ? 'UPLIFT' : 'No Tension'})`],
          ['Soil Bearing DCR', `${result.dcr.bearing_dcr} (${result.dcr.bearing_dcr <= 1 ? 'PASS' : 'FAIL'})`],
          ['One-Way Shear (Vu / φVc)', `${result.structural.Vu_1way} / ${result.structural.phiVc_1way} kN`],
          ['One-Way Shear DCR', `${result.dcr.shear_1way_dcr}`],
          ['Punching Shear (Vu / φVc)', `${result.structural.Vu_2way} / ${result.structural.phiVc_2way} kN`],
          ['Punching Shear DCR', `${result.dcr.shear_2way_dcr}`],
          ['Flexural Moment (Mu / φMn)', `${result.structural.Mu_flexure} / ${result.structural.phiMn} kN·m`],
          ['Bottom Steel Area (Req/Prov)', `${result.structural.As_req_bot} / ${result.structural.As_prov_bot} mm²`],
          ['Governing Failure State', result.governing_check],
          ['Overall Compliance', result.status],
        ],
        theme: 'grid',
        headStyles: { fillColor: [15, 118, 110], fontSize: 7.5, cellPadding: 2, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7, cellPadding: 1.8 },
      });

      let currentY = 104;
      const footingSvg = document.getElementById('footing-composite-svg') as unknown as SVGSVGElement;
      const canvas3D = mountRef.current?.querySelector('canvas');

      if (footingSvg || canvas3D) {
        try {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(15, 23, 42);
          doc.text('FOOTING 3D SOIL HEATMAP & 2D CAD DRAWINGS', 12, currentY);
          currentY += 4;

          if (canvas3D) {
            const img3D = canvas3D.toDataURL('image/png');
            doc.addImage(img3D, 'PNG', 12, currentY, 90, 52);
          }

          if (footingSvg) {
            const footingPng = await convertSvgToPng(footingSvg, '#0f172a');
            doc.addImage(footingPng, 'PNG', 108, currentY, 90, 52);
          }
          currentY += 56;
        } catch (e) {
          console.warn('Diagram PDF rendering failed:', e);
          currentY += 10;
        }
      }

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(12, currentY, 186, 26, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text('FOOTING STRUCTURAL DESIGN VERIFICATION', 16, currentY + 6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(51, 65, 85);
      doc.text(`Status: ${result.status === 'SAFE' ? 'APPROVED & COMPLIANT' : 'CRITICAL OVERSTRESS'}`, 16, currentY + 13);
      doc.text(`Governing Failure State: ${result.governing_check}`, 16, currentY + 19);

      doc.save(`Footing_${footingType}_${meshType}_Report.pdf`);
    } catch (e) {
      console.error('PDF error:', e);
      alert('Failed to generate PDF report.');
    } finally {
      setPdfGenerating(false);
    }
  };

  // --- SVG PLAN & ELEVATION VISUALIZER ---
  const renderCompositeSVG = () => {
    const w = 440;
    const h = 210;

    const planCx = 110;
    const planCy = 110;
    const scale = 120 / Math.max(footingB, footingB2, footingL);

    const pB = footingB * scale;
    const pB2 = footingB2 * scale;
    const pL = footingL * scale;
    const pC1 = colC1 * scale;
    const pC2 = colC2 * scale;
    const pS = colSpacing * scale;

    const elevX = 240;
    const elevY = 60;
    const elevW = 170;
    const elevH = 70;

    const qMaxVal = result ? result.geotechnical.q_max : 200;
    const qMinVal = result ? Math.max(result.geotechnical.q_min, 0) : 100;
    const pScale = 35 / Math.max(qMaxVal, 100);
    const hQMax = qMaxVal * pScale;
    const hQMin = qMinVal * pScale;

    return (
      <svg id="footing-composite-svg" viewBox={`0 0 ${w} ${h}`} className="w-full h-56 drop-shadow-md">
        <rect width="100%" height="100%" fill="#0f172a" rx="6" />
        <line x1="220" y1="15" x2="220" y2="195" stroke="#334155" strokeWidth="1" strokeDasharray="4 2" />

        {/* 1. PLAN VIEW */}
        <text x={planCx} y="20" fill="#cbd5e1" fontSize="9" textAnchor="middle" fontWeight="bold">
          PLAN VIEW ({footingType === 'combined' ? combinedSubType.toUpperCase() : 'ISOLATED/STRIP'})
        </text>

        {footingType !== 'combined' && (
          <g>
            <rect
              x={planCx - pB / 2}
              y={planCy - pL / 2}
              width={pB}
              height={pL}
              fill="#1e293b"
              stroke="#94a3b8"
              strokeWidth="1.5"
            />
            <rect
              x={planCx - (footingType === 'wall_strip' ? pB / 2 : pC2 / 2)}
              y={planCy - pC1 / 2}
              width={footingType === 'wall_strip' ? pB : pC2}
              height={pC1}
              fill="#38bdf8"
              stroke="#0284c7"
              strokeWidth="1.5"
            />
          </g>
        )}

        {footingType === 'combined' && combinedSubType === 'rectangular' && (
          <g>
            <rect
              x={planCx - pB / 2}
              y={planCy - pL / 2}
              width={pB}
              height={pL}
              fill="#1e293b"
              stroke="#94a3b8"
              strokeWidth="1.5"
            />
            <rect x={planCx - pC2 / 2} y={planCy - pS / 2 - pC1 / 2} width={pC2} height={pC1} fill="#38bdf8" stroke="#0284c7" strokeWidth="1.5" />
            <rect x={planCx - pC2 / 2} y={planCy + pS / 2 - pC1 / 2} width={pC2} height={pC1} fill="#38bdf8" stroke="#0284c7" strokeWidth="1.5" />
          </g>
        )}

        {footingType === 'combined' && combinedSubType === 'trapezoidal' && (
          <g>
            <polygon
              points={`${planCx - pB / 2},${planCy - pL / 2} ${planCx + pB / 2},${planCy - pL / 2} ${planCx + pB2 / 2},${planCy + pL / 2} ${planCx - pB2 / 2},${planCy + pL / 2}`}
              fill="#1e293b"
              stroke="#f59e0b"
              strokeWidth="1.5"
            />
            <rect x={planCx - pC2 / 2} y={planCy - pS / 2 - pC1 / 2} width={pC2} height={pC1} fill="#38bdf8" stroke="#0284c7" strokeWidth="1.5" />
            <rect x={planCx - pC2 / 2} y={planCy + pS / 2 - pC1 / 2} width={pC2} height={pC1} fill="#38bdf8" stroke="#0284c7" strokeWidth="1.5" />
          </g>
        )}

        {footingType === 'combined' && combinedSubType === 'strap' && (
          <g>
            <rect x={planCx - pB / 2} y={planCy - pS / 2 - (pL * 0.35) / 2} width={pB} height={pL * 0.35} fill="#1e293b" stroke="#94a3b8" strokeWidth="1.5" />
            <rect x={planCx - pB2 / 2} y={planCy + pS / 2 - (pL * 0.35) / 2} width={pB2} height={pL * 0.35} fill="#1e293b" stroke="#94a3b8" strokeWidth="1.5" />
            <rect x={planCx - (strapW * scale) / 2} y={planCy - pS / 2} width={strapW * scale} height={pS} fill="#0284c7" opacity="0.6" stroke="#38bdf8" strokeWidth="1.2" />
            <rect x={planCx - pC2 / 2} y={planCy - pS / 2 - pC1 / 2} width={pC2} height={pC1} fill="#38bdf8" stroke="#0284c7" strokeWidth="1.5" />
            <rect x={planCx - pC2 / 2} y={planCy + pS / 2 - pC1 / 2} width={pC2} height={pC1} fill="#38bdf8" stroke="#0284c7" strokeWidth="1.5" />
          </g>
        )}

        {/* 2. ELEVATION VIEW */}
        <text x={elevX + elevW / 2} y="20" fill="#cbd5e1" fontSize="9" textAnchor="middle" fontWeight="bold">
          ELEVATION & SOIL STRESS PROFILE
        </text>

        {footingType !== 'combined' || combinedSubType !== 'strap' ? (
          <g>
            <rect x={elevX} y={elevY} width={elevW} height={elevH} fill="#334155" stroke="#94a3b8" strokeWidth="1.5" />
            {footingType !== 'combined' ? (
              <rect x={elevX + elevW / 2 - 15} y={elevY - 25} width="30" height="25" fill="#38bdf8" stroke="#0284c7" strokeWidth="1.5" />
            ) : (
              <g>
                <rect x={elevX + 25} y={elevY - 25} width="25" height="25" fill="#38bdf8" stroke="#0284c7" strokeWidth="1.5" />
                <rect x={elevX + elevW - 50} y={elevY - 25} width="25" height="25" fill="#38bdf8" stroke="#0284c7" strokeWidth="1.5" />
              </g>
            )}
          </g>
        ) : (
          <g>
            <rect x={elevX + 10} y={elevY + 15} width="45" height={elevH - 15} fill="#334155" stroke="#94a3b8" strokeWidth="1.5" />
            <rect x={elevX + elevW - 55} y={elevY + 15} width="45" height={elevH - 15} fill="#334155" stroke="#94a3b8" strokeWidth="1.5" />
            <rect x={elevX + 55} y={elevY + 5} width={elevW - 110} height="25" fill="#0284c7" opacity="0.6" stroke="#38bdf8" strokeWidth="1.2" />
            <rect x={elevX + 20} y={elevY - 15} width="25" height="30" fill="#38bdf8" stroke="#0284c7" strokeWidth="1.5" />
            <rect x={elevX + elevW - 45} y={elevY - 15} width="25" height="30" fill="#38bdf8" stroke="#0284c7" strokeWidth="1.5" />
          </g>
        )}

        {/* Soil Heatmap Trapezoid */}
        <polygon
          points={`${elevX},${elevY + elevH + 4} ${elevX + elevW},${elevY + elevH + 4} ${elevX + elevW},${elevY + elevH + 4 + hQMax} ${elevX},${elevY + elevH + 4 + hQMin}`}
          fill="#f59e0b"
          opacity="0.3"
          stroke="#f59e0b"
          strokeWidth="1.5"
        />

        <text x={elevX - 2} y={elevY + elevH + 18} fill="#f59e0b" fontSize="7.5" textAnchor="end" fontWeight="bold">
          q_min={result ? result.geotechnical.q_min : 0}
        </text>
        <text x={elevX + elevW + 2} y={elevY + elevH + 18} fill="#f59e0b" fontSize="7.5" textAnchor="start" fontWeight="bold">
          q_max={result ? result.geotechnical.q_max : 0}
        </text>
      </svg>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-950 p-6 rounded-2xl border border-slate-800 text-slate-100 font-sans">
      <div className="lg:col-span-5 space-y-4 bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-xl">
        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
          <h3 className="font-semibold text-slate-200 text-sm">Foundation Config</h3>
          <select
            value={code}
            onChange={(e) => setCode(e.target.value as DesignCode)}
            className="bg-cyan-500/20 text-cyan-400 font-bold border border-cyan-500/30 rounded px-2 py-1 text-xs"
          >
            <option value="ACI318">ACI 318-19</option>
            <option value="EC2">Eurocode 2</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Foundation Type</label>
            <select
              value={footingType}
              onChange={(e) => setFootingType(e.target.value as FootingType)}
              className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-medium"
            >
              <option value="isolated_pad">Isolated Pad Footing</option>
              <option value="wall_strip">Continuous Wall / Strip</option>
              <option value="combined">Combined Footing</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Rebar Mesh Layout</label>
            <select
              value={meshType}
              onChange={(e) => setMeshType(e.target.value as MeshType)}
              className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-medium"
            >
              <option value="single_mesh">Single Mesh (Bottom)</option>
              <option value="double_mesh">Double Mesh (Top & Bot)</option>
            </select>
          </div>
        </div>

        {footingType === 'combined' && (
          <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
            <label className="block text-xs text-cyan-400 font-semibold">Combined Sub-Type</label>
            <select
              value={combinedSubType}
              onChange={(e) => setCombinedSubType(e.target.value as CombinedSubType)}
              className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-slate-200"
            >
              <option value="rectangular">Rectangular Combined</option>
              <option value="trapezoidal">Trapezoidal Combined</option>
              <option value="strap">Strap (Cantilever) Footing</option>
            </select>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <label className="block text-[10px] text-slate-400">Col Spacing S (mm)</label>
                <input
                  type="number"
                  value={colSpacing}
                  onChange={(e) => setColSpacing(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded p-1 text-xs text-slate-200 font-mono"
                />
              </div>
              {combinedSubType === 'trapezoidal' && (
                <div>
                  <label className="block text-[10px] text-slate-400">Width B2 (mm)</label>
                  <input
                    type="number"
                    value={footingB2}
                    onChange={(e) => setFootingB2(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded p-1 text-xs text-slate-200 font-mono"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Width B (mm)</label>
            <input
              type="number"
              value={footingB}
              onChange={(e) => setFootingB(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              {footingType === 'wall_strip' ? 'Unit (1000mm)' : 'Length L (mm)'}
            </label>
            <input
              type="number"
              disabled={footingType === 'wall_strip'}
              value={footingL}
              onChange={(e) => setFootingL(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-mono disabled:opacity-30"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Depth D (mm)</label>
            <input
              type="number"
              value={footingD}
              onChange={(e) => setFootingD(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              {footingType === 'wall_strip' ? 'Wall Thick c1 (mm)' : 'Column c1 (mm)'}
            </label>
            <input
              type="number"
              value={colC1}
              onChange={(e) => setColC1(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200 font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Column c2 (mm)</label>
            <input
              type="number"
              disabled={footingType === 'wall_strip'}
              value={colC2}
              onChange={(e) => setColC2(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200 font-mono disabled:opacity-40"
            />
          </div>
        </div>

        <div className="space-y-3 pt-2 border-t border-slate-800">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">q_allow (kPa)</label>
              <input
                type="number"
                value={qAllow}
                onChange={(e) => setQAllow(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Concrete f'c (MPa)</label>
              <input
                type="number"
                value={fc}
                onChange={(e) => setFc(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Bot Bar Ø (mm)</label>
              <input
                type="number"
                value={barDiam}
                onChange={(e) => setBarDiam(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Bot Spacing (mm)</label>
              <input
                type="number"
                value={barSpacing}
                onChange={(e) => setBarSpacing(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200 font-mono"
              />
            </div>
          </div>

          {(meshType === 'double_mesh' || footingType === 'combined') && (
            <div className="grid grid-cols-2 gap-3 p-2.5 bg-slate-950 rounded border border-slate-800">
              <div>
                <label className="block text-xs text-amber-400 mb-1">Top Bar Ø (mm)</label>
                <input
                  type="number"
                  value={topBarDiam}
                  onChange={(e) => setTopBarDiam(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-amber-400 mb-1">Top Spacing (mm)</label>
                <input
                  type="number"
                  value={topBarSpacing}
                  onChange={(e) => setTopBarSpacing(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-mono"
                />
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
          <div>
            <label className="block text-xs text-slate-400 mb-1">P1_Dead / P1_Live (kN)</label>
            <div className="flex gap-1">
              <input
                type="number"
                value={P_Dead}
                onChange={(e) => setP_Dead(Number(e.target.value))}
                className="w-1/2 bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-mono"
              />
              <input
                type="number"
                value={P_Live}
                onChange={(e) => setP_Live(Number(e.target.value))}
                className="w-1/2 bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">M1_Dead / M1_Live (kN·m)</label>
            <div className="flex gap-1">
              <input
                type="number"
                value={M_Dead}
                onChange={(e) => setM_Dead(Number(e.target.value))}
                className="w-1/2 bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-mono"
              />
              <input
                type="number"
                value={M_Live}
                onChange={(e) => setM_Live(Number(e.target.value))}
                className="w-1/2 bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-mono"
              />
            </div>
          </div>
        </div>

        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold py-2.5 rounded transition shadow-lg shadow-cyan-500/20 text-xs uppercase tracking-wider"
        >
          {loading ? 'Analyzing Foundation...' : `Run Analysis (${code})`}
        </button>

        {result && (
          <button
            onClick={generatePDF}
            disabled={pdfGenerating}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2 rounded transition shadow-lg text-xs"
          >
            {pdfGenerating ? 'Generating PDF Report...' : '📄 Download PDF Report (With Drawings)'}
          </button>
        )}
      </div>

      <div className="lg:col-span-7 space-y-6">
        {result && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center">
              <span className="text-[10px] text-slate-400 block mb-1">Soil Bearing DCR</span>
              <span className={`text-base font-bold font-mono ${result.dcr.bearing_dcr <= 1.0 ? 'text-emerald-400' : 'text-red-400'}`}>{result.dcr.bearing_dcr}</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center">
              <span className="text-[10px] text-slate-400 block mb-1">One-Way Shear DCR</span>
              <span className={`text-base font-bold font-mono ${result.dcr.shear_1way_dcr <= 1.0 ? 'text-emerald-400' : 'text-red-400'}`}>{result.dcr.shear_1way_dcr}</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center">
              <span className="text-[10px] text-slate-400 block mb-1">Punching Shear DCR</span>
              <span className={`text-base font-bold font-mono ${result.dcr.shear_2way_dcr <= 1.0 ? 'text-emerald-400' : 'text-red-400'}`}>{result.dcr.shear_2way_dcr}</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center">
              <span className="text-[10px] text-slate-400 block mb-1">Flexure DCR</span>
              <span className={`text-base font-bold font-mono ${result.dcr.flexure_dcr <= 1.0 ? 'text-emerald-400' : 'text-red-400'}`}>{result.dcr.flexure_dcr}</span>
            </div>
          </div>
        )}

        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-3">
          <div className="flex flex-wrap justify-between items-center gap-2 border-b border-slate-800 pb-2">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <span>FOUNDATION PLAN & ELEVATION VISUALIZER</span>
              <span className="text-cyan-400 font-mono text-[10px]">({footingType.toUpperCase()})</span>
            </h4>

            <div className="flex items-center space-x-1 bg-slate-950 p-0.5 rounded border border-slate-800">
              <button
                onClick={() => setViewMode('2d_composite')}
                className={`px-2 py-1 text-[10px] font-bold rounded ${viewMode === '2d_composite' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'}`}
              >
                2D CAD Views
              </button>
              <button
                onClick={() => setViewMode('3d')}
                className={`px-2 py-1 text-[10px] font-bold rounded ${viewMode === '3d' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'}`}
              >
                3D Soil Heatmap
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
                <span className="text-slate-400 text-[10px] whitespace-nowrap">Pressure Scale ({soilPressureExag}x):</span>
                <input
                  type="range"
                  min="0.5"
                  max="4.0"
                  step="0.1"
                  value={soilPressureExag}
                  onChange={(e) => setSoilPressureExag(Number(e.target.value))}
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
              </div>
            )}

            {(viewMode === '2d_composite' || viewMode === 'split') && (
              <div
                className={`w-full bg-slate-950 border border-slate-800 rounded-lg p-2 flex flex-col items-center justify-center relative ${
                  viewMode === '2d_composite' ? 'md:col-span-2' : ''
                }`}
              >
                {renderCompositeSVG()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
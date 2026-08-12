'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type DesignCode = 'ACI318' | 'EC2' | 'BS8110';
type ColumnSectionType =
  | 'rc_rectangular'
  | 'rc_circular'
  | 'steel_encased_i'
  | 'steel_encased_h'
  | 'steel_encased_t';

interface CapacityBreakdown {
  axial: {
    pc: number;
    ps: number;
    pa: number;
    pc_pct: number;
    ps_pct: number;
    pa_pct: number;
  };
  flexure: {
    mc: number;
    ms: number;
    ma: number;
    mc_pct: number;
    ms_pct: number;
    ma_pct: number;
  };
}

interface ColumnResult {
  section_type: ColumnSectionType;
  design_code: DesignCode;
  geometry: {
    b: number;
    h: number;
    cover: number;
    Ag: number;
    Ac: number;
    Ast: number;
    Ass: number;
  };
  loads: {
    Pu: number;
    Mux: number;
    Muy: number;
    Vu: number;
  };
  capacity: {
    phiPn_max: number;
    phiMnx: number;
    phiMny: number;
    phiVc: number;
  };
  breakdown: CapacityBreakdown;
  dcr: {
    axial_dcr: number;
    flexure_x_dcr: number;
    flexure_y_dcr: number;
    pm_interaction_dcr: number;
    shear_dcr: number;
    overall_dcr: number;
  };
  verification: {
    status: 'SAFE' | 'OVERSTRESSED';
    governing_check: string;
    rebar_ratio: number;
  };
  pm_envelope: { m: number; p: number }[];
}

// Utility to snapshot DOM SVG elements (2D drawing & Recharts) to PNG base64 for jsPDF inclusion
const captureSvgToCanvas = (containerEl: HTMLElement | null): Promise<string | null> => {
  return new Promise((resolve) => {
    if (!containerEl) return resolve(null);
    const svgEl = containerEl.querySelector('svg');
    if (!svgEl) return resolve(null);

    const xml = new XMLSerializer().serializeToString(svgEl);
    const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL ? URL.createObjectURL(svgBlob) : '';
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = 2; // High DPI rendering
      canvas.width = (svgEl.clientWidth || 300) * scale;
      canvas.height = (svgEl.clientHeight || 300) * scale;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0f172a'; // Slate 900 background matching
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        if (url) URL.revokeObjectURL(url);
        resolve(dataUrl);
      } else {
        resolve(null);
      }
    };
    img.onerror = () => {
      if (url) URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
};

export default function ColumnAnalysisTool() {
  const [designCode, setDesignCode] = useState<DesignCode>('ACI318');
  const [sectionType, setSectionType] = useState<ColumnSectionType>('steel_encased_i');
  const [viewMode, setViewMode] = useState<'3d' | '2d' | 'split'>('split');

  // Concrete Dimensions
  const [b, setB] = useState<number>(500);
  const [h, setH] = useState<number>(500);
  const [cover, setCover] = useState<number>(40);
  const [columnLength, setColumnLength] = useState<number>(3.5);

  // Encased Steel Section Dimensions
  const [ds, setDs] = useState<number>(300);
  const [bf, setBf] = useState<number>(200);
  const [tw, setTw] = useState<number>(10);
  const [tf, setTf] = useState<number>(15);

  // Material Strengths
  const [fc, setFc] = useState<number>(35);
  const [fy, setFy] = useState<number>(460);
  const [fys, setFys] = useState<number>(355);

  // Reinforcement
  const [barDiam, setBarDiam] = useState<number>(20);
  const [tieDiam, setTieDiam] = useState<number>(10);
  const [nx, setNx] = useState<number>(3);
  const [ny, setNy] = useState<number>(3);
  const [nTotalCircular, setNTotalCircular] = useState<number>(8);

  // Design Loads
  const [Pu, setPu] = useState<number>(1800);
  const [Mux, setMux] = useState<number>(150);
  const [Muy, setMuy] = useState<number>(80);
  const [Vu, setVu] = useState<number>(120);

  const [result, setResult] = useState<ColumnResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [downloadingPdf, setDownloadingPdf] = useState<boolean>(false);

  const mountRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const svg2dRef = useRef<HTMLDivElement>(null);

  const isEncased = sectionType.startsWith('steel_encased');
  const isCircular = sectionType === 'rc_circular';

  // --- 2D SECTION REBAR COORDINATE CALCULATOR ---
  const rebar2DPositions = useMemo(() => {
    const coords: { x: number; y: number }[] = [];
    const width = b;
    const height = isCircular ? b : h;
    const effCover = cover + tieDiam + barDiam / 2;

    if (isCircular) {
      const radius = width / 2 - effCover;
      const count = Math.max(nTotalCircular, 4);
      for (let i = 0; i < count; i++) {
        const angle = (2 * Math.PI * i) / count;
        coords.push({
          x: width / 2 + radius * Math.cos(angle),
          y: height / 2 + radius * Math.sin(angle),
        });
      }
    } else {
      const xLeft = effCover;
      const xRight = width - effCover;
      const yTop = effCover;
      const yBottom = height - effCover;

      const numX = Math.max(nx, 2);
      const numY = Math.max(ny, 2);

      const dx = (xRight - xLeft) / (numX - 1 || 1);
      const dy = (yBottom - yTop) / (numY - 1 || 1);

      for (let i = 0; i < numX; i++) {
        const xPos = xLeft + i * dx;
        coords.push({ x: xPos, y: yTop });
        coords.push({ x: xPos, y: yBottom });
      }
      for (let j = 1; j < numY - 1; j++) {
        const yPos = yTop + j * dy;
        coords.push({ x: xLeft, y: yPos });
        coords.push({ x: xRight, y: yPos });
      }
    }
    return coords;
  }, [b, h, cover, tieDiam, barDiam, nx, ny, nTotalCircular, isCircular]);

  // --- 3D WEBGL RENDERER ---
  useEffect(() => {
    if (viewMode === '2d') return;
    const mount = mountRef.current;
    if (!mount) return;

    const widthVal = mount.clientWidth || 400;
    const heightVal = mount.clientHeight || 260;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);

    const camera = new THREE.PerspectiveCamera(45, widthVal / heightVal, 0.1, 1000);
    camera.position.set(columnLength * 0.9, columnLength * 0.8, columnLength * 1.4);

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(widthVal, heightVal);
    renderer.setPixelRatio(window.devicePixelRatio);
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, columnLength / 2, 0);
    controls.update();

    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(10, 20, 15);
    scene.add(dirLight);

    const grid = new THREE.GridHelper(8, 16, 0x334155, 0x1e293b);
    grid.position.set(0, 0, 0);
    scene.add(grid);

    const wMeters = b / 1000;
    const hMeters = isCircular ? wMeters : h / 1000;
    let colMesh: THREE.Mesh;

    if (isCircular) {
      const colGeo = new THREE.CylinderGeometry(wMeters / 2, wMeters / 2, columnLength, 32);
      const colMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.6 });
      colMesh = new THREE.Mesh(colGeo, colMat);
    } else {
      const colGeo = new THREE.BoxGeometry(wMeters, columnLength, hMeters);
      const colMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.6 });
      colMesh = new THREE.Mesh(colGeo, colMat);
    }
    colMesh.position.set(0, columnLength / 2, 0);
    scene.add(colMesh);

    if (isEncased) {
      const dsM = ds / 1000;
      const bfM = bf / 1000;
      const twM = tw / 1000;
      const tfM = tf / 1000;
      const steelMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.8, roughness: 0.2 });
      const steelGroup = new THREE.Group();

      if (sectionType === 'steel_encased_i' || sectionType === 'steel_encased_h') {
        const tfMesh = new THREE.Mesh(new THREE.BoxGeometry(bfM, columnLength, tfM), steelMat);
        tfMesh.position.set(0, 0, dsM / 2 - tfM / 2);
        steelGroup.add(tfMesh);

        const bfMesh = new THREE.Mesh(new THREE.BoxGeometry(bfM, columnLength, tfM), steelMat);
        bfMesh.position.set(0, 0, -dsM / 2 + tfM / 2);
        steelGroup.add(bfMesh);

        const webMesh = new THREE.Mesh(new THREE.BoxGeometry(twM, columnLength, dsM - 2 * tfM), steelMat);
        webMesh.position.set(0, 0, 0);
        steelGroup.add(webMesh);
      } else if (sectionType === 'steel_encased_t') {
        const tfMesh = new THREE.Mesh(new THREE.BoxGeometry(bfM, columnLength, tfM), steelMat);
        tfMesh.position.set(0, 0, dsM / 2 - tfM / 2);
        steelGroup.add(tfMesh);

        const webMesh = new THREE.Mesh(new THREE.BoxGeometry(twM, columnLength, dsM - tfM), steelMat);
        webMesh.position.set(0, 0, -tfM / 2);
        steelGroup.add(webMesh);
      }

      steelGroup.position.set(0, columnLength / 2, 0);
      scene.add(steelGroup);
    }

    const rebarMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.9 });
    const barR = Math.max((barDiam / 1000) / 2, 0.004);

    rebar2DPositions.forEach((pt) => {
      const xPos = pt.x / 1000 - wMeters / 2;
      const zPos = pt.y / 1000 - hMeters / 2;
      const barMesh = new THREE.Mesh(new THREE.CylinderGeometry(barR, barR, columnLength - 0.1, 12), rebarMat);
      barMesh.position.set(xPos, columnLength / 2, zPos);
      scene.add(barMesh);
    });

    const arrowHelper = new THREE.ArrowHelper(
      new THREE.Vector3(0, -1, 0),
      new THREE.Vector3(0, columnLength + 0.8, 0),
      0.7,
      0xef4444,
      0.2,
      0.15
    );
    scene.add(arrowHelper);

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
  }, [b, h, columnLength, cover, sectionType, ds, bf, tw, tf, barDiam, tieDiam, rebar2DPositions, isCircular, isEncased, viewMode]);

  // --- MATHEMATICAL ANALYSIS & CAPACITY BREAKDOWN ENGINE ---
  const handleAnalyze = () => {
    setLoading(true);

    try {
      const grossB = Math.max(Number(b), 100);
      const grossH = isCircular ? grossB : Math.max(Number(h), 100);
      const Ag = isCircular ? (Math.PI / 4) * Math.pow(grossB, 2) : grossB * grossH;

      let totalRebars = 4;
      if (isCircular) {
        totalRebars = Math.max(Number(nTotalCircular), 4);
      } else if (isEncased) {
        totalRebars = 4;
      } else {
        const numX = Math.max(Number(nx), 2);
        const numY = Math.max(Number(ny), 2);
        totalRebars = 2 * numX + 2 * Math.max(numY - 2, 0);
      }
      const db = Math.max(Number(barDiam), 8);
      const Ast = totalRebars * (Math.PI / 4) * Math.pow(db, 2);

      let Ass = 0;
      let Zx_steel = 0;
      let Zy_steel = 0;

      const d_s = Math.min(Number(ds), grossH - 2 * cover - 20);
      const b_f = Math.min(Number(bf), grossB - 2 * cover - 20);
      const t_w = Math.min(Number(tw), b_f / 2);
      const t_f = Math.min(Number(tf), d_s / 2);

      if (isEncased) {
        if (sectionType === 'steel_encased_i' || sectionType === 'steel_encased_h') {
          Ass = 2 * b_f * t_f + (d_s - 2 * t_f) * t_w;
          Zx_steel = b_f * t_f * (d_s - t_f) + (t_w * Math.pow(d_s - 2 * t_f, 2)) / 4;
          Zy_steel = (2 * t_f * Math.pow(b_f, 2)) / 4 + ((d_s - 2 * t_f) * Math.pow(t_w, 2)) / 4;
        } else if (sectionType === 'steel_encased_t') {
          Ass = b_f * t_f + (d_s - t_f) * t_w;
          Zx_steel = (t_w * Math.pow(d_s - t_f, 2)) / 2 + b_f * t_f * (t_f / 2);
          Zy_steel = (t_f * Math.pow(b_f, 2)) / 4 + ((d_s - t_f) * Math.pow(t_w, 2)) / 4;
        }
      }

      const Ac = Math.max(Ag - Ast - Ass, Ag * 0.1);
      const f_c = Number(fc);
      const f_y = Number(fy);
      const f_ys = Number(fys);

      const Pc = (0.85 * f_c * Ac) / 1000;
      const Ps = (f_y * Ast) / 1000;
      const Pa = (f_ys * Ass) / 1000;
      const P0 = Pc + Ps + Pa;

      const pc_pct = Number(((Pc / P0) * 100).toFixed(1));
      const ps_pct = Number(((Ps / P0) * 100).toFixed(1));
      const pa_pct = Number(((Pa / P0) * 100).toFixed(1));

      const phi_axial = isCircular ? 0.75 : 0.65;
      const alpha_ecc = isCircular ? 0.85 : 0.8;
      const phiPn_max = Math.max(alpha_ecc * phi_axial * P0, 1.0);

      const d_eff_x = grossH - cover - Number(tieDiam) - db / 2;
      const d_eff_y = grossB - cover - Number(tieDiam) - db / 2;

      const Mc = (0.85 * f_c * grossB * Math.pow(grossH, 2)) / 4 / 1e6;
      const Ms = (0.8 * Ast * f_y * (d_eff_x - grossH / 2)) / 1e6;
      const Ma = (Zx_steel * f_ys) / 1e6;
      const M_tot = Mc + Ms + Ma || 1.0;

      const mc_pct = Number(((Mc / M_tot) * 100).toFixed(1));
      const ms_pct = Number(((Ms / M_tot) * 100).toFixed(1));
      const ma_pct = Number(((Ma / M_tot) * 100).toFixed(1));

      const phi_flexure = 0.7;
      const phiMnx = Math.max(phi_flexure * (0.8 * Mc + Ms + Ma), 1.0);
      const phiMny = Math.max(phi_flexure * (0.8 * ((0.85 * f_c * grossH * Math.pow(grossB, 2)) / 4 / 1e6) + (0.8 * Ast * f_y * (d_eff_y - grossB / 2)) / 1e6 + (Zy_steel * f_ys) / 1e6), 1.0);

      const phi_shear = 0.75;
      const Vc = (0.17 * Math.sqrt(f_c) * grossB * d_eff_x) / 1000;
      const phiVc = Math.max(phi_shear * Vc, 1.0);

      const p_u = Math.abs(Number(Pu));
      const m_ux = Math.abs(Number(Mux));
      const m_uy = Math.abs(Number(Muy));
      const v_u = Math.abs(Number(Vu));

      const axial_dcr = p_u / phiPn_max;
      const flexure_x_dcr = m_ux / phiMnx;
      const flexure_y_dcr = m_uy / phiMny;
      const shear_dcr = v_u / phiVc;

      let pm_interaction_dcr = 0;
      if (axial_dcr >= 0.2) {
        pm_interaction_dcr = axial_dcr + (8 / 9) * (flexure_x_dcr + flexure_y_dcr);
      } else {
        pm_interaction_dcr = axial_dcr / 2 + (flexure_x_dcr + flexure_y_dcr);
      }

      const overall_dcr = Math.max(pm_interaction_dcr, shear_dcr);
      const rebar_ratio = ((Ast + Ass) / Ag) * 100;

      let governing_check = 'P-M Interaction';
      if (shear_dcr > pm_interaction_dcr) governing_check = 'Shear Capacity';
      if (rebar_ratio < 0.8) governing_check = 'Min Rebar Ratio (< 0.8%)';
      if (rebar_ratio > 8.0) governing_check = 'Max Rebar Ratio (> 8.0%)';

      const pm_envelope: { m: number; p: number }[] = [];
      const steps = 15;
      for (let i = 0; i <= steps; i++) {
        const ratio = i / steps;
        const p_val = Number((phiPn_max * (1 - Math.pow(ratio, 1.4))).toFixed(1));
        const m_val = Number((phiMnx * Math.sin(ratio * Math.PI)).toFixed(1));
        pm_envelope.push({ m: m_val, p: Math.max(0, p_val) });
      }

      setResult({
        section_type: sectionType,
        design_code: designCode,
        geometry: {
          b: grossB,
          h: grossH,
          cover: Number(cover),
          Ag: Math.round(Ag),
          Ac: Math.round(Ac),
          Ast: Math.round(Ast),
          Ass: Math.round(Ass),
        },
        loads: { Pu: p_u, Mux: m_ux, Muy: m_uy, Vu: v_u },
        capacity: {
          phiPn_max: Number(phiPn_max.toFixed(1)),
          phiMnx: Number(phiMnx.toFixed(1)),
          phiMny: Number(phiMny.toFixed(1)),
          phiVc: Number(phiVc.toFixed(1)),
        },
        breakdown: {
          axial: {
            pc: Math.round(Pc),
            ps: Math.round(Ps),
            pa: Math.round(Pa),
            pc_pct,
            ps_pct,
            pa_pct,
          },
          flexure: {
            mc: Number(Mc.toFixed(1)),
            ms: Number(Ms.toFixed(1)),
            ma: Number(Ma.toFixed(1)),
            mc_pct,
            ms_pct,
            ma_pct,
          },
        },
        dcr: {
          axial_dcr: Number(axial_dcr.toFixed(3)),
          flexure_x_dcr: Number(flexure_x_dcr.toFixed(3)),
          flexure_y_dcr: Number(flexure_y_dcr.toFixed(3)),
          pm_interaction_dcr: Number(pm_interaction_dcr.toFixed(3)),
          shear_dcr: Number(shear_dcr.toFixed(3)),
          overall_dcr: Number(overall_dcr.toFixed(3)),
        },
        verification: {
          status: overall_dcr <= 1.0 && rebar_ratio >= 0.8 && rebar_ratio <= 8.0 ? 'SAFE' : 'OVERSTRESSED',
          governing_check,
          rebar_ratio: Number(rebar_ratio.toFixed(2)),
        },
        pm_envelope,
      });
    } catch (err) {
      console.error('Analysis error:', err);
    } finally {
      setLoading(false);
    }
  };

  // --- UPDATED PDF GENERATOR (NOW EMBEDS BOTH 2D & 3D VIEWS) ---
  const generatePDF = async () => {
    if (!result) return;
    setDownloadingPdf(true);

    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const dateStr = new Date().toLocaleDateString();

      // Header Band
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 18, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(56, 189, 248);
      doc.text('HAYA STRUCTURES | COMPOSITE COLUMN DESIGN REPORT', 10, 8);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(226, 232, 240);
      doc.text(`Code Standard: ${designCode} | Section: ${sectionType.toUpperCase()} | Date: ${dateStr}`, 10, 14);

      // Section 1: Visuals Band (2D Drawing, 3D Canvas, & P-M Diagram)
      doc.setFillColor(30, 41, 59);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.rect(10, 21, 190, 6, 'F');
      doc.text('1. 2D CROSS-SECTION DETAIL, 3D MODEL & P-M CAPACITY ENVELOPE', 12, 25);

      // Capture 2D Cross Section Drawing
      const img2D = await captureSvgToCanvas(svg2dRef.current);
      if (img2D) {
        doc.addImage(img2D, 'PNG', 10, 28, 60, 48);
      }

      // Capture WebGL 3D Model Canvas
      const canvas3D = mountRef.current?.querySelector('canvas');
      if (canvas3D) {
        const img3D = canvas3D.toDataURL('image/png');
        doc.addImage(img3D, 'PNG', 73, 28, 62, 48);
      }

      // Capture P-M Interaction Diagram
      const chartImg = await captureSvgToCanvas(chartRef.current);
      if (chartImg) {
        doc.addImage(chartImg, 'PNG', 138, 28, 62, 48);
      }

      // Section 2: Input & Capacity Verification Tables
      doc.setFillColor(30, 41, 59);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.rect(10, 78, 190, 6, 'F');
      doc.text('2. DESIGN PARAMETERS & SECTION CAPACITY BREAKDOWN', 12, 82);

      autoTable(doc, {
        startY: 85,
        margin: { left: 10 },
        tableWidth: 93,
        head: [['Input Parameter', 'Value / Unit']],
        body: [
          ['Section Type', sectionType.replace(/_/g, ' ').toUpperCase()],
          ['Section Dimensions', `${result.geometry.b} × ${result.geometry.h} mm`],
          ['Concrete Clear Cover', `${result.geometry.cover} mm`],
          ['Rebar Arrangement', isCircular ? `${nTotalCircular} Bars Total` : `${nx} × ${ny} Face Grid`],
          ['Concrete Strength (f\'c)', `${fc} MPa`],
          ['Rebar Yield (fy)', `${fy} MPa`],
          ...(isEncased ? [['Encased Steel Yield (fys)', `${fys} MPa`]] : []),
          ['Axial Load (Pu)', `${result.loads.Pu} kN`],
        ],
        theme: 'grid',
        headStyles: { fillColor: [14, 116, 144], fontSize: 7, cellPadding: 1.5 },
        bodyStyles: { fontSize: 7, cellPadding: 1.5 },
      });

      autoTable(doc, {
        startY: 85,
        margin: { left: 107 },
        tableWidth: 93,
        head: [['Material Component', 'Axial (kN)', 'Share (%)', 'Flexure (kNm)']],
        body: [
          ['Concrete Core', `${result.breakdown.axial.pc}`, `${result.breakdown.axial.pc_pct}%`, `${result.breakdown.flexure.mc}`],
          ['Rebar Cage', `${result.breakdown.axial.ps}`, `${result.breakdown.axial.ps_pct}%`, `${result.breakdown.flexure.ms}`],
          ...(isEncased ? [['Encased Steel', `${result.breakdown.axial.pa}`, `${result.breakdown.axial.pa_pct}%`, `${result.breakdown.flexure.ma}`]] : []),
          ['Total Design Capacity', `${result.capacity.phiPn_max}`, '100%', `${result.capacity.phiMnx}`],
          ['Governing Failure Check', result.verification.governing_check, '-', result.verification.status],
        ],
        theme: 'grid',
        headStyles: { fillColor: [15, 118, 110], fontSize: 7, cellPadding: 1.5 },
        bodyStyles: { fontSize: 7, cellPadding: 1.5 },
      });

      // Section 3: Demand Capacity Ratio Matrix
      doc.setFillColor(30, 41, 59);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.rect(10, 145, 190, 6, 'F');
      doc.text('3. DEMAND CAPACITY RATIO (DCR) MATRIX', 12, 149);

      autoTable(doc, {
        startY: 152,
        margin: { left: 10, right: 10 },
        tableWidth: 190,
        head: [['Limit State Check', 'Factored Demand', 'Factored Capacity', 'DCR Ratio', 'Verdict']],
        body: [
          ['Axial Compression', `${result.loads.Pu} kN`, `${result.capacity.phiPn_max} kN`, `${result.dcr.axial_dcr}`, result.dcr.axial_dcr <= 1.0 ? 'PASS' : 'FAIL'],
          ['Flexure X Axis', `${result.loads.Mux} kN·m`, `${result.capacity.phiMnx} kN·m`, `${result.dcr.flexure_x_dcr}`, result.dcr.flexure_x_dcr <= 1.0 ? 'PASS' : 'FAIL'],
          ['Flexure Y Axis', `${result.loads.Muy} kN·m`, `${result.capacity.phiMny} kN·m`, `${result.dcr.flexure_y_dcr}`, result.dcr.flexure_y_dcr <= 1.0 ? 'PASS' : 'FAIL'],
          ['Biaxial P-M Interaction', 'Interaction Surface', 'Envelope Boundary', `${result.dcr.pm_interaction_dcr}`, result.dcr.pm_interaction_dcr <= 1.0 ? 'PASS' : 'FAIL'],
          ['Shear Capacity (Vu)', `${result.loads.Vu} kN`, `${result.capacity.phiVc} kN`, `${result.dcr.shear_dcr}`, result.dcr.shear_dcr <= 1.0 ? 'PASS' : 'FAIL'],
        ],
        theme: 'striped',
        headStyles: { fillColor: [30, 41, 59], fontSize: 7, cellPadding: 1.8 },
        bodyStyles: { fontSize: 7, cellPadding: 1.5 },
      });

      // Engineering Approval Box
      const finalY = (doc as any).lastAutoTable.finalY + 6;

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(10, finalY, 110, 36, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text('ENGINEERING ASSUMPTIONS', 14, finalY + 6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(51, 65, 85);
      const notes = [
        `1. Verified per ${designCode} ultimate limit state conditions.`,
        '2. Steel profile assumes complete concrete encasement and strain compatibility.',
        '3. Rebar ratio bounded within code minimums (0.8%) and maximums (8.0%).',
      ];
      notes.forEach((note, idx) => {
        doc.text(note, 14, finalY + 13 + idx * 6);
      });

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(125, finalY, 75, 36, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text('VERIFICATION STAMP', 129, finalY + 6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text('Status:', 129, finalY + 14);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(
        result.verification.status === 'SAFE' ? 16 : 225,
        result.verification.status === 'SAFE' ? 185 : 29,
        result.verification.status === 'SAFE' ? 129 : 72
      );
      doc.text(result.verification.status === 'SAFE' ? 'APPROVED / COMPLIANT' : 'OVERSTRESSED', 142, finalY + 14);

      doc.setDrawColor(148, 163, 184);
      doc.line(129, finalY + 26, 192, finalY + 26);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(6);
      doc.setTextColor(100, 116, 139);
      doc.text('Authorized Structural Engineer Signature', 129, finalY + 30);

      // Footer
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 287, 210, 10, 'F');
      doc.setFontSize(6.5);
      doc.setTextColor(148, 163, 184);
      doc.text('Haya Structures - Verified Column Design Calculation Sheet | Page 1 of 1', 10, 293);

      doc.save(`Haya_Column_${designCode}_${sectionType}.pdf`);
    } catch (err) {
      console.error('PDF Export Error:', err);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const pmChartData = useMemo(() => {
    if (!result) return [];
    return result.pm_envelope.map((pt) => ({ m: pt.m, p: pt.p }));
  }, [result]);

  const appliedPointData = useMemo(() => {
    if (!result) return [];
    return [{ m: result.loads.Mux, p: result.loads.Pu }];
  }, [result]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-950 p-6 rounded-2xl border border-slate-800 text-slate-100 font-sans">
      {/* Controls Column */}
      <div className="lg:col-span-5 space-y-4 bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-xl">
        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
          <h3 className="font-semibold text-slate-200 text-sm">Column Controls & Properties</h3>
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

        <div>
          <label className="block text-xs text-slate-400 mb-1">Column Cross-Section Geometry</label>
          <select
            value={sectionType}
            onChange={(e) => setSectionType(e.target.value as ColumnSectionType)}
            className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200"
          >
            <option value="steel_encased_i">Composite Encased I-Section (UB/UC)</option>
            <option value="steel_encased_h">Composite Encased Heavy H-Section</option>
            <option value="steel_encased_t">Composite Encased T-Section</option>
            <option value="rc_rectangular">Standard RC Rectangular Column</option>
            <option value="rc_circular">Standard RC Circular Column</option>
          </select>
        </div>

        {/* Geometry Dimensions */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-[10px] text-slate-400">Width b (mm)</label>
            <input type="number" value={b} onChange={(e) => setB(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200" />
          </div>
          {!isCircular && (
            <div>
              <label className="block text-[10px] text-slate-400">Depth h (mm)</label>
              <input type="number" value={h} onChange={(e) => setH(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200" />
            </div>
          )}
          <div>
            <label className="block text-[10px] text-slate-400">Length L (m)</label>
            <input type="number" value={columnLength} onChange={(e) => setColumnLength(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200" />
          </div>
        </div>

        {/* Encased Steel Controls */}
        {isEncased && (
          <div className="p-2.5 bg-cyan-950/30 border border-cyan-800/40 rounded-lg space-y-2">
            <h4 className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wider">Encased Steel Profile Specs (mm)</h4>
            <div className="grid grid-cols-4 gap-1.5">
              <div>
                <label className="block text-[9px] text-slate-400">Depth ds</label>
                <input type="number" value={ds} onChange={(e) => setDs(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-xs text-slate-200" />
              </div>
              <div>
                <label className="block text-[9px] text-slate-400">Flange bf</label>
                <input type="number" value={bf} onChange={(e) => setBf(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-xs text-slate-200" />
              </div>
              <div>
                <label className="block text-[9px] text-slate-400">Web tw</label>
                <input type="number" value={tw} onChange={(e) => setTw(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-xs text-slate-200" />
              </div>
              <div>
                <label className="block text-[9px] text-slate-400">Flange tf</label>
                <input type="number" value={tf} onChange={(e) => setTf(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-xs text-slate-200" />
              </div>
            </div>
          </div>
        )}

        {/* Reinforcement Configurations */}
        <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
          <h4 className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">Reinforcement Configuration</h4>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[9px] text-slate-400">Cover (mm)</label>
              <input type="number" value={cover} onChange={(e) => setCover(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded p-1 text-xs text-slate-200" />
            </div>
            <div>
              <label className="block text-[9px] text-slate-400">Bar Diam (mm)</label>
              <input type="number" value={barDiam} onChange={(e) => setBarDiam(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded p-1 text-xs text-slate-200" />
            </div>
            <div>
              <label className="block text-[9px] text-slate-400">Tie Diam (mm)</label>
              <input type="number" value={tieDiam} onChange={(e) => setTieDiam(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded p-1 text-xs text-slate-200" />
            </div>
          </div>

          {isCircular ? (
            <div>
              <label className="block text-[9px] text-slate-400 mb-1">Total Rebars in Circle</label>
              <input type="number" value={nTotalCircular} onChange={(e) => setNTotalCircular(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-bold" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[9px] text-slate-400 mb-1">Bars along X Face (nx)</label>
                <input type="number" value={nx} onChange={(e) => setNx(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-bold" />
              </div>
              <div>
                <label className="block text-[9px] text-slate-400 mb-1">Bars along Y Face (ny)</label>
                <input type="number" value={ny} onChange={(e) => setNy(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-bold" />
              </div>
            </div>
          )}
        </div>

        {/* Material Strengths */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-[10px] text-slate-400">f'c (MPa)</label>
            <input type="number" value={fc} onChange={(e) => setFc(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200" />
          </div>
          <div>
            <label className="block text-[10px] text-slate-400">fy (MPa)</label>
            <input type="number" value={fy} onChange={(e) => setFy(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200" />
          </div>
          {isEncased && (
            <div>
              <label className="block text-[10px] text-slate-400">fys (MPa)</label>
              <input type="number" value={fys} onChange={(e) => setFys(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200" />
            </div>
          )}
        </div>

        {/* Applied Loads */}
        <div className="pt-2 border-t border-slate-800 space-y-2">
          <h4 className="font-semibold text-slate-200 text-xs">Applied Factored Actions</h4>
          <div className="grid grid-cols-4 gap-1.5">
            <div>
              <label className="block text-[9px] text-slate-400">Pu (kN)</label>
              <input type="number" value={Pu} onChange={(e) => setPu(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-xs text-slate-200" />
            </div>
            <div>
              <label className="block text-[9px] text-slate-400">Mux (kNm)</label>
              <input type="number" value={Mux} onChange={(e) => setMux(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-xs text-slate-200" />
            </div>
            <div>
              <label className="block text-[9px] text-slate-400">Muy (kNm)</label>
              <input type="number" value={Muy} onChange={(e) => setMuy(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-xs text-slate-200" />
            </div>
            <div>
              <label className="block text-[9px] text-slate-400">Vu (kN)</label>
              <input type="number" value={Vu} onChange={(e) => setVu(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-xs text-slate-200" />
            </div>
          </div>
        </div>

        <button onClick={handleAnalyze} disabled={loading} className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold py-2.5 rounded transition disabled:opacity-50 mt-4 text-xs">
          {loading ? 'Solving Column Response...' : 'Run Column Capacity & P-M Analysis'}
        </button>

        {result && (
          <div className="mt-4 pt-3 border-t border-slate-800 space-y-1.5 bg-slate-950 p-3 rounded-lg border border-slate-800">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-slate-400 font-bold uppercase">{designCode} Verdict:</span>
              <span className={`text-xs px-2 py-0.5 rounded font-bold ${result.verification.status === 'SAFE' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                {result.verification.status}
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Axial Capacity (φP_n): <span className="text-cyan-400 font-mono">{result.capacity.phiPn_max} kN</span>
            </p>
            <p className="text-xs text-slate-300">
              Moment Capacity (φM_nx): <span className="text-cyan-400 font-mono">{result.capacity.phiMnx} kN·m</span>
            </p>
            <p className="text-xs text-slate-300">
              Overall Combined DCR: <span className="text-emerald-400 font-mono">{result.dcr.overall_dcr}</span>
            </p>

            <button onClick={generatePDF} disabled={downloadingPdf} className="w-full mt-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2 rounded transition shadow-lg text-xs">
              {downloadingPdf ? 'Generating PDF Sheet...' : '📄 Download PDF Calculation Sheet'}
            </button>
          </div>
        )}
      </div>

      {/* Visual Models & Breakdown Column */}
      <div className="lg:col-span-7 space-y-4">
        {/* Visual Viewport Control */}
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex flex-col space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-slate-300">STRUCTURAL DRAWING & VISUALIZATION</h3>
            <div className="flex space-x-1 bg-slate-950 p-0.5 rounded border border-slate-800">
              <button
                onClick={() => setViewMode('2d')}
                className={`px-2 py-1 text-[10px] font-bold rounded ${viewMode === '2d' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'}`}
              >
                2D Section
              </button>
              <button
                onClick={() => setViewMode('3d')}
                className={`px-2 py-1 text-[10px] font-bold rounded ${viewMode === '3d' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'}`}
              >
                3D Model
              </button>
              <button
                onClick={() => setViewMode('split')}
                className={`px-2 py-1 text-[10px] font-bold rounded ${viewMode === 'split' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Dual View
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 min-h-[260px]">
            {/* 2D Cross Section SVG Drawing (Maintained for DOM + PDF Capture) */}
            <div
              ref={svg2dRef}
              className={`w-full bg-slate-950 border border-slate-800 rounded-lg p-2 flex-col items-center justify-center relative ${
                viewMode === '3d' ? 'hidden' : 'flex'
              } ${viewMode === '2d' ? 'md:col-span-2' : ''}`}
            >
              <div className="absolute top-2 left-2 text-[10px] font-semibold text-slate-400">2D Section Detail</div>
              <svg viewBox="-20 -20 540 540" className="w-full h-56 max-w-[240px]">
                {/* Concrete Core */}
                {isCircular ? (
                  <circle cx="250" cy="250" r="230" fill="#334155" stroke="#94a3b8" strokeWidth="4" />
                ) : (
                  <rect x="20" y="20" width="460" height="460" fill="#334155" stroke="#94a3b8" strokeWidth="4" rx="4" />
                )}

                {/* Stirrups / Ties */}
                {isCircular ? (
                  <circle cx="250" cy="250" r={230 - cover * 0.8} fill="none" stroke="#e2e8f0" strokeWidth="3" strokeDasharray="6 4" />
                ) : (
                  <rect x={20 + cover * 0.8} y={20 + cover * 0.8} width={460 - cover * 1.6} height={460 - cover * 1.6} fill="none" stroke="#e2e8f0" strokeWidth="3" strokeDasharray="6 4" />
                )}

                {/* Encased Structural Steel Profile Drawing */}
                {isEncased && (
                  <g>
                    {(sectionType === 'steel_encased_i' || sectionType === 'steel_encased_h') && (
                      <>
                        <rect x={250 - (bf / b) * 230} y={250 - (ds / h) * 230} width={(bf / b) * 460} height={(tf / h) * 460} fill="#38bdf8" stroke="#0284c7" strokeWidth="2" />
                        <rect x={250 - (bf / b) * 230} y={250 + (ds / h) * 230 - (tf / h) * 460} width={(bf / b) * 460} height={(tf / h) * 460} fill="#38bdf8" stroke="#0284c7" strokeWidth="2" />
                        <rect x={250 - (tw / b) * 230} y={250 - (ds / h) * 230 + (tf / h) * 460} width={(tw / b) * 460} height={(ds / h) * 460 - 2 * (tf / h) * 460} fill="#38bdf8" stroke="#0284c7" strokeWidth="2" />
                      </>
                    )}
                    {sectionType === 'steel_encased_t' && (
                      <>
                        <rect x={250 - (bf / b) * 230} y={250 - (ds / h) * 230} width={(bf / b) * 460} height={(tf / h) * 460} fill="#38bdf8" stroke="#0284c7" strokeWidth="2" />
                        <rect x={250 - (tw / b) * 230} y={250 - (ds / h) * 230 + (tf / h) * 460} width={(tw / b) * 460} height={(ds / h) * 460 - (tf / h) * 460} fill="#38bdf8" stroke="#0284c7" strokeWidth="2" />
                      </>
                    )}
                  </g>
                )}

                {/* Rebars */}
                {rebar2DPositions.map((pt, idx) => {
                  const cx = 20 + (pt.x / b) * 460;
                  const cy = 20 + (pt.y / (isCircular ? b : h)) * 460;
                  return <circle key={idx} cx={cx} cy={cy} r="10" fill="#ef4444" stroke="#7f1d1d" strokeWidth="2" />;
                })}

                {/* Dimension Annotations */}
                <text x="250" y="10" fill="#94a3b8" fontSize="18" textAnchor="middle" fontWeight="bold">
                  b = {b} mm
                </text>
                {!isCircular && (
                  <text x="500" y="250" fill="#94a3b8" fontSize="18" textAnchor="middle" fontWeight="bold" transform="rotate(90 500 250)">
                    h = {h} mm
                  </text>
                )}
              </svg>
            </div>

            {/* 3D Model Viewport */}
            {(viewMode === '3d' || viewMode === 'split') && (
              <div
                ref={mountRef}
                className={`w-full h-full bg-slate-950 border border-slate-800 rounded-lg overflow-hidden relative ${viewMode === '3d' ? 'md:col-span-2 min-h-[260px]' : ''}`}
              >
                <div className="absolute bottom-2 left-2 bg-slate-950/80 px-2 py-1 rounded text-[10px] text-slate-400 pointer-events-none">
                  Orbit: Drag | Zoom: Scroll
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section Capacity Breakdown Card */}
        {result && (
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-slate-300 border-b border-slate-800 pb-2">SECTION CAPACITY BREAKDOWN (MATERIAL CONTRIBUTIONS)</h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Axial Breakdown */}
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-semibold">Nominal Axial Capacity (P0)</span>
                  <span className="text-cyan-400 font-bold font-mono">
                    {result.breakdown.axial.pc + result.breakdown.axial.ps + result.breakdown.axial.pa} kN
                  </span>
                </div>

                <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden flex">
                  <div style={{ width: `${result.breakdown.axial.pc_pct}%` }} className="bg-slate-500 h-full" title={`Concrete: ${result.breakdown.axial.pc_pct}%`} />
                  <div style={{ width: `${result.breakdown.axial.ps_pct}%` }} className="bg-red-500 h-full" title={`Rebars: ${result.breakdown.axial.ps_pct}%`} />
                  {isEncased && <div style={{ width: `${result.breakdown.axial.pa_pct}%` }} className="bg-cyan-400 h-full" title={`Steel Profile: ${result.breakdown.axial.pa_pct}%`} />}
                </div>

                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-400 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-500 inline-block" /> Concrete Core (Pc):</span>
                    <span className="font-mono text-slate-200">{result.breakdown.axial.pc} kN ({result.breakdown.axial.pc_pct}%)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Rebar Cage (Ps):</span>
                    <span className="font-mono text-slate-200">{result.breakdown.axial.ps} kN ({result.breakdown.axial.ps_pct}%)</span>
                  </div>
                  {isEncased && (
                    <div className="flex justify-between">
                      <span className="text-slate-400 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" /> Encased Steel (Pa):</span>
                      <span className="font-mono text-slate-200">{result.breakdown.axial.pa} kN ({result.breakdown.axial.pa_pct}%)</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Flexural Breakdown */}
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-semibold">Flexural Contribution (Mnx)</span>
                  <span className="text-cyan-400 font-bold font-mono">
                    {Number((result.breakdown.flexure.mc + result.breakdown.flexure.ms + result.breakdown.flexure.ma).toFixed(1))} kNm
                  </span>
                </div>

                <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden flex">
                  <div style={{ width: `${result.breakdown.flexure.mc_pct}%` }} className="bg-slate-500 h-full" title={`Concrete: ${result.breakdown.flexure.mc_pct}%`} />
                  <div style={{ width: `${result.breakdown.flexure.ms_pct}%` }} className="bg-red-500 h-full" title={`Rebars: ${result.breakdown.flexure.ms_pct}%`} />
                  {isEncased && <div style={{ width: `${result.breakdown.flexure.ma_pct}%` }} className="bg-cyan-400 h-full" title={`Steel Profile: ${result.breakdown.flexure.ma_pct}%`} />}
                </div>

                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-400 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-500 inline-block" /> Concrete Core (Mc):</span>
                    <span className="font-mono text-slate-200">{result.breakdown.flexure.mc} kNm ({result.breakdown.flexure.mc_pct}%)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Rebar Cage (Ms):</span>
                    <span className="font-mono text-slate-200">{result.breakdown.flexure.ms} kNm ({result.breakdown.flexure.ms_pct}%)</span>
                  </div>
                  {isEncased && (
                    <div className="flex justify-between">
                      <span className="text-slate-400 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" /> Encased Steel (Ma):</span>
                      <span className="font-mono text-slate-200">{result.breakdown.flexure.ma} kNm ({result.breakdown.flexure.ma_pct}%)</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* P-M Interaction Chart */}
        {result && (
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-slate-300 border-b border-slate-800 pb-2">P-M INTERACTION DIAGRAM (CAPACITY ENVELOPE)</h4>
            <div ref={chartRef} className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={pmChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="m" stroke="#94a3b8" fontSize={10} name="Bending Moment (kNm)" />
                  <YAxis stroke="#94a3b8" fontSize={10} name="Axial Load (kN)" />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: 11 }} />
                  <ReferenceLine y={0} stroke="#64748b" />
                  <Line type="monotone" dataKey="p" stroke="#38bdf8" strokeWidth={2} dot={false} name="P-M Capacity Envelope" />
                  <Scatter data={appliedPointData} fill="#ef4444" name="Applied Load Point" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
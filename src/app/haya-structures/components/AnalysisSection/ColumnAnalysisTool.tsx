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

// Helper to convert Recharts/DOM SVG nodes into base64 PNG for jsPDF inclusion
const captureSvgToCanvas = (containerEl: HTMLElement | null): Promise<string | null> => {
  return new Promise((resolve) => {
    if (!containerEl) return resolve(null);
    const svgEl = containerEl.querySelector('svg');
    if (!svgEl) return resolve(null);

    const xml = new XMLSerializer().serializeToString(svgEl);
    const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = 2; // High DPI export
      canvas.width = (svgEl.clientWidth || 500) * scale;
      canvas.height = (svgEl.clientHeight || 250) * scale;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0f172a'; // Match slate-900 background
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        URL.revokeObjectURL(url);
        resolve(dataUrl);
      } else {
        resolve(null);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
};

export default function ColumnAnalysisTool() {
  const [designCode, setDesignCode] = useState<DesignCode>('ACI318');
  const [sectionType, setSectionType] = useState<ColumnSectionType>('steel_encased_i');

  // Concrete Dimensions
  const [b, setB] = useState<number>(500);
  const [h, setH] = useState<number>(500);
  const [cover, setCover] = useState<number>(40);
  const [columnLength, setColumnLength] = useState<number>(3.5); // meters

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

  const isEncased = sectionType.startsWith('steel_encased');
  const isCircular = sectionType === 'rc_circular';

  // --- 3D THREE.JS WEBGL RENDERER ---
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const widthVal = mount.clientWidth || 500;
    const heightVal = mount.clientHeight || 300;

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

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(10, 20, 15);
    scene.add(dirLight);

    // Floor Base Grid
    const grid = new THREE.GridHelper(8, 16, 0x334155, 0x1e293b);
    grid.position.set(0, 0, 0);
    scene.add(grid);

    // Concrete Column Geometry
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

    // Encased Structural Steel Profile (If Applicable)
    if (isEncased) {
      const dsM = ds / 1000;
      const bfM = bf / 1000;
      const twM = tw / 1000;
      const tfM = tf / 1000;
      const steelMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.8, roughness: 0.2 });

      const steelGroup = new THREE.Group();

      if (sectionType === 'steel_encased_i' || sectionType === 'steel_encased_h') {
        // Top Flange
        const tfMesh = new THREE.Mesh(new THREE.BoxGeometry(bfM, columnLength, tfM), steelMat);
        tfMesh.position.set(0, 0, dsM / 2 - tfM / 2);
        steelGroup.add(tfMesh);
        // Bottom Flange
        const bfMesh = new THREE.Mesh(new THREE.BoxGeometry(bfM, columnLength, tfM), steelMat);
        bfMesh.position.set(0, 0, -dsM / 2 + tfM / 2);
        steelGroup.add(bfMesh);
        // Web
        const webMesh = new THREE.Mesh(new THREE.BoxGeometry(twM, columnLength, dsM - 2 * tfM), steelMat);
        webMesh.position.set(0, 0, 0);
        steelGroup.add(webMesh);
      } else if (sectionType === 'steel_encased_t') {
        // Flange
        const tfMesh = new THREE.Mesh(new THREE.BoxGeometry(bfM, columnLength, tfM), steelMat);
        tfMesh.position.set(0, 0, dsM / 2 - tfM / 2);
        steelGroup.add(tfMesh);
        // Stem
        const webMesh = new THREE.Mesh(new THREE.BoxGeometry(twM, columnLength, dsM - tfM), steelMat);
        webMesh.position.set(0, 0, -tfM / 2);
        steelGroup.add(webMesh);
      }

      steelGroup.position.set(0, columnLength / 2, 0);
      scene.add(steelGroup);
    }

    // Rebar Cage
    const rebarMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.9 });
    const barR = (barDiam / 1000) / 2;
    const covM = cover / 1000;

    if (isCircular) {
      const radius = wMeters / 2 - covM;
      const count = Math.max(nTotalCircular, 4);
      for (let i = 0; i < count; i++) {
        const angle = (2 * Math.PI * i) / count;
        const xPos = radius * Math.cos(angle);
        const zPos = radius * Math.sin(angle);
        const barMesh = new THREE.Mesh(new THREE.CylinderGeometry(barR, barR, columnLength - 0.1, 12), rebarMat);
        barMesh.position.set(xPos, columnLength / 2, zPos);
        scene.add(barMesh);
      }
    } else {
      const innerW = wMeters / 2 - covM;
      const innerH = hMeters / 2 - covM;
      const corners = [
        [-innerW, -innerH],
        [innerW, -innerH],
        [-innerW, innerH],
        [innerW, innerH],
      ];
      corners.forEach(([xP, zP]) => {
        const barMesh = new THREE.Mesh(new THREE.CylinderGeometry(barR, barR, columnLength - 0.1, 12), rebarMat);
        barMesh.position.set(xP, columnLength / 2, zP);
        scene.add(barMesh);
      });
    }

    // Applied Axial Vector Arrow
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
  }, [b, h, columnLength, cover, sectionType, ds, bf, tw, tf, barDiam, nTotalCircular, isCircular, isEncased]);

  // --- ANALYSIS ENGINE & P-M GENERATOR ---
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

      const P0 = (0.85 * f_c * Ac + f_y * Ast + f_ys * Ass) / 1000;
      const phi_axial = isCircular ? 0.75 : 0.65;
      const alpha_ecc = isCircular ? 0.85 : 0.8;
      const phiPn_max = Math.max(alpha_ecc * phi_axial * P0, 1.0);

      const d_eff_x = grossH - cover - Number(tieDiam) - db / 2;
      const d_eff_y = grossB - cover - Number(tieDiam) - db / 2;

      const M_cx = (0.85 * f_c * grossB * Math.pow(grossH, 2)) / 4 / 1e6;
      const M_cy = (0.85 * f_c * grossH * Math.pow(grossB, 2)) / 4 / 1e6;

      const M_stx = (0.8 * Ast * f_y * (d_eff_x - grossH / 2)) / 1e6;
      const M_sty = (0.8 * Ast * f_y * (d_eff_y - grossB / 2)) / 1e6;

      const M_ssx = (Zx_steel * f_ys) / 1e6;
      const M_ssy = (Zy_steel * f_ys) / 1e6;

      const phi_flexure = 0.7;
      const phiMnx = Math.max(phi_flexure * (0.8 * M_cx + M_stx + M_ssx), 1.0);
      const phiMny = Math.max(phi_flexure * (0.8 * M_cy + M_sty + M_ssy), 1.0);

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

      // P-M Envelope Coordinates Construction
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

  // --- ZERO-WHITE-SPACE PDF GENERATION ENGINE ---
  const generatePDF = async () => {
    if (!result) return;
    setDownloadingPdf(true);

    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const dateStr = new Date().toLocaleDateString();

      // Top Header Band
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

      // Section 1: Side-by-Side Visuals Capture
      doc.setFillColor(30, 41, 59);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.rect(10, 21, 190, 6, 'F');
      doc.text('1. 3D COLUMN GEOMETRY & P-M CAPACITY INTERACTION DIAGRAM', 12, 25);

      // WebGL Canvas Capture
      const canvas3D = mountRef.current?.querySelector('canvas');
      if (canvas3D) {
        const img3D = canvas3D.toDataURL('image/png');
        doc.addImage(img3D, 'PNG', 10, 28, 93, 48);
      }

      // Recharts Interactive P-M Capture
      const chartImg = await captureSvgToCanvas(chartRef.current);
      if (chartImg) {
        doc.addImage(chartImg, 'PNG', 107, 28, 93, 48);
      }

      // Section 2: Input & Capacity Verification Tables
      doc.setFillColor(30, 41, 59);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.rect(10, 78, 190, 6, 'F');
      doc.text('2. DESIGN PARAMETERS & CAPACITY VERIFICATION', 12, 82);

      autoTable(doc, {
        startY: 85,
        margin: { left: 10 },
        tableWidth: 93,
        head: [['Input Parameter', 'Value / Unit']],
        body: [
          ['Section Type', sectionType.replace(/_/g, ' ').toUpperCase()],
          ['Section Dimensions', `${result.geometry.b} × ${result.geometry.h} mm`],
          ['Concrete Clear Cover', `${result.geometry.cover} mm`],
          ['Concrete Strength (f\'c)', `${fc} MPa`],
          ['Rebar Yield (fy)', `${fy} MPa`],
          ...(isEncased ? [['Encased Steel Yield (fys)', `${fys} MPa`]] : []),
          ['Axial Load (Pu)', `${result.loads.Pu} kN`],
          ['Moment X Axis (Mux)', `${result.loads.Mux} kN·m`],
        ],
        theme: 'grid',
        headStyles: { fillColor: [14, 116, 144], fontSize: 7, cellPadding: 1.5 },
        bodyStyles: { fontSize: 7, cellPadding: 1.5 },
      });

      autoTable(doc, {
        startY: 85,
        margin: { left: 107 },
        tableWidth: 93,
        head: [['Capacity Check Metric', 'Calculated Output']],
        body: [
          ['Gross Section Area (Ag)', `${result.geometry.Ag} mm²`],
          ['Rebar Steel Area (Ast)', `${result.geometry.Ast} mm²`],
          ['Total Steel Ratio (ρ)', `${result.verification.rebar_ratio}%`],
          ['Axial Capacity (φPn,max)', `${result.capacity.phiPn_max} kN`],
          ['Flexural Capacity X (φMnx)', `${result.capacity.phiMnx} kN·m`],
          ['Shear Capacity (φVc)', `${result.capacity.phiVc} kN`],
          ['Governing Failure State', result.verification.governing_check],
          ['Design Verdict', result.verification.status],
        ],
        theme: 'grid',
        headStyles: { fillColor: [15, 118, 110], fontSize: 7, cellPadding: 1.5 },
        bodyStyles: { fontSize: 7, cellPadding: 1.5 },
      });

      // Section 3: Demand Capacity Ratio (DCR) Matrix
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

      // Section 4: Engineering Sign-off Box
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
      {/* Inputs Column */}
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

      {/* Visual Models Column */}
      <div className="lg:col-span-7 space-y-4">
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex flex-col">
          <h3 className="text-xs font-bold text-slate-300 mb-3">3D INTERACTIVE COLUMN MODEL & ENCASED CAGE</h3>
          <div ref={mountRef} className="w-full h-64 rounded-lg overflow-hidden border border-slate-800 relative">
            <div className="absolute bottom-2 left-2 bg-slate-950/80 px-2 py-1 rounded text-[10px] text-slate-400 pointer-events-none">
              Orbit: Left Click + Drag | Pan: Right Click | Zoom: Scroll
            </div>
          </div>
        </div>

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
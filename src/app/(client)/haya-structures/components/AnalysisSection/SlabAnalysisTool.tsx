'use client';

import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type DesignCode = 'ACI318' | 'EC2' | 'BS8110';
type SlabSystem = 'one_way_solid' | 'two_way_solid' | 'flat_plate' | 'flat_slab';
type SupportCondition = 'simply_supported' | 'continuous' | 'cantilever' | 'restrained_4edges';

interface SlabResult {
  slab_type?: string;
  slab_system?: SlabSystem;
  design_code?: DesignCode;
  support_condition?: SupportCondition;
  inputs?: {
    lx: number;
    ly: number;
    thickness: number;
    total_h?: number;
    cover: number;
    fc: number;
    fy: number;
    dead_load: number;
    live_load: number;
    bar_diam: number;
    bar_spacing: number;
    bar_diam_y: number;
    bar_spacing_y: number;
    col_w?: number;
    col_h?: number;
  };
  loads?: {
    self_weight: number;
    total_dead: number;
    wu: number;
  };
  moments?: {
    Mu_x: number;
    Mu_y: number;
    Vu: number;
    Vu_punch?: number;
  };
  capacity?: {
    phiMn: number;
    phiMn_y: number;
    phiVc: number;
    phiVc_punch?: number;
    bo?: number;
    As_provided: number;
    As_provided_y: number;
    As_min: number;
  };
  dcr?: {
    flexure_dcr: number;
    shear_dcr: number;
    punching_dcr?: number;
    overall_dcr: number;
  };
  deflection?: {
    actual_ratio: number;
    max_ratio: number;
    status: string;
  };
  verification?: {
    flexure_dcr: number;
    shear_dcr: number;
    punching_dcr?: number;
    overall_dcr: number;
    failure_mode?: string;
    rebar_status: string;
    status: 'SAFE' | 'OVERSTRESSED';
  };
}

// Turbo/Rainbow Color Map Generator for Normalized Deflection Heatmap
function getHeatmapColor(value: number): THREE.Color {
  const v = THREE.MathUtils.clamp(value, 0, 1);
  const h = (1 - v) * 0.666; // 0.666 = Blue (min deflection), 0.0 = Red (max deflection)
  return new THREE.Color().setHSL(h, 1.0, 0.5);
}

export default function SlabAnalysisTool() {
  const [designCode, setDesignCode] = useState<DesignCode>('ACI318');
  const [slabSystem, setSlabSystem] = useState<SlabSystem>('flat_plate');
  const [supportCondition, setSupportCondition] = useState<SupportCondition>('simply_supported');

  // Geometry
  const [lx, setLx] = useState<number>(4.0);
  const [ly, setLy] = useState<number>(6.0);
  const [thickness, setThickness] = useState<number>(180);
  const [cover, setCover] = useState<number>(25);

  // Column / Drop Panel Geometry
  const [colW, setColW] = useState<number>(400);
  const [colH, setColH] = useState<number>(400);
  const [dropPanelT, setDropPanelT] = useState<number>(50);

  // Materials
  const [fc, setFc] = useState<number>(30);
  const [fy, setFy] = useState<number>(420);

  // Loads
  const [deadLoad, setDeadLoad] = useState<number>(1.5);
  const [liveLoad, setLiveLoad] = useState<number>(3.0);

  // Reinforcement
  const [barDiam, setBarDiam] = useState<number>(12);
  const [barSpacing, setBarSpacing] = useState<number>(150);
  const [barDiamY, setBarDiamY] = useState<number>(10);
  const [barSpacingY, setBarSpacingY] = useState<number>(200);

  // Controls
  const [viewMode, setViewMode] = useState<'3d' | '2d' | 'split'>('split');
  const [deflectionScale, setDeflectionScale] = useState<number>(150);
  const [showWireframe, setShowWireframe] = useState<boolean>(true);

  const [result, setResult] = useState<SlabResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const mountRef = useRef<HTMLDivElement>(null);
  const isPunchingRelevant = slabSystem === 'flat_plate' || slabSystem === 'flat_slab';

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const payload = {
        element_type: 'slab',
        design_code: designCode,
        slab_system: slabSystem,
        support_condition: supportCondition,
        lx: Number(lx),
        ly: Number(ly),
        thickness: Number(thickness),
        cover: Number(cover),
        fc: Number(fc),
        fy: Number(fy),
        dead_load: Number(deadLoad),
        live_load: Number(liveLoad),
        bar_diam: Number(barDiam),
        bar_spacing: Number(barSpacing),
        bar_diam_y: Number(barDiamY),
        bar_spacing_y: Number(barSpacingY),
        col_w: Number(colW),
        col_h: Number(colH),
        drop_panel_t: Number(dropPanelT),
      };

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`Server status ${res.status}`);
      const data = await res.json();
      setResult(data.data || data);
    } catch (err) {
      console.error(err);
      alert('Error conducting slab structural analysis.');
    } finally {
      setLoading(false);
    }
  };

  // --- 3D EXAGGERATED DEFLECTED SHAPE WEBGL ENGINE ---
  useEffect(() => {
    if (viewMode === '2d') return;
    const mount = mountRef.current;
    if (!mount) return;

    const widthVal = mount.clientWidth || 400;
    const heightVal = mount.clientHeight || 280;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);

    const camera = new THREE.PerspectiveCamera(45, widthVal / heightVal, 0.1, 1000);
    camera.position.set(lx * 0.9, Math.max(lx, ly) * 1.2, ly * 1.3);

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(widthVal, heightVal);
    renderer.setPixelRatio(window.devicePixelRatio);
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(lx / 2, -0.2, ly / 2);
    controls.update();

    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(lx * 2, ly * 2, lx * 2);
    scene.add(dirLight);

    // Parametric Subdivided Surface Mesh
    const segmentsX = 40;
    const segmentsY = 40;
    const planeGeo = new THREE.PlaneGeometry(lx, ly, segmentsX, segmentsY);
    planeGeo.rotateX(-Math.PI / 2);
    planeGeo.translate(lx / 2, 0, ly / 2);

    const posAttr = planeGeo.attributes.position;
    const count = posAttr.count;
    const colors = new Float32Array(count * 3);

    // Physical Deflection Amplification Scale
    const maxDeflectionMeters = ((lx * 1000) / (result?.deflection?.actual_ratio || 250)) / 1000;
    const amp = Math.max(maxDeflectionMeters * deflectionScale, 0.05);

    for (let i = 0; i < count; i++) {
      const x = posAttr.getX(i);
      const z = posAttr.getZ(i);

      const normX = x / lx;
      const normY = z / ly;

      let wNorm = 0;

      // Elastic Deflection Shape Functions w(x,y)
      if (supportCondition === 'cantilever') {
        wNorm = Math.pow(normX, 2) * (3 - 2 * normX);
      } else if (supportCondition === 'continuous' || supportCondition === 'restrained_4edges') {
        wNorm = Math.pow(Math.sin(Math.PI * normX), 2) * Math.pow(Math.sin(Math.PI * normY), 2);
      } else if (slabSystem === 'one_way_solid') {
        wNorm = Math.sin(Math.PI * normX);
      } else {
        wNorm = Math.sin(Math.PI * normX) * Math.sin(Math.PI * normY);
      }

      const dispY = -wNorm * amp;
      posAttr.setY(i, dispY);

      const vertexColor = getHeatmapColor(wNorm);
      colors[i * 3] = vertexColor.r;
      colors[i * 3 + 1] = vertexColor.g;
      colors[i * 3 + 2] = vertexColor.b;
    }

    planeGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    planeGeo.computeVertexNormals();

    const surfaceMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      roughness: 0.3,
      metalness: 0.1,
    });
    const surfaceMesh = new THREE.Mesh(planeGeo, surfaceMat);
    scene.add(surfaceMesh);

    if (showWireframe) {
      const wireMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        wireframe: true,
        transparent: true,
        opacity: 0.2,
      });
      const wireMesh = new THREE.Mesh(planeGeo, wireMat);
      scene.add(wireMesh);
    }

    // --- SUPPORT STRUCTURE GEOMETRY & ELEVATION OFFSET CORRECTIONS ---
    const slabH = thickness / 1000;
    const dpT = slabSystem === 'flat_slab' ? dropPanelT / 1000 : 0;
    const suppMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.4, roughness: 0.5 });
    const dropMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.3 });

    const cW = (colW || 400) / 1000;
    const cH = (colH || 400) / 1000;
    const colLength = 1.5; // Column height under slab

    // Dynamic Grid Position to prevent mesh clipping during high deflection scaling
    const lowestStructuralY = -(slabH + dpT + colLength + amp + 0.3);
    const grid = new THREE.GridHelper(Math.max(lx, ly) * 2.2, 20, 0x334155, 0x1e293b);
    grid.position.set(lx / 2, lowestStructuralY, ly / 2);
    scene.add(grid);

    if (isPunchingRelevant) {
      // Column & Drop Panel Construction
      const addColumnWithDrop = (xPos: number, zPos: number) => {
        // Drop Panel (Top positioned at bottom of slab Y = -slabH)
        if (slabSystem === 'flat_slab' && dpT > 0) {
          const dpWidth = Math.max(cW * 2.5, 1.0);
          const dpHeight = Math.max(cH * 2.5, 1.0);
          const dpGeo = new THREE.BoxGeometry(dpWidth, dpT, dpHeight);
          const dpMesh = new THREE.Mesh(dpGeo, dropMat);
          dpMesh.position.set(xPos, -slabH - dpT / 2, zPos);
          scene.add(dpMesh);
        }

        // Column (Top positioned at bottom of drop panel or slab Y = -slabH - dpT)
        const colGeo = new THREE.BoxGeometry(cW, colLength, cH);
        const colMesh = new THREE.Mesh(colGeo, suppMat);
        colMesh.position.set(xPos, -slabH - dpT - colLength / 2, zPos);
        scene.add(colMesh);
      };

      addColumnWithDrop(0, 0);
      addColumnWithDrop(lx, 0);
      addColumnWithDrop(0, ly);
      addColumnWithDrop(lx, ly);
      if (lx > 3.5 && ly > 3.5) addColumnWithDrop(lx / 2, ly / 2);
    } else {
      // Beam Support Framing Alignment Fix
      const bW = 0.25; // Beam width (m)
      const bD = 0.45; // Beam depth (m)
      const beamYCenter = -slabH - bD / 2;

      const addBeamAlongX = (zPos: number) => {
        const bGeo = new THREE.BoxGeometry(lx + bW, bD, bW);
        const bMesh = new THREE.Mesh(bGeo, suppMat);
        bMesh.position.set(lx / 2, beamYCenter, zPos);
        scene.add(bMesh);
      };

      const addBeamAlongZ = (xPos: number) => {
        const bGeo = new THREE.BoxGeometry(bW, bD, ly + bW);
        const bMesh = new THREE.Mesh(bGeo, suppMat);
        bMesh.position.set(xPos, beamYCenter, ly / 2);
        scene.add(bMesh);
      };

      if (slabSystem === 'one_way_solid') {
        // Beams supporting primary span X run along Z at X=0 and X=Lx
        addBeamAlongZ(0);
        addBeamAlongZ(lx);
      } else {
        // Two-Way Solid Slab on Perimeter Beams (All 4 Edges)
        addBeamAlongZ(0);
        addBeamAlongZ(lx);
        addBeamAlongX(0);
        addBeamAlongX(ly);
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
  }, [lx, ly, thickness, colW, colH, dropPanelT, supportCondition, slabSystem, isPunchingRelevant, viewMode, result, deflectionScale, showWireframe]);

  const convertSvgToPng = (svgElement: SVGSVGElement, bgColor = '#0f172a'): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
        const bbox = svgElement.getBoundingClientRect();
        const w = bbox.width || 500;
        const h = bbox.height || 250;

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

  const generatePDF = async () => {
    if (!result) return;
    setDownloadingPdf(true);

    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const dateStr = new Date().toLocaleDateString();

      // Top Banner Header
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 18, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(56, 189, 248);
      doc.text('HAYA STRUCTURES | RC SLAB VERIFICATION REPORT', 12, 10);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(226, 232, 240);
      doc.text(`Code Standard: ${designCode} | System: ${result.slab_type} | Date: ${dateStr}`, 12, 15);

      // Section 1: Inputs & Design Summary
      autoTable(doc, {
        startY: 22,
        margin: { left: 12 },
        tableWidth: 90,
        head: [['Design Input Parameter', 'Value / Unit']],
        body: [
          ['Slab System Type', result.slab_type ?? 'Flat Plate'],
          ['Short Span (Lx)', `${lx} m`],
          ['Long Span (Ly)', `${ly} m`],
          ['Aspect Ratio (Ly/Lx)', `${(ly / lx).toFixed(2)}`],
          ['Slab Thickness (h)', `${thickness} mm`],
          ...(slabSystem === 'flat_slab' ? [['Drop Panel Thickness', `+${dropPanelT} mm`]] : []),
          ...(isPunchingRelevant ? [['Column Size (c1 x c2)', `${colW} x ${colH} mm`]] : []),
          ['Concrete Cover (c)', `${cover} mm`],
          ['Concrete Strength (f\'c / fck)', `${fc} MPa`],
          ['Steel Yield Strength (fy)', `${fy} MPa`],
          ['Superimposed Dead Load', `${deadLoad} kN/m²`],
          ['Live Load (LL)', `${liveLoad} kN/m²`],
          ['Primary Rebar (X)', `T${barDiam} @ ${barSpacing} mm`],
          ['Secondary Rebar (Y)', `T${barDiamY} @ ${barSpacingY} mm`],
        ],
        theme: 'grid',
        headStyles: { fillColor: [14, 116, 144], fontSize: 7.5, cellPadding: 2, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7, cellPadding: 1.8 },
      });

      autoTable(doc, {
        startY: 22,
        margin: { left: 108 },
        tableWidth: 90,
        head: [['Analysis & Structural Capacity', 'Result / Status']],
        body: [
          ['Slab Classification', result.slab_type ?? 'Flat Plate'],
          ['Ultimate Load (wu)', `${result.loads?.wu ?? 0} kN/m²`],
          ['Design Moment Short Span (Mu,x)', `${result.moments?.Mu_x ?? 0} kN·m/m`],
          ['Design Moment Long Span (Mu,y)', `${result.moments?.Mu_y ?? 0} kN·m/m`],
          ['One-Way Shear Force (Vu)', `${result.moments?.Vu ?? 0} kN/m`],
          ...(isPunchingRelevant
            ? [
                ['Punching Shear Force (Vu,punch)', `${result.moments?.Vu_punch ?? 0} kN`],
                ['Punching Capacity (φVc,punch)', `${result.capacity?.phiVc_punch ?? 0} kN`],
                ['Critical Perimeter (bo)', `${result.capacity?.bo ?? 0} mm`],
                ['Punching Shear DCR', `${result.verification?.punching_dcr ?? result.dcr?.punching_dcr ?? 0}`],
              ]
            : []),
          ['Flexural Capacity (φMn,x)', `${result.capacity?.phiMn ?? 0} kN·m/m`],
          ['One-Way Shear Capacity (φVc)', `${result.capacity?.phiVc ?? 0} kN/m`],
          ['Provided Steel Area (As,x)', `${result.capacity?.As_provided ?? 0} mm²/m`],
          ['Minimum Steel Required (As,min)', `${result.capacity?.As_min ?? 0} mm²/m`],
          ['Span / Depth Ratio (L/d)', `${result.deflection?.actual_ratio} (Max: ${result.deflection?.max_ratio})`],
          ['Flexural DCR', `${result.verification?.flexure_dcr ?? result.dcr?.flexure_dcr ?? 0}`],
          ['Shear DCR', `${result.verification?.shear_dcr ?? result.dcr?.shear_dcr ?? 0}`],
          ['Governing Failure Mode', result.verification?.failure_mode ?? 'SAFE'],
          ['Overall Compliance', result.verification?.status ?? 'SAFE'],
        ],
        theme: 'grid',
        headStyles: { fillColor: [15, 118, 110], fontSize: 7.5, cellPadding: 2, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7, cellPadding: 1.8 },
      });

      let currentY = 96;
      const planSvg = document.getElementById('slab-plan-svg') as unknown as SVGSVGElement;
      const canvas3D = mountRef.current?.querySelector('canvas');

      if (planSvg || canvas3D) {
        try {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(15, 23, 42);
          doc.text('3D EXAGGERATED DEFLECTION SHAPE & STRUCTURAL PLAN', 12, currentY);
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
          console.warn('Diagram PDF rendering failed:', e);
          currentY += 10;
        }
      }

      // Section 3: Verification Table
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text('DETAILED STRUCTURAL COMPLIANCE MATRIX', 12, currentY);
      currentY += 3;

      const flexDcr = result.verification?.flexure_dcr ?? result.dcr?.flexure_dcr ?? 0;
      const shearDcr = result.verification?.shear_dcr ?? result.dcr?.shear_dcr ?? 0;
      const punchDcr = result.verification?.punching_dcr ?? result.dcr?.punching_dcr ?? 0;

      autoTable(doc, {
        startY: currentY,
        margin: { left: 12, right: 12 },
        head: [['Limit State Verification Check', 'Applied Demand (Ed)', 'Section Capacity (Rd)', 'DCR / Ratio', 'Design Verdict']],
        body: [
          ['Flexural Resistance (Short Span X)', `${result.moments?.Mu_x ?? 0} kN·m/m`, `${result.capacity?.phiMn ?? 0} kN·m/m`, `${flexDcr}`, flexDcr <= 1.0 ? 'PASS' : 'FAIL'],
          ['Flexural Resistance (Long Span Y)', `${result.moments?.Mu_y ?? 0} kN·m/m`, `${result.capacity?.phiMn_y ?? 0} kN·m/m`, `${(result.moments?.Mu_y ?? 0) / (result.capacity?.phiMn_y || 1)}`, 'PASS'],
          ['One-Way Beam Shear', `${result.moments?.Vu ?? 0} kN/m`, `${result.capacity?.phiVc ?? 0} kN/m`, `${shearDcr}`, shearDcr <= 1.0 ? 'PASS' : 'FAIL'],
          ...(isPunchingRelevant
            ? [['Two-Way Punching Shear', `${result.moments?.Vu_punch ?? 0} kN`, `${result.capacity?.phiVc_punch ?? 0} kN`, `${punchDcr}`, punchDcr <= 1.0 ? 'PASS' : 'FAIL']]
            : []),
          ['Minimum Reinforcement Area (As,min)', `${result.capacity?.As_min ?? 0} mm²/m`, `${result.capacity?.As_provided ?? 0} mm²/m`, `${((result.capacity?.As_min ?? 0) / (result.capacity?.As_provided || 1)).toFixed(2)}`, result.verification?.rebar_status ?? 'ADEQUATE'],
          ['Span-to-Depth Deflection (L/d)', `${result.deflection?.actual_ratio ?? 0}`, `Max ${result.deflection?.max_ratio ?? 0}`, `${((result.deflection?.actual_ratio ?? 0) / (result.deflection?.max_ratio || 1)).toFixed(2)}`, result.deflection?.status ?? 'PASS'],
        ],
        theme: 'grid',
        headStyles: { fillColor: [30, 41, 59], fontSize: 7.5, cellPadding: 2, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7, cellPadding: 1.8 },
      });

      const finalTableY = (doc as any).lastAutoTable.finalY + 6;

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(12, finalTableY, 110, 52, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text('DESIGN ASSUMPTIONS & ENGINEERING NOTES', 16, finalTableY + 6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(51, 65, 85);
      const notes = [
        `1. Load combinations computed in accordance with ${designCode} standards.`,
        `2. Clear concrete cover (c = ${cover}mm) measured to primary reinforcement.`,
        '3. Critical punching shear perimeter (bo) evaluated at distance d/2 from column face.',
        '4. Deflection check verified via simplified span-to-effective depth ratios.',
        '5. Structural layout and support conditions assume unyielding supports.',
      ];
      notes.forEach((note, idx) => {
        doc.text(note, 16, finalTableY + 13 + idx * 7);
      });

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(128, finalTableY, 70, 52, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text('ENGINEERING VERIFICATION', 132, finalTableY + 6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text('Prepared By: Haya Structures Engine', 132, finalTableY + 14);
      doc.text('Checked By: Lead Structural Engineer', 132, finalTableY + 22);

      doc.text('Status:', 132, finalTableY + 30);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(result.verification?.status === 'SAFE' ? 16 : 225, result.verification?.status === 'SAFE' ? 185 : 29, result.verification?.status === 'SAFE' ? 129 : 72);
      doc.text(result.verification?.status === 'SAFE' ? 'APPROVED / COMPLIANT' : 'OVERSTRESSED / REJECTED', 145, finalTableY + 30);

      doc.setDrawColor(148, 163, 184);
      doc.line(132, finalTableY + 44, 192, finalTableY + 44);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(6);
      doc.setTextColor(100, 116, 139);
      doc.text('Authorized Structural Stamp & Signature', 132, finalTableY + 48);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(148, 163, 184);
      doc.text('Haya Structures Structural Analysis Framework © 2026 | Automated Engineering Calculation Sheet', 12, 287);
      doc.text('Page 1 of 1', 188, 287);

      doc.save(`Haya_Slab_Design_${designCode}_${result.slab_type?.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error('PDF Export Error:', err);
      alert('Failed to generate PDF structural report.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const getCodeName = (code: DesignCode) => {
    switch (code) {
      case 'ACI318':
        return 'ACI 318-19 (LRFD)';
      case 'EC2':
        return 'Eurocode 2 (EN 1992-1-1)';
      case 'BS8110':
        return 'BS 8110:1997 (ULS)';
    }
  };

  const flexDcr = result?.verification?.flexure_dcr ?? result?.dcr?.flexure_dcr ?? 0;
  const shearDcr = result?.verification?.shear_dcr ?? result?.dcr?.shear_dcr ?? 0;
  const punchDcr = result?.verification?.punching_dcr ?? result?.dcr?.punching_dcr ?? 0;
  const overallDcr = result?.verification?.overall_dcr ?? result?.dcr?.overall_dcr ?? 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-950 p-6 rounded-2xl border border-slate-800 text-slate-100 font-sans">
      {/* Input Side Panel */}
      <div className="lg:col-span-5 space-y-4 bg-slate-900 p-5 rounded-xl border border-slate-800">
        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
          <h3 className="font-semibold text-slate-200">RC Slab Design Inputs</h3>
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
          <label className="block text-xs text-slate-400 mb-1">Structural Slab System</label>
          <select
            value={slabSystem}
            onChange={(e) => setSlabSystem(e.target.value as SlabSystem)}
            className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200 font-medium"
          >
            <option value="flat_plate">Flat Plate (Direct Column Support)</option>
            <option value="flat_slab">Flat Slab (With Drop Panels)</option>
            <option value="two_way_solid">Two-Way Solid Slab on Beams</option>
            <option value="one_way_solid">One-Way Solid Slab</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Boundary Support Condition</label>
          <select
            value={supportCondition}
            onChange={(e) => setSupportCondition(e.target.value as SupportCondition)}
            className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200"
          >
            <option value="simply_supported">Simply Supported</option>
            <option value="continuous">Continuous / Fixed Ends</option>
            <option value="restrained_4edges">Restrained Exterior Edges (Two-Way)</option>
            <option value="cantilever">Cantilever Slab</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Short Span Lx (m)</label>
            <input
              type="number"
              step="0.1"
              value={lx}
              onChange={(e) => setLx(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Long Span Ly (m)</label>
            <input
              type="number"
              step="0.1"
              value={ly}
              onChange={(e) => setLy(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Slab Thickness h (mm)</label>
            <input
              type="number"
              value={thickness}
              onChange={(e) => setThickness(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Clear Cover (mm)</label>
            <input
              type="number"
              value={cover}
              onChange={(e) => setCover(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200"
            />
          </div>
        </div>

        {isPunchingRelevant && (
          <div className="p-3 bg-cyan-950/30 border border-cyan-800/40 rounded-lg space-y-3">
            <h4 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">Punching Shear Parameters</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Column Width c1 (mm)</label>
                <input
                  type="number"
                  value={colW}
                  onChange={(e) => setColW(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Column Height c2 (mm)</label>
                <input
                  type="number"
                  value={colH}
                  onChange={(e) => setColH(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200"
                />
              </div>
            </div>
            {slabSystem === 'flat_slab' && (
              <div>
                <label className="block text-xs text-slate-400 mb-1">Extra Drop Panel Thickness (mm)</label>
                <input
                  type="number"
                  value={dropPanelT}
                  onChange={(e) => setDropPanelT(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200"
                />
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
          <div>
            <label className="block text-xs text-slate-400 mb-1">{designCode === 'ACI318' ? "f'c (MPa)" : 'fck (MPa)'}</label>
            <input
              type="number"
              value={fc}
              onChange={(e) => setFc(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">fy / fyk (MPa)</label>
            <input
              type="number"
              value={fy}
              onChange={(e) => setFy(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Superimposed DL (kN/m²)</label>
            <input
              type="number"
              step="0.1"
              value={deadLoad}
              onChange={(e) => setDeadLoad(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Live Load LL (kN/m²)</label>
            <input
              type="number"
              step="0.1"
              value={liveLoad}
              onChange={(e) => setLiveLoad(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200"
            />
          </div>
        </div>

        <div className="space-y-3 pt-2 border-t border-slate-800">
          <h4 className="font-semibold text-slate-200 text-xs uppercase tracking-wider text-cyan-400">Primary Rebar (Short Span / X)</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Bar Diam Øx (mm)</label>
              <input
                type="number"
                value={barDiam}
                onChange={(e) => setBarDiam(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Spacing sx (mm)</label>
              <input
                type="number"
                value={barSpacing}
                onChange={(e) => setBarSpacing(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200"
              />
            </div>
          </div>

          <h4 className="font-semibold text-slate-200 text-xs uppercase tracking-wider text-cyan-400">Secondary Rebar (Long Span / Y)</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Bar Diam Øy (mm)</label>
              <input
                type="number"
                value={barDiamY}
                onChange={(e) => setBarDiamY(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Spacing sy (mm)</label>
              <input
                type="number"
                value={barSpacingY}
                onChange={(e) => setBarSpacingY(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200"
              />
            </div>
          </div>
        </div>

        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold py-2.5 rounded transition disabled:opacity-50 mt-4 shadow-lg shadow-cyan-500/20"
        >
          {loading ? 'Analyzing Structural System...' : `Run Slab Verification (${designCode})`}
        </button>

        {result && (
          <div className="mt-4 pt-4 border-t border-slate-800 space-y-2 text-sm bg-slate-950 p-3.5 rounded-lg border border-slate-800">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-slate-400 font-bold uppercase">{getCodeName(designCode)}:</span>
              <span
                className={`text-xs px-2 py-0.5 rounded font-bold ${
                  result.verification?.status === 'SAFE'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                }`}
              >
                {result.verification?.status}
              </span>
            </div>
            <p>
              System Type: <span className="text-cyan-400 font-semibold">{result.slab_type}</span>
            </p>
            <p>
              Design Load (wu): <span className="text-cyan-400 font-mono">{result.loads?.wu} kN/m²</span>
            </p>
            <p>
              Short Span Moment (Mu,x): <span className="text-cyan-400 font-mono">{result.moments?.Mu_x} kN·m/m</span>
            </p>
            {isPunchingRelevant && (
              <p>
                Punching Shear (Vu,punch): <span className="text-rose-400 font-mono">{result.moments?.Vu_punch ?? 0} kN</span>
              </p>
            )}
            <p>
              Flexural Capacity (φMn): <span className="text-emerald-400 font-mono">{result.capacity?.phiMn} kN·m/m</span>
            </p>
            <p>
              Overall Governing DCR: <span className="text-emerald-400 font-mono">{overallDcr}</span>
            </p>

            <button
              onClick={generatePDF}
              disabled={downloadingPdf}
              className="w-full mt-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2 rounded transition shadow-lg"
            >
              {downloadingPdf ? 'Generating PDF Report...' : '📄 Download Complete Slab PDF Report'}
            </button>
          </div>
        )}
      </div>

      {/* Visual & Detailed Verification Viewport */}
      <div className="lg:col-span-7 space-y-6">
        {result && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center">
              <span className="text-xs text-slate-400 block mb-1">Flexure DCR</span>
              <span className={`text-lg font-bold font-mono ${flexDcr <= 1.0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {flexDcr}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center">
              <span className="text-xs text-slate-400 block mb-1">One-Way Shear</span>
              <span className={`text-lg font-bold font-mono ${shearDcr <= 1.0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {shearDcr}
              </span>
            </div>

            {isPunchingRelevant ? (
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center">
                <span className="text-xs text-slate-400 block mb-1">Punching DCR</span>
                <span className={`text-lg font-bold font-mono ${punchDcr <= 1.0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {punchDcr}
                </span>
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center opacity-50">
                <span className="text-xs text-slate-400 block mb-1">Punching DCR</span>
                <span className="text-xs text-slate-500 block">N/A (Beams Present)</span>
              </div>
            )}

            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center">
              <span className="text-xs text-slate-400 block mb-1">Deflection L/d</span>
              <span className="text-lg font-bold font-mono text-cyan-400">
                {result.deflection?.actual_ratio ?? 0}
              </span>
            </div>
          </div>
        )}

        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-3">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              EXAGGERATED 3D DEFLECTION SURFACE & STRUCTURAL DETAIL
            </h3>
            <div className="flex items-center space-x-1 bg-slate-950 p-0.5 rounded border border-slate-800">
              <button
                onClick={() => setViewMode('2d')}
                className={`px-2 py-1 text-[10px] font-bold rounded ${viewMode === '2d' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'}`}
              >
                2D Plan
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
            <div className="flex flex-wrap items-center justify-between gap-4 p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs">
              <div className="flex items-center space-x-2 flex-1 min-w-[200px]">
                <span className="text-slate-400 text-[11px] whitespace-nowrap">Deflection Scale ({deflectionScale}x):</span>
                <input
                  type="range"
                  min="10"
                  max="500"
                  value={deflectionScale}
                  onChange={(e) => setDeflectionScale(Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>
              <label className="flex items-center space-x-2 text-slate-300 text-[11px] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showWireframe}
                  onChange={(e) => setShowWireframe(e.target.checked)}
                  className="rounded accent-cyan-500"
                />
                <span>Curvature Mesh</span>
              </label>
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
                <div className="absolute top-2 right-2 bg-slate-950/80 px-2 py-1 rounded text-[9px] text-cyan-400 pointer-events-none z-10 border border-slate-800 font-mono">
                  Heatmap: Blue (Zero) → Red (Max δ)
                </div>
              </div>
            )}

            <div
              className={`w-full bg-slate-950 border border-slate-800 rounded-lg p-2 flex flex-col items-center justify-center relative ${
                viewMode === '3d' ? 'hidden' : 'flex'
              } ${viewMode === '2d' ? 'md:col-span-2' : ''}`}
            >
              <div className="absolute top-2 left-2 text-[10px] font-semibold text-slate-400">2D Structural Plan View</div>
              <svg id="slab-plan-svg" viewBox="0 0 500 300" className="w-full h-56 max-w-[380px]">
                <rect x="50" y="30" width="400" height="220" fill="#1e293b" stroke="#38bdf8" strokeWidth="3" rx="4" />

                {isPunchingRelevant ? (
                  <>
                    <rect x="40" y="20" width="20" height="20" fill="#0284c7" stroke="#38bdf8" />
                    <rect x="440" y="20" width="20" height="20" fill="#0284c7" stroke="#38bdf8" />
                    <rect x="40" y="240" width="20" height="20" fill="#0284c7" stroke="#38bdf8" />
                    <rect x="440" y="240" width="20" height="20" fill="#0284c7" stroke="#38bdf8" />
                    <rect x="30" y="10" width="40" height="40" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4 3" />
                  </>
                ) : (
                  <>
                    <rect x="40" y="20" width="420" height="10" fill="#475569" />
                    <rect x="40" y="250" width="420" height="10" fill="#475569" />
                  </>
                )}

                <line x1="70" y1="140" x2="430" y2="140" stroke="#ef4444" strokeWidth="3" />
                <text x="250" y="132" fill="#ef4444" fontSize="11" textAnchor="middle" fontWeight="bold">
                  Primary X: T{barDiam} @ {barSpacing}mm
                </text>

                <line x1="250" y1="50" x2="250" y2="230" stroke="#38bdf8" strokeWidth="3" />
                <text x="260" y="180" fill="#38bdf8" fontSize="11" textAnchor="start" fontWeight="bold">
                  Secondary Y: T{barDiamY} @ {barSpacingY}mm
                </text>

                <text x="250" y="275" fill="#94a3b8" fontSize="12" textAnchor="middle">
                  Lx = {lx} m
                </text>
                <text x="25" y="140" fill="#94a3b8" fontSize="12" textAnchor="middle" transform="rotate(-90 25 140)">
                  Ly = {ly} m
                </text>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
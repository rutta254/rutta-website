'use client';

import React, { useState, useMemo } from 'react';

// Structural Elements & Codes
export type StructuralElement = 'foundation' | 'beam' | 'column' | 'slab' | 'wall' | 'truss' | 'frame';
export type DesignCode = 'ACI318' | 'EC2' | 'IS456' | 'BS8110' | 'AS3600' | 'CSA_A23';

// Foundation Classification Hierarchy
export type FoundationCategory = 'shallow' | 'deep';
export type ShallowType = 'isolated' | 'strip' | 'raft' | 'combined';
export type CombinedSubtype = 'rectangular' | 'trapezoidal' | 'strap';
export type DeepType = 'pile_cap' | 'bored_pile' | 'driven_pile' | 'micropile';

export interface SoilPreset {
  id: string;
  label: string;
  q: number;
  isCustom?: boolean;
}

const DEFAULT_SOIL_PRESETS: SoilPreset[] = [
  { id: '1', label: 'Soft Clay', q: 100 },
  { id: '2', label: 'Stiff Clay', q: 150 },
  { id: '3', label: 'Med. Sand', q: 200 },
  { id: '4', label: 'Dense Gravel', q: 300 },
  { id: '5', label: 'Hard Rock', q: 500 },
];

interface CodeConfig {
  id: DesignCode;
  label: string;
  region: string;
  gammaD: number;
  gammaL: number;
  punchingOffsetD: number;
  phiFlexure: number;
  phiShear: number;
  description: string;
}

const DESIGN_CODES: Record<DesignCode, CodeConfig> = {
  ACI318: {
    id: 'ACI318',
    label: 'ACI 318-19',
    region: 'USA / Intl',
    gammaD: 1.2,
    gammaL: 1.6,
    punchingOffsetD: 0.5,
    phiFlexure: 0.90,
    phiShear: 0.75,
    description: 'LRFD load combinations (1.2D + 1.6L) with 0.5d critical punching perimeter.',
  },
  EC2: {
    id: 'EC2',
    label: 'Eurocode 2',
    region: 'EU / UK',
    gammaD: 1.35,
    gammaL: 1.5,
    punchingOffsetD: 2.0,
    phiFlexure: 0.87,
    phiShear: 0.67,
    description: 'EN 1992 ULS factors (1.35Gk + 1.5Qk) with 2.0d rounded control perimeter.',
  },
  IS456: {
    id: 'IS456',
    label: 'IS 456:2000',
    region: 'India',
    gammaD: 1.5,
    gammaL: 1.5,
    punchingOffsetD: 0.5,
    phiFlexure: 0.87,
    phiShear: 0.67,
    description: 'Limit State Design (1.5DL + 1.5LL) per Bureau of Indian Standards.',
  },
  BS8110: {
    id: 'BS8110',
    label: 'BS 8110',
    region: 'British Std',
    gammaD: 1.4,
    gammaL: 1.6,
    punchingOffsetD: 1.5,
    phiFlexure: 0.87,
    phiShear: 0.80,
    description: 'ULS factors (1.4Gk + 1.6Qk) with 1.5d rectangular punching shear boundary.',
  },
  AS3600: {
    id: 'AS3600',
    label: 'AS 3600:18',
    region: 'Australia',
    gammaD: 1.2,
    gammaL: 1.5,
    punchingOffsetD: 0.5,
    phiFlexure: 0.85,
    phiShear: 0.70,
    description: 'Australian Standard LRFD factors (1.2G + 1.5Q).',
  },
  CSA_A23: {
    id: 'CSA_A23',
    label: 'CSA A23.3',
    region: 'Canada',
    gammaD: 1.25,
    gammaL: 1.5,
    punchingOffsetD: 0.5,
    phiFlexure: 0.85,
    phiShear: 0.65,
    description: 'Canadian Standard factored loads (1.25D + 1.5L) with phi factors.',
  },
};

const ELEMENT_TYPES: { id: StructuralElement; label: string }[] = [
  { id: 'foundation', label: 'FOUNDATION' },
  { id: 'beam', label: 'BEAM' },
  { id: 'column', label: 'COLUMN' },
  { id: 'slab', label: 'SLAB' },
  { id: 'wall', label: 'WALL' },
  { id: 'truss', label: 'TRUSS' },
  { id: 'frame', label: 'FRAME' },
];

export default function IntegratedStructuralSuite() {
  const [activeElement, setActiveElement] = useState<StructuralElement>('foundation');
  const [activeCode, setActiveCode] = useState<DesignCode>('ACI318');

  // Foundation Sub-types State
  const [fdnCategory, setFdnCategory] = useState<FoundationCategory>('shallow');
  const [shallowType, setShallowType] = useState<ShallowType>('isolated');
  const [combinedSubtype, setCombinedSubtype] = useState<CombinedSubtype>('rectangular');
  const [deepType, setDeepType] = useState<DeepType>('pile_cap');

  // Soil Management State
  const [soilPresets, setSoilPresets] = useState<SoilPreset[]>(DEFAULT_SOIL_PRESETS);
  const [showAddSoilModal, setShowAddSoilModal] = useState<boolean>(false);
  const [newSoilName, setNewSoilName] = useState<string>('');
  const [newSoilCapacity, setNewSoilCapacity] = useState<number>(250);
  const [qAllowable, setQAllowable] = useState<number>(175);

  // Material Properties
  const [fc, setFc] = useState<number>(30);
  const [fy, setFy] = useState<number>(500);
  const [cover, setCover] = useState<number>(50);
  const [barDiameter, setBarDiameter] = useState<number>(16);

  // Loading Inputs
  const [deadLoad, setDeadLoad] = useState<number>(650);
  const [liveLoad, setLiveLoad] = useState<number>(350);
  const [momentX, setMomentX] = useState<number>(40);
  const [momentY, setMomentY] = useState<number>(20);
  const [axialForce, setAxialForce] = useState<number>(850);

  // Dimensional Geometry
  const [dimL, setDimL] = useState<number>(2300); // Length or Span (mm)
  const [dimB, setDimB] = useState<number>(2300); // Width (mm)
  const [dimH, setDimH] = useState<number>(500);  // Depth or Thickness (mm)
  const [colX, setColX] = useState<number>(400);  // Column X (mm)
  const [colY, setColY] = useState<number>(400);  // Column Y (mm)

  const codeSpec = DESIGN_CODES[activeCode];

  // Custom Soil Handlers
  const handleAddCustomSoil = () => {
    if (!newSoilName.trim() || newSoilCapacity <= 0) return;
    const customPreset: SoilPreset = {
      id: Date.now().toString(),
      label: newSoilName.trim(),
      q: newSoilCapacity,
      isCustom: true,
    };
    setSoilPresets((prev) => [...prev, customPreset]);
    setQAllowable(newSoilCapacity);
    setNewSoilName('');
    setNewSoilCapacity(250);
    setShowAddSoilModal(false);
  };

  const handleDeleteCustomSoil = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSoilPresets((prev) => prev.filter((p) => p.id !== id));
  };

  // Active Foundation Dynamic Label
  const fdnLabel = useMemo(() => {
    if (fdnCategory === 'deep') {
      const labels: Record<DeepType, string> = {
        pile_cap: 'Pile Cap',
        bored_pile: 'Bored Pile',
        driven_pile: 'Driven Pile',
        micropile: 'Micropile System',
      };
      return `DEEP - ${labels[deepType].toUpperCase()}`;
    }
    if (shallowType === 'combined') {
      const cLabels: Record<CombinedSubtype, string> = {
        rectangular: 'Rectangular Combined',
        trapezoidal: 'Trapezoidal Combined',
        strap: 'Strap / Cantilever Beam',
      };
      return `SHALLOW - ${cLabels[combinedSubtype].toUpperCase()}`;
    }
    const sLabels: Record<ShallowType, string> = {
      isolated: 'Isolated Pad Footing',
      strip: 'Continuous Strip Footing',
      raft: 'Mat / Raft Foundation',
      combined: 'Combined Footing',
    };
    return `SHALLOW - ${sLabels[shallowType].toUpperCase()}`;
  }, [fdnCategory, shallowType, combinedSubtype, deepType]);

  // Structural Calculation Engine
  const designResults = useMemo(() => {
    const d = dimH - cover - barDiameter;
    const dM = d / 1000;
    const gammaD = codeSpec.gammaD;
    const gammaL = codeSpec.gammaL;

    if (activeElement === 'foundation') {
      const pService = deadLoad + liveLoad;
      const lengthM = dimL / 1000;
      const widthM = dimB / 1000;
      const depthM = dimH / 1000;
      const area = lengthM * widthM;

      const grossWeight = area * depthM * 24;
      const pServiceTotal = pService + grossWeight;

      const zX = (widthM * Math.pow(lengthM, 2)) / 6;
      const zY = (lengthM * Math.pow(widthM, 2)) / 6;
      const qDirect = pServiceTotal / area;
      const qEccX = momentX / (zX || 1);
      const qEccY = momentY / (zY || 1);

      const qMax = qDirect + qEccX + qEccY;
      const qMin = Math.max(0, qDirect - qEccX - qEccY);
      const soilDcr = qMax / (qAllowable || 1);

      const pFactored = gammaD * deadLoad + gammaL * liveLoad;
      const qUltimate = pFactored / (area || 1);

      const cantileverX = (dimL - colX) / 2 / 1000;
      const shearDist1Way = cantileverX - dM;
      const v1Way = Math.max(0, qUltimate * (widthM * shearDist1Way));
      const vc1Way = (codeSpec.phiShear * 0.17 * Math.sqrt(fc) * dimB * d) / 1000;
      const dcr1Way = v1Way / (vc1Way || 1);

      // Code-Specific Punching Perimeter (b0)
      const a = codeSpec.punchingOffsetD;
      let b0 = 0;
      let punchingArea = 0;

      if (activeCode === 'EC2') {
        b0 = 2 * colX + 2 * colY + 2 * Math.PI * (a * d);
        punchingArea = (colX / 1000) * (colY / 1000) + (2 * colX * a * dM) / 1000 + (2 * colY * a * dM) / 1000 + Math.PI * Math.pow(a * dM, 2);
      } else {
        b0 = 2 * (colX + 2 * a * d) + 2 * (colY + 2 * a * d);
        punchingArea = (colX / 1000 + 2 * a * dM) * (colY / 1000 + 2 * a * dM);
      }

      const vPunch = qUltimate * Math.max(0, area - punchingArea);
      const vcPunch = (codeSpec.phiShear * 0.33 * Math.sqrt(fc) * b0 * d) / 1000;
      const dcrPunch = vPunch / (vcPunch || 1);

      const mUltimateFace = (qUltimate * widthM * Math.pow(cantileverX, 2)) / 2;
      const rn = (mUltimateFace * 1e6) / (0.9 * dimB * Math.pow(d, 2));
      const rhoReq = ((0.85 * fc) / fy) * (1 - Math.sqrt(Math.max(0, 1 - (2 * rn) / (0.85 * fc))));
      const asReq = Math.max(0.0018, rhoReq) * dimB * d;

      const singleBarArea = (Math.PI / 4) * Math.pow(barDiameter, 2);
      const rawSpacing = (singleBarArea * dimB) / (asReq || 1);
      const barSpacing = Math.min(300, Math.max(100, Math.floor(rawSpacing / 25) * 25));
      const numberOfBars = Math.ceil((dimB - 2 * cover) / barSpacing) + 1;
      const asProv = numberOfBars * singleBarArea;

      const hookLength = 12 * barDiameter;
      const barLength = dimL - 2 * cover + 2 * hookLength;
      const totalWeightKg = numberOfBars * (barLength / 1000) * (Math.pow(barDiameter, 2) / 162) * 2;

      return {
        isFoundation: true,
        dcrPrimary: soilDcr,
        dcrSecondary: dcr1Way,
        dcrPunch,
        asReq,
        asProv,
        numberOfBars,
        barSpacing,
        barLength,
        totalWeightKg,
        primaryTitle: '1. Soil Bearing Capacity Check',
        secondaryTitle: '2. One-Way Beam Shear Check',
        primaryDetails: `q_max: ${qMax.toFixed(1)} kPa | q_min: ${qMin.toFixed(1)} kPa | Allowable: ${qAllowable} kPa`,
        secondaryDetails: `V_u: ${v1Way.toFixed(1)} kN | φV_c: ${vc1Way.toFixed(1)} kN at dist d=${d}mm`,
        punchDetails: `V_u: ${vPunch.toFixed(1)} kN | φV_c: ${vcPunch.toFixed(1)} kN on b_0=${b0.toFixed(0)}mm (${codeSpec.punchingOffsetD}d)`,
      };
    }

    // Generic Member Analysis Engine (Beam, Column, Slab, Wall, Truss, Frame)
    const wFactored = gammaD * deadLoad + gammaL * liveLoad;
    const lengthM = dimL / 1000;
    const mFactored = (wFactored * Math.pow(lengthM, 2)) / 8;
    const vFactored = (wFactored * lengthM) / 2;

    const rn = (mFactored * 1e6) / (codeSpec.phiFlexure * dimB * Math.pow(d, 2));
    const rho = ((0.85 * fc) / fy) * (1 - Math.sqrt(Math.max(0, 1 - (2 * rn) / (0.85 * fc))));
    const asReq = Math.max(0.0018, rho) * dimB * d;

    const mCapacity = (codeSpec.phiFlexure * asReq * fy * (d - 0.15 * d)) / 1e6;
    const dcrPrimary = mFactored / (mCapacity || 1);

    const vc = (codeSpec.phiShear * 0.17 * Math.sqrt(fc) * dimB * d) / 1000;
    const dcrSecondary = vFactored / (vc || 1);

    const singleBarArea = (Math.PI / 4) * Math.pow(barDiameter, 2);
    const numberOfBars = Math.max(2, Math.ceil(asReq / singleBarArea));
    const asProv = numberOfBars * singleBarArea;
    const barSpacing = Math.floor((dimB - 2 * cover) / (numberOfBars - 1));
    const barLength = dimL + 2 * (12 * barDiameter);
    const totalWeightKg = numberOfBars * (barLength / 1000) * (Math.pow(barDiameter, 2) / 162);

    return {
      isFoundation: false,
      dcrPrimary,
      dcrSecondary,
      dcrPunch: 0,
      asReq,
      asProv,
      numberOfBars,
      barSpacing,
      barLength,
      totalWeightKg,
      primaryTitle: `1. Flexural Capacity Check (M_u vs φM_n)`,
      secondaryTitle: `2. Shear Capacity Check (V_u vs φV_c)`,
      primaryDetails: `M_u: ${mFactored.toFixed(1)} kNm | φM_n: ${mCapacity.toFixed(1)} kNm | Span: ${lengthM.toFixed(1)}m`,
      secondaryDetails: `V_u: ${vFactored.toFixed(1)} kN | φV_c: ${vc.toFixed(1)} kN`,
      punchDetails: '',
    };
  }, [
    activeElement, activeCode, codeSpec, deadLoad, liveLoad, momentX, momentY,
    qAllowable, fc, fy, cover, barDiameter, dimL, dimB, dimH, colX, colY
  ]);

  return (
    <div className="space-y-6 text-slate-200 font-sans max-w-7xl mx-auto p-2">
      {/* 1. Structural Element Selector Tabs */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            1. Select Structural Member Type
          </span>
          <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded">
            Active: {activeElement === 'foundation' ? fdnLabel : activeElement.toUpperCase()}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
          {ELEMENT_TYPES.map((item) => {
            const isSelected = activeElement === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveElement(item.id)}
                className={`py-2 px-3 rounded-lg text-xs font-mono font-bold tracking-wider transition-all border ${
                  isSelected
                    ? 'bg-cyan-500 text-slate-950 border-cyan-300 shadow-md shadow-cyan-500/20'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Foundation Sub-Type Selector (Shown only when FOUNDATION is selected) */}
      {activeElement === 'foundation' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              2. Foundation Classification & Sub-Type
            </span>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
              {fdnLabel}
            </span>
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] font-mono text-slate-400 uppercase block">Category</span>
            <div className="grid grid-cols-2 gap-2 max-w-xs">
              <button
                onClick={() => setFdnCategory('shallow')}
                className={`py-1.5 px-3 rounded-lg text-xs font-mono font-bold border transition-all ${
                  fdnCategory === 'shallow'
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                }`}
              >
                SHALLOW
              </button>
              <button
                onClick={() => setFdnCategory('deep')}
                className={`py-1.5 px-3 rounded-lg text-xs font-mono font-bold border transition-all ${
                  fdnCategory === 'deep'
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                }`}
              >
                DEEP
              </button>
            </div>
          </div>

          {fdnCategory === 'shallow' && (
            <div className="space-y-3 pt-2 border-t border-slate-800/60">
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono text-slate-400 uppercase block">Shallow Sub-type</span>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {(
                    [
                      { id: 'isolated', label: 'ISOLATED PAD' },
                      { id: 'strip', label: 'STRIP / CONTINUOUS' },
                      { id: 'raft', label: 'MAT / RAFT' },
                      { id: 'combined', label: 'COMBINED FOOTING' },
                    ] as { id: ShallowType; label: string }[]
                  ).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setShallowType(item.id)}
                      className={`py-1.5 px-3 rounded-lg text-xs font-mono font-bold border transition-all ${
                        shallowType === item.id
                          ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {shallowType === 'combined' && (
                <div className="space-y-1.5 p-3 bg-slate-950 rounded-lg border border-cyan-500/30">
                  <span className="text-[10px] font-mono text-cyan-400 uppercase font-bold block">
                    Combined Footing Type
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {(
                      [
                        { id: 'rectangular', label: 'RECTANGULAR COMBINED' },
                        { id: 'trapezoidal', label: 'TRAPEZOIDAL COMBINED' },
                        { id: 'strap', label: 'STRAP / CANTILEVER' },
                      ] as { id: CombinedSubtype; label: string }[]
                    ).map((cItem) => (
                      <button
                        key={cItem.id}
                        onClick={() => setCombinedSubtype(cItem.id)}
                        className={`py-1.5 px-3 rounded text-xs font-mono font-bold border transition-all ${
                          combinedSubtype === cItem.id
                            ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {cItem.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {fdnCategory === 'deep' && (
            <div className="space-y-1.5 pt-2 border-t border-slate-800/60">
              <span className="text-[10px] font-mono text-slate-400 uppercase block">Deep Sub-type</span>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {(
                  [
                    { id: 'pile_cap', label: 'PILE CAP' },
                    { id: 'bored_pile', label: 'BORED PILE' },
                    { id: 'driven_pile', label: 'PRECAST DRIVEN' },
                    { id: 'micropile', label: 'MICROPILE' },
                  ] as { id: DeepType; label: string }[]
                ).map((dItem) => (
                  <button
                    key={dItem.id}
                    onClick={() => setDeepType(dItem.id)}
                    className={`py-1.5 px-3 rounded-lg text-xs font-mono font-bold border transition-all ${
                      deepType === dItem.id
                        ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {dItem.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Design Code Standard Selector */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            {activeElement === 'foundation' ? '3.' : '2.'} Select Design Code Standard
          </span>
          <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded">
            {codeSpec.region} Standard
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          {(Object.keys(DESIGN_CODES) as DesignCode[]).map((codeKey) => {
            const code = DESIGN_CODES[codeKey];
            const isSelected = activeCode === codeKey;
            return (
              <button
                key={codeKey}
                onClick={() => setActiveCode(codeKey)}
                className={`px-3 py-2 rounded-lg text-xs font-mono font-bold transition-all text-left flex flex-col justify-between ${
                  isSelected
                    ? 'bg-cyan-500 text-slate-950 border-cyan-300 shadow-md'
                    : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'
                }`}
              >
                <span>{code.label}</span>
                <span className={`text-[9px] font-normal ${isSelected ? 'text-slate-900' : 'text-slate-500'}`}>
                  {code.region}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] font-mono text-slate-400">{codeSpec.description}</p>
      </div>

      {/* 4. Inputs & Calculations Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2">
            {activeElement.toUpperCase()} Inputs ({codeSpec.label})
          </h3>

          {/* Loads */}
          <div className="space-y-3">
            <span className="text-[11px] font-mono font-bold text-cyan-400 uppercase">1. Applied Load Cases</span>
            <div className="grid grid-cols-2 gap-3">
              <InputField label="Dead Load P_D / w_D (kN)" value={deadLoad} onChange={setDeadLoad} />
              <InputField label="Live Load P_L / w_L (kN)" value={liveLoad} onChange={setLiveLoad} />
              <InputField label="Moment M_x (kNm)" value={momentX} onChange={setMomentX} />
              {activeElement === 'foundation' ? (
                <InputField label="Moment M_y (kNm)" value={momentY} onChange={setMomentY} />
              ) : (
                <InputField label="Axial Force P_u (kN)" value={axialForce} onChange={setAxialForce} />
              )}
            </div>
          </div>

          {/* Geometry */}
          <div className="space-y-3">
            <span className="text-[11px] font-mono font-bold text-cyan-400 uppercase">2. Geometry Specs</span>
            <div className="grid grid-cols-2 gap-3">
              <InputField label="Length / Span L (mm)" value={dimL} onChange={setDimL} step={50} />
              <InputField label="Width B (mm)" value={dimB} onChange={setDimB} step={50} />
              <InputField label="Thickness / Depth H (mm)" value={dimH} onChange={setDimH} step={25} />
              <InputField label="Concrete Cover (mm)" value={cover} onChange={setCover} step={5} />
              {activeElement === 'foundation' && (
                <>
                  <InputField label="Column c_x (mm)" value={colX} onChange={setColX} step={25} />
                  <InputField label="Column c_y (mm)" value={colY} onChange={setColY} step={25} />
                </>
              )}
            </div>
          </div>

          {/* Soil & Material Presets (Shown for Foundations) */}
          {activeElement === 'foundation' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-mono font-bold text-cyan-400 uppercase">3. Soil Capacity Preset</span>
                <button
                  onClick={() => setShowAddSoilModal(!showAddSoilModal)}
                  className="text-[10px] font-mono text-cyan-400 hover:underline"
                >
                  {showAddSoilModal ? 'Cancel' : '+ Custom Soil'}
                </button>
              </div>

              {showAddSoilModal && (
                <div className="bg-slate-950 p-3 rounded-lg border border-cyan-500/30 space-y-2">
                  <span className="text-[10px] font-mono text-slate-300 font-bold block">Add Custom Soil Profile</span>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Soil Name"
                      value={newSoilName}
                      onChange={(e) => setNewSoilName(e.target.value)}
                      className="bg-slate-900 border border-slate-800 text-slate-200 rounded px-2 py-1 text-xs font-mono focus:border-cyan-500 focus:outline-none"
                    />
                    <input
                      type="number"
                      placeholder="q_allow (kPa)"
                      value={newSoilCapacity}
                      onChange={(e) => setNewSoilCapacity(Number(e.target.value) || 0)}
                      className="bg-slate-900 border border-slate-800 text-slate-200 rounded px-2 py-1 text-xs font-mono focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={handleAddCustomSoil}
                    className="w-full bg-cyan-500 text-slate-950 font-bold font-mono text-xs py-1 rounded hover:bg-cyan-400"
                  >
                    Save Soil Preset
                  </button>
                </div>
              )}

              <div className="flex flex-wrap gap-1.5">
                {soilPresets.map((preset) => {
                  const isActive = qAllowable === preset.q;
                  return (
                    <div
                      key={preset.id}
                      onClick={() => setQAllowable(preset.q)}
                      className={`px-2 py-1 rounded text-[10px] font-mono font-bold cursor-pointer transition-all border flex items-center gap-1 ${
                        isActive
                          ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <span>{preset.label} ({preset.q} kPa)</span>
                      {preset.isCustom && (
                        <span onClick={(e) => handleDeleteCustomSoil(preset.id, e)} className="text-rose-400 ml-1 font-bold">
                          ×
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Materials */}
          <div className="space-y-3">
            <span className="text-[11px] font-mono font-bold text-cyan-400 uppercase">
              {activeElement === 'foundation' ? '4. Material Strengths' : '3. Material Strengths'}
            </span>
            <div className="grid grid-cols-2 gap-3">
              <InputField label="Concrete f_c' (MPa)" value={fc} onChange={setFc} />
              <InputField label="Steel Yield f_y (MPa)" value={fy} onChange={setFy} />
              <InputField label="Bar Diameter (mm)" value={barDiameter} onChange={setBarDiameter} step={2} />
              {activeElement === 'foundation' && (
                <InputField label="q_allowable (kPa)" value={qAllowable} onChange={setQAllowable} />
              )}
            </div>
          </div>
        </div>

        {/* Dynamic Verification & BBS Outputs */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2">
              Code Verifications & Structural DCR
            </h3>

            <div className="space-y-3">
              <DcrProgressBar
                title={designResults.primaryTitle}
                dcr={designResults.dcrPrimary}
                details={designResults.primaryDetails}
              />
              <DcrProgressBar
                title={designResults.secondaryTitle}
                dcr={designResults.dcrSecondary}
                details={designResults.secondaryDetails}
              />
              {designResults.isFoundation && (
                <DcrProgressBar
                  title={`3. Two-Way Punching Shear Check (${codeSpec.punchingOffsetD}d Perimeter)`}
                  dcr={designResults.dcrPunch}
                  details={designResults.punchDetails}
                />
              )}
            </div>
          </div>

          {/* Reinforcement Bar Bending Schedule (BBS) Output */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Bar Bending Schedule ({activeElement === 'foundation' ? fdnLabel : activeElement.toUpperCase()})
              </h3>
              <span className="text-[10px] bg-cyan-500/10 text-cyan-400 font-mono px-2 py-0.5 rounded border border-cyan-500/20">
                A_s,req: {designResults.asReq.toFixed(0)} mm²
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300 font-mono">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-2 px-3">Direction / Mark</th>
                    <th className="py-2 px-3">Bar Dia</th>
                    <th className="py-2 px-3">Quantity</th>
                    <th className="py-2 px-3">Spacing</th>
                    <th className="py-2 px-3">Cut Length</th>
                    <th className="py-2 px-3">Weight</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  <tr>
                    <td className="py-2 px-3 font-bold text-cyan-400">
                      {designResults.isFoundation ? 'B1 (X-Dir Main)' : 'Main Top/Bot'}
                    </td>
                    <td className="py-2 px-3">T{barDiameter}</td>
                    <td className="py-2 px-3">{designResults.numberOfBars}</td>
                    <td className="py-2 px-3">@{designResults.barSpacing} mm</td>
                    <td className="py-2 px-3">{designResults.barLength} mm</td>
                    <td className="py-2 px-3">
                      {(designResults.isFoundation ? designResults.totalWeightKg / 2 : designResults.totalWeightKg).toFixed(1)} kg
                    </td>
                  </tr>
                  {designResults.isFoundation && (
                    <tr>
                      <td className="py-2 px-3 font-bold text-cyan-400">B2 (Y-Dir Main)</td>
                      <td className="py-2 px-3">T{barDiameter}</td>
                      <td className="py-2 px-3">{designResults.numberOfBars}</td>
                      <td className="py-2 px-3">@{designResults.barSpacing} mm</td>
                      <td className="py-2 px-3">{designResults.barLength} mm</td>
                      <td className="py-2 px-3">{(designResults.totalWeightKg / 2).toFixed(1)} kg</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex justify-between items-center text-xs">
              <span className="text-slate-400">Reinforcement Summary:</span>
              <span className={`font-mono font-bold ${designResults.asProv >= designResults.asReq ? 'text-emerald-400' : 'text-rose-400'}`}>
                A_s,prov: {designResults.asProv.toFixed(0)} mm² ({designResults.asProv >= designResults.asReq ? 'Pass' : 'Fail'})
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] text-slate-400 font-mono block">{label}</label>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-lg px-2.5 py-1.5 text-xs font-mono focus:border-cyan-500 focus:outline-none transition-colors"
      />
    </div>
  );
}

function DcrProgressBar({
  title,
  dcr,
  details,
}: {
  title: string;
  dcr: number;
  details: string;
}) {
  const percent = Math.min(100, Math.max(0, Math.round(dcr * 100)));
  const isOver = dcr > 1.0;

  return (
    <div className="space-y-1.5 bg-slate-950 p-3 rounded-lg border border-slate-800">
      <div className="flex justify-between items-center text-xs font-mono">
        <span className="text-slate-300 font-medium">{title}</span>
        <span className={`font-bold ${isOver ? 'text-rose-400' : 'text-emerald-400'}`}>
          DCR: {dcr.toFixed(2)} ({percent}%)
        </span>
      </div>
      <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
        <div
          className={`h-full transition-all duration-300 ${isOver ? 'bg-rose-500' : 'bg-cyan-500'}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="text-[10px] font-mono text-slate-400">{details}</div>
    </div>
  );
}
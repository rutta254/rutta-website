'use client';

import { useState, useMemo } from 'react';

// 6 Major Structural Design Codes Metadata
export type DesignCode = 'ACI318' | 'EC2' | 'IS456' | 'BS8110' | 'AS3600' | 'CSA_A23';

// Foundation Hierarchy Types
export type FoundationCategory = 'shallow' | 'deep';
export type ShallowFoundationType = 'isolated' | 'strip' | 'raft' | 'combined';
export type CombinedFoundationType = 'rectangular' | 'trapezoidal' | 'strap';
export type DeepFoundationType = 'pile_cap' | 'bored_pile' | 'driven_pile' | 'micropile';

interface CodeConfig {
  id: DesignCode;
  label: string;
  region: string;
  gammaD: number;
  gammaL: number;
  punchingOffsetD: number;
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
    phiShear: 0.75,
    description: 'LRFD load combinations (1.2D + 1.6L) with critical punching perimeter at 0.5d.',
  },
  EC2: {
    id: 'EC2',
    label: 'Eurocode 2',
    region: 'EU / UK',
    gammaD: 1.35,
    gammaL: 1.5,
    punchingOffsetD: 2.0,
    phiShear: 0.67,
    description: 'EN 1992 ultimate limit state (1.35Gk + 1.5Qk) with punching control perimeter at 2.0d.',
  },
  IS456: {
    id: 'IS456',
    label: 'IS 456:2000',
    region: 'India',
    gammaD: 1.5,
    gammaL: 1.5,
    punchingOffsetD: 0.5,
    phiShear: 0.67,
    description: 'Limit State Design (1.5DL + 1.5LL) with shear verification per Clause 31.6.',
  },
  BS8110: {
    id: 'BS8110',
    label: 'BS 8110',
    region: 'British Std',
    gammaD: 1.4,
    gammaL: 1.6,
    punchingOffsetD: 1.5,
    phiShear: 0.8,
    description: 'Ultimate Limit State factors (1.4Gk + 1.6Qk) with punching shear zone at 1.5d.',
  },
  AS3600: {
    id: 'AS3600',
    label: 'AS 3600:18',
    region: 'Australia',
    gammaD: 1.2,
    gammaL: 1.5,
    punchingOffsetD: 0.5,
    phiShear: 0.7,
    description: 'Australian Standard LRFD factors (1.2G + 1.5Q) with capacity factor phi = 0.70.',
  },
  CSA_A23: {
    id: 'CSA_A23',
    label: 'CSA A23.3',
    region: 'Canada',
    gammaD: 1.25,
    gammaL: 1.5,
    punchingOffsetD: 0.5,
    phiShear: 0.65,
    description: 'Canadian Standard factored loads (1.25D + 1.5L) with phi_c = 0.65 concrete factor.',
  },
};

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

export default function FoundationDesignTool() {
  // Selected Design Standard
  const [activeCode, setActiveCode] = useState<DesignCode>('ACI318');

  // Foundation Hierarchy States
  const [foundationCategory, setFoundationCategory] = useState<FoundationCategory>('shallow');
  const [shallowType, setShallowType] = useState<ShallowFoundationType>('isolated');
  const [combinedType, setCombinedType] = useState<CombinedFoundationType>('rectangular');
  const [deepType, setDeepType] = useState<DeepFoundationType>('pile_cap');

  // Dynamic Soil Presets
  const [soilPresets, setSoilPresets] = useState<SoilPreset[]>(DEFAULT_SOIL_PRESETS);
  const [showAddSoilModal, setShowAddSoilModal] = useState<boolean>(false);
  const [newSoilName, setNewSoilName] = useState<string>('');
  const [newSoilCapacity, setNewSoilCapacity] = useState<number>(250);

  // Service & Applied Loads
  const [deadLoad, setDeadLoad] = useState<number>(650); // kN
  const [liveLoad, setLiveLoad] = useState<number>(350); // kN
  const [momentX, setMomentX] = useState<number>(40); // kNm
  const [momentY, setMomentY] = useState<number>(20); // kNm

  // Geotechnical & Material Properties
  const [qAllowable, setQAllowable] = useState<number>(175); // kPa
  const [fc, setFc] = useState<number>(30); // MPa
  const [fy, setFy] = useState<number>(500); // MPa
  const [concreteCover, setConcreteCover] = useState<number>(50); // mm

  // Foundation & Column Dimensions
  const [colX, setColX] = useState<number>(400); // mm
  const [colY, setColY] = useState<number>(400); // mm
  const [footingL, setFootingL] = useState<number>(2300); // mm
  const [footingB, setFootingB] = useState<number>(2300); // mm
  const [footingH, setFootingH] = useState<number>(500); // mm
  const [barDiameter, setBarDiameter] = useState<number>(16); // mm

  const codeSpec = DESIGN_CODES[activeCode];

  // Handler to add custom soil profile
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

  // Handler to delete custom soil profile
  const handleDeleteCustomSoil = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSoilPresets((prev) => prev.filter((p) => p.id !== id));
  };

  // Cycle through presets on Step 1 click
  const handleCycleSoilBearing = () => {
    const currentIndex = soilPresets.findIndex((p) => p.q === qAllowable);
    const nextIndex = (currentIndex + 1) % soilPresets.length;
    setQAllowable(soilPresets[nextIndex].q);
  };

  // Structural Calculation Engine
  const results = useMemo(() => {
    const pService = deadLoad + liveLoad;
    const lengthM = footingL / 1000;
    const widthM = footingB / 1000;
    const depthM = footingH / 1000;
    const area = lengthM * widthM;

    const grossWeight = area * depthM * 24;
    const pServiceTotal = pService + grossWeight;

    const zX = (widthM * Math.pow(lengthM, 2)) / 6;
    const zY = (lengthM * Math.pow(widthM, 2)) / 6;
    const qDirect = pServiceTotal / area;
    const qEccX = momentX / zX;
    const qEccY = momentY / zY;

    const qMax = qDirect + qEccX + qEccY;
    const qMin = Math.max(0, qDirect - qEccX - qEccY);
    const soilDcr = qMax / (qAllowable || 1);

    const pFactored = codeSpec.gammaD * deadLoad + codeSpec.gammaL * liveLoad;
    const qUltimate = pFactored / area;

    const d = footingH - concreteCover - barDiameter;
    const dM = d / 1000;

    const cantileverX = (footingL - colX) / 2 / 1000;
    const shearDist1Way = cantileverX - dM;
    const v1Way = Math.max(0, qUltimate * (widthM * shearDist1Way));
    const vc1Way = (codeSpec.phiShear * 0.17 * Math.sqrt(fc) * footingB * d) / 1000;
    const dcr1Way = v1Way / (vc1Way || 1);

    const offset = codeSpec.punchingOffsetD * d;
    const offsetM = offset / 1000;
    const b0 = 2 * (colX + 2 * offset) + 2 * (colY + 2 * offset);
    const punchingArea = (colX / 1000 + 2 * offsetM) * (colY / 1000 + 2 * offsetM);
    const vPunch = qUltimate * Math.max(0, area - punchingArea);
    const vcPunch = (codeSpec.phiShear * 0.33 * Math.sqrt(fc) * b0 * d) / 1000;
    const dcrPunch = vPunch / (vcPunch || 1);

    const mUltimateFace = (qUltimate * widthM * Math.pow(cantileverX, 2)) / 2;
    const rn = (mUltimateFace * 1e6) / (0.9 * footingB * Math.pow(d, 2));
    const rhoReq = ((0.85 * fc) / fy) * (1 - Math.sqrt(Math.max(0, 1 - (2 * rn) / (0.85 * fc))));
    const rhoMin = 0.0018;
    const rhoFinal = Math.max(rhoReq, rhoMin);

    const asReq = rhoFinal * footingB * d;
    const singleBarArea = (Math.PI / 4) * Math.pow(barDiameter, 2);

    const rawSpacing = (singleBarArea * footingB) / asReq;
    const barSpacing = Math.min(300, Math.max(100, Math.floor(rawSpacing / 25) * 25));
    const numberOfBars = Math.ceil((footingB - 2 * concreteCover) / barSpacing) + 1;
    const asProv = numberOfBars * singleBarArea;

    const hookLength = 12 * barDiameter;
    const barLength = footingL - 2 * concreteCover + 2 * hookLength;
    const linearDensity = Math.pow(barDiameter, 2) / 162;
    const totalWeightKg = numberOfBars * (barLength / 1000) * linearDensity * 2;

    const isPassing = soilDcr <= 1.0 && dcr1Way <= 1.0 && dcrPunch <= 1.0;

    return {
      pFactored,
      qMax,
      qMin,
      soilDcr,
      d,
      v1Way,
      vc1Way,
      dcr1Way,
      b0,
      vPunch,
      vcPunch,
      dcrPunch,
      asReq,
      barSpacing,
      asProv,
      numberOfBars,
      barLength,
      totalWeightKg,
      isPassing,
    };
  }, [
    activeCode, codeSpec, deadLoad, liveLoad, momentX, momentY,
    qAllowable, fc, fy, concreteCover, colX, colY, footingL, footingB, footingH, barDiameter
  ]);

  // Label Formatter for Current Selection
  const activeFoundationLabel = useMemo(() => {
    if (foundationCategory === 'deep') {
      const deepLabels: Record<DeepFoundationType, string> = {
        pile_cap: 'Pile Cap Foundation',
        bored_pile: 'Bored Cast-in-Situ Pile',
        driven_pile: 'Precast Driven Pile',
        micropile: 'Micropile / Anchor System',
      };
      return `Deep - ${deepLabels[deepType]}`;
    }

    if (shallowType === 'combined') {
      const combinedLabels: Record<CombinedFoundationType, string> = {
        rectangular: 'Rectangular Combined Footing',
        trapezoidal: 'Trapezoidal Combined Footing',
        strap: 'Strap / Cantilever Beam Footing',
      };
      return `Shallow - ${combinedLabels[combinedType]}`;
    }

    const shallowLabels: Record<ShallowFoundationType, string> = {
      isolated: 'Isolated Pad Footing',
      strip: 'Continuous Strip Footing',
      raft: 'Mat / Raft Foundation',
      combined: 'Combined Footing',
    };
    return `Shallow - ${shallowLabels[shallowType]}`;
  }, [foundationCategory, shallowType, combinedType, deepType]);

  return (
    <div className="space-y-6 text-slate-200">
      {/* 1. Design Standard Selector */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            1. Select Design Standard Code
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
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20 ring-1 ring-cyan-300'
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
        <p className="text-[11px] font-mono text-slate-400 pt-1">{codeSpec.description}</p>
      </div>

      {/* 2. Hierarchical Foundation Type Selector */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            2. Foundation Classification & Geometry Type
          </span>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
            {activeFoundationLabel}
          </span>
        </div>

        {/* Primary Category Selector: Shallow vs Deep */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-mono text-slate-400 uppercase block">Category</span>
          <div className="grid grid-cols-2 gap-2 max-w-xs">
            <button
              onClick={() => setFoundationCategory('shallow')}
              className={`py-2 px-3 rounded-lg text-xs font-mono font-bold border transition-all ${
                foundationCategory === 'shallow'
                  ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
              }`}
            >
              Shallow Foundation
            </button>
            <button
              onClick={() => setFoundationCategory('deep')}
              className={`py-2 px-3 rounded-lg text-xs font-mono font-bold border transition-all ${
                foundationCategory === 'deep'
                  ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
              }`}
            >
              Deep Foundation
            </button>
          </div>
        </div>

        {/* Shallow Subtypes */}
        {foundationCategory === 'shallow' && (
          <div className="space-y-3 pt-2 border-t border-slate-800/60">
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono text-slate-400 uppercase block">
                Shallow Foundation Type
              </span>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {(
                  [
                    { id: 'isolated', label: 'Isolated Pad' },
                    { id: 'strip', label: 'Strip / Continuous' },
                    { id: 'raft', label: 'Mat / Raft' },
                    { id: 'combined', label: 'Combined Footing' },
                  ] as { id: ShallowFoundationType; label: string }[]
                ).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setShallowType(item.id)}
                    className={`py-2 px-3 rounded-lg text-xs font-mono font-bold border transition-all ${
                      shallowType === item.id
                        ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Combined Foundation Nested Subtypes */}
            {shallowType === 'combined' && (
              <div className="space-y-1.5 p-3 bg-slate-950 rounded-lg border border-cyan-500/30 animate-fadeIn">
                <span className="text-[10px] font-mono text-cyan-400 uppercase font-bold block">
                  Select Combined Foundation Subtype
                </span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'rectangular', label: 'Rectangular Combined' },
                      { id: 'trapezoidal', label: 'Trapezoidal Combined' },
                      { id: 'strap', label: 'Strap / Cantilever' },
                    ] as { id: CombinedFoundationType; label: string }[]
                  ).map((cItem) => (
                    <button
                      key={cItem.id}
                      onClick={() => setCombinedType(cItem.id)}
                      className={`py-1.5 px-3 rounded text-xs font-mono font-bold border transition-all ${
                        combinedType === cItem.id
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

        {/* Deep Subtypes */}
        {foundationCategory === 'deep' && (
          <div className="space-y-1.5 pt-2 border-t border-slate-800/60">
            <span className="text-[10px] font-mono text-slate-400 uppercase block">
              Deep Foundation Type
            </span>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {(
                [
                  { id: 'pile_cap', label: 'Pile Cap' },
                  { id: 'bored_pile', label: 'Bored Pile' },
                  { id: 'driven_pile', label: 'Precast Driven' },
                  { id: 'micropile', label: 'Micropile' },
                ] as { id: DeepFoundationType; label: string }[]
              ).map((dItem) => (
                <button
                  key={dItem.id}
                  onClick={() => setDeepType(dItem.id)}
                  className={`py-2 px-3 rounded-lg text-xs font-mono font-bold border transition-all ${
                    deepType === dItem.id
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {dItem.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 3. Structural Workflow Stepper */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block mb-3">
          Automated Foundation Engineering Workflow Pipeline ({activeFoundationLabel})
        </span>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs font-mono">
          <WorkflowStep
            stepNum={1}
            title="Soil Bearing Check"
            status={results.soilDcr <= 1.0 ? 'pass' : 'fail'}
            metric={`q_max: ${results.qMax.toFixed(1)} / ${qAllowable} kPa`}
            onClick={handleCycleSoilBearing}
            interactive
          />
          <WorkflowStep
            stepNum={2}
            title="Load Factoring"
            status="info"
            metric={`P_u: ${results.pFactored.toFixed(0)} kN (${codeSpec.gammaD}D + ${codeSpec.gammaL}L)`}
          />
          <WorkflowStep
            stepNum={3}
            title="Punching Shear"
            status={results.dcrPunch <= 1.0 ? 'pass' : 'fail'}
            metric={`DCR: ${results.dcrPunch.toFixed(2)} (@ ${codeSpec.punchingOffsetD}d)`}
          />
          <WorkflowStep
            stepNum={4}
            title="Flexure & BBS"
            status="info"
            metric={`A_s: ${results.asReq.toFixed(0)} mm² | ${results.totalWeightKg.toFixed(0)} kg`}
          />
        </div>
      </div>

      {/* Inputs & Outputs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Input Parameters */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2">
            Design Inputs ({codeSpec.label})
          </h3>

          <div className="space-y-3">
            <span className="text-[11px] font-mono font-bold text-cyan-400 uppercase">1. Applied Unfactored Loads</span>
            <div className="grid grid-cols-2 gap-3">
              <InputField label="Dead Load P_D (kN)" value={deadLoad} onChange={setDeadLoad} />
              <InputField label="Live Load P_L (kN)" value={liveLoad} onChange={setLiveLoad} />
              <InputField label="Moment M_x (kNm)" value={momentX} onChange={setMomentX} />
              <InputField label="Moment M_y (kNm)" value={momentY} onChange={setMomentY} />
            </div>
          </div>

          {/* Customizable Bearing Capacity Section */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-mono font-bold text-cyan-400 uppercase">2. Materials & Customizable Soil</span>
              <button
                onClick={() => setShowAddSoilModal(!showAddSoilModal)}
                className="text-[10px] font-mono text-cyan-400 hover:underline flex items-center gap-1"
              >
                {showAddSoilModal ? 'Cancel' : '+ Add Custom Soil'}
              </button>
            </div>

            {/* Custom Soil Preset Form */}
            {showAddSoilModal && (
              <div className="bg-slate-950 p-3 rounded-lg border border-cyan-500/30 space-y-2 animate-fadeIn">
                <span className="text-[10px] font-mono text-slate-300 font-bold block">Create Custom Soil Profile</span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Soil Label (e.g. Silty Sand)"
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
                  className="w-full bg-cyan-500 text-slate-950 font-bold font-mono text-xs py-1.5 rounded hover:bg-cyan-400 transition-colors"
                >
                  Save & Apply Preset
                </button>
              </div>
            )}

            {/* Customizable Preset Badges */}
            <div className="flex flex-wrap gap-1.5">
              {soilPresets.map((preset) => {
                const isActive = qAllowable === preset.q;
                return (
                  <div
                    key={preset.id}
                    onClick={() => setQAllowable(preset.q)}
                    className={`px-2 py-1.5 rounded text-[10px] font-mono font-bold cursor-pointer transition-all border flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <span>{preset.label} ({preset.q} kPa)</span>
                    {preset.isCustom && (
                      <span
                        onClick={(e) => handleDeleteCustomSoil(preset.id, e)}
                        className="text-rose-400 hover:text-rose-200 ml-1 font-bold"
                        title="Delete custom preset"
                      >
                        ×
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <InputField label="q_allowable (kPa)" value={qAllowable} onChange={setQAllowable} />
              <InputField label="Concrete f_c' (MPa)" value={fc} onChange={setFc} />
              <InputField label="Steel f_y (MPa)" value={fy} onChange={setFy} />
              <InputField label="Concrete Cover (mm)" value={concreteCover} onChange={setConcreteCover} />
            </div>
          </div>

          <div className="space-y-3">
            <span className="text-[11px] font-mono font-bold text-cyan-400 uppercase">3. Geometry & Member Specs</span>
            <div className="grid grid-cols-2 gap-3">
              <InputField label="Length L (mm)" value={footingL} onChange={setFootingL} step={50} />
              <InputField label="Width B (mm)" value={footingB} onChange={setFootingB} step={50} />
              <InputField label="Thickness H (mm)" value={footingH} onChange={setFootingH} step={25} />
              <InputField label="Bar Diameter (mm)" value={barDiameter} onChange={setBarDiameter} step={2} />
              <InputField label="Column c_x (mm)" value={colX} onChange={setColX} step={25} />
              <InputField label="Column c_y (mm)" value={colY} onChange={setColY} step={25} />
            </div>
          </div>
        </div>

        {/* Verifications & BBS */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2">
              Code Verifications ({codeSpec.label}) - {activeFoundationLabel}
            </h3>

            <div className="space-y-3">
              <DcrProgressBar
                title="1. Soil Bearing Capacity Check"
                dcr={results.soilDcr}
                details={`q_max: ${results.qMax.toFixed(1)} kPa | q_min: ${results.qMin.toFixed(1)} kPa | Allowable: ${qAllowable} kPa`}
              />
              <DcrProgressBar
                title="2. One-Way Beam Shear Check"
                dcr={results.dcr1Way}
                details={`V_u: ${results.v1Way.toFixed(1)} kN | φV_c: ${results.vc1Way.toFixed(1)} kN at dist d=${results.d}mm`}
              />
              <DcrProgressBar
                title={`3. Two-Way Punching Shear Check (${codeSpec.punchingOffsetD}d Perimeter)`}
                dcr={results.dcrPunch}
                details={`V_u: ${results.vPunch.toFixed(1)} kN | φV_c: ${results.vcPunch.toFixed(1)} kN on b_0=${results.b0}mm`}
              />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Bar Bending Schedule (BBS) Output
              </h3>
              <span className="text-[10px] bg-cyan-500/10 text-cyan-400 font-mono px-2 py-0.5 rounded border border-cyan-500/20">
                A_s,req: {results.asReq.toFixed(0)} mm²
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300 font-mono">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-2 px-3">Dir</th>
                    <th className="py-2 px-3">Bar Mark</th>
                    <th className="py-2 px-3">Count</th>
                    <th className="py-2 px-3">Spacing</th>
                    <th className="py-2 px-3">Cut Length</th>
                    <th className="py-2 px-3">Weight</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  <tr>
                    <td className="py-2 px-3 font-bold text-cyan-400">B1 (X)</td>
                    <td className="py-2 px-3">T{barDiameter}-01</td>
                    <td className="py-2 px-3">{results.numberOfBars}</td>
                    <td className="py-2 px-3">@{results.barSpacing} mm</td>
                    <td className="py-2 px-3">{results.barLength} mm</td>
                    <td className="py-2 px-3">{(results.totalWeightKg / 2).toFixed(1)} kg</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-bold text-cyan-400">B2 (Y)</td>
                    <td className="py-2 px-3">T{barDiameter}-02</td>
                    <td className="py-2 px-3">{results.numberOfBars}</td>
                    <td className="py-2 px-3">@{results.barSpacing} mm</td>
                    <td className="py-2 px-3">{results.barLength} mm</td>
                    <td className="py-2 px-3">{(results.totalWeightKg / 2).toFixed(1)} kg</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex justify-between items-center text-xs">
              <span className="text-slate-400">Reinforcement Provided (A_s,prov):</span>
              <span className="font-mono text-emerald-400 font-bold">
                {results.asProv.toFixed(0)} mm² ({(results.asProv / results.asReq * 100).toFixed(0)}% efficiency)
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// UI Helpers
function WorkflowStep({
  stepNum,
  title,
  status,
  metric,
  onClick,
  interactive = false,
}: {
  stepNum: number;
  title: string;
  status: 'pass' | 'fail' | 'info';
  metric: string;
  onClick?: () => void;
  interactive?: boolean;
}) {
  const statusColors = {
    pass: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    fail: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
    info: 'bg-slate-950 border-slate-800 text-cyan-400',
  };

  return (
    <div
      onClick={onClick}
      className={`p-3 rounded-lg border ${statusColors[status]} space-y-1 transition-all ${
        interactive ? 'cursor-pointer hover:border-cyan-400 hover:bg-slate-900/80 active:scale-95' : ''
      }`}
    >
      <div className="flex items-center justify-between text-[10px] text-slate-400">
        <span>STEP 0{stepNum} {interactive && '(Click to Cycle)'}</span>
        {status === 'pass' && <span className="text-emerald-400 font-bold">OK</span>}
        {status === 'fail' && <span className="text-rose-400 font-bold">NG</span>}
      </div>
      <div className="font-bold text-slate-200">{title}</div>
      <div className="text-[10px] font-mono text-slate-400">{metric}</div>
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
  const percent = Math.min(100, Math.round(dcr * 100));
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
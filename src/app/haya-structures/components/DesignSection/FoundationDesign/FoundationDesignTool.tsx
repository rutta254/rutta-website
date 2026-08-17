'use client';

import { useState, useMemo } from 'react';

interface CalculationResults {
  area: number;
  grossWeight: number;
  qMax: number;
  qMin: number;
  soilDcr: number;
  d: number;
  v1Way: number;
  vc1Way: number;
  dcr1Way: number;
  b0: number;
  vPunch: number;
  vcPunch: number;
  dcrPunch: number;
  asReq: number;
  barSpacing: number;
  asProv: number;
  numberOfBars: number;
  barLength: number;
  totalWeightKg: number;
  isPassing: boolean;
}

export default function FoundationDesignTool() {
  // Service & Ultimate Loads
  const [deadLoad, setDeadLoad] = useState<number>(650); // kN
  const [liveLoad, setLiveLoad] = useState<number>(350); // kN
  const [momentX, setMomentX] = useState<number>(40); // kNm
  const [momentY, setMomentY] = useState<number>(20); // kNm

  // Soil & Concrete Parameters
  const [qAllowable, setQAllowable] = useState<number>(175); // kPa
  const [fc, setFc] = useState<number>(30); // MPa
  const [fy, setFy] = useState<number>(500); // MPa
  const [concreteCover, setConcreteCover] = useState<number>(50); // mm

  // Geometry
  const [colX, setColX] = useState<number>(400); // mm
  const [colY, setColY] = useState<number>(400); // mm
  const [footingL, setFootingL] = useState<number>(2300); // mm
  const [footingB, setFootingB] = useState<number>(2300); // mm
  const [footingH, setFootingH] = useState<number>(500); // mm
  const [barDiameter, setBarDiameter] = useState<number>(16); // mm

  // Structural Calculation Engine
  const results: CalculationResults = useMemo(() => {
    // 1. Service Loads & Soil Pressure
    const pService = deadLoad + liveLoad;
    const pFactored = 1.2 * deadLoad + 1.6 * liveLoad;
    const mUFactoredX = 1.2 * momentX + 1.6 * (momentX * (liveLoad / (deadLoad || 1)));
    const mUFactoredY = 1.2 * momentY + 1.6 * (momentY * (liveLoad / (deadLoad || 1)));

    const lengthM = footingL / 1000;
    const widthM = footingB / 1000;
    const depthM = footingH / 1000;
    const area = lengthM * widthM;

    // Self weight calculation (concrete density ~ 24 kN/m³)
    const grossWeight = area * depthM * 24;
    const pServiceTotal = pService + grossWeight;

    // Direct Biaxial Bearing Pressure
    const zX = (widthM * Math.pow(lengthM, 2)) / 6;
    const zY = (lengthM * Math.pow(widthM, 2)) / 6;
    const qDirect = pServiceTotal / area;
    const qEccX = momentX / zX;
    const qEccY = momentY / zY;

    const qMax = qDirect + qEccX + qEccY;
    const qMin = Math.max(0, qDirect - qEccX - qEccY);
    const soilDcr = qMax / (qAllowable || 1);

    // 2. Depth & Shear Checks
    const d = footingH - concreteCover - barDiameter; // mm
    const dM = d / 1000;

    // Ultimate Soil Pressure (for concrete structural strength design)
    const qUltimate = pFactored / area; // kPa

    // One-Way (Beam) Shear Check at distance 'd' from column face
    const cantileverX = (footingL - colX) / 2 / 1000; // m
    const shearDist1Way = cantileverX - dM; // m
    const v1Way = Math.max(0, qUltimate * (widthM * shearDist1Way)); // kN
    // ACI 318 Simplified Shear Capacity: phi * 0.17 * sqrt(fc) * b * d
    const vc1Way = 0.75 * 0.17 * Math.sqrt(fc) * (footingB) * d / 1000; // kN
    const dcr1Way = v1Way / (vc1Way || 1);

    // Two-Way (Punching) Shear Check at distance 'd/2' around column
    const colXM = colX / 1000;
    const colYM = colY / 1000;
    const b0 = 2 * (colX + d) + 2 * (colY + d); // mm
    const punchingArea = (colXM + dM) * (colYM + dM); // m²
    const vPunch = qUltimate * (area - punchingArea); // kN
    // ACI 318 Punching Shear Capacity: phi * 0.33 * sqrt(fc) * b0 * d
    const vcPunch = 0.75 * 0.33 * Math.sqrt(fc) * b0 * d / 1000; // kN
    const dcrPunch = vPunch / (vcPunch || 1);

    // 3. Flexural Reinforcement Design
    const mUltimateFace = (qUltimate * widthM * Math.pow(cantileverX, 2)) / 2; // kNm
    const rn = (mUltimateFace * 1e6) / (0.9 * footingB * Math.pow(d, 2));
    const rhoReq = (0.85 * fc / fy) * (1 - Math.sqrt(Math.max(0, 1 - (2 * rn) / (0.85 * fc))));
    const rhoMin = 0.0018; // Minimum shrinkage & temperature reinforcement
    const rhoFinal = Math.max(rhoReq, rhoMin);

    const asReq = rhoFinal * footingB * d; // mm²
    const singleBarArea = (Math.PI / 4) * Math.pow(barDiameter, 2); // mm²

    // Spacing calculation capped between 100mm and 300mm
    const rawSpacing = (singleBarArea * footingB) / asReq;
    const barSpacing = Math.min(300, Math.max(100, Math.floor(rawSpacing / 25) * 25));

    const numberOfBars = Math.ceil((footingB - 2 * concreteCover) / barSpacing) + 1;
    const asProv = numberOfBars * singleBarArea;

    // Bar Bending Schedule (BBS) Metrics
    const hookLength = 12 * barDiameter; // Standard 90-degree bend leg
    const barLength = footingL - (2 * concreteCover) + (2 * hookLength); // mm
    const linearDensity = (Math.pow(barDiameter, 2) / 162); // kg/m
    const totalWeightKg = numberOfBars * (barLength / 1000) * linearDensity * 2; // Both directions (X & Y)

    const isPassing = soilDcr <= 1.0 && dcr1Way <= 1.0 && dcrPunch <= 1.0;

    return {
      area,
      grossWeight,
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
    deadLoad, liveLoad, momentX, momentY, qAllowable, fc, fy,
    concreteCover, colX, colY, footingL, footingB, footingH, barDiameter
  ]);

  return (
    <div className="space-y-6 text-slate-200">
      {/* Top Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatusCard
          label="Overall Design Status"
          value={results.isPassing ? 'PASSING' : 'ACTION REQ.'}
          subtext={`Max DCR: ${Math.max(results.soilDcr, results.dcr1Way, results.dcrPunch).toFixed(2)}`}
          status={results.isPassing ? 'pass' : 'fail'}
        />
        <StatusCard
          label="Max Soil Bearing Pressure"
          value={`${results.qMax.toFixed(1)} kPa`}
          subtext={`Allowable: ${qAllowable} kPa (DCR: ${results.soilDcr.toFixed(2)})`}
          status={results.soilDcr <= 1.0 ? 'pass' : 'fail'}
        />
        <StatusCard
          label="Punching Shear Ratio"
          value={`${results.dcrPunch.toFixed(2)}`}
          subtext={`V_u: ${results.vPunch.toFixed(0)} kN / φV_c: ${results.vcPunch.toFixed(0)} kN`}
          status={results.dcrPunch <= 1.0 ? 'pass' : 'fail'}
        />
        <StatusCard
          label="Total Foundation Steel"
          value={`${results.totalWeightKg.toFixed(1)} kg`}
          subtext={`2x Layers (${results.numberOfBars}x T${barDiameter} @ ${results.barSpacing}mm)`}
          status="neutral"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Input Control Panel */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2">
            Design Inputs & Loads
          </h3>

          {/* Applied Structural Loads */}
          <div className="space-y-3">
            <span className="text-[11px] font-mono font-bold text-cyan-400 uppercase">1. Applied Loads</span>
            <div className="grid grid-cols-2 gap-3">
              <InputField label="Dead Load P_D (kN)" value={deadLoad} onChange={setDeadLoad} />
              <InputField label="Live Load P_L (kN)" value={liveLoad} onChange={setLiveLoad} />
              <InputField label="Moment M_x (kNm)" value={momentX} onChange={setMomentX} />
              <InputField label="Moment M_y (kNm)" value={momentY} onChange={setMomentY} />
            </div>
          </div>

          {/* Geotechnical & Materials */}
          <div className="space-y-3">
            <span className="text-[11px] font-mono font-bold text-cyan-400 uppercase">2. Soil & Materials</span>
            <div className="grid grid-cols-2 gap-3">
              <InputField label="q_allowable (kPa)" value={qAllowable} onChange={setQAllowable} />
              <InputField label="Concrete f_c' (MPa)" value={fc} onChange={setFc} />
              <InputField label="Steel f_y (MPa)" value={fy} onChange={setFy} />
              <InputField label="Clear Cover (mm)" value={concreteCover} onChange={setConcreteCover} />
            </div>
          </div>

          {/* Footing & Column Geometry */}
          <div className="space-y-3">
            <span className="text-[11px] font-mono font-bold text-cyan-400 uppercase">3. Geometry & Sizing</span>
            <div className="grid grid-cols-2 gap-3">
              <InputField label="Footing Length L (mm)" value={footingL} onChange={setFootingL} step={50} />
              <InputField label="Footing Width B (mm)" value={footingB} onChange={setFootingB} step={50} />
              <InputField label="Thickness H (mm)" value={footingH} onChange={setFootingH} step={25} />
              <InputField label="Bar Diameter (mm)" value={barDiameter} onChange={setBarDiameter} step={2} />
              <InputField label="Column c_x (mm)" value={colX} onChange={setColX} step={25} />
              <InputField label="Column c_y (mm)" value={colY} onChange={setColY} step={25} />
            </div>
          </div>
        </div>

        {/* Calculation Output & BBS Schedule */}
        <div className="lg:col-span-7 space-y-6">
          {/* Engineering Verification Checks */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2">
              Limit State Verifications (ACI 318 / LRFD)
            </h3>

            <div className="space-y-3">
              <DcrProgressBar
                title="1. Bearing Pressure Utilization"
                dcr={results.soilDcr}
                details={`q_max: ${results.qMax.toFixed(1)} kPa | q_min: ${results.qMin.toFixed(1)} kPa | Allowable: ${qAllowable} kPa`}
              />
              <DcrProgressBar
                title="2. One-Way (Beam) Shear Capacity"
                dcr={results.dcr1Way}
                details={`V_u: ${results.v1Way.toFixed(1)} kN | φV_c: ${results.vc1Way.toFixed(1)} kN at dist d=${results.d}mm`}
              />
              <DcrProgressBar
                title="3. Two-Way (Punching) Shear Capacity"
                dcr={results.dcrPunch}
                details={`V_u: ${results.vPunch.toFixed(1)} kN | φV_c: ${results.vcPunch.toFixed(1)} kN on perimeter b_0=${results.b0}mm`}
              />
            </div>
          </div>

          {/* Bar Bending Schedule (BBS) & Detailing */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Rebar Schedule & BBS Generator
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
              <span className="text-slate-400">Provided Area (A_s,prov):</span>
              <span className="font-mono text-emerald-400 font-bold">
                {results.asProv.toFixed(0)} mm² ({(results.asProv / results.asReq * 100).toFixed(0)}% provided)
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Subcomponents
function StatusCard({
  label,
  value,
  subtext,
  status,
}: {
  label: string;
  value: string;
  subtext: string;
  status: 'pass' | 'fail' | 'neutral';
}) {
  const badgeColors = {
    pass: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    fail: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
    neutral: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400',
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
      <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wide">{label}</span>
      <div className={`text-lg font-bold font-mono border rounded-lg px-2.5 py-1 ${badgeColors[status]}`}>
        {value}
      </div>
      <p className="text-[10px] text-slate-400 font-mono mt-1">{subtext}</p>
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
      <p className="text-[10px] text-slate-400 font-mono">{details}</p>
    </div>
  );
}
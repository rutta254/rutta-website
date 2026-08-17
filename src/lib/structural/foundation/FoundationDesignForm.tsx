import React, { useState, useMemo } from 'react';
import {
  Layers,
  Building2,
  Ruler,
  Weight,
  Grid,
  ShieldAlert,
  HelpCircle,
  Play
} from 'lucide-react';

// Fixed relative import path (assuming sibling index.ts or types file in the same directory)
import {
  DesignCode,
  FoundationCategory,
  ShallowType,
  DeepType,
  CombinedSubType,
  MeshMode,
  FoundationDesignInput,
  ShallowDesignInput,
  DeepDesignInput,
  FoundationDesignResult,
  designFoundation
} from './index';

interface FoundationDesignFormProps {
  onCalculate?: (result: FoundationDesignResult) => void;
}

export const FoundationDesignForm: React.FC<FoundationDesignFormProps> = ({ onCalculate }) => {
  // Shared Parameters
  const [code, setCode] = useState<DesignCode>('BS8110');
  const [category, setCategory] = useState<FoundationCategory>('shallow');
  const [fc, setFc] = useState<string>('30');
  const [fy, setFy] = useState<string>('460');
  const [cover, setCover] = useState<string>('50');
  const [c1, setC1] = useState<string>('400');
  const [c2, setC2] = useState<string>('400');

  // Loading & Action Parameters
  const [pDead, setPDead] = useState<string>('800');
  const [pLive, setPLive] = useState<string>('400');
  const [mDeadX, setMDeadX] = useState<string>('50');
  const [mLiveX, setMLiveX] = useState<string>('30');
  const [mDeadY, setMDeadY] = useState<string>('0');
  const [mLiveY, setMLiveY] = useState<string>('0');

  // Mesh & Rebar Configuration
  const [meshMode, setMeshMode] = useState<MeshMode>('auto');
  const [botBarDiam, setBotBarDiam] = useState<string>('16');
  const [botBarSpacing, setBotBarSpacing] = useState<string>('150');
  const [topBarDiam, setTopBarDiam] = useState<string>('12');
  const [topBarSpacing, setTopBarSpacing] = useState<string>('200');

  // Shallow Foundation Parameters
  const [shallowType, setShallowType] = useState<ShallowType>('isolated_pad');
  const [combinedSubType, setCombinedSubType] = useState<CombinedSubType>('rectangular');
  const [qAllow, setQAllow] = useState<string>('150');
  const [gammaSoil, setGammaSoil] = useState<string>('18');
  const [embedmentDepth, setEmbedmentDepth] = useState<string>('1500');
  const [colSpacing, setColSpacing] = useState<string>('3500');
  const [c2_1, setC2_1] = useState<string>('400');
  const [c2_2, setC2_2] = useState<string>('400');

  // Deep Foundation Parameters
  const [deepType, setDeepType] = useState<DeepType>('pile_cap');
  const [pileDiameter, setPileDiameter] = useState<string>('500');
  const [numPiles, setNumPiles] = useState<string>('4');
  const [pileLength, setPileLength] = useState<string>('12000');
  const [pileSpacing, setPileSpacing] = useState<string>('1500');

  // Parse strings safely without triggering zero-jumps while typing
  const parseNum = (val: string, fallback = 0): number => {
    const num = parseFloat(val);
    return isNaN(num) ? fallback : num;
  };

  // Construct input object dynamically
  const payload: FoundationDesignInput = useMemo(() => {
    const baseInput = {
      code,
      fc: parseNum(fc, 30),
      fy: parseNum(fy, 460),
      cover: parseNum(cover, 50),
      c1: parseNum(c1, 400),
      c2: parseNum(c2, 400),
      pDead: parseNum(pDead, 0),
      pLive: parseNum(pLive, 0),
      mDeadX: parseNum(mDeadX, 0),
      mLiveX: parseNum(mLiveX, 0),
      mDeadY: parseNum(mDeadY, 0),
      mLiveY: parseNum(mLiveY, 0),
      meshMode,
      botBarDiam: parseNum(botBarDiam, 16),
      botBarSpacing: parseNum(botBarSpacing, 150),
      topBarDiam: parseNum(topBarDiam, 12),
      topBarSpacing: parseNum(topBarSpacing, 200),
    };

    if (category === 'shallow') {
      const shallow: ShallowDesignInput = {
        ...baseInput,
        category: 'shallow',
        shallowType,
        combinedSubType: shallowType === 'combined' ? combinedSubType : undefined,
        qAllow: parseNum(qAllow, 150),
        gammaSoil: parseNum(gammaSoil, 18),
        embedmentDepth: parseNum(embedmentDepth, 1500),
        colSpacing: shallowType === 'combined' ? parseNum(colSpacing, 3500) : undefined,
        c2_1: shallowType === 'combined' ? parseNum(c2_1, parseNum(c1, 400)) : undefined,
        c2_2: shallowType === 'combined' ? parseNum(c2_2, parseNum(c2, 400)) : undefined,
      };
      return shallow;
    } else {
      const deep: DeepDesignInput = {
        ...baseInput,
        category: 'deep',
        deepType,
        pileDiameter: parseNum(pileDiameter, 500),
        numPiles: parseNum(numPiles, 4),
        pileLength: parseNum(pileLength, 12000),
        pileSpacing: parseNum(pileSpacing, 1500),
      };
      return deep;
    }
  }, [
    code, category, fc, fy, cover, c1, c2, pDead, pLive, mDeadX, mLiveX, mDeadY, mLiveY,
    meshMode, botBarDiam, botBarSpacing, topBarDiam, topBarSpacing, shallowType,
    combinedSubType, qAllow, gammaSoil, embedmentDepth, colSpacing, c2_1, c2_2,
    deepType, pileDiameter, numPiles, pileLength, pileSpacing
  ]);

  const handleCalculate = (e: React.FormEvent) => {
    e.preventDefault();
    const result = designFoundation(payload);
    if (onCalculate) {
      onCalculate(result);
    }
  };

  return (
    <form onSubmit={handleCalculate} className="w-full max-w-5xl mx-auto bg-slate-900 text-slate-100 rounded-xl border border-slate-800 shadow-2xl overflow-hidden font-sans">
      {/* Top Bar / Design Code Picker */}
      <div className="bg-slate-950 p-5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/30">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">Foundation Design Generator</h2>
            <p className="text-xs text-slate-400">Configure geotechnical, geometry & loading parameters</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Design Code:</label>
          <select
            value={code}
            onChange={(e) => setCode(e.target.value as DesignCode)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
          >
            <option value="BS8110">BS 8110:1997</option>
            <option value="ACI318_19">ACI 318-19</option>
            <option value="EC2_EN1992">Eurocode 2 (EN 1992)</option>
            <option value="IS456">IS 456:2000</option>
            <option value="AS3600">AS 3600:2018</option>
            <option value="CSA_A23_3">CSA A23.3-19</option>
          </select>
        </div>
      </div>

      <div className="p-6 space-y-8">
        {/* Section 1: Foundation Type & Subtype Selection */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-5 h-5 text-indigo-400" />
            <h3 className="text-md font-semibold text-slate-200">1. Classification & Type</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Category Toggle */}
            <div className="bg-slate-950/60 p-1.5 rounded-lg border border-slate-800 flex gap-2">
              <button
                type="button"
                onClick={() => setCategory('shallow')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-semibold transition ${
                  category === 'shallow'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                Shallow Foundation
              </button>
              <button
                type="button"
                onClick={() => setCategory('deep')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-semibold transition ${
                  category === 'deep'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                Deep Foundation
              </button>
            </div>

            {/* Subtype Pickers */}
            <div className="flex items-center gap-3">
              {category === 'shallow' ? (
                <>
                  <select
                    value={shallowType}
                    onChange={(e) => setShallowType(e.target.value as ShallowType)}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="isolated_pad">Isolated Pad Footing</option>
                    <option value="wall_strip">Wall Strip Footing</option>
                    <option value="combined">Combined Footing</option>
                    <option value="raft_mat">Raft / Mat Foundation</option>
                  </select>

                  {shallowType === 'combined' && (
                    <select
                      value={combinedSubType}
                      onChange={(e) => setCombinedSubType(e.target.value as CombinedSubType)}
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      <option value="rectangular">Rectangular</option>
                      <option value="trapezoidal">Trapezoidal</option>
                      <option value="strap">Strap Beam</option>
                    </select>
                  )}
                </>
              ) : (
                <select
                  value={deepType}
                  onChange={(e) => setDeepType(e.target.value as DeepType)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="pile_cap">Pile Cap System</option>
                  <option value="single_pile">Single Isolated Pile</option>
                  <option value="drilled_shaft">Drilled Shaft / Caisson</option>
                </select>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Loading & Action Parameters */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Weight className="w-5 h-5 text-amber-400" />
            <h3 className="text-md font-semibold text-slate-200">2. Applied Column Actions (Unfactored / Service)</h3>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">P Dead (kN)</label>
              <input
                type="number"
                value={pDead}
                onChange={(e) => setPDead(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">P Live (kN)</label>
              <input
                type="number"
                value={pLive}
                onChange={(e) => setPLive(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Mx Dead (kNm)</label>
              <input
                type="number"
                value={mDeadX}
                onChange={(e) => setMDeadX(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Mx Live (kNm)</label>
              <input
                type="number"
                value={mLiveX}
                onChange={(e) => setMLiveX(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">My Dead (kNm)</label>
              <input
                type="number"
                value={mDeadY}
                onChange={(e) => setMDeadY(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">My Live (kNm)</label>
              <input
                type="number"
                value={mLiveY}
                onChange={(e) => setMLiveY(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Geotechnical & Material Properties */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Ruler className="w-5 h-5 text-emerald-400" />
            <h3 className="text-md font-semibold text-slate-200">3. Material & Geotechnical Parameters</h3>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Concrete f'c (MPa)</label>
              <input
                type="number"
                value={fc}
                onChange={(e) => setFc(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Rebar fy (MPa)</label>
              <input
                type="number"
                value={fy}
                onChange={(e) => setFy(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Concrete Cover (mm)</label>
              <input
                type="number"
                value={cover}
                onChange={(e) => setCover(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Column c1 x c2 (mm)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="c1"
                  value={c1}
                  onChange={(e) => setC1(e.target.value)}
                  className="w-1/2 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <input
                  type="number"
                  placeholder="c2"
                  value={c2}
                  onChange={(e) => setC2(e.target.value)}
                  className="w-1/2 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            {category === 'shallow' ? (
              <>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Allowable Bearing q_allow (kPa)</label>
                  <input
                    type="number"
                    value={qAllow}
                    onChange={(e) => setQAllow(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Soil Gamma (kN/m³)</label>
                  <input
                    type="number"
                    value={gammaSoil}
                    onChange={(e) => setGammaSoil(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Embedment Depth (mm)</label>
                  <input
                    type="number"
                    value={embedmentDepth}
                    onChange={(e) => setEmbedmentDepth(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                {shallowType === 'combined' && (
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Column Spacing (mm)</label>
                    <input
                      type="number"
                      value={colSpacing}
                      onChange={(e) => setColSpacing(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                )}
              </>
            ) : (
              <>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Pile Diameter (mm)</label>
                  <input
                    type="number"
                    value={pileDiameter}
                    onChange={(e) => setPileDiameter(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Pile Quantity</label>
                  <input
                    type="number"
                    value={numPiles}
                    onChange={(e) => setNumPiles(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Pile Length (mm)</label>
                  <input
                    type="number"
                    value={pileLength}
                    onChange={(e) => setPileLength(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Pile Center Spacing (mm)</label>
                  <input
                    type="number"
                    value={pileSpacing}
                    onChange={(e) => setPileSpacing(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Section 4: Reinforcement & Mesh Settings */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Grid className="w-5 h-5 text-sky-400" />
            <h3 className="text-md font-semibold text-slate-200">4. Reinforcement & Mesh Mode</h3>
          </div>

          <div className="space-y-4">
            {/* Mesh Mode Selectors */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { id: 'auto', title: 'Auto Evaluated Mesh', desc: 'Code-driven double mesh evaluation' },
                { id: 'single', title: 'Force Single Mesh', desc: 'Bottom reinforcement mat only' },
                { id: 'double', title: 'Force Double Mesh', desc: 'Top and bottom reinforcement mats' },
              ].map((item) => (
                <div
                  key={item.id}
                  onClick={() => setMeshMode(item.id as MeshMode)}
                  className={`cursor-pointer p-3 rounded-lg border transition ${
                    meshMode === item.id
                      ? 'bg-sky-950/40 border-sky-500 ring-1 ring-sky-500'
                      : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-200">{item.title}</span>
                    <input
                      type="radio"
                      name="meshMode"
                      checked={meshMode === item.id}
                      onChange={() => {}}
                      className="text-sky-500 focus:ring-0"
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{item.desc}</p>
                </div>
              ))}
            </div>

            {/* Bar Configuration inputs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Bottom Bar Diam (mm)</label>
                <input
                  type="number"
                  value={botBarDiam}
                  onChange={(e) => setBotBarDiam(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Bottom Spacing (mm)</label>
                <input
                  type="number"
                  value={botBarSpacing}
                  onChange={(e) => setBotBarSpacing(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Top Bar Diam (mm)</label>
                <input
                  type="number"
                  value={topBarDiam}
                  onChange={(e) => setTopBarDiam(e.target.value)}
                  disabled={meshMode === 'single'}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Top Spacing (mm)</label>
                <input
                  type="number"
                  value={topBarSpacing}
                  onChange={(e) => setTopBarSpacing(e.target.value)}
                  disabled={meshMode === 'single'}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer / Submit Button */}
      <div className="bg-slate-950 p-5 border-t border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <HelpCircle className="w-4 h-4 text-slate-500" />
          <span>Calculations apply ultimate load factors (1.2D + 1.6L) according to selected code.</span>
        </div>

        <button
          type="submit"
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-lg font-semibold text-sm shadow-lg shadow-indigo-600/30 transition transform active:scale-95"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>Run Design Calculations</span>
        </button>
      </div>
    </form>
  );
};
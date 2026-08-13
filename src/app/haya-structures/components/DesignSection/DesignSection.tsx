'use client';

import { useState } from 'react';
import FoundationDesignTool from './FoundationDesignTool';

// Placeholder fallbacks for element design tools in development
const BeamDesignTool = () => <PlaceholderTool name="Beam Design & Optimization" />;
const ColumnDesignTool = () => <PlaceholderTool name="Column Design & Interaction Diagrams" />;
const SlabDesignTool = () => <PlaceholderTool name="Slab Reinforcement & Deflection Design" />;
const WallDesignTool = () => <PlaceholderTool name="Shear Wall & Retaining Design" />;
const TrussDesignTool = () => <PlaceholderTool name="Truss Member Sizing & Connection Design" />;
const FrameDesignTool = () => <PlaceholderTool name="Frame Optimization Engine" />;

type ElementType = 'foundation' | 'beam' | 'column' | 'slab' | 'wall' | 'truss' | 'frame';

interface ElementOption {
  id: ElementType;
  label: string;
  badge?: string;
}

const ELEMENTS: ElementOption[] = [
  { id: 'foundation', label: 'Foundations', badge: 'Auto-Sizer + BBS' },
  { id: 'beam', label: 'Beams' },
  { id: 'column', label: 'Columns' },
  { id: 'slab', label: 'Slabs' },
  { id: 'wall', label: 'Walls' },
  { id: 'truss', label: 'Trusses' },
  { id: 'frame', label: 'Frames' },
];

export default function DesignSection() {
  const [activeElement, setActiveElement] = useState<ElementType>('foundation');

  const renderSelectedTool = () => {
    switch (activeElement) {
      case 'foundation':
        return <FoundationDesignTool />;
      case 'beam':
        return <BeamDesignTool />;
      case 'column':
        return <ColumnDesignTool />;
      case 'slab':
        return <SlabDesignTool />;
      case 'wall':
        return <WallDesignTool />;
      case 'truss':
        return <TrussDesignTool />;
      case 'frame':
        return <FrameDesignTool />;
      default:
        return <FoundationDesignTool />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Select Structural Element for Automated Design
          </h2>
          <span className="text-[10px] bg-cyan-500/20 text-cyan-400 font-bold px-2 py-0.5 rounded border border-cyan-500/30">
            AUTO-DESIGN & REBAR BBS ENGINE
          </span>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2">
          {ELEMENTS.map((el) => (
            <button
              key={el.id}
              onClick={() => setActiveElement(el.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition flex items-center gap-2 ${
                activeElement === el.id
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-lg shadow-cyan-500/20'
                  : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'
              }`}
            >
              <span>{el.label}</span>
              {el.badge && (
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                    activeElement === el.id
                      ? 'bg-slate-950 text-cyan-400 font-bold'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {el.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="tool-viewport">
        {renderSelectedTool()}
      </div>
    </div>
  );
}

function PlaceholderTool({ name }: { name: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center space-y-3">
      <div className="w-12 h-12 bg-cyan-500/10 text-cyan-400 rounded-full flex items-center justify-center mx-auto border border-cyan-500/20 font-bold">
        🛠️
      </div>
      <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wide">{name}</h3>
      <p className="text-xs text-slate-400 max-w-md mx-auto">
        Automated sizing, direct code steel area optimization, and bar bending schedules (BBS) for this module are under active construction.
      </p>
    </div>
  );
}
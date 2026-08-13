'use client';

import { useState } from 'react';
import FoundationDesignTool from './FoundationDesign/FoundationDesignTool';

// Placeholder runners for elements undergoing active design-engine integration
const BeamDesignTool = () => <DesignPlaceholder name="Beam Reinforcement & Moment Sizing" icon="📐" />;
const ColumnDesignTool = () => <DesignPlaceholder name="Column Interaction Diagram & Tie Design" icon="🏛️" />;
const SlabDesignTool = () => <DesignPlaceholder name="Slab Thickness & Mesh Optimization" icon="🟩" />;
const WallDesignTool = () => <DesignPlaceholder name="Shear Wall & Retaining Wall Sizing" icon="🧱" />;
const TrussDesignTool = () => <DesignPlaceholder name="Truss Steel Profile Sizing & Welds" icon="🔺" />;
const FrameDesignTool = () => <DesignPlaceholder name="Portal Frame Member Optimization" icon="🖼️" />;

export type StructuralElementType = 
  | 'foundation'
  | 'beam'
  | 'column'
  | 'slab'
  | 'wall'
  | 'truss'
  | 'frame';

interface ElementToggleOption {
  id: StructuralElementType;
  label: string;
  badge?: string;
  description: string;
}

const DESIGN_ELEMENTS: ElementToggleOption[] = [
  { 
    id: 'foundation', 
    label: 'Foundations',
    description: 'Direct soil pressure optimization, punching depth solver & rebar schedule.'
  },
  { 
    id: 'beam', 
    label: 'Beams',
    description: 'Optimal b x d depth solver, tension steel & stirrup spacing.'
  },
  { 
    id: 'column', 
    label: 'Columns',
    description: 'Biaxial bending capacity, longitudinal bar arrangement & tie sizing.'
  },
  { 
    id: 'slab', 
    label: 'Slabs',
    description: 'Minimum thickness checks, top/bottom mesh spacing & crack control.'
  },
  { 
    id: 'wall', 
    label: 'Walls',
    description: 'Boundary element detailing, horizontal/vertical shear rebar.'
  },
  { 
    id: 'truss', 
    label: 'Trusses',
    description: 'Automatic RHS/CHS/Angle section selection based on LRFD capacity.'
  },
  { 
    id: 'frame', 
    label: 'Frames',
    description: 'Integrated moment frame beam-column joint & drift designer.'
  },
];

export default function DesignSection() {
  const [activeElement, setActiveElement] = useState<StructuralElementType>('foundation');

  const selectedElementMeta = DESIGN_ELEMENTS.find((el) => el.id === activeElement);

  // Dynamic router that delegates execution to the corresponding element design component
  const renderSelectedDesignTool = () => {
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
      {/* Structural Element Toggles Header */}
      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-3">
        <div className="flex flex-wrap justify-between items-center gap-2 border-b border-slate-800 pb-2">
          <div>
            <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Structural Member Auto-Design Hub
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Select an element to run direct sizing optimization, steel area calculations, and BBS schedule generation.
            </p>
          </div>
          <span className="text-[10px] bg-cyan-500/20 text-cyan-400 font-bold px-2 py-1 rounded border border-cyan-500/30 font-mono">
            DESIGN MODE ACTIVE
          </span>
        </div>

        {/* Toggle Nav Buttons */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-700">
          {DESIGN_ELEMENTS.map((el) => {
            const isActive = activeElement === el.id;
            return (
              <button
                key={el.id}
                onClick={() => setActiveElement(el.id)}
                className={`px-4 py-2.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-2.5 ${
                  isActive
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-lg shadow-cyan-500/20 translate-y-[-1px]'
                    : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800/80 hover:text-slate-100'
                }`}
              >
                <span>{el.label}</span>
                {el.badge && (
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold tracking-tight ${
                      isActive
                        ? 'bg-slate-950 text-cyan-400'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {el.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected Element Sub-Bar Description */}
        {selectedElementMeta && (
          <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-400 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span>{selectedElementMeta.description}</span>
          </div>
        )}
      </div>

      {/* Active Element Viewport */}
      <div className="design-tool-viewport">
        {renderSelectedDesignTool()}
      </div>
    </div>
  );
}

// Fallback Container for Elements Under Construction
function DesignPlaceholder({ name, icon }: { name: string; icon: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center space-y-3">
      <div className="w-12 h-12 bg-cyan-500/10 text-cyan-400 rounded-full flex items-center justify-center mx-auto border border-cyan-500/20 text-xl">
        {icon}
      </div>
      <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wide">{name}</h3>
      <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
        Direct section optimization, capacity ratios, and bar bending schedule (BBS) calculations for this element module are ready for integration into <code className="text-cyan-400">src/lib/structural/</code>.
      </p>
    </div>
  );
}
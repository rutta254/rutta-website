'use client';

import { useState } from 'react';
import BeamAnalysisTool from './analysis/BeamAnalysisTool';
import GenericAnalysisTool from './analysis/ColumnAnalysisTool';

export default function AnalysisSection() {
  const [structuralElement, setStructuralElement] = useState<
    'beam' | 'column' | 'slab' | 'wall' | 'truss' | 'foundation' | 'frame'
  >('beam');

  const elements = [
    { id: 'beam', label: 'Beams' },
    { id: 'column', label: 'Columns' },
    { id: 'slab', label: 'Slabs' },
    { id: 'wall', label: 'Walls' },
    { id: 'truss', label: 'Trusses' },
    { id: 'foundation', label: 'Foundations' },
    { id: 'frame', label: 'Frames' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Select Structural Element for Analysis
        </h2>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {elements.map((el) => (
            <button
              key={el.id}
              onClick={() => setStructuralElement(el.id as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                structuralElement === el.id
                  ? 'bg-teal-500 text-slate-950 font-bold'
                  : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'
              }`}
            >
              {el.label}
            </button>
          ))}
        </div>
      </div>

      {structuralElement === 'beam' ? (
        <BeamAnalysisTool />
      ) : (
        <GenericAnalysisTool title={structuralElement.toUpperCase()} />
      )}
    </div>
  );
}
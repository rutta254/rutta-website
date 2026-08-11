'use client';

import { useState } from 'react';
import Link from 'next/link';
import AnalysisSection from './components/AnalysisSection';
import DesignSection from './components/DesignSection';
import ConsultancySection from './components/ConsultancySection';
import ProjectsSection from './components/ProjectsSection';

export default function HayaStructuresHub() {
  const [activeTab, setActiveTab] = useState<'analysis' | 'design' | 'consultancy' | 'projects'>('analysis');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header & Primary Toggles */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 pb-4 gap-4">
          <div>
            <Link href="/" className="text-cyan-400 text-sm hover:underline">
              ← Back to Rutta.com Home
            </Link>
            <h1 className="text-3xl font-extrabold text-cyan-400 mt-1">HAYA STRUCTURES SUITE</h1>
            <p className="text-sm text-slate-400">Integrated Structural Engineering & Finite Element Analysis Platform</p>
          </div>

          <div className="flex bg-slate-900 p-1.5 rounded-xl border border-slate-800 gap-1 flex-wrap">
            {(['analysis', 'design', 'consultancy', 'projects'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition ${
                  activeTab === tab ? 'bg-cyan-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Routing */}
        {activeTab === 'analysis' && <AnalysisSection />}
        {activeTab === 'design' && <DesignSection />}
        {activeTab === 'consultancy' && <ConsultancySection />}
        {activeTab === 'projects' && <ProjectsSection />}

      </div>
    </div>
  );
}
// src/app/page.tsx
'use client';

import Link from 'next/link';

export default function RuttaGroupGateway() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-6 md:p-12">
      {/* Top Header / Branding */}
      <header className="max-w-6xl mx-auto w-full flex justify-between items-center">
        <h1 className="text-xl md:text-2xl font-extrabold tracking-widest text-cyan-400">
          RUTTA GROUP
        </h1>
        <div className="text-xs font-semibold uppercase tracking-widest px-3 py-1 bg-cyan-500/10 text-cyan-400 rounded-full border border-cyan-500/20">
          Unified Enterprise Portal
        </div>
      </header>

      {/* Gateway Hero Section */}
      <main className="max-w-3xl mx-auto text-center space-y-8 my-auto py-12">
        <div className="space-y-4">
          <span className="px-3.5 py-1 text-xs font-bold uppercase tracking-widest bg-cyan-950 text-cyan-400 border border-cyan-800 rounded-full">
            Enterprise Ecosystem
          </span>
          <h2 className="text-4xl md:text-6xl font-black tracking-tight text-white">
            Welcome to <span className="text-cyan-400">Rutta Group</span>
          </h2>
          <p className="text-base md:text-lg text-slate-400 max-w-xl mx-auto">
            The central ecosystem connecting Meraki Ranch, Haya Structures, Haya Feeds, Cloudmore, Art4u, and live global markets.
          </p>
        </div>

        {/* Action Buttons: Client Login, Register, or View as Guest */}
        <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-4">
          <Link
            href="/login"
            className="w-full sm:w-auto px-8 py-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-base transition shadow-lg shadow-cyan-500/20 text-center"
          >
            👤 Client Login / Register
          </Link>
          
          <Link
            href="/hub"
            className="w-full sm:w-auto px-8 py-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 font-semibold text-base transition text-center"
          >
            👀 View as Guest
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto w-full border-t border-slate-900 pt-6 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} RUTTA GROUP. All rights reserved.
      </footer>
    </div>
  );
}
'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function Home() {
  const [marketData, setMarketData] = useState({
    eurusd: { price: "1.0845", change: "+0.12%", status: "Bullish Trend" },
    xauusd: { price: "2342.10", change: "+0.45%", status: "Safe-Haven Active" },
    eurgbp: { price: "0.8520", change: "-0.05%", status: "Range Bound" },
    usdjpy: { price: "155.30", change: "+0.18%", status: "Momentum Up" },
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setMarketData(prev => ({
        eurusd: { ...prev.eurusd, price: (1.0840 + Math.random() * 0.0010).toFixed(4) },
        xauusd: { ...prev.xauusd, price: (2340.00 + Math.random() * 3.00).toFixed(2) },
        eurgbp: { ...prev.eurgbp, price: (0.8515 + Math.random() * 0.0010).toFixed(4) },
        usdjpy: { ...prev.usdjpy, price: (155.20 + Math.random() * 0.30).toFixed(2) },
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center justify-between p-6 sm:p-12 overflow-x-hidden">
      
      {/* Top Hero Header */}
      <div className="w-full max-w-5xl text-center space-y-4 my-6">
        <span className="px-3 py-1 text-xs font-semibold uppercase tracking-widest bg-blue-500/10 text-blue-400 rounded-full border border-blue-500/20">
          Central Hub & Portfolio
        </span>
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white">
          Engineering, Apparel & Visual Art
        </h1>
        <p className="max-w-2xl mx-auto text-slate-400 text-sm sm:text-base leading-relaxed">
          Welcome to my central portal. Showcasing specialized work across civil structural engineering, 
          modern streetwear fashion, visual art galleries, and cloud development.
        </p>
      </div>

      {/* Main Centered Grid with Directly Aligned Horizontal Forex Toggles */}
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-8 my-8">
        
        {/* Column 1: Haya Structures & EUR/USD Toggle */}
        <div className="flex flex-col gap-4">
          <Link href="/haya-structures" className="group flex-1">
            <div className="h-full bg-slate-900/80 border border-slate-800 rounded-2xl p-8 sm:p-10 shadow-xl transition-all duration-300 group-hover:border-blue-500/50 group-hover:bg-slate-900 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold mb-6 text-lg">
                  HS
                </div>
                <h2 className="text-2xl font-bold text-white group-hover:text-blue-400 transition-colors">
                  Haya Structures
                </h2>
                <p className="text-slate-400 text-sm mt-3 leading-relaxed">
                  Civil & Structural engineering calculation suites, beam analysis tools, and structural drafting portals.
                </p>
              </div>
              <div className="mt-8 flex items-center text-blue-400 text-sm font-semibold">
                Launch Suite &rarr;
              </div>
            </div>
          </Link>

          {/* Direct Horizontal Currency Toggle */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between shadow-lg">
            <div>
              <span className="text-xs font-bold text-slate-400 block tracking-wide">EUR/USD (King Pair)</span>
              <span className="text-lg font-mono font-bold text-white">{marketData.eurusd.price}</span>
            </div>
            <div className="text-right">
              <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                {marketData.eurusd.change}
              </span>
              <span className="block text-[10px] text-slate-500 mt-1">{marketData.eurusd.status}</span>
            </div>
          </div>
        </div>

        {/* Column 2: Cloudmore & Gold (XAU/USD) Toggle */}
        <div className="flex flex-col gap-4">
          <div className="h-full bg-slate-900/80 border border-slate-800 rounded-2xl p-8 sm:p-10 shadow-xl flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-400 font-bold mb-6 text-lg">
                CM
              </div>
              <h2 className="text-2xl font-bold text-white">Cloudmore</h2>
              <p className="text-slate-400 text-sm mt-3 leading-relaxed">
                Cloud infrastructure pipelines, automated CI/CD workflows, and full-stack web deployments.
              </p>
            </div>
            <div className="mt-8 text-xs text-purple-400 font-semibold uppercase tracking-wider">
              Active Environment
            </div>
          </div>

          {/* Direct Horizontal Currency Toggle */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between shadow-lg">
            <div>
              <span className="text-xs font-bold text-slate-400 block tracking-wide">Gold XAU/USD</span>
              <span className="text-lg font-mono font-bold text-white">{marketData.xauusd.price}</span>
            </div>
            <div className="text-right">
              <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                {marketData.xauusd.change}
              </span>
              <span className="block text-[10px] text-slate-500 mt-1">{marketData.xauusd.status}</span>
            </div>
          </div>
        </div>

        {/* Column 3: Visual Art & EUR/GBP Toggle */}
        <div className="flex flex-col gap-4">
          <div className="h-full bg-slate-900/80 border border-slate-800 rounded-2xl p-8 sm:p-10 shadow-xl flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-amber-600/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold mb-6 text-lg">
                VA
              </div>
              <h2 className="text-2xl font-bold text-white">Visual Art</h2>
              <p className="text-slate-400 text-sm mt-3 leading-relaxed">
                Creative design portfolios, modern digital galleries, and immersive visual storytelling concepts.
              </p>
            </div>
            <div className="mt-8 text-xs text-amber-400 font-semibold uppercase tracking-wider">
              Gallery Portfolio
            </div>
          </div>

          {/* Direct Horizontal Currency Toggle */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between shadow-lg">
            <div>
              <span className="text-xs font-bold text-slate-400 block tracking-wide">EUR/GBP</span>
              <span className="text-lg font-mono font-bold text-white">{marketData.eurgbp.price}</span>
            </div>
            <div className="text-right">
              <span className="text-xs font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                {marketData.eurgbp.change}
              </span>
              <span className="block text-[10px] text-slate-500 mt-1">{marketData.eurgbp.status}</span>
            </div>
          </div>
        </div>

      </div>

      {/* Footer Note */}
      <footer className="w-full max-w-5xl text-center py-6 text-xs text-slate-500 border-t border-slate-900">
        &copy; {new Date().getFullYear()} Rutta Central Portal. All Rights Reserved. Built with Next.js & Tailwind CSS.
      </footer>

    </main>
  );
}
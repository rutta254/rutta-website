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
      
      {/* Top Navbar with RUTTA.COM on Top Left */}
      <nav className="w-full max-w-6xl flex items-center justify-between py-2 border-b border-slate-900 mb-4">
        <div className="flex items-center space-x-2">
          <span className="text-2xl sm:text-3xl font-black tracking-tight bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent drop-shadow-sm">
            RUTTA.COM
          </span>
        </div>
        <div className="text-xs font-semibold uppercase tracking-widest px-3 py-1 bg-blue-500/10 text-blue-400 rounded-full border border-blue-500/20">
          Central Hub & Portfolio
        </div>
      </nav>

      {/* Top Hero Header */}
      <div className="w-full max-w-6xl text-center space-y-4 my-4">
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white">
          Engineering, Apparel & Visual Art
        </h1>
        <p className="max-w-2xl mx-auto text-slate-400 text-sm sm:text-base leading-relaxed">
          Welcome to my central portal, showcasing specialized work across civil & structural engineering, 
          cloud development, modern fashion, and visual art galleries.
        </p>
      </div>

      {/* Forex Watchlist Section Header */}
      <div className="w-full max-w-6xl flex flex-col sm:flex-row items-start sm:items-center justify-between mt-6 mb-2 px-2 border-b border-slate-900 pb-3 gap-2">
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">Forex Watchlist</h2>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1.5 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
            Live Feed Active
          </span>
        </div>
      </div>

      {/* Main Centered Grid */}
      <div className="w-full max-w-6xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 my-6">
        
        {/* Column 1: Haya Structures & EUR/USD */}
        <div className="flex flex-col gap-4">
          <Link href="/haya-structures" className="group flex-1">
            <div className="h-full bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl transition-all duration-300 group-hover:border-blue-500/50 group-hover:bg-slate-900 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold mb-4 text-base">
                  HS
                </div>
                <h2 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">
                  Haya Structures LLC
                </h2>
                <p className="text-slate-400 text-xs sm:text-sm mt-2 leading-relaxed">
                  Civil & Structural Engineering: Analysis, Design, Consultancy and Projects.
                </p>
              </div>
              <div className="mt-6 flex items-center text-blue-400 text-xs font-semibold">
                Launch Suite &rarr;
              </div>
            </div>
          </Link>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between shadow-lg">
            <div>
              <span className="text-[11px] font-bold text-slate-400 block tracking-wide">EUR/USD</span>
              <span className="text-base font-mono font-bold text-white">{marketData.eurusd.price}</span>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                {marketData.eurusd.change}
              </span>
              <span className="block text-[9px] text-slate-500 mt-0.5">{marketData.eurusd.status}</span>
            </div>
          </div>
        </div>

        {/* Column 2: CloudMore & Gold (XAU/USD) */}
        <div className="flex flex-col gap-4">
          <div className="h-full bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-400 font-bold mb-4 text-base">
                CM
              </div>
              <h2 className="text-xl font-bold text-white">CloudMore</h2>
              <p className="text-slate-400 text-xs sm:text-sm mt-2 leading-relaxed">
                Cloud Infrastructure Pipelines, Automated CI/CD Workflows, and Deployments.
              </p>
            </div>
            <div className="mt-6 text-xs text-purple-400 font-semibold uppercase tracking-wider">
              Active Environment
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between shadow-lg">
            <div>
              <span className="text-[11px] font-bold text-slate-400 block tracking-wide">Gold XAU/USD</span>
              <span className="text-base font-mono font-bold text-white">{marketData.xauusd.price}</span>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                {marketData.xauusd.change}
              </span>
              <span className="block text-[9px] text-slate-500 mt-0.5">{marketData.xauusd.status}</span>
            </div>
          </div>
        </div>

        {/* Column 3: Mr.Universe & EUR/GBP */}
        <div className="flex flex-col gap-4">
          <div className="h-full bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-amber-600/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold mb-4 text-base">
                Mr.U
              </div>
              <h2 className="text-xl font-bold text-white">Mr.Universe</h2>
              <p className="text-slate-400 text-xs sm:text-sm mt-2 leading-relaxed">
                Apparels, Accessories and Lifestyle.
              </p>
            </div>
            <div className="mt-6 text-xs text-amber-400 font-semibold uppercase tracking-wider">
              Gallery Portfolio
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between shadow-lg">
            <div>
              <span className="text-[11px] font-bold text-slate-400 block tracking-wide">EUR/GBP</span>
              <span className="text-base font-mono font-bold text-white">{marketData.eurgbp.price}</span>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-semibold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
                {marketData.eurgbp.change}
              </span>
              <span className="block text-[9px] text-slate-500 mt-0.5">{marketData.eurgbp.status}</span>
            </div>
          </div>
        </div>

        {/* Column 4: Art4U / USD/JPY */}
        <div className="flex flex-col gap-4">
          <div className="h-full bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold mb-4 text-base">
                @4u
              </div>
              <h2 className="text-xl font-bold text-white">Art4U</h2>
              <p className="text-slate-400 text-xs sm:text-sm mt-2 leading-relaxed">
                Creative Design Portfolios, Modern Digital Galleries, and Storytelling.
              </p>
            </div>
            <div className="mt-6 text-xs text-emerald-400 font-semibold uppercase tracking-wider">
              Creative Portfolio
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between shadow-lg">
            <div>
              <span className="text-[11px] font-bold text-slate-400 block tracking-wide">USD/JPY</span>
              <span className="text-base font-mono font-bold text-white">{marketData.usdjpy.price}</span>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                {marketData.usdjpy.change}
              </span>
              <span className="block text-[9px] text-slate-500 mt-0.5">{marketData.usdjpy.status}</span>
            </div>
          </div>
        </div>

      </div>

      {/* Footer Note */}
      <footer className="w-full max-w-6xl text-center py-6 text-xs text-slate-500 border-t border-slate-900">
        &copy; {new Date().getFullYear()} RUTTA.COM Central Portal. All Rights Reserved. Built with Next.js & Tailwind CSS.
      </footer>

    </main>
  );
}
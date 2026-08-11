'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function Home() {
  const [marketData, setMarketData] = useState({
    eurusd: { price: "1.0845", change: "+0.12%", status: "Bullish Trend" },
    xauusd: { price: "2342.10", change: "+0.45%", status: "Safe-Haven Active" },
    eurgbp: { price: "0.8520", change: "-0.05%", status: "Range Bound" },
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setMarketData(prev => ({
        eurusd: { ...prev.eurusd, price: (1.0840 + Math.random() * 0.0010).toFixed(4) },
        xauusd: { ...prev.xauusd, price: (2340 + Math.random() * 5).toFixed(2) },
        eurgbp: { ...prev.eurgbp, price: (0.8515 + Math.random() * 0.0010).toFixed(4) },
      }));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="h-screen bg-black text-white font-sans selection:bg-white selection:text-black overflow-hidden flex flex-col">
      {/* Top Navigation Bar */}
      <nav className="flex-none flex flex-col sm:flex-row justify-between items-center px-6 sm:px-8 py-3 border-b border-neutral-800 bg-black/90 backdrop-blur-md z-50 gap-2">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white font-['Plus_Jakarta_Sans'] uppercase">
          RUTTA<span className="text-neutral-500 font-light">.COM</span>
        </h1>
        
        <div className="flex flex-wrap justify-center gap-4 sm:space-x-8 text-xs sm:text-sm font-semibold tracking-wide">
          <Link href="#haya" className="text-neutral-400 hover:text-white transition">Haya Structures</Link>
          <Link href="#cloudmore" className="text-neutral-400 hover:text-white transition">Cloudmore</Link>
          <Link href="#art4u" className="text-neutral-400 hover:text-white transition">Art4u</Link>
          <Link href="#watchlist" className="text-white hover:text-neutral-300 transition">Market Watch</Link>
        </div>
      </nav>

      {/* Main Split Screen Layout (No Outer Scroll) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        
        {/* LEFT SIDE: Primary Landing & Business Cards (8 Columns) */}
        <div className="lg:col-span-8 h-full overflow-y-auto px-6 py-8 sm:px-10 lg:border-r border-neutral-800 flex flex-col justify-between">
          <div>
            {/* Hero Header */}
            <section className="mb-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-300 text-xs font-semibold tracking-wider uppercase mb-4">
                <span className="w-2 h-2 rounded-full bg-white"></span>
                Central Hub & Portfolio
              </div>
              
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight mb-3 text-white leading-tight">
                Engineering, Apparel & Visual Art
              </h2>
              
              <p className="text-neutral-400 text-sm sm:text-base max-w-2xl font-normal leading-relaxed">
                Welcome to my central portal. Showcasing specialized work across civil structural engineering, modern streetwear fashion, visual art galleries, and cloud development.
              </p>
            </section>

            {/* Business Sections Grid */}
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              
              {/* Haya Structures LLC Card */}
              <div id="haya" className="bg-neutral-950 p-5 rounded-2xl border border-neutral-800 hover:border-neutral-500 transition-all flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-white font-bold text-base mb-4">
                    HS
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">Haya Structures LLC</h3>
                  <p className="text-neutral-400 text-xs mb-6 leading-relaxed">
                    Civil & Structural Engineering consulting and automated calculation tools.
                  </p>
                </div>
                <Link href="/haya-structures" className="inline-flex items-center justify-center w-full bg-white hover:bg-neutral-200 text-black font-bold px-3 py-2.5 rounded-xl text-xs transition shadow-md">
                  Visit Site →
                </Link>
              </div>

              {/* Cloudmore Collections Card */}
              <div id="cloudmore" className="bg-neutral-950 p-5 rounded-2xl border border-neutral-800 hover:border-neutral-500 transition-all flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-white font-bold text-base mb-4">
                    CC
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">Cloudmore Collections</h3>
                  <p className="text-neutral-400 text-xs mb-6 leading-relaxed">
                    Modern streetwear and apparel collections designed for everyday expression.
                  </p>
                </div>
                <span className="inline-flex items-center justify-center w-full bg-neutral-900 text-neutral-400 font-semibold px-3 py-2.5 rounded-xl text-xs border border-neutral-800">
                  Coming Soon
                </span>
              </div>

              {/* Art4u Card */}
              <div id="art4u" className="bg-neutral-950 p-5 rounded-2xl border border-neutral-800 hover:border-neutral-500 transition-all flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-white font-bold text-base mb-4">
                    A4
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">Art4u</h3>
                  <p className="text-neutral-400 text-xs mb-6 leading-relaxed">
                    Visual art gallery featuring physical paintings and digital fine-art commissions.
                  </p>
                </div>
                <span className="inline-flex items-center justify-center w-full bg-neutral-900 text-neutral-400 font-semibold px-3 py-2.5 rounded-xl text-xs border border-neutral-800">
                  Coming Soon
                </span>
              </div>

            </section>
          </div>

          <footer className="text-xs text-neutral-500 pt-4 border-t border-neutral-900 flex justify-between items-center">
            <span>© {new Date().getFullYear()} Rutta.com. All rights reserved.</span>
            <span>Built with Next.js & Tailwind CSS</span>
          </footer>
        </div>

        {/* RIGHT SIDE: Live Forex & Market Watchlist (4 Columns, Vertically Stacked) */}
        <div id="watchlist" className="lg:col-span-4 h-full overflow-y-auto p-6 bg-neutral-950/40 flex flex-col gap-4">
          <div className="flex-none mb-1">
            <span className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold">Personal Tracking Hub</span>
            <h3 className="text-xl font-extrabold text-white">Live Market Watchlist</h3>
            <p className="text-neutral-400 text-xs mt-1">
              Monitoring core asset behaviors and volatility without risk.
            </p>
          </div>

          {/* Stacked Forex Cards Container */}
          <div className="flex flex-col gap-3.5 pb-6">
            
            {/* EUR/USD Card */}
            <div className="bg-neutral-950 p-5 rounded-2xl border border-neutral-800 hover:border-neutral-700 transition shadow-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-white text-base">EUR/USD</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-900 text-neutral-300 border border-neutral-800">Major Baseline</span>
              </div>
              <div className="text-2xl font-mono font-bold text-emerald-400 mb-1">
                {marketData.eurusd.price}
              </div>
              <div className="flex justify-between text-[11px] text-neutral-400 border-t border-neutral-900 pt-2.5 mt-2">
                <span>Behavior: Trend Steady</span>
                <span className="text-emerald-400 font-semibold">{marketData.eurusd.change}</span>
              </div>
            </div>

            {/* Gold XAU/USD Card */}
            <div className="bg-neutral-950 p-5 rounded-2xl border border-neutral-800 hover:border-neutral-700 transition shadow-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-white text-base">XAU/USD (Gold)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-900 text-neutral-300 border border-neutral-800">Safe-Haven</span>
              </div>
              <div className="text-2xl font-mono font-bold text-amber-400 mb-1">
                {marketData.xauusd.price}
              </div>
              <div className="flex justify-between text-[11px] text-neutral-400 border-t border-neutral-900 pt-2.5 mt-2">
                <span>Behavior: High Volatility</span>
                <span className="text-emerald-400 font-semibold">{marketData.xauusd.change}</span>
              </div>
            </div>

            {/* EUR/GBP Card */}
            <div className="bg-neutral-950 p-5 rounded-2xl border border-neutral-800 hover:border-neutral-700 transition shadow-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-white text-base">EUR/GBP</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-900 text-neutral-300 border border-neutral-800">Cross Pair</span>
              </div>
              <div className="text-2xl font-mono font-bold text-blue-400 mb-1">
                {marketData.eurgbp.price}
              </div>
              <div className="flex justify-between text-[11px] text-neutral-400 border-t border-neutral-900 pt-2.5 mt-2">
                <span>Behavior: Range Bound</span>
                <span className="text-rose-400 font-semibold">{marketData.eurgbp.change}</span>
              </div>
            </div>

          </div>
        </div>

      </div>
    </main>
  );
}
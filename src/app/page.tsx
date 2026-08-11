'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function Home() {
  const [marketData, setMarketData] = useState({
    eurusd: { price: "1.0845", change: "+0.12%" },
    xauusd: { price: "2342.10", change: "+0.45%" },
    eurgbp: { price: "0.8520", change: "-0.05%" },
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
    <main className="min-h-screen bg-black text-white font-sans selection:bg-white selection:text-black flex flex-col">
      {/* Top Navigation Bar */}
      <nav className="flex justify-between items-center px-6 py-4 border-b border-neutral-800 bg-black/90 backdrop-blur-md sticky top-0 z-50">
        <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white font-['Plus_Jakarta_Sans'] uppercase">
          RUTTA<span className="text-neutral-500 font-light">.COM</span>
        </h1>
        
        <div className="flex gap-6 text-xs font-semibold tracking-wide">
          <Link href="#haya" className="text-neutral-400 hover:text-white transition hidden sm:inline">Haya</Link>
          <Link href="#cloudmore" className="text-neutral-400 hover:text-white transition hidden sm:inline">Cloudmore</Link>
          <Link href="#art4u" className="text-neutral-400 hover:text-white transition hidden sm:inline">Art4u</Link>
          <Link href="#watchlist" className="text-white hover:text-neutral-300 transition">Market Watch</Link>
        </div>
      </nav>

      {/* Main Centered Wrapper */}
      <div className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 flex flex-col justify-between">
        
        {/* Top Central Hero Content */}
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-300 text-[11px] font-semibold tracking-wider uppercase mb-4">
            <span className="w-2 h-2 rounded-full bg-white"></span>
            Central Hub & Portfolio
          </div>
          
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight mb-3 text-white leading-tight">
            Engineering, Apparel & Visual Art
          </h2>
          
          <p className="text-neutral-400 text-sm sm:text-base max-w-2xl font-normal leading-relaxed mb-8">
            Welcome to my central portal. Showcasing specialized work across civil structural engineering, modern streetwear fashion, visual art galleries, and cloud development.
          </p>

          {/* Business Cards Grid (Haya, Cloudmore, Art4u) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            
            {/* Haya Structures LLC */}
            <div id="haya" className="bg-neutral-950 p-5 rounded-xl border border-neutral-800 hover:border-neutral-500 transition flex flex-col justify-between shadow-lg">
              <div>
                <div className="w-10 h-10 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-white font-bold text-sm mb-4">
                  HS
                </div>
                <h3 className="text-base font-bold text-white mb-1.5">Haya Structures</h3>
                <p className="text-neutral-400 text-xs mb-6 leading-relaxed">
                  Civil & Structural Engineering consulting & automated calculation tools.
                </p>
              </div>
              <Link href="/haya-structures" className="inline-flex items-center justify-center w-full bg-white hover:bg-neutral-200 text-black font-bold py-2.5 rounded-lg text-xs transition shadow">
                Visit Site →
              </Link>
            </div>

            {/* Cloudmore Collections */}
            <div id="cloudmore" className="bg-neutral-950 p-5 rounded-xl border border-neutral-800 hover:border-neutral-500 transition flex flex-col justify-between shadow-lg">
              <div>
                <div className="w-10 h-10 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-white font-bold text-sm mb-4">
                  CC
                </div>
                <h3 className="text-base font-bold text-white mb-1.5">Cloudmore</h3>
                <p className="text-neutral-400 text-xs mb-6 leading-relaxed">
                  Modern streetwear and apparel collections for everyday expression.
                </p>
              </div>
              <span className="inline-flex items-center justify-center w-full bg-neutral-900 text-neutral-400 font-semibold py-2.5 rounded-lg text-xs border border-neutral-800">
                Coming Soon
              </span>
            </div>

            {/* Art4u (Visual Art Section) */}
            <div id="art4u" className="bg-neutral-950 p-5 rounded-xl border border-neutral-800 hover:border-neutral-500 transition flex flex-col justify-between shadow-lg">
              <div>
                <div className="w-10 h-10 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-white font-bold text-sm mb-4">
                  A4
                </div>
                <h3 className="text-base font-bold text-white mb-1.5">Art4u</h3>
                <p className="text-neutral-400 text-xs mb-6 leading-relaxed">
                  Visual art gallery featuring physical paintings and fine-art commissions.
                </p>
              </div>
              <span className="inline-flex items-center justify-center w-full bg-neutral-900 text-neutral-400 font-semibold py-2.5 rounded-lg text-xs border border-neutral-800">
                Coming Soon
              </span>
            </div>

          </div>
        </div>

        {/* BOTTOM SECTION: Centered Content Left, Very Narrow Strip Right (Positioned below Visual Art) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pt-4 border-t border-neutral-900">
          
          {/* Left Area (Spans 8 columns for balance) */}
          <div className="lg:col-span-8">
            <h4 className="text-sm font-semibold text-neutral-300 mb-2">About the Live Watchlist</h4>
            <p className="text-xs text-neutral-500 leading-relaxed">
              Tracking behavior patterns on major pairs like EUR/USD, Gold (XAU/USD), and cross pairs without capital exposure. Monitoring trends helps build macro intuition over time.
            </p>
          </div>

          {/* Right Narrow Strip Ticker (Spans 4 columns, designed slim & compact) */}
          <div id="watchlist" className="lg:col-span-4 bg-neutral-950/60 p-4 rounded-xl border border-neutral-800/80">
            <div className="flex justify-between items-center mb-3">
              <div>
                <span className="text-[9px] uppercase tracking-widest text-neutral-500 font-bold">Live Feed</span>
                <h3 className="text-xs font-extrabold text-white">Forex Watchlist</h3>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>

            {/* Vertical Stack: Slim cards */}
            <div className="flex flex-col gap-2.5">
              
              {/* EUR/USD */}
              <div className="bg-black p-2.5 rounded-lg border border-neutral-800/60">
                <div className="flex justify-between items-center mb-0.5">
                  <span className="font-bold text-white text-[11px]">EUR/USD</span>
                  <span className="text-emerald-400 font-mono text-[10px] font-semibold">{marketData.eurusd.change}</span>
                </div>
                <div className="flex justify-between items-baseline font-mono">
                  <span className="text-sm font-bold text-neutral-200">{marketData.eurusd.price}</span>
                  <span className="text-[9px] text-neutral-500 uppercase">Baseline</span>
                </div>
              </div>

              {/* XAU/USD (Gold) */}
              <div className="bg-black p-2.5 rounded-lg border border-neutral-800/60">
                <div className="flex justify-between items-center mb-0.5">
                  <span className="font-bold text-white text-[11px]">XAU/USD (Gold)</span>
                  <span className="text-emerald-400 font-mono text-[10px] font-semibold">{marketData.xauusd.change}</span>
                </div>
                <div className="flex justify-between items-baseline font-mono">
                  <span className="text-sm font-bold text-amber-400">{marketData.xauusd.price}</span>
                  <span className="text-[9px] text-neutral-500 uppercase">Safe-Haven</span>
                </div>
              </div>

              {/* EUR/GBP */}
              <div className="bg-black p-2.5 rounded-lg border border-neutral-800/60">
                <div className="flex justify-between items-center mb-0.5">
                  <span className="font-bold text-white text-[11px]">EUR/GBP</span>
                  <span className="text-rose-400 font-mono text-[10px] font-semibold">{marketData.eurgbp.change}</span>
                </div>
                <div className="flex justify-between items-baseline font-mono">
                  <span className="text-sm font-bold text-blue-400">{marketData.eurgbp.price}</span>
                  <span className="text-[9px] text-neutral-500 uppercase">Cross Pair</span>
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* Footer */}
        <footer className="text-xs text-neutral-500 pt-6 mt-6 border-t border-neutral-900 flex justify-between">
          <span>© {new Date().getFullYear()} Rutta.com. All rights reserved.</span>
          <span>Next.js & Tailwind CSS</span>
        </footer>

      </div>
    </main>
  );
}
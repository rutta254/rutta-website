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
    <main className="h-screen w-screen bg-black text-white font-sans selection:bg-white selection:text-black overflow-hidden flex flex-col">
      {/* Top Navigation Bar */}
      <nav className="flex-none flex justify-between items-center px-6 py-2.5 border-b border-neutral-800 bg-black/90 backdrop-blur-md z-50">
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

      {/* Main Split Grid Layout - Locked to screen height */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        
        {/* LEFT COLUMN: Hero & Business Cards (7 Cols on Desktop) */}
        <div className="lg:col-span-7 h-full flex flex-col justify-between p-5 sm:p-6 lg:border-r border-neutral-800 overflow-y-auto">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-300 text-[10px] font-semibold tracking-wider uppercase mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
              Central Hub & Portfolio
            </div>
            
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight mb-2 text-white leading-tight">
              Engineering, Apparel & Visual Art
            </h2>
            
            <p className="text-neutral-400 text-xs sm:text-sm max-w-xl font-normal leading-relaxed mb-6">
              Welcome to my central portal. Showcasing specialized work across civil structural engineering, modern streetwear fashion, visual art galleries, and cloud development.
            </p>

            {/* Business Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              
              {/* Haya Structures LLC */}
              <div id="haya" className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 hover:border-neutral-500 transition flex flex-col justify-between">
                <div>
                  <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-white font-bold text-xs mb-3">
                    HS
                  </div>
                  <h3 className="text-sm font-bold text-white mb-1">Haya Structures</h3>
                  <p className="text-neutral-400 text-[11px] mb-4 leading-normal">
                    Civil & Structural Engineering consulting & automated calculation tools.
                  </p>
                </div>
                <Link href="/haya-structures" className="inline-flex items-center justify-center w-full bg-white hover:bg-neutral-200 text-black font-bold py-2 rounded-lg text-[11px] transition shadow">
                  Visit Site →
                </Link>
              </div>

              {/* Cloudmore Collections */}
              <div id="cloudmore" className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 hover:border-neutral-500 transition flex flex-col justify-between">
                <div>
                  <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-white font-bold text-xs mb-3">
                    CC
                  </div>
                  <h3 className="text-sm font-bold text-white mb-1">Cloudmore</h3>
                  <p className="text-neutral-400 text-[11px] mb-4 leading-normal">
                    Modern streetwear and apparel collections for everyday expression.
                  </p>
                </div>
                <span className="inline-flex items-center justify-center w-full bg-neutral-900 text-neutral-400 font-semibold py-2 rounded-lg text-[11px] border border-neutral-800">
                  Coming Soon
                </span>
              </div>

              {/* Art4u */}
              <div id="art4u" className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 hover:border-neutral-500 transition flex flex-col justify-between">
                <div>
                  <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-white font-bold text-xs mb-3">
                    A4
                  </div>
                  <h3 className="text-sm font-bold text-white mb-1">Art4u</h3>
                  <p className="text-neutral-400 text-[11px] mb-4 leading-normal">
                    Visual art gallery featuring physical paintings and fine-art commissions.
                  </p>
                </div>
                <span className="inline-flex items-center justify-center w-full bg-neutral-900 text-neutral-400 font-semibold py-2 rounded-lg text-[11px] border border-neutral-800">
                  Coming Soon
                </span>
              </div>

            </div>
          </div>

          <footer className="text-[10px] text-neutral-500 pt-3 border-t border-neutral-900 flex justify-between">
            <span>© {new Date().getFullYear()} Rutta.com</span>
            <span>Next.js & Tailwind</span>
          </footer>
        </div>

        {/* RIGHT COLUMN: Vertically Stacked Forex Watchlist (5 Cols on Desktop) */}
        <div id="watchlist" className="lg:col-span-5 h-full p-5 bg-neutral-950/50 flex flex-col justify-between overflow-hidden">
          <div>
            <div className="mb-3">
              <span className="text-[9px] uppercase tracking-widest text-neutral-500 font-bold">Tracking Hub</span>
              <h3 className="text-lg font-extrabold text-white">Live Market Watchlist</h3>
            </div>

            {/* Vertical Stack Container */}
            <div className="flex flex-col gap-2.5">
              
              {/* EUR/USD */}
              <div className="bg-neutral-950 p-3.5 rounded-xl border border-neutral-800 hover:border-neutral-700 transition">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-white text-xs">EUR/USD</span>
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-neutral-900 text-neutral-300 border border-neutral-800">Major Baseline</span>
                </div>
                <div className="text-xl font-mono font-bold text-emerald-400">
                  {marketData.eurusd.price}
                </div>
                <div className="flex justify-between text-[10px] text-neutral-400 border-t border-neutral-900 pt-1.5 mt-1.5">
                  <span>Trend Steady</span>
                  <span className="text-emerald-400 font-semibold">{marketData.eurusd.change}</span>
                </div>
              </div>

              {/* Gold XAU/USD */}
              <div className="bg-neutral-950 p-3.5 rounded-xl border border-neutral-800 hover:border-neutral-700 transition">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-white text-xs">XAU/USD (Gold)</span>
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-neutral-900 text-neutral-300 border border-neutral-800">Safe-Haven</span>
                </div>
                <div className="text-xl font-mono font-bold text-amber-400">
                  {marketData.xauusd.price}
                </div>
                <div className="flex justify-between text-[10px] text-neutral-400 border-t border-neutral-900 pt-1.5 mt-1.5">
                  <span>High Volatility</span>
                  <span className="text-emerald-400 font-semibold">{marketData.xauusd.change}</span>
                </div>
              </div>

              {/* EUR/GBP */}
              <div className="bg-neutral-950 p-3.5 rounded-xl border border-neutral-800 hover:border-neutral-700 transition">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-white text-xs">EUR/GBP</span>
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-neutral-900 text-neutral-300 border border-neutral-800">Cross Pair</span>
                </div>
                <div className="text-xl font-mono font-bold text-blue-400">
                  {marketData.eurgbp.price}
                </div>
                <div className="flex justify-between text-[10px] text-neutral-400 border-t border-neutral-900 pt-1.5 mt-1.5">
                  <span>Range Bound</span>
                  <span className="text-rose-400 font-semibold">{marketData.eurgbp.change}</span>
                </div>
              </div>

            </div>
          </div>

          <div className="text-[10px] text-neutral-500 text-center pt-2">
            Simulated live asset tracking feed
          </div>
        </div>

      </div>
    </main>
  );
}
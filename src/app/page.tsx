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
    <main className="h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 flex flex-col justify-between p-3 sm:p-4">
      {/* Top Navigation Bar */}
      <nav className="w-full flex items-center justify-between px-4 py-2 bg-slate-900/60 backdrop-blur-md rounded-xl border border-slate-800/80 shrink-0">
        <div className="font-extrabold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400 text-sm sm:text-base">
          RUTTA.COM
        </div>
        <div className="hidden md:flex items-center space-x-6 text-xs font-medium text-slate-300">
          <Link href="#haya" className="hover:text-cyan-400 transition-colors">Haya Structures</Link>
          <Link href="#cloudmore" className="hover:text-cyan-400 transition-colors">Cloudmore</Link>
          <Link href="#art4u" className="hover:text-cyan-400 transition-colors">Art4u</Link>
          <span className="text-slate-500">|</span>
          <span className="text-cyan-400 font-semibold">Market Watch</span>
        </div>
      </nav>

      {/* Main Content Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 my-auto overflow-hidden">
        
        {/* Left Side: Portfolio & Business Sections (8 Columns) */}
        <div className="lg:col-span-8 flex flex-col justify-between space-y-3 overflow-y-auto pr-1">
          
          {/* Hero Header */}
          <div className="bg-slate-900/40 border border-slate-800/80 p-4 rounded-xl backdrop-blur-sm">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white mb-1">
              Central Hub &amp; Portfolio
            </h1>
            <p className="text-xs font-medium text-cyan-400/90 whitespace-nowrap overflow-hidden text-ellipsis mb-1.5">
              Engineering, Apparel &amp; Visual Art
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Welcome to my central portal. Showcasing specialized work across civil structural engineering, modern streetwear fashion, visual art galleries, and cloud development.
            </p>
          </div>

          {/* Business Sections Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Haya Structures LLC Card */}
            <div id="haya" className="bg-slate-900/40 border border-slate-800/80 p-3.5 rounded-xl flex flex-col justify-between">
              <div>
                <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold text-xs mb-2">
                  HS
                </div>
                <h2 className="text-xs font-bold text-white mb-1">Haya Structures LLC</h2>
                <p className="text-[11px] text-slate-400 leading-snug">
                  Civil &amp; Structural Engineering consulting, verifications, and automated cloud calculation tools.
                </p>
              </div>
              <div className="mt-3">
                <a href="#" className="text-[11px] font-semibold text-cyan-400 hover:underline inline-flex items-center">
                  Visit Site →
                </a>
              </div>
            </div>

            {/* Cloudmore Collections Card */}
            <div id="cloudmore" className="bg-slate-900/40 border border-slate-800/80 p-3.5 rounded-xl flex flex-col justify-between">
              <div>
                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-xs mb-2">
                  CC
                </div>
                <h2 className="text-xs font-bold text-white mb-1">Cloudmore Collections</h2>
                <p className="text-[11px] text-slate-400 leading-snug">
                  Modern streetwear and apparel collections designed for everyday expression and distinct style.
                </p>
              </div>
              <div className="mt-3">
                <span className="text-[10px] font-medium text-indigo-300/80 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                  Catalog Coming Soon
                </span>
              </div>
            </div>

            {/* Art4u Card */}
            <div id="art4u" className="bg-slate-900/40 border border-slate-800/80 p-3.5 rounded-xl flex flex-col justify-between">
              <div>
                <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 font-bold text-xs mb-2">
                  A4
                </div>
                <h2 className="text-xs font-bold text-white mb-1">Art4u</h2>
                <p className="text-[11px] text-slate-400 leading-snug">
                  Visual art gallery featuring physical paintings, digital illustrations, and custom fine-art commissions.
                </p>
              </div>
              <div className="mt-3">
                <span className="text-[10px] font-medium text-purple-300/80 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                  Gallery Coming Soon
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Slim Live Forex Ticker Panel (4 Columns) */}
        <div className="lg:col-span-4 flex flex-col space-y-2.5 justify-center">
          <div className="text-[11px] font-semibold text-slate-400 tracking-wider uppercase px-1">
            Live Market Ticker
          </div>

          {/* EUR/USD Card */}
          <div className="bg-slate-900/50 border border-slate-800/80 p-3 rounded-xl backdrop-blur-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-white">EUR/USD</span>
              <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                {marketData.eurusd.change}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-extrabold text-cyan-300">{marketData.eurusd.price}</span>
              <span className="text-[10px] text-slate-400">{marketData.eurusd.status}</span>
            </div>
          </div>

          {/* Gold XAU/USD Card */}
          <div className="bg-slate-900/50 border border-slate-800/80 p-3 rounded-xl backdrop-blur-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-white">XAU/USD (Gold)</span>
              <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                {marketData.xauusd.change}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-extrabold text-cyan-300">{marketData.xauusd.price}</span>
              <span className="text-[10px] text-slate-400">{marketData.xauusd.status}</span>
            </div>
          </div>

          {/* EUR/GBP Card */}
          <div className="bg-slate-900/50 border border-slate-800/80 p-3 rounded-xl backdrop-blur-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-white">EUR/GBP</span>
              <span className="text-[10px] font-medium text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
                {marketData.eurgbp.change}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-extrabold text-cyan-300">{marketData.eurgbp.price}</span>
              <span className="text-[10px] text-slate-400">{marketData.eurgbp.status}</span>
            </div>
          </div>
        </div>

      </div>

      {/* Footer minimal info */}
      <footer className="w-full text-center text-[10px] text-slate-500 pt-1 shrink-0">
        © {new Date().getFullYear()} RUTTA.COM — All rights reserved.
      </footer>
    </main>
  );
}
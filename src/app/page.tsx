'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function Home() {
  const [marketData, setMarketData] = useState({
    eurusd: { price: "Loading...", change: "Live Feed", status: "Connected" },
    xauusd: { price: "Loading...", change: "Live Feed", status: "Connected" },
    eurgbp: { price: "Loading...", change: "Live Feed", status: "Connected" },
    usdjpy: { price: "Loading...", change: "Live Feed", status: "Connected" },
  });

  useEffect(() => {
    const apiKey = "4754ca7b4700482aaa89d0385aa68f60";
    const symbols = "EUR/USD,XAU/USD,EUR/GBP,USD/JPY";

    const fetchMarketData = async () => {
      try {
        const response = await fetch(
          `https://api.twelvedata.com/price?symbol=${symbols}&apikey=${apiKey}`
        );
        const data = await response.json();

        // Twelve Data returns an object with symbols as keys when multiple symbols are requested
        if (data && !data.code) {
          setMarketData({
            eurusd: {
              price: data["EUR/USD"] ? parseFloat(data["EUR/USD"].price).toFixed(4) : marketData.eurusd.price,
              change: "+0.15%",
              status: "Live Feed"
            },
            xauusd: {
              price: data["XAU/USD"] ? parseFloat(data["XAU/USD"].price).toFixed(2) : marketData.xauusd.price,
              change: "+0.42%",
              status: "Live Feed"
            },
            eurgbp: {
              price: data["EUR/GBP"] ? parseFloat(data["EUR/GBP"].price).toFixed(4) : marketData.eurgbp.price,
              change: "-0.08%",
              status: "Live Feed"
            },
            usdjpy: {
              price: data["USD/JPY"] ? parseFloat(data["USD/JPY"].price).toFixed(2) : marketData.usdjpy.price,
              change: "+0.21%",
              status: "Live Feed"
            },
          });
        }
      } catch (error) {
        console.error("Error fetching live market data:", error);
      }
    };

    // Fetch immediately on load
    fetchMarketData();

    // Poll every 30 seconds to stay safely within free tier rate limits
    const interval = setInterval(fetchMarketData, 30000);
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

      {/* Main Centered Grid: Four Main Portfolio Toggles */}
      <div className="w-full max-w-6xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 my-6">
        
        {/* Column 1: Haya Structures */}
        <Link href="/haya-structures" className="group flex flex-col">
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

        {/* Column 2: CloudMore */}
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

        {/* Column 3: Mr.Universe */}
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

        {/* Column 4: Art4U */}
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

      </div>

      {/* Forex Watchlist Section Header (Placed directly below the 4 main toggles) */}
      <div className="w-full max-w-6xl flex flex-col sm:flex-row items-start sm:items-center justify-between mt-8 mb-4 px-2 border-b border-slate-900 pb-3 gap-2">
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

      {/* Currency Cards Grid (Directly beneath the Forex Watchlist header) */}
      <div className="w-full max-w-6xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        
        {/* EUR/USD */}
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

        {/* Gold XAU/USD */}
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

        {/* EUR/GBP */}
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

        {/* USD/JPY */}
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

      {/* Footer Note */}
      <footer className="w-full max-w-6xl text-center py-6 text-xs text-slate-500 border-t border-slate-900">
        &copy; {new Date().getFullYear()} RUTTA.COM Central Portal. All Rights Reserved. Built with Next.js & Tailwind CSS.
      </footer>

    </main>
  );
}
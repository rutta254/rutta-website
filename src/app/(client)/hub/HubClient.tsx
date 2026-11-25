'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { signOut } from 'next-auth/react';

type UserProfile = {
  id: string;
  name: string | null;
  username: string | null;
  image: string | null;
  role: string;
  clientNumber: number | null;
  profileComplete: boolean;
} | null;

function SessionTimer() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const key = 'rg_session_start';
    let start = localStorage.getItem(key);
    if (!start) {
      start = Date.now().toString();
      localStorage.setItem(key, start);
    }
    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - parseInt(start!)) / 1000);
      setSeconds(elapsed);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="flex items-center gap-2">
      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
      <span className="text-xs font-mono font-semibold text-emerald-400 tracking-widest">
        Session {h > 0 ? `${pad(h)}:` : ''}{pad(m)}:{pad(s)}
      </span>
    </div>
  );
}

export default function HubClient({ userProfile }: { userProfile: UserProfile }) {
  const [marketData, setMarketData] = useState({
    eurusd: { price: "Loading...", change: "+0.15%", status: "Live Feed" },
    xauusd: { price: "Loading...", change: "+0.42%", status: "Live Feed" },
    eurgbp: { price: "Loading...", change: "-0.08%", status: "Live Feed" },
    usdjpy: { price: "Loading...", change: "+0.21%", status: "Live Feed" },
  });

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_TWELVE_DATA_API_KEY || "4754ca7b4700482aaa89d0385aa68f60";
    const symbols = "EUR/USD,XAU/USD,EUR/GBP,USD/JPY";

    const fetchMarketData = async () => {
      try {
        const response = await fetch(
          `https://api.twelvedata.com/price?symbol=${symbols}&apikey=${apiKey}`
        );
        const data = await response.json();
        if (data && !data.code) {
          setMarketData({
            eurusd: { price: data["EUR/USD"] ? parseFloat(data["EUR/USD"].price).toFixed(4) : marketData.eurusd.price, change: "+0.15%", status: "Live Feed" },
            xauusd: { price: data["XAU/USD"] ? parseFloat(data["XAU/USD"].price).toFixed(2) : marketData.xauusd.price, change: "+0.42%", status: "Live Feed" },
            eurgbp: { price: data["EUR/GBP"] ? parseFloat(data["EUR/GBP"].price).toFixed(4) : marketData.eurgbp.price, change: "-0.08%", status: "Live Feed" },
            usdjpy: { price: data["USD/JPY"] ? parseFloat(data["USD/JPY"].price).toFixed(2) : marketData.usdjpy.price, change: "+0.21%", status: "Live Feed" },
          });
        }
      } catch (error) {
        console.error("Market data error:", error);
      }
    };

    fetchMarketData();
    const interval = setInterval(fetchMarketData, 30000);
    return () => clearInterval(interval);
  }, []);

  const clientId = userProfile?.clientNumber
    ? `RG-${String(userProfile.clientNumber).padStart(3, '0')}`
    : null;

  const displayUsername = userProfile?.username
    ? `@${userProfile.username}`
    : userProfile?.name
    ? `@${userProfile.name.toLowerCase().replace(/\s+/g, '_')}`
    : null;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center justify-between p-6 sm:p-12 overflow-x-hidden">

      {/* Top Navbar */}
      <nav className="w-full max-w-6xl flex items-center justify-between py-2 border-b border-slate-900 mb-4">
        <div className="flex items-center space-x-2">
          <Link href="/" className="text-xs font-semibold text-slate-400 hover:text-white mr-4">
            &larr; Back to Gateway
          </Link>
          <span className="text-2xl sm:text-3xl font-black tracking-tight bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent drop-shadow-sm">
            RUTTA.COM
          </span>
        </div>

        {userProfile ? (
          <div className="flex flex-col items-center gap-1">
            {/* Profile Picture */}
            <div className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-cyan-500/60 shadow-lg shadow-cyan-500/20">
              {userProfile.image ? (
                <Image
                  src={userProfile.image}
                  alt={userProfile.name ?? 'User'}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full bg-cyan-600 flex items-center justify-center text-white font-bold text-xl">
                  {userProfile.name?.[0]?.toUpperCase() ?? 'U'}
                </div>
              )}
            </div>
            {/* Username */}
            <div className="text-sm font-bold text-slate-200 tracking-wide">
              {displayUsername}
            </div>
            {/* Client ID — same size as username, blue */}
            {clientId && (
              <div className="text-sm font-bold text-blue-400 tracking-wide">
                {clientId}
              </div>
            )}
          </div>
        ) : (
          <Link
            href="/login"
            className="text-xs font-semibold uppercase tracking-widest px-3 py-1 bg-blue-500/10 text-blue-400 rounded-full border border-blue-500/20 hover:bg-blue-500/20 transition"
          >
            Sign In
          </Link>
        )}
      </nav>

      {/* Hero */}
      <div className="w-full max-w-6xl text-center space-y-4 my-4">
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white">
          Engineering, Apparel & Visual Art
        </h1>
        <p className="max-w-2xl mx-auto text-slate-400 text-sm sm:text-base leading-relaxed">
          Welcome to the central portal, showcasing specialized work across civil & structural engineering,
          cloud development, modern fashion, and visual art galleries.
        </p>
      </div>

      {/* Business Cards */}
      <div className="w-full max-w-6xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 my-6">
        <Link href="/haya-structures" className="group flex flex-col">
          <div className="h-full bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl transition-all duration-300 group-hover:border-blue-500/50 group-hover:bg-slate-900 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold mb-4">HS</div>
              <h2 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">Haya Structures LLC</h2>
              <p className="text-slate-400 text-xs sm:text-sm mt-2 leading-relaxed">Civil & Structural Engineering: Analysis, Design, Consultancy and Projects.</p>
            </div>
            <div className="mt-6 flex items-center text-blue-400 text-xs font-semibold">Launch Suite &rarr;</div>
          </div>
        </Link>

        <div className="h-full bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-400 font-bold mb-4">CM</div>
            <h2 className="text-xl font-bold text-white">CloudMore</h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-2 leading-relaxed">Apparels, Accessories and Lifestyle.</p>
          </div>
          <div className="mt-6 text-xs text-purple-400 font-semibold uppercase tracking-wider">Gallery Portfolio</div>
        </div>

        <div className="h-full bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-amber-600/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold mb-4">Mr.U</div>
            <h2 className="text-xl font-bold text-white">Mr.Universe</h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-2 leading-relaxed">Cloud Infrastructure Pipelines, Automated CI/CD Workflows, and Deployments.</p>
          </div>
          <div className="mt-6 text-xs text-amber-400 font-semibold uppercase tracking-wider">Active Environment</div>
        </div>

        <div className="h-full bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold mb-4">@4u</div>
            <h2 className="text-xl font-bold text-white">Art4U</h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-2 leading-relaxed">Creative Design Portfolios, Modern Digital Galleries, and Storytelling.</p>
          </div>
          <div className="mt-6 text-xs text-emerald-400 font-semibold uppercase tracking-wider">Creative Portfolio</div>
        </div>
      </div>

      {/* Forex Watchlist */}
      <div className="w-full max-w-6xl flex flex-col sm:flex-row items-start sm:items-center justify-between mt-8 mb-4 px-2 border-b border-slate-900 pb-3 gap-2">
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">Forex Watchlist</h2>
        </div>
        <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
          Live Feed Active
        </span>
      </div>

      <div className="w-full max-w-6xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "EUR/USD", data: marketData.eurusd, color: "emerald" },
          { label: "Gold XAU/USD", data: marketData.xauusd, color: "emerald" },
          { label: "EUR/GBP", data: marketData.eurgbp, color: "rose" },
          { label: "USD/JPY", data: marketData.usdjpy, color: "emerald" },
        ].map(({ label, data, color }) => (
          <div key={label} className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between shadow-lg">
            <div>
              <span className="text-[11px] font-bold text-slate-400 block tracking-wide">{label}</span>
              <span className="text-base font-mono font-bold text-white">{data.price}</span>
            </div>
            <div className="text-right">
              <span className={`text-[11px] font-semibold text-${color}-400 bg-${color}-500/10 px-1.5 py-0.5 rounded border border-${color}-500/20`}>
                {data.change}
              </span>
              <span className="block text-[9px] text-slate-500 mt-0.5">{data.status}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Session Timer + Account Actions — visible at bottom */}
      {userProfile && (
        <div className="w-full max-w-6xl border-t border-slate-800 pt-6 pb-2 flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Session Timer */}
          <SessionTimer />

          {/* Settings and Sign Out */}
          <div className="flex items-center gap-3">
            <Link
              href="/settings"
              className="px-5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-cyan-500/50 rounded-xl text-sm font-semibold text-slate-200 hover:text-cyan-400 transition flex items-center gap-2"
            >
              ⚙ Settings
            </Link>
            <button
              onClick={() => {
                localStorage.removeItem('rg_session_start');
                signOut({ callbackUrl: '/' });
              }}
              className="px-5 py-2 bg-red-950/30 hover:bg-red-900/40 border border-red-900/50 hover:border-red-500/50 rounded-xl text-sm font-semibold text-red-400 hover:text-red-300 transition flex items-center gap-2"
            >
              ⏻ Sign Out
            </button>
          </div>
        </div>
      )}

      <footer className="w-full max-w-6xl text-center py-6 text-xs text-slate-500 border-t border-slate-900 mt-4">
        &copy; {new Date().getFullYear()} RUTTA.COM Central Portal. All Rights Reserved. Built with Next.js & Tailwind CSS.
      </footer>
    </main>
  );
}
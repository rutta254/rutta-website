'client'
import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function Home() {
  // Real-time tracking mockup states for your target watchlist
  const [marketData, setMarketData] = useState({
    eurusd: { price: "1.0845", change: "+0.12%", status: "Bullish Trend" },
    xauusd: { price: "2342.10", change: "+0.45%", status: "Safe-Haven Active" },
    eurgbp: { price: "0.8520", change: "-0.05%", status: "Range Bound" },
  });

  // Simulated live tick update for demonstration
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
    <main className="min-h-screen bg-black text-white font-sans selection:bg-white selection:text-black overflow-x-hidden">
      {/* Top Navigation Bar */}
      <nav className="flex flex-col sm:flex-row justify-between items-center px-6 sm:px-8 py-5 border-b border-neutral-800 sticky top-0 bg-black/90 backdrop-blur-md z-50 gap-4">
        {/* Larger, rounded typography for RUTTA.COM */}
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white font-['Plus_Jakarta_Sans'] uppercase">
          RUTTA<span className="text-neutral-500 font-light">.COM</span>
        </h1>
        
        <div className="flex flex-wrap justify-center gap-4 sm:space-x-8 text-xs sm:text-sm font-semibold tracking-wide">
          <Link href="#haya" className="text-neutral-400 hover:text-white transition">Haya Structures</Link>
          <Link href="#cloudmore" className="text-neutral-400 hover:text-white transition">Cloudmore</Link>
          <Link href="#art4u" className="text-neutral-400 hover:text-white transition">Art4u</Link>
          <Link href="#watchlist" className="text-white hover:text-neutral-300 transition">Market Watch</Link>
        </div>
      </nav>

      {/* Hero Header */}
      <section className="text-center py-16 sm:py-28 px-4 max-w-6xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-300 text-xs font-semibold tracking-wider uppercase mb-8">
          <span className="w-2 h-2 rounded-full bg-white"></span>
          Central Hub & Portfolio
        </div>
        
        <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-6 text-white leading-tight">
          Engineering, Apparel & Visual Art
        </h2>
        
        <p className="text-neutral-400 text-base sm:text-lg mb-12 max-w-2xl mx-auto font-normal leading-relaxed px-2">
          Welcome to my central portal. Showcasing specialized work across civil structural engineering, modern streetwear fashion, visual art galleries, and cloud development.
        </p>
      </section>

      {/* Business Sections Grid */}
      <section className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 px-6 pb-20">
        
        {/* Haya Structures LLC Card */}
        <div id="haya" className="bg-neutral-950 p-6 sm:p-8 rounded-3xl border border-neutral-800 hover:border-neutral-500 transition-all shadow-2xl flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-white font-bold text-lg mb-6">
              HS
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">Haya Structures LLC</h3>
            <p className="text-neutral-400 text-sm mb-8 leading-relaxed">
              Civil & Structural Engineering consulting, structural verifications, and automated cloud calculation tools.
            </p>
          </div>
          <Link href="/haya-structures" className="inline-flex items-center justify-center w-full bg-white hover:bg-neutral-200 text-black font-bold px-4 py-3 rounded-xl text-sm transition shadow-md">
            Visit Site →
          </Link>
        </div>

        {/* Cloudmore Collections Card */}
        <div id="cloudmore" className="bg-neutral-950 p-6 sm:p-8 rounded-3xl border border-neutral-800 hover:border-neutral-500 transition-all shadow-2xl flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-white font-bold text-lg mb-6">
              CC
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">Cloudmore Collections</h3>
            <p className="text-neutral-400 text-sm mb-8 leading-relaxed">
              Modern streetwear and apparel collections designed for everyday expression and distinct style.
            </p>
          </div>
          <span className="inline-flex items-center justify-center w-full bg-neutral-900 text-neutral-400 font-semibold px-4 py-3 rounded-xl text-sm border border-neutral-800">
            Catalog Coming Soon
          </span>
        </div>

        {/* Art4u Card */}
        <div id="art4u" className="bg-neutral-950 p-6 sm:p-8 rounded-3xl border border-neutral-800 hover:border-neutral-500 transition-all shadow-2xl flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-white font-bold text-lg mb-6">
              A4
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">Art4u</h3>
            <p className="text-neutral-400 text-sm mb-8 leading-relaxed">
              Visual art gallery featuring physical paintings, digital illustrations, and custom fine-art commissions.
            </p>
          </div>
          <span className="inline-flex items-center justify-center w-full bg-neutral-900 text-neutral-400 font-semibold px-4 py-3 rounded-xl text-sm border border-neutral-800">
            Gallery Coming Soon
          </span>
        </div>

      </section>

      {/* Live Forex & Market Watchlist Section */}
      <section id="watchlist" className="max-w-6xl mx-auto px-6 pb-28">
        <div className="border-t border-neutral-800 pt-16">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-4">
            <div>
              <span className="text-xs uppercase tracking-widest text-neutral-500 font-bold">Personal Tracking Hub</span>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">Live Market Watchlist</h3>
            </div>
            <p className="text-neutral-400 text-sm max-w-md">
              Monitoring core asset behaviors, macroeconomic trends, and volatility across major baseline instruments without financial risk.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* EUR/USD Card */}
            <div className="bg-neutral-950 p-6 rounded-3xl border border-neutral-800 hover:border-neutral-700 transition">
              <div className="flex justify-between items-center mb-4">
                <span className="font-bold text-white text-lg">EUR/USD</span>
                <span className="text-xs px-2.5 py-1 rounded-full bg-neutral-900 text-neutral-300 border border-neutral-800">Major Baseline</span>
              </div>
              <div className="text-3xl font-mono font-bold text-emerald-400 mb-2">
                {marketData.eurusd.price}
              </div>
              <div className="flex justify-between text-xs text-neutral-400 border-t border-neutral-900 pt-3 mt-4">
                <span>Behavior: Trend Steady</span>
                <span className="text-emerald-400 font-semibold">{marketData.eurusd.change}</span>
              </div>
            </div>

            {/* Gold XAU/USD Card */}
import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* Top Navigation Bar */}
      <nav className="flex justify-between items-center px-8 py-6 border-b border-slate-800/80 sticky top-0 bg-slate-950/80 backdrop-blur-md z-50">
        <h1 className="text-2xl font-extrabold tracking-tight text-white font-['Plus_Jakarta_Sans']">
          rutta<span className="text-cyan-400">.com</span>
        </h1>
        <div className="space-x-8 text-sm font-semibold">
          <Link href="#haya" className="hover:text-cyan-400 transition">Haya Structures</Link>
          <Link href="#cloudmore" className="hover:text-pink-400 transition">Cloudmore</Link>
          <Link href="#art4u" className="hover:text-amber-400 transition">Art4u</Link>
        </div>
      </nav>

      {/* Hero Header */}
      <section className="text-center py-24 px-4 max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold mb-6">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
          Central Hub & Portfolio
        </div>
        
        <h2 className="text-4xl lg:text-6xl font-extrabold tracking-tight mb-6 bg-gradient-to-r from-cyan-400 via-pink-400 to-amber-400 bg-clip-text text-transparent">
          Engineering, Apparel & Visual Art
        </h2>
        
        <p className="text-slate-400 text-lg mb-10 max-w-2xl mx-auto font-normal leading-relaxed">
          Welcome to my central portal. Showcasing specialized work across civil structural engineering, modern streetwear fashion, visual art galleries, and cloud development.
        </p>
      </section>

      {/* Business Sections Grid */}
      <section className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8 px-6 pb-24">
        
        {/* Haya Structures LLC Card */}
        <div id="haya" className="bg-slate-900/60 p-8 rounded-3xl border border-cyan-500/30 hover:border-cyan-400 transition-all shadow-xl shadow-cyan-950/20 flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold text-lg mb-6">
              HS
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">Haya Structures LLC</h3>
            <p className="text-slate-400 text-sm mb-8 leading-relaxed">
              Civil & Structural Engineering consulting, structural verifications, and automated cloud calculation tools.
            </p>
          </div>
          <Link href="/haya-structures" className="inline-flex items-center justify-center w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-4 py-3 rounded-xl text-sm shadow-lg shadow-cyan-500/10 transition">
            Beam Calculator →
          </Link>
        </div>

        {/* Cloudmore Collections Card */}
        <div id="cloudmore" className="bg-slate-900/60 p-8 rounded-3xl border border-pink-500/30 hover:border-pink-400 transition-all shadow-xl shadow-pink-950/20 flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 font-bold text-lg mb-6">
              CC
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">Cloudmore Collections</h3>
            <p className="text-slate-400 text-sm mb-8 leading-relaxed">
              Modern streetwear and apparel collections designed for everyday expression and distinct style.
            </p>
          </div>
          <span className="inline-flex items-center justify-center w-full bg-slate-800/80 text-slate-400 font-semibold px-4 py-3 rounded-xl text-sm border border-slate-700/50">
            Catalog Coming Soon
          </span>
        </div>

        {/* Art4u Card */}
        <div id="art4u" className="bg-slate-900/60 p-8 rounded-3xl border border-amber-500/30 hover:border-amber-400 transition-all shadow-xl shadow-amber-950/20 flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-lg mb-6">
              A4
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">Art4u</h3>
            <p className="text-slate-400 text-sm mb-8 leading-relaxed">
              Visual art gallery featuring physical paintings, digital illustrations, and custom fine-art commissions.
            </p>
          </div>
          <span className="inline-flex items-center justify-center w-full bg-slate-800/80 text-slate-400 font-semibold px-4 py-3 rounded-xl text-sm border border-slate-700/50">
            Gallery Coming Soon
          </span>
        </div>

      </section>
    </main>
  );
}
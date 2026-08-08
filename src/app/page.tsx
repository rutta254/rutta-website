import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white font-sans selection:bg-white selection:text-black">
      {/* Top Navigation Bar */}
      <nav className="flex justify-between items-center px-8 py-6 border-b border-neutral-800 sticky top-0 bg-black/90 backdrop-blur-md z-50">
        {/* Larger, rounded typography for RUTTA.COM */}
        <h1 className="text-4xl font-black tracking-tight text-white font-['Plus_Jakarta_Sans'] uppercase">
          RUTTA<span className="text-neutral-500 font-light">.COM</span>
        </h1>
        
        <div className="space-x-8 text-sm font-semibold tracking-wide">
          <Link href="#haya" className="text-neutral-400 hover:text-white transition">Haya Structures</Link>
          <Link href="#cloudmore" className="text-neutral-400 hover:text-white transition">Cloudmore</Link>
          <Link href="#art4u" className="text-neutral-400 hover:text-white transition">Art4u</Link>
        </div>
      </nav>

      {/* Hero Header */}
      <section className="text-center py-28 px-4 max-w-6xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-300 text-xs font-semibold tracking-wider uppercase mb-8">
          <span className="w-2 h-2 rounded-full bg-white"></span>
          Central Hub & Portfolio
        </div>
        
        {/* Single-line responsive hero heading */}
        <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-6 text-white whitespace-nowrap">
          Engineering, Apparel & Visual Art
        </h2>
        
        <p className="text-neutral-400 text-lg mb-12 max-w-2xl mx-auto font-normal leading-relaxed">
          Welcome to my central portal. Showcasing specialized work across civil structural engineering, modern streetwear fashion, visual art galleries, and cloud development.
        </p>
      </section>

      {/* Business Sections Grid */}
      <section className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8 px-6 pb-28">
        
        {/* Haya Structures LLC Card */}
        <div id="haya" className="bg-neutral-950 p-8 rounded-3xl border border-neutral-800 hover:border-neutral-500 transition-all shadow-2xl flex flex-col justify-between">
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
        <div id="cloudmore" className="bg-neutral-950 p-8 rounded-3xl border border-neutral-800 hover:border-neutral-500 transition-all shadow-2xl flex flex-col justify-between">
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
        <div id="art4u" className="bg-neutral-950 p-8 rounded-3xl border border-neutral-800 hover:border-neutral-500 transition-all shadow-2xl flex flex-col justify-between">
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
    </main>
  );
}
import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-900 text-white font-sans">
      {/* Top Navigation Bar */}
      <nav className="flex justify-between items-center px-8 py-6 border-b border-slate-800">
        <h1 className="text-2xl font-bold tracking-wider text-cyan-400">RUTTA.COM</h1>
        <div className="space-x-6 text-sm font-medium">
          <Link href="#haya" className="hover:text-cyan-400 transition">Haya Structures</Link>
          <Link href="#cloudmore" className="hover:text-pink-400 transition">Cloudmore</Link>
          <Link href="#art4u" className="hover:text-amber-400 transition">Art4u</Link>
        </div>
      </nav>

      {/* Hero Header */}
      <section className="text-center py-20 px-4 max-w-4xl mx-auto">
        <h2 className="text-5xl font-extrabold mb-6 bg-gradient-to-r from-cyan-400 via-pink-500 to-amber-400 bg-clip-text text-transparent">
          Engineering, Apparel & Visual Art
        </h2>
        <p className="text-slate-400 text-lg mb-8">
          Welcome to my central portal. Here I showcase my work across civil structural engineering,
          fashion design, visual art, and cloud development.
        </p>
      </section>

      {/* Business Sections Grid */}
      <section className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8 px-6 pb-20">
        
        {/* Haya Structures LLC Card */}
        <div id="haya" className="bg-slate-800/50 p-8 rounded-2xl border border-cyan-500/30 hover:border-cyan-400 transition">
          <h3 className="text-2xl font-bold text-cyan-400 mb-2">Haya Structures LLC</h3>
          <p className="text-slate-400 text-sm mb-6">
            Civil & Structural Engineering consulting, structural verifications, and automated cloud calculation tools.
          </p>
          <Link href="/haya-structures" className="inline-block bg-cyan-500 hover:bg-cyan-600 text-slate-900 font-semibold px-4 py-2 rounded-lg text-sm transition">
            Beam Calculator →
          </Link>
        </div>

        {/* Cloudmore Collections Card */}
        <div id="cloudmore" className="bg-slate-800/50 p-8 rounded-2xl border border-pink-500/30 hover:border-pink-400 transition">
          <h3 className="text-2xl font-bold text-pink-400 mb-2">Cloudmore Collections</h3>
          <p className="text-slate-400 text-sm mb-6">
            Modern streetwear and apparel collections designed for everyday expression.
          </p>
          <span className="inline-block bg-slate-700 text-slate-400 font-semibold px-4 py-2 rounded-lg text-sm">
            Catalog Coming Soon
          </span>
        </div>

        {/* Art4u Card */}
        <div id="art4u" className="bg-slate-800/50 p-8 rounded-2xl border border-amber-500/30 hover:border-amber-400 transition">
          <h3 className="text-2xl font-bold text-amber-400 mb-2">Art4u</h3>
          <p className="text-slate-400 text-sm mb-6">
            Visual art gallery featuring physical paintings, digital illustrations, and custom commissions.
          </p>
          <span className="inline-block bg-slate-700 text-slate-400 font-semibold px-4 py-2 rounded-lg text-sm">
            Gallery Coming Soon
          </span>
        </div>

      </section>
    </main>
  );
}
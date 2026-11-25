import Link from 'next/link';
import { FaArrowLeft, FaInstagram, FaTiktok } from 'react-icons/fa6';
import { INSTAGRAM_URL, TIKTOK_URL } from '../cloudmore-collections/cloudmoreData';

export default function CloudMoreHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-900 bg-slate-950/85 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/hub"
          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-purple-400 transition"
        >
          <FaArrowLeft /> Back to Hub
        </Link>

        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-purple-600/15 border border-purple-500/30 flex items-center justify-center text-purple-400 font-black text-xs">
            CM
          </span>
          <span className="text-base sm:text-lg font-extrabold tracking-wide text-white">
            Cloud <span className="text-purple-400">More</span>
          </span>
        </div>

        <div className="flex items-center gap-4">
          <nav className="hidden md:flex items-center gap-5 text-xs font-semibold text-slate-400">
            <a href="#about" className="hover:text-white transition">About</a>
            <a href="#consignments" className="hover:text-white transition">What We Deal With:</a>
            <a href="#gallery" className="hover:text-white transition">Gallery</a>
            <a href="#socials" className="hover:text-white transition">Socials</a>
            <a href="#connect" className="hover:text-white transition">Reach Out</a>
          </nav>

          <div className="flex items-center gap-3 border-l border-slate-800 pl-4">
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="CloudMore on Instagram"
              className="text-slate-300 hover:text-pink-400 transition text-lg"
            >
              <FaInstagram />
            </a>
            <a
              href={TIKTOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="CloudMore on TikTok"
              className="text-slate-300 hover:text-cyan-400 transition text-lg"
            >
              <FaTiktok />
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
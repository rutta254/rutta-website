'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  FaInstagram,
  FaTiktok,
  FaArrowLeft,
  FaShirt,
  FaTags,
  FaImages,
  FaArrowUpRightFromSquare,
  FaCheck,
} from 'react-icons/fa6';

const INSTAGRAM_HANDLE = 'cloudmore.collections';
const TIKTOK_HANDLE = 'cloudmore.collections';

const PAGES_AND_OFFERINGS = [
  {
    id: 'about',
    badge: '01 • About',
    title: 'About CloudMore Collections',
    icon: FaShirt,
    accent: 'text-purple-400',
    badgeBg: 'bg-purple-500/10 border-purple-500/20 text-purple-300',
    description:
      'CloudMore Collections is the apparel, clothing, and consignment arm under Rutta.com. We curate everyday statement pieces, seasonal clothing drops, and authenticated consignment finds for people who care about both style and value.',
    highlights: [
      'Curated apparel & everyday clothing essentials',
      'Quality-checked consignment pieces & resales',
      'Direct community drops via Instagram & TikTok',
    ],
  },
  {
    id: 'consignments',
    badge: '02 • Consignments',
    title: 'What We Deal With: Consignments & Apparel',
    icon: FaTags,
    accent: 'text-fuchsia-400',
    badgeBg: 'bg-fuchsia-500/10 border-fuchsia-500/20 text-fuchsia-300',
    description:
      'Whether you are shopping for a fresh fit or looking to consign clean, stylish garments from your wardrobe, we keep the process straightforward and transparent.',
    highlights: [
      'Apparel & clothing pieces (tops, outerwear, sets & staples)',
      'Consignment intake & item review for select pieces',
      'Transparent pricing and fast DM reservations',
    ],
  },
  {
    id: 'lookbook',
    badge: '03 • Social Pages',
    title: 'Instagram & TikTok Showcases',
    icon: FaImages,
    accent: 'text-cyan-400',
    badgeBg: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-300',
    description:
      'Our newest inventory, restocks, and consignment arrivals go live on our social pages first. Use TikTok for motion, styling, and fit checks, and Instagram for lookbooks, availability posts, and DMs.',
    highlights: [
      'TikTok: Fit checks, styling clips, unboxings & behind-the-scenes',
      'Instagram: Catalog posts, story drops, sizing & DM inquiries',
      'Quick links back to the Rutta.com Hub anytime',
    ],
  },
];

export default function CloudMoreCollectionsPage() {
  const [inquiryType, setInquiryType] = useState<
    'Apparel & Clothing' | 'Consignment Inquiry' | 'Styling / Custom Request'
  >('Apparel & Clothing');
  const [itemNote, setItemNote] = useState('');
  const [copied, setCopied] = useState(false);

  const igUrl = `https://www.instagram.com/${INSTAGRAM_HANDLE}`;
  const tiktokUrl = `https://www.tiktok.com/@${TIKTOK_HANDLE}`;

  const composedMessage = `Hi @${INSTAGRAM_HANDLE}! I'm reaching out about: ${inquiryType}${
    itemNote.trim() ? ` — ${itemNote.trim()}` : ''
  }.`;

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(composedMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col justify-between overflow-x-hidden">
      {/* Top Bar */}
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
              CloudMore <span className="text-purple-400">Collections</span>
            </span>
          </div>

          {/* Quick Page Anchors + Social Icons */}
          <div className="flex items-center gap-4">
            <nav className="hidden md:flex items-center gap-5 text-xs font-semibold text-slate-400">
              <a href="#about" className="hover:text-white transition">About</a>
              <a href="#consignments" className="hover:text-white transition">Consignments</a>
              <a href="#socials" className="hover:text-white transition">Socials</a>
              <a href="#connect" className="hover:text-white transition">Reach Out</a>
            </nav>

            <div className="flex items-center gap-3 border-l border-slate-800 pl-4">
              <a
                href={igUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="CloudMore Collections on Instagram"
                className="text-slate-300 hover:text-pink-400 transition text-lg"
              >
                <FaInstagram />
              </a>
              <a
                href={tiktokUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="CloudMore Collections on TikTok"
                className="text-slate-300 hover:text-cyan-400 transition text-lg"
              >
                <FaTiktok />
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto w-full px-6 py-12 sm:py-16 space-y-16">
        {/* Hero */}
        <section className="relative rounded-3xl border border-slate-800/90 bg-gradient-to-br from-slate-900 via-slate-900/90 to-purple-950/30 p-8 sm:p-12 shadow-2xl">
          <div className="max-w-3xl space-y-5">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-widest bg-purple-500/10 border border-purple-500/25 text-purple-300">
              Apparel • Clothing • Consignments
            </div>

            <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-[1.08]">
              Modern Apparel &amp;{' '}
              <span className="bg-gradient-to-r from-purple-400 via-fuchsia-400 to-cyan-300 bg-clip-text text-transparent">
                Curated Consignments.
              </span>
            </h1>

            <p className="text-slate-300 text-base sm:text-lg leading-relaxed max-w-2xl">
              Explore CloudMore Collections—where fresh clothing drops, everyday essentials, and
              consignment pieces come together. Learn about who we are, what we deal with, and jump
              straight to our Instagram and TikTok pages.
            </p>

            <div className="flex flex-col sm:flex-row gap-3.5 pt-2">
              <a
                href={igUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold text-sm transition shadow-lg shadow-purple-500/20"
              >
                <FaInstagram className="text-base" />
                Instagram (@{INSTAGRAM_HANDLE})
                <FaArrowUpRightFromSquare className="text-xs" />
              </a>

              <a
                href={tiktokUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-slate-950/90 hover:bg-slate-800 text-white border border-slate-700 font-semibold text-sm transition"
              >
                <FaTiktok className="text-base text-cyan-400" />
                TikTok (@{TIKTOK_HANDLE})
                <FaArrowUpRightFromSquare className="text-xs text-slate-400" />
              </a>
            </div>
          </div>
        </section>

        {/* Pages & Sections Breakdown (About, Consignments, Socials) */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {PAGES_AND_OFFERINGS.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                id={item.id}
                className="scroll-mt-24 rounded-2xl bg-slate-900/80 border border-slate-800 p-6 sm:p-7 flex flex-col justify-between space-y-6 shadow-xl"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${item.badgeBg}`}>
                      {item.badge}
                    </span>
                    <div className={`w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center ${item.accent}`}>
                      <Icon className="text-base" />
                    </div>
                  </div>

                  <h2 className="text-xl font-bold text-white">{item.title}</h2>
                  <p className="text-sm text-slate-400 leading-relaxed">{item.description}</p>
                </div>

                <ul className="space-y-2.5 pt-4 border-t border-slate-800/80 text-xs sm:text-sm text-slate-300">
                  {item.highlights.map((point) => (
                    <li key={point} className="flex items-start gap-2.5">
                      <span className="mt-1 w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>

        {/* Dedicated Social Media Handles Cards */}
        <section id="socials" className="scroll-mt-24 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-slate-900 pb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-purple-400">
                Official Channels
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
                Our Social Media Pages
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-400">
              Updates, drops, and consignments are shared directly on both platforms.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Instagram Card */}
            <a
              href={igUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-2xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-pink-500/40 p-7 transition-all shadow-xl flex flex-col justify-between gap-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-pink-500/10 border border-pink-500/25 flex items-center justify-center text-pink-400 text-2xl">
                    <FaInstagram />
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-pink-400">
                      Instagram Page
                    </div>
                    <div className="text-xl font-bold text-white group-hover:text-pink-300 transition">
                      @{INSTAGRAM_HANDLE}
                    </div>
                  </div>
                </div>
                <FaArrowUpRightFromSquare className="text-slate-500 group-hover:text-pink-400 transition mt-1" />
              </div>

              <p className="text-sm text-slate-400 leading-relaxed">
                Browse featured clothing &amp; consignment posts, check piece availability, and send
                direct messages for orders or consignment submissions.
              </p>
            </a>

            {/* TikTok Card */}
            <a
              href={tiktokUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-2xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-cyan-500/40 p-7 transition-all shadow-xl flex flex-col justify-between gap-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-400 text-2xl">
                    <FaTiktok />
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                      TikTok Page
                    </div>
                    <div className="text-xl font-bold text-white group-hover:text-cyan-300 transition">
                      @{TIKTOK_HANDLE}
                    </div>
                  </div>
                </div>
                <FaArrowUpRightFromSquare className="text-slate-500 group-hover:text-cyan-400 transition mt-1" />
              </div>

              <p className="text-sm text-slate-400 leading-relaxed">
                Watch outfit previews, fabric &amp; fit spotlights, consignment highlights, and
                short-form drops as soon as new pieces land.
              </p>
            </a>
          </div>
        </section>

        {/* Quick Inquiry / DM Helper */}
        <section id="connect" className="scroll-mt-24 rounded-2xl bg-slate-900/70 border border-slate-800 p-6 sm:p-8 shadow-xl space-y-5">
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-bold text-white">
              Shop or Consign via Social DM
            </h2>
            <p className="text-sm text-slate-400">
              Pick what you&apos;re looking for, copy a ready-to-send message, and open Instagram or TikTok.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            {(['Apparel & Clothing', 'Consignment Inquiry', 'Styling / Custom Request'] as const).map(
              (type) => {
                const active = inquiryType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setInquiryType(type)}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold border transition ${
                      active
                        ? 'bg-purple-500/20 border-purple-400 text-purple-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {type}
                  </button>
                );
              }
            )}
          </div>

          <div className="space-y-3">
            <input
              type="text"
              value={itemNote}
              onChange={(e) => setItemNote(e.target.value)}
              placeholder="Optional: mention size, piece name, or consignment item..."
              className="w-full rounded-xl bg-slate-950 border border-slate-800 focus:border-purple-500/60 focus:outline-none px-4 py-3 text-sm text-white placeholder:text-slate-500"
            />

            <div className="rounded-xl bg-slate-950/90 border border-slate-800/90 p-3.5 text-xs sm:text-sm text-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="break-words">&ldquo;{composedMessage}&rdquo;</span>
              <button
                type="button"
                onClick={handleCopyMessage}
                className="shrink-0 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition"
              >
                {copied ? <FaCheck className="text-emerald-400" /> : null}
                {copied ? 'Copied' : 'Copy DM'}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-1">
            <a
              href={igUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-pink-500/15 hover:bg-pink-500/25 border border-pink-500/30 text-pink-300 text-xs sm:text-sm font-semibold transition"
            >
              <FaInstagram /> Open @{INSTAGRAM_HANDLE} on IG
            </a>
            <a
              href={tiktokUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-xs sm:text-sm font-semibold transition"
            >
              <FaTiktok /> Open @{TIKTOK_HANDLE} on TikTok
            </a>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-6 px-6 text-center text-xs text-slate-500">
        &copy; {new Date().getFullYear()} CloudMore Collections (@{INSTAGRAM_HANDLE}) &bull; Part of RUTTA.COM.
      </footer>
    </div>
  );
}
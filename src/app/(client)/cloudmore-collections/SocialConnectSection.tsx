'use client';

import { useState } from 'react';
import { FaArrowUpRightFromSquare, FaCheck, FaInstagram, FaTiktok } from 'react-icons/fa6';
import {
  INSTAGRAM_HANDLE,
  INSTAGRAM_URL,
  TIKTOK_HANDLE,
  TIKTOK_URL,
} from '../cloudmore-collections/cloudmoreData';

export type InquiryCategory =
  | 'Apparel & Clothing'
  | 'Consignment Inquiry'
  | 'Styling / Custom Request';

type Props = {
  inquiryType: InquiryCategory;
  setInquiryType: (value: InquiryCategory) => void;
  itemNote: string;
  setItemNote: (value: string) => void;
};

export default function SocialConnectSection({
  inquiryType,
  setInquiryType,
  itemNote,
  setItemNote,
}: Props) {
  const [copied, setCopied] = useState(false);

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
    <>
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
          <a
            href={INSTAGRAM_URL}
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

          <a
            href={TIKTOK_URL}
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
      <section
        id="connect"
        className="scroll-mt-24 rounded-2xl bg-slate-900/70 border border-slate-800 p-6 sm:p-8 shadow-xl space-y-5"
      >
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-bold text-white">
            Shop or Consign via Social DM
          </h2>
          <p className="text-sm text-slate-400">
            Pick what you&apos;re looking for, copy a ready-to-send message, and open Instagram or TikTok.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          {(
            ['Apparel & Clothing', 'Consignment Inquiry', 'Styling / Custom Request'] as const
          ).map((type) => {
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
          })}
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
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-pink-500/15 hover:bg-pink-500/25 border border-pink-500/30 text-pink-300 text-xs sm:text-sm font-semibold transition"
          >
            <FaInstagram /> Open @{INSTAGRAM_HANDLE} on IG
          </a>
          <a
            href={TIKTOK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-xs sm:text-sm font-semibold transition"
          >
            <FaTiktok /> Open @{TIKTOK_HANDLE} on TikTok
          </a>
        </div>
      </section>
    </>
  );
}
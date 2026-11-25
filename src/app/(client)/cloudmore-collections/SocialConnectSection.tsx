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
  variant?: 'all' | 'bar' | 'connect';
};

export default function SocialConnectSection({
  inquiryType,
  setInquiryType,
  itemNote,
  setItemNote,
  variant = 'all',
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

  const showBar = variant === 'all' || variant === 'bar';
  const showConnect = variant === 'all' || variant === 'connect';

  return (
    <>
      {showBar && (
        <section
          id="socials"
          aria-label="Social Media Handles"
          className="scroll-mt-24 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-900/75 border border-slate-800 px-3.5 py-2"
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Socials
          </span>

          <div className="flex items-center gap-2">
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 hover:bg-pink-500/15 border border-slate-800 hover:border-pink-500/40 px-2.5 py-1 text-xs font-medium text-slate-200 hover:text-pink-300 transition whitespace-nowrap"
            >
              <FaInstagram className="text-xs text-pink-400 shrink-0" />
              <span>@{INSTAGRAM_HANDLE}</span>
              <FaArrowUpRightFromSquare className="text-[10px] text-slate-500 shrink-0" />
            </a>

            <a
              href={TIKTOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 hover:bg-cyan-500/15 border border-slate-800 hover:border-cyan-500/40 px-2.5 py-1 text-xs font-medium text-slate-200 hover:text-cyan-300 transition whitespace-nowrap"
            >
              <FaTiktok className="text-xs text-cyan-400 shrink-0" />
              <span>@{TIKTOK_HANDLE}</span>
              <FaArrowUpRightFromSquare className="text-[10px] text-slate-500 shrink-0" />
            </a>
          </div>
        </section>
      )}

      {showConnect && (
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
      )}
    </>
  );
}
'use client';

import { useState } from 'react';
import {
  FaArrowUpRightFromSquare,
  FaImages,
  FaInstagram,
  FaTiktok,
  FaXmark,
} from 'react-icons/fa6';
import {
  GalleryItem,
  INSTAGRAM_HANDLE,
  INSTAGRAM_URL,
  TIKTOK_HANDLE,
  TIKTOK_URL,
} from '../cloudmore-collections/cloudmoreData';

type Props = {
  onSelectForInquiry: (item: GalleryItem) => void;
};

type SlideChoice = {
  id: string;
  platform: 'TikTok' | 'Instagram';
  handle: string;
  url: string;
  galleryOptionLabel: string;
  externalOptionLabel: string;
  inquiryItem: GalleryItem;
};

const SLIDES: SlideChoice[] = [
  {
    id: 'tiktok-slide',
    platform: 'TikTok',
    handle: TIKTOK_HANDLE,
    url: TIKTOK_URL,
    galleryOptionLabel: 'Visit Gallery',
    externalOptionLabel: 'Go to TikTok',
    inquiryItem: {
      id: 'tiktok-slide',
      title: 'TikTok',
      category: 'Apparel',
      platform: 'TikTok',
      tag: `@${TIKTOK_HANDLE}`,
      statusLabel: 'TikTok',
      caption: 'TikTok',
      postUrl: TIKTOK_URL,
    },
  },
  {
    id: 'instagram-slide',
    platform: 'Instagram',
    handle: INSTAGRAM_HANDLE,
    url: INSTAGRAM_URL,
    galleryOptionLabel: 'Visit Gallery',
    externalOptionLabel: 'Go to Instagram',
    inquiryItem: {
      id: 'instagram-slide',
      title: 'Instagram',
      category: 'Consignments',
      platform: 'Instagram',
      tag: `@${INSTAGRAM_HANDLE}`,
      statusLabel: 'Instagram',
      caption: 'Instagram',
      postUrl: INSTAGRAM_URL,
    },
  },
];

export default function ShowcaseGallery({ onSelectForInquiry }: Props) {
  const [activeSlide, setActiveSlide] = useState<SlideChoice | null>(null);

  const handleVisitGallery = (slide: SlideChoice) => {
    onSelectForInquiry(slide.inquiryItem);
    setActiveSlide(null);
    document.getElementById('gallery')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section id="gallery" className="scroll-mt-24 space-y-5">
      <div className="border-b border-slate-900 pb-3.5">
        <span className="text-xs font-bold uppercase tracking-widest text-purple-400 flex items-center gap-2">
          <FaImages /> Showcase
        </span>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
          Gallery
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          What is happening on CloudMore Collections
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {SLIDES.map((slide) => {
          const isInstagram = slide.platform === 'Instagram';
          const PlatformIcon = isInstagram ? FaInstagram : FaTiktok;
          const cornerColor = isInstagram ? 'text-pink-400' : 'text-cyan-400';
          const borderHover = isInstagram
            ? 'hover:border-pink-500/40'
            : 'hover:border-cyan-500/40';

          return (
            <button
              key={slide.id}
              type="button"
              onClick={() => setActiveSlide(slide)}
              className={`group w-full aspect-[16/9] rounded-2xl bg-slate-900/80 border border-slate-800 ${borderHover} p-4 flex flex-col justify-between text-left shadow-xl transition-all cursor-pointer`}
            >
              <div className="flex items-center justify-between w-full">
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${cornerColor}`}>
                  <PlatformIcon /> {slide.platform}
                </span>
                <span className="text-[11px] font-medium text-slate-400 group-hover:text-slate-200 transition">
                  @{slide.handle}
                </span>
              </div>

              <div className="flex items-end justify-between w-full">
                <span className={`text-sm font-bold ${cornerColor}`}>
                  {slide.platform}
                </span>
                <span className="text-xs text-slate-400 group-hover:text-white transition">
                  Select option &rarr;
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Choice Prompt Modal */}
      {activeSlide && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setActiveSlide(null)}
        >
          <div
            className="max-w-sm w-full rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-purple-400">
                  {activeSlide.platform}
                </div>
                <h3 className="text-lg font-bold text-white mt-1">
                  Where would you like to go?
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveSlide(null)}
                aria-label="Close options"
                className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-white transition"
              >
                <FaXmark />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => handleVisitGallery(activeSlide)}
                className="w-full px-4 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-slate-950 text-xs sm:text-sm font-bold transition text-center"
              >
                {activeSlide.galleryOptionLabel}
              </button>

              <a
                href={activeSlide.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setActiveSlide(null)}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-white text-xs sm:text-sm font-semibold transition"
              >
                {activeSlide.externalOptionLabel}{' '}
                <FaArrowUpRightFromSquare className="text-xs" />
              </a>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
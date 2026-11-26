'use client';

import { useEffect, useState } from 'react';
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

type SlideMediaConfig = {
  mediaType?: 'animation' | 'image' | 'video';
  videoUrl?: string;
  imageUrl?: string;
};

type SlidesApiResponse = {
  tiktok?: SlideMediaConfig;
  instagram?: SlideMediaConfig;
};

type SlideChoice = {
  id: 'tiktok-slide' | 'instagram-slide';
  keyName: 'tiktok' | 'instagram';
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
    keyName: 'tiktok',
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
    keyName: 'instagram',
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
  const [slidesConfig, setSlidesConfig] = useState<SlidesApiResponse>({});

  useEffect(() => {
    let active = true;
    fetch('/api/cloudmore/slides', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (!active || !data?.slides) return;
        setSlidesConfig(data.slides);
      })
      .catch(() => {
        // Fallback to animation demo when API is unreachable
      });

    return () => {
      active = false;
    };
  }, []);

  const handleVisitGallery = (slide: SlideChoice) => {
    onSelectForInquiry(slide.inquiryItem);
    setActiveSlide(null);
    document.getElementById('gallery')?.scrollIntoView({ behavior: 'smooth' });
  };

  const renderSlideMedia = (slide: SlideChoice) => {
    const isInstagram = slide.platform === 'Instagram';
    const custom = slidesConfig[slide.keyName];

    if (custom?.videoUrl) {
      return (
        <video
          src={custom.videoUrl}
          poster={custom.imageUrl || undefined}
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
      );
    }

    if (custom?.imageUrl) {
      return (
        <img
          src={custom.imageUrl}
          alt={slide.platform}
          className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      );
    }

    return (
      <div className="absolute inset-0 overflow-hidden bg-slate-950">
        <div
          className={`absolute -top-12 -left-12 h-44 w-44 rounded-full blur-2xl animate-pulse ${
            isInstagram ? 'bg-pink-500/25' : 'bg-cyan-400/25'
          }`}
        />
        <div
          className={`absolute -bottom-12 -right-12 h-48 w-48 rounded-full blur-2xl animate-bounce ${
            isInstagram ? 'bg-purple-500/20' : 'bg-fuchsia-500/20'
          }`}
          style={{ animationDuration: '4.5s' }}
        />
        <div className="relative z-10 flex h-full w-full flex-col items-center justify-center px-4 text-center">
          <div
            className={`h-16 w-12 rounded-xl border ${
              isInstagram
                ? 'border-pink-400/40 bg-pink-500/10'
                : 'border-cyan-400/40 bg-cyan-500/10'
            } animate-pulse flex items-center justify-center`}
          >
            <span className="text-[10px] font-semibold tracking-wider uppercase text-slate-200">
              9:16
            </span>
          </div>
          <span className="mt-2.5 text-[11px] text-slate-400">
            Motion preview ready for {slide.platform} upload
          </span>
        </div>
      </div>
    );
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 justify-items-center">
        {SLIDES.map((slide) => {
          const isInstagram = slide.platform === 'Instagram';
          const PlatformIcon = isInstagram ? FaInstagram : FaTiktok;
          const cornerColor = isInstagram ? 'text-pink-400' : 'text-cyan-400';
          const borderHover = isInstagram
            ? 'hover:border-pink-500/50'
            : 'hover:border-cyan-500/50';

          return (
            <button
              key={slide.id}
              type="button"
              onClick={() => setActiveSlide(slide)}
              className={`group relative w-full max-w-[260px] sm:max-w-[280px] aspect-[9/16] rounded-[2rem] bg-slate-900/85 border border-slate-800 ${borderHover} p-4 flex flex-col justify-between text-left shadow-2xl overflow-hidden transition-all cursor-pointer`}
            >
              {renderSlideMedia(slide)}

              <div className="relative z-20 flex items-center justify-between w-full">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full bg-slate-950/75 px-2.5 py-1 text-xs font-semibold backdrop-blur-sm ${cornerColor}`}
                >
                  <PlatformIcon /> {slide.platform}
                </span>
                <span className="rounded-full bg-slate-950/75 px-2 py-0.5 text-[11px] font-medium text-slate-300 backdrop-blur-sm truncate max-w-[125px]">
                  @{slide.handle}
                </span>
              </div>

              <div className="relative z-20 flex items-end justify-between w-full">
                <span
                  className={`rounded-full bg-slate-950/75 px-2.5 py-1 text-xs font-bold backdrop-blur-sm ${cornerColor}`}
                >
                  {slide.platform}
                </span>
                <span className="rounded-full bg-slate-950/75 px-2.5 py-1 text-[11px] text-slate-200 backdrop-blur-sm group-hover:text-white transition">
                  Select option &rarr;
                </span>
              </div>
            </button>
          );
        })}
      </div>

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
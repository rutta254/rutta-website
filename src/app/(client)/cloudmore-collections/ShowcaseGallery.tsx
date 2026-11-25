'use client';

import { useMemo, useState } from 'react';
import {
  FaArrowUpRightFromSquare,
  FaImages,
  FaInstagram,
  FaTiktok,
  FaXmark,
} from 'react-icons/fa6';
import {
  GALLERY_ITEMS,
  GalleryItem,
  INSTAGRAM_HANDLE,
  INSTAGRAM_URL,
  TIKTOK_HANDLE,
  TIKTOK_URL,
} from '../cloudmore-collections/cloudmoreData';

type Props = {
  onSelectForInquiry: (item: GalleryItem) => void;
};

export default function ShowcaseGallery({ onSelectForInquiry }: Props) {
  const [selectedItem, setSelectedItem] = useState<GalleryItem | null>(null);

  const twoSlides = useMemo(() => {
    const tiktokItem =
      GALLERY_ITEMS.find((item) => item.platform === 'TikTok') ?? {
        id: 'tiktok-slide',
        title: 'TikTok Drops & Fit Spotlights',
        category: 'Apparel' as const,
        platform: 'TikTok' as const,
        tag: '@cloudmore.collections',
        statusLabel: 'Live on TikTok',
        caption:
          'Watch outfit previews, fabric & fit spotlights, consignment highlights, and short-form drops.',
        postUrl: TIKTOK_URL,
      };

    const instagramItem =
      GALLERY_ITEMS.find((item) => item.platform === 'Instagram') ?? {
        id: 'instagram-slide',
        title: 'Instagram Featured Pieces & Consignments',
        category: 'Consignments' as const,
        platform: 'Instagram' as const,
        tag: '@cloudmore.collections',
        statusLabel: 'Live on Instagram',
        caption:
          'Browse featured clothing & consignment posts, check piece availability, and DM to shop or consign.',
        postUrl: INSTAGRAM_URL,
      };

    return [tiktokItem, instagramItem];
  }, []);

  const getExternalUrl = (item: GalleryItem) =>
    item.postUrl || (item.platform === 'Instagram' ? INSTAGRAM_URL : TIKTOK_URL);

  const getHandle = (item: GalleryItem) =>
    item.platform === 'Instagram' ? INSTAGRAM_HANDLE : TIKTOK_HANDLE;

  return (
    <section id="gallery" className="scroll-mt-24 space-y-5">
      <div className="border-b border-slate-900 pb-3.5">
        <span className="text-xs font-bold uppercase tracking-widest text-purple-400 flex items-center gap-2">
          <FaImages /> Social Showcase
        </span>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
          Gallery
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          What is happening on CloudMore Collections
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {twoSlides.map((item) => {
          const isInstagram = item.platform === 'Instagram';
          const PlatformIcon = isInstagram ? FaInstagram : FaTiktok;
          const platformColor = isInstagram ? 'text-pink-400' : 'text-cyan-400';
          const borderHover = isInstagram
            ? 'hover:border-pink-500/40'
            : 'hover:border-cyan-500/40';

          return (
            <div
              key={item.id}
              className={`group rounded-2xl bg-slate-900/80 border border-slate-800 ${borderHover} overflow-hidden shadow-xl flex flex-col justify-between transition-all`}
            >
              <div>
                <button
                  type="button"
                  onClick={() => setSelectedItem(item)}
                  className="w-full aspect-[16/9] bg-gradient-to-br from-slate-900 via-purple-950/20 to-slate-950 border-b border-slate-800/80 p-4 flex flex-col justify-between text-left relative overflow-hidden"
                >
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="w-full h-full object-cover absolute inset-0 group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <>
                      <div className="flex items-center justify-between w-full z-10">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-950/80 border border-slate-800 text-slate-300">
                          {item.category}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold ${platformColor}`}
                        >
                          <PlatformIcon /> {item.platform}
                        </span>
                      </div>

                      <div className="z-10 space-y-1">
                        <div className="text-[11px] font-medium text-purple-300">
                          {item.tag}
                        </div>
                        <div className="text-xs text-slate-400">
                          Click to inspect details &rarr;
                        </div>
                      </div>
                    </>
                  )}
                </button>

                <div className="p-4 space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-purple-400 font-semibold">
                      {item.statusLabel}
                    </span>
                    <span className={`inline-flex items-center gap-1 ${platformColor}`}>
                      <PlatformIcon className="text-xs" /> @{getHandle(item)}
                    </span>
                  </div>
                  <h3 className="font-bold text-white text-sm sm:text-base leading-snug">
                    {item.title}
                  </h3>
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {item.caption}
                  </p>
                </div>
              </div>

              <div className="px-4 pb-3.5 pt-2 flex items-center justify-between gap-2 border-t border-slate-800/60 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedItem(item)}
                  className="text-slate-300 hover:text-white font-semibold transition"
                >
                  Preview
                </button>
                <a
                  href={getExternalUrl(item)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-1 font-semibold transition ${platformColor} hover:opacity-85`}
                >
                  Open {item.platform}{' '}
                  <FaArrowUpRightFromSquare className="text-[10px]" />
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail Modal */}
      {selectedItem && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedItem(null)}
        >
          <div
            className="max-w-lg w-full rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-purple-400">
                  {selectedItem.category} &bull; {selectedItem.platform}
                </div>
                <h3 className="text-xl font-bold text-white mt-1">
                  {selectedItem.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                aria-label="Close preview"
                className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-white transition"
              >
                <FaXmark />
              </button>
            </div>

            {selectedItem.imageUrl && (
              <div className="aspect-video w-full rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
                <img
                  src={selectedItem.imageUrl}
                  alt={selectedItem.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <p className="text-sm text-slate-300 leading-relaxed">
              {selectedItem.caption}
            </p>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  onSelectForInquiry(selectedItem);
                  setSelectedItem(null);
                }}
                className="px-4 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-slate-950 text-xs sm:text-sm font-bold transition"
              >
                Ask About This Item
              </button>
              <a
                href={getExternalUrl(selectedItem)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-white text-xs sm:text-sm font-semibold transition"
              >
                Open on {selectedItem.platform}{' '}
                <FaArrowUpRightFromSquare className="text-xs" />
              </a>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
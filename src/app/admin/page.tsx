// src/app/admin/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export type AdminSlideConfig = {
  platform: 'tiktok' | 'instagram';
  mediaType: 'animation' | 'image' | 'video';
  videoUrl: string;
  imageUrl: string;
};

export type CloudMoreSlidesState = {
  tiktok: AdminSlideConfig;
  instagram: AdminSlideConfig;
};

const DEFAULT_SLIDES_STATE: CloudMoreSlidesState = {
  tiktok: { platform: 'tiktok', mediaType: 'animation', videoUrl: '', imageUrl: '' },
  instagram: { platform: 'instagram', mediaType: 'animation', videoUrl: '', imageUrl: '' },
};

export default function AdminOverview() {
  const [slides, setSlides] = useState<CloudMoreSlidesState>(DEFAULT_SLIDES_STATE);
  const [statusMessage, setStatusMessage] = useState('');
  const [savingPlatform, setSavingPlatform] = useState<'tiktok' | 'instagram' | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/cloudmore/slides', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (!active || !data?.slides) return;
        setSlides({
          tiktok: { ...DEFAULT_SLIDES_STATE.tiktok, ...data.slides.tiktok },
          instagram: { ...DEFAULT_SLIDES_STATE.instagram, ...data.slides.instagram },
        });
      })
      .catch(() => {
        // Keep defaults on initial load failure
      });

    return () => {
      active = false;
    };
  }, []);

  const updateSlideState = (
    platform: 'tiktok' | 'instagram',
    patch: Partial<AdminSlideConfig>
  ) => {
    setSlides((prev) => ({
      ...prev,
      [platform]: {
        ...prev[platform],
        ...patch,
      },
    }));
  };

  const handleFileUpload = async (
    platform: 'tiktok' | 'instagram',
    file: File | undefined
  ) => {
    if (!file) return;
    setSavingPlatform(platform);
    setStatusMessage('');

    try {
      const formData = new FormData();
      formData.append('platform', platform);
      formData.append('file', file);
      formData.append('videoUrl', slides[platform].videoUrl);
      formData.append('imageUrl', slides[platform].imageUrl);

      const res = await fetch('/api/cloudmore/slides', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setStatusMessage(data?.error || 'Upload failed.');
        return;
      }

      updateSlideState(platform, {
        mediaType: data.slide.mediaType,
        videoUrl: data.slide.videoUrl || '',
        imageUrl: data.slide.imageUrl || '',
      });
      setStatusMessage(
        `Uploaded and saved ${platform === 'tiktok' ? 'TikTok' : 'Instagram'} media.`
      );
    } catch {
      setStatusMessage('Network error while uploading media.');
    } finally {
      setSavingPlatform(null);
    }
  };

  const handleSaveUrls = async (platform: 'tiktok' | 'instagram') => {
    setSavingPlatform(platform);
    setStatusMessage('');

    try {
      const current = slides[platform];
      const res = await fetch('/api/cloudmore/slides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          mediaType: current.mediaType,
          videoUrl: current.videoUrl,
          imageUrl: current.imageUrl,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatusMessage(data?.error || 'Failed to save slide settings.');
        return;
      }

      updateSlideState(platform, {
        mediaType: data.slide.mediaType,
        videoUrl: data.slide.videoUrl || '',
        imageUrl: data.slide.imageUrl || '',
      });
      setStatusMessage(
        `Saved ${platform === 'tiktok' ? 'TikTok' : 'Instagram'} slide settings.`
      );
    } catch {
      setStatusMessage('Network error while saving settings.');
    } finally {
      setSavingPlatform(null);
    }
  };

  const handleResetAnimation = async (platform: 'tiktok' | 'instagram') => {
    setSavingPlatform(platform);
    setStatusMessage('');

    try {
      const res = await fetch('/api/cloudmore/slides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          mediaType: 'animation',
          videoUrl: '',
          imageUrl: '',
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatusMessage(data?.error || 'Failed to reset animation.');
        return;
      }

      updateSlideState(platform, {
        mediaType: 'animation',
        videoUrl: '',
        imageUrl: '',
      });
      setStatusMessage(
        `Reset ${platform === 'tiktok' ? 'TikTok' : 'Instagram'} to motion animation.`
      );
    } catch {
      setStatusMessage('Network error while resetting slide.');
    } finally {
      setSavingPlatform(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black text-white">Admin Control Center</h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage your enterprise ventures, backend pipelines, and platform states.
          </p>
        </div>
        <Link
          href="/cloudmore-collections"
          className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/40 text-purple-200 text-xs font-semibold transition"
        >
          Open CloudMore Collections &rarr;
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-slate-900">Haya Structures</h3>
          <p className="text-xs text-slate-500 mt-1">Engineering tools &amp; API telemetry.</p>
          <Link href="/haya-structures" className="text-xs font-semibold text-blue-600 mt-4 block">
            View Live Suite &rarr;
          </Link>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-slate-900">Automation Workflows</h3>
          <p className="text-xs text-slate-500 mt-1">Manage Make.com / n8n cross-posting.</p>
          <span className="text-xs font-semibold text-purple-600 mt-4 block">Connected</span>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-slate-900">System Security</h3>
          <p className="text-xs text-slate-500 mt-1">Admin Session Status: Active</p>
          <span className="text-xs font-semibold text-emerald-600 mt-4 block">Protected</span>
        </div>
      </div>

      {/* CloudMore 9:16 Slides Media Manager */}
      <section className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-purple-400">
              CloudMore Collections
            </span>
            <h2 className="text-xl font-extrabold text-white mt-0.5">
              TikTok &amp; Instagram 9:16 Slide Media
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Upload or link 9:16 videos and images saved to Cloudinary &amp; PostgreSQL.
            </p>
          </div>
          {statusMessage && (
            <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-lg">
              {statusMessage}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {(['tiktok', 'instagram'] as const).map((platform) => {
            const isTikTok = platform === 'tiktok';
            const label = isTikTok ? 'TikTok' : 'Instagram';
            const config = slides[platform];
            const isBusy = savingPlatform === platform;

            return (
              <div
                key={platform}
                className="rounded-xl bg-slate-950/80 border border-slate-800 p-5 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h3
                    className={`text-base font-bold ${
                      isTikTok ? 'text-cyan-400' : 'text-pink-400'
                    }`}
                  >
                    {label} Slide (9:16) &bull;{' '}
                    <span className="text-xs uppercase text-slate-400">
                      {config.mediaType}
                    </span>
                  </h3>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleResetAnimation(platform)}
                    className="text-xs text-slate-400 hover:text-white underline transition disabled:opacity-50"
                  >
                    Use Motion Demo
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Upload 9:16 Video or Image File
                  </label>
                  <input
                    type="file"
                    accept="video/*,image/*"
                    disabled={isBusy}
                    onChange={(e) => handleFileUpload(platform, e.target.files?.[0])}
                    className="block w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-white hover:file:bg-slate-700 cursor-pointer disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Video URL (MP4 / WebM)
                  </label>
                  <input
                    type="text"
                    value={config.videoUrl}
                    disabled={isBusy}
                    onChange={(e) =>
                      updateSlideState(platform, { videoUrl: e.target.value })
                    }
                    placeholder="https://res.cloudinary.com/..."
                    className="w-full rounded-xl bg-slate-900 border border-slate-800 focus:border-purple-500/60 focus:outline-none px-3.5 py-2 text-xs text-white placeholder:text-slate-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Image URL (Photo Slide / Video Poster)
                  </label>
                  <input
                    type="text"
                    value={config.imageUrl}
                    disabled={isBusy}
                    onChange={(e) =>
                      updateSlideState(platform, { imageUrl: e.target.value })
                    }
                    placeholder="https://res.cloudinary.com/..."
                    className="w-full rounded-xl bg-slate-900 border border-slate-800 focus:border-purple-500/60 focus:outline-none px-3.5 py-2 text-xs text-white placeholder:text-slate-500"
                  />
                </div>

                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => handleSaveUrls(platform)}
                  className="w-full py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 disabled:opacity-50 text-slate-950 text-xs font-bold transition"
                >
                  {isBusy ? 'Saving...' : `Save ${label} Slide`}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
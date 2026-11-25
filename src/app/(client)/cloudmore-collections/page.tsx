'use client';

import { useState } from 'react';
import CloudMoreHeader from './CloudMoreHeader';
import OfferingsGrid from './OfferingsGrid';
import ShowcaseGallery from './ShowcaseGallery';
import SocialConnectSection, { InquiryCategory } from './SocialConnectSection';
import { GalleryItem, INSTAGRAM_HANDLE } from './cloudmoreData';

export default function CloudMoreCollectionsPage() {
  const [inquiryType, setInquiryType] = useState<InquiryCategory>('Apparel & Clothing');
  const [itemNote, setItemNote] = useState('');

  const handleSelectForInquiry = (item: GalleryItem) => {
    setInquiryType(
      item.category === 'Consignments' ? 'Consignment Inquiry' : 'Apparel & Clothing'
    );
    setItemNote(item.title);
    document.getElementById('connect')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col justify-between overflow-x-hidden">
      <CloudMoreHeader />

      <main className="max-w-6xl mx-auto w-full px-6 py-12 sm:py-16 space-y-16">
        {/* Hero */}
        <section className="space-y-4">
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-[1.08]">
            Modern Apparel &amp;{' '}
            <span className="bg-gradient-to-r from-purple-400 via-fuchsia-400 to-cyan-300 bg-clip-text text-transparent">
              Curated Consignments.
            </span>
          </h1>
          <p className="text-slate-300 text-base sm:text-lg leading-relaxed max-w-2xl">
            Explore CloudMore — where fresh clothing drops, everyday essentials, and
            consignment pieces come together. Learn about who we are, what we deal with, and jump
            straight to our Instagram and TikTok pages.
          </p>
        </section>

        <OfferingsGrid />

        <ShowcaseGallery onSelectForInquiry={handleSelectForInquiry} />

        <SocialConnectSection
          inquiryType={inquiryType}
          setInquiryType={setInquiryType}
          itemNote={itemNote}
          setItemNote={setItemNote}
        />
      </main>

      <footer className="border-t border-slate-900 py-6 px-6 text-center text-xs text-slate-500">
        &copy; {new Date().getFullYear()} CloudMore (@{INSTAGRAM_HANDLE}) &bull; Part of RUTTA.COM.
      </footer>
    </div>
  );
}
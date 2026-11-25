export const INSTAGRAM_HANDLE = 'cloudmore.collections';
export const TIKTOK_HANDLE = 'cloudmore.collections';

export const INSTAGRAM_URL = `https://www.instagram.com/${INSTAGRAM_HANDLE}`;
export const TIKTOK_URL = `https://www.tiktok.com/@${TIKTOK_HANDLE}`;

export type GalleryCategory = 'Apparel' | 'Consignments';
export type SocialPlatform = 'Instagram' | 'TikTok';

export type GalleryItem = {
  id: string;
  title: string;
  category: GalleryCategory;
  platform: SocialPlatform;
  tag: string;
  statusLabel: string;
  caption: string;
  imageUrl?: string;
  postUrl?: string;
};

export const GALLERY_ITEMS: GalleryItem[] = [
  {
    id: 'cm-01',
    title: 'Heavyweight Hoodies & Street Staples',
    category: 'Apparel',
    platform: 'TikTok',
    tag: 'Fit Check • New & Thrifted',
    statusLabel: 'Featured Drop',
    caption:
      'Fresh apparel rotation featuring structured hoodies, outerwear, and everyday staples previewed in our latest fit check.',
  },
  {
    id: 'cm-02',
    title: 'Curated Designer & Collector Consignment',
    category: 'Consignments',
    platform: 'Instagram',
    tag: 'Consignment • Verified',
    statusLabel: 'Inquire via DM',
    caption:
      'Selected consignment pieces including collectibles, limited-edition items, designer garments, and statement accessories.',
  },
  {
    id: 'cm-03',
    title: 'Outerwear, Jackets & Tracksets',
    category: 'Apparel',
    platform: 'Instagram',
    tag: 'Apparel • Lookbook',
    statusLabel: 'Available / Restocking',
    caption:
      'Layering pieces across jackets, sweaters, vests, jeans, and tracksuits—curated for clean silhouettes and daily wear.',
  },
  {
    id: 'cm-04',
    title: 'Accessories, Eyewear, Caps & Bags',
    category: 'Consignments',
    platform: 'TikTok',
    tag: 'Consignment & Accessories',
    statusLabel: 'Spotlight Clip',
    caption:
      'Finishing touches from caps, spectacles, skimasks, and bags to memorabilia, artwork, and jewelry consignment finds.',
  },
];

export const OFFERINGS = [
  {
    id: 'about',
    badge: '01 • About',
    title: 'About CloudMore',
    type: 'about' as const,
    accent: 'text-purple-400',
    badgeBg: 'bg-purple-500/10 border-purple-500/20 text-purple-300',
    description:
      'CloudMore is the apparel and consignment arm under Rutta Group. We curate everyday statement pieces, seasonal clothing drops, and authenticated consignment finds for people who care about both style and value.',
    highlights: [] as string[],
  },
  {
    id: 'consignments',
    badge: '02 • What We Deal With:',
    title: 'Consignments & Apparel',
    type: 'consignments' as const,
    accent: 'text-fuchsia-400',
    badgeBg: 'bg-fuchsia-500/10 border-fuchsia-500/20 text-fuchsia-300',
    description:
      'At CloudMore we deal with both thrifted and new apparels and consignment items.',
    highlights: [
      'Apparel: caps, spectacles, skimasks, t-shirts, vests, hoodies, shoes, shorts, jeans, jackets, sweaters, tracksuits, socks, gloves, scarves, bags and more',
      'Consignment: collectibles, limited-edition items, antiques, memorabilia, artwork, designer pieces, jewelry and more',
    ],
  },
];
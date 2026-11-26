// src/app/api/cloudmore/slides/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

type PlatformKey = 'tiktok' | 'instagram';

type SlidePayload = {
  platform: PlatformKey;
  mediaType: string;
  videoUrl: string;
  imageUrl: string;
};

const DEFAULTS: Record<PlatformKey, SlidePayload> = {
  tiktok: {
    platform: 'tiktok',
    mediaType: 'animation',
    videoUrl: '',
    imageUrl: '',
  },
  instagram: {
    platform: 'instagram',
    mediaType: 'animation',
    videoUrl: '',
    imageUrl: '',
  },
};

function parsePlatform(value: unknown): PlatformKey | null {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'tiktok' || normalized === 'instagram') {
    return normalized;
  }
  return null;
}

async function isAuthorizedAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  if (cookieStore.get('admin_auth')?.value === 'true') {
    return true;
  }

  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.id) {
      const dbUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
      });
      if (dbUser?.role === 'ADMIN') return true;
    }
  } catch {
    // Ignore session lookup errors
  }

  return false;
}

export async function GET() {
  try {
    const rows = await prisma.cloudMoreSlide.findMany();
    const result: Record<PlatformKey, SlidePayload> = {
      tiktok: { ...DEFAULTS.tiktok },
      instagram: { ...DEFAULTS.instagram },
    };

    for (const row of rows) {
      const platformKey = parsePlatform(row.platform);
      if (platformKey) {
        result[platformKey] = {
          platform: platformKey,
          mediaType: row.mediaType,
          videoUrl: row.videoUrl ?? '',
          imageUrl: row.imageUrl ?? '',
        };
      }
    }

    return NextResponse.json({ success: true, slides: result });
  } catch (error) {
    console.error('GET /api/cloudmore/slides error:', error);
    return NextResponse.json({ error: 'Failed to load slides' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authorized = await isAuthorizedAdmin();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contentType = req.headers.get('content-type') || '';

    let platform: PlatformKey | null = null;
    let mediaType: 'animation' | 'image' | 'video' = 'animation';
    let videoUrl = '';
    let imageUrl = '';
    let file: File | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      platform = parsePlatform(formData.get('platform'));

      const rawMediaType = String(formData.get('mediaType') || '');
      if (
        rawMediaType === 'animation' ||
        rawMediaType === 'image' ||
        rawMediaType === 'video'
      ) {
        mediaType = rawMediaType;
      }

      videoUrl = String(formData.get('videoUrl') || '').trim();
      imageUrl = String(formData.get('imageUrl') || '').trim();

      const maybeFile = formData.get('file');
      if (maybeFile instanceof File && maybeFile.size > 0) {
        file = maybeFile;
      }
    } else {
      const body = await req.json();
      platform = parsePlatform(body?.platform);

      if (
        body?.mediaType === 'animation' ||
        body?.mediaType === 'image' ||
        body?.mediaType === 'video'
      ) {
        mediaType = body.mediaType;
      }
      videoUrl = String(body?.videoUrl || '').trim();
      imageUrl = String(body?.imageUrl || '').trim();
    }

    if (!platform) {
      return NextResponse.json(
        { error: 'Invalid platform. Expected "tiktok" or "instagram".' },
        { status: 400 }
      );
    }

    if (file) {
      const isVideo = file.type.startsWith('video/');
      const isImage = file.type.startsWith('image/');

      if (!isVideo && !isImage) {
        return NextResponse.json(
          { error: 'Only video or image files are allowed.' },
          { status: 400 }
        );
      }

      const maxBytes = isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
      if (file.size > maxBytes) {
        return NextResponse.json(
          {
            error: isVideo
              ? 'Video too large. Maximum size is 100MB.'
              : 'Image too large. Maximum size is 10MB.',
          },
          { status: 400 }
        );
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const base64 = `data:${file.type};base64,${buffer.toString('base64')}`;

      const uploadResult = await cloudinary.uploader.upload(base64, {
        folder: `rutta-group/cloudmore/${platform}`,
        public_id: `${platform}_9x16_slide`,
        overwrite: true,
        resource_type: 'auto',
      });

      if (isVideo) {
        mediaType = 'video';
        videoUrl = uploadResult.secure_url;
      } else {
        mediaType = 'image';
        imageUrl = uploadResult.secure_url;
        videoUrl = '';
      }
    } else if (mediaType === 'animation' && !videoUrl && !imageUrl) {
      videoUrl = '';
      imageUrl = '';
    } else if (videoUrl) {
      mediaType = 'video';
    } else if (imageUrl) {
      mediaType = 'image';
    } else {
      mediaType = 'animation';
    }

    const saved = await prisma.cloudMoreSlide.upsert({
      where: { platform },
      update: {
        mediaType,
        videoUrl: videoUrl || null,
        imageUrl: imageUrl || null,
      },
      create: {
        platform,
        mediaType,
        videoUrl: videoUrl || null,
        imageUrl: imageUrl || null,
      },
    });

    return NextResponse.json({ success: true, slide: saved });
  } catch (error) {
    console.error('POST /api/cloudmore/slides error:', error);
    return NextResponse.json(
      { error: 'Failed to save slide media' },
      { status: 500 }
    );
  }
}
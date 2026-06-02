import { NextResponse } from 'next/server';
import { uploadToCloudinary, validateImage } from '@/lib/cloudinary';
import { getBearer, verifyToken } from '@/lib/auth';
import { getDb } from '@/lib/mongo';

const CORS = {
  'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'X-Content-Type-Options': 'nosniff',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req) {
  try {
    const db = await getDb();
    const token = getBearer(req);
    const data = verifyToken(token);
    if (!data) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: CORS });
    }
    const user = await db.collection('users').findOne({ id: data.uid }, { projection: { _id: 0, role: 1 } });
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: CORS });
    }
    if (user.role !== 'admin') {
      return NextResponse.json({ ok: false, error: 'Admin only' }, { status: 403, headers: CORS });
    }

    const body = await req.json().catch(() => ({}));
    const { image, fileName, folder = 'chemistshop' } = body;

    if (!image || typeof image !== 'string' || !image.startsWith('data:image/')) {
      return NextResponse.json({ ok: false, error: 'Invalid image data. Expected base64 data URL.' }, { status: 400, headers: CORS });
    }

    // Extract size from base64 (approximate: each char ~ 0.75 bytes after base64)
    const base64Body = image.split(',')[1];
    const sizeBytes = Math.round((base64Body.length * 3) / 4);

    const validation = validateImage(fileName || 'image.jpg', sizeBytes);
    if (!validation.ok) {
      return NextResponse.json({ ok: false, error: validation.error }, { status: 400, headers: CORS });
    }

    const url = await uploadToCloudinary(image, folder);
    return NextResponse.json({ ok: true, url }, { status: 200, headers: CORS });
  } catch (e) {
    console.error('Upload error', e);
    return NextResponse.json({ ok: false, error: e.message || 'Upload failed' }, { status: 500, headers: CORS });
  }
}

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';

export async function POST(req) {
  try {
    const { lat, lng, distance, radiusKm } = await req.json();

    if (lat == null || lng == null || distance == null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const db = await getDb();
    const collection = db.collection('analytics_out_of_range');

    await collection.insertOne({
      lat,
      lng,
      distance,
      radiusKm,
      timestamp: new Date(),
      userAgent: req.headers.get('user-agent'),
      ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json({ error: 'Failed to log analytics' }, { status: 500 });
  }
}

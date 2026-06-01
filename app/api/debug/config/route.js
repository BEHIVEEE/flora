import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';

export async function GET(req) {
  try {
    const db = await getDb();
    const settings = await db.collection('settings').findOne({});

    return NextResponse.json({
      shopLat: settings?.shopLat,
      shopLng: settings?.shopLng,
      deliveryRadiusKm: settings?.deliveryRadiusKm,
      configured: settings?.shopLat != null && settings?.shopLng != null,
    });
  } catch (error) {
    console.error('Config check error:', error);
    return NextResponse.json({ error: 'Failed to check config' }, { status: 500 });
  }
}

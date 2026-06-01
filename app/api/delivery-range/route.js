import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';
import { distanceKm } from '@/lib/distance';

export async function POST(req) {
  try {
    const { lat, lng } = await req.json();

    if (lat == null || lng == null) {
      return NextResponse.json({ error: 'Missing lat/lng' }, { status: 400 });
    }

    const db = await getDb();
    const settings = await db.collection('settings').findOne({});

    const shopLat = settings?.shopLat;
    const shopLng = settings?.shopLng;
    const deliveryRadiusKm = Number(settings?.deliveryRadiusKm) || 10;

    if (shopLat == null || shopLng == null) {
      return NextResponse.json({ error: 'Shop location not configured' }, { status: 503 });
    }

    const distance = distanceKm(lat, lng, shopLat, shopLng);
    const inRange = distance <= deliveryRadiusKm;

    return NextResponse.json({
      inRange,
      distance,
      radiusKm: deliveryRadiusKm,
      message: inRange
        ? `You're ${distance.toFixed(1)} km away. We deliver to your area!`
        : `You're ${distance.toFixed(1)} km away. We deliver within ${deliveryRadiusKm} km.`,
    });
  } catch (error) {
    console.error('Delivery range error:', error);
    return NextResponse.json({ error: 'Failed to check delivery range' }, { status: 500 });
  }
}

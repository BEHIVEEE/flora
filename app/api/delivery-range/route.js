import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';
import { distanceKm } from '@/lib/distance';
import { PINCODE_COORDS } from '@/lib/pincode-coords';

export async function POST(req) {
  try {
    const { lat, lng, pincode } = await req.json();

    console.log('Delivery range request:', { lat, lng, pincode });

    if (!lat && !lng && !pincode) {
      return NextResponse.json({ error: 'Missing lat/lng or pincode' }, { status: 400 });
    }

    let latitude = lat;
    let longitude = lng;

    // If pincode provided, look up coordinates
    if (pincode && (!lat || !lng)) {
      console.log('Looking up pincode:', pincode);
      const coords = PINCODE_COORDS[pincode];
      console.log('Pincode lookup result:', coords);
      
      if (!coords) {
        console.log('Available pincodes:', Object.keys(PINCODE_COORDS).slice(0, 10));
        return NextResponse.json({ 
          error: `Pincode ${pincode} not found. Try: 400001, 400050, 400060, 401107` 
        }, { status: 400 });
      }
      latitude = coords.lat;
      longitude = coords.lng;
      console.log('Using coordinates for pincode:', { latitude, longitude });
    }

    const db = await getDb();
    const settings = await db.collection('settings').findOne({});

    const shopLat = settings?.shopLat;
    const shopLng = settings?.shopLng;
    const deliveryRadiusKm = Number(settings?.deliveryRadiusKm) || 10;

    if (shopLat == null || shopLng == null) {
      return NextResponse.json({ error: 'Shop location not configured' }, { status: 503 });
    }

    const distance = distanceKm(latitude, longitude, shopLat, shopLng);
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

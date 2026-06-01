import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';
import { distanceKm } from '@/lib/distance';

// Approximate lat/lng for major Indian pincodes (you can expand this)
const PINCODE_COORDS = {
  '400001': { lat: 18.9520, lng: 72.8347, city: 'Mumbai' }, // Fort
  '400002': { lat: 18.9676, lng: 72.8194, city: 'Mumbai' }, // Colaba
  '400003': { lat: 18.9766, lng: 72.8235, city: 'Mumbai' }, // Fort
  '400004': { lat: 18.9766, lng: 72.8235, city: 'Mumbai' }, // Kala Ghoda
  '400005': { lat: 18.9766, lng: 72.8235, city: 'Mumbai' }, // Kala Ghoda
  '400006': { lat: 18.9766, lng: 72.8235, city: 'Mumbai' }, // Fort
  '400007': { lat: 18.9766, lng: 72.8235, city: 'Mumbai' }, // Fort
  '400008': { lat: 18.9766, lng: 72.8235, city: 'Mumbai' }, // Fort
  '400009': { lat: 18.9766, lng: 72.8235, city: 'Mumbai' }, // Fort
  '400010': { lat: 18.9766, lng: 72.8235, city: 'Mumbai' }, // Fort
  '400011': { lat: 19.0176, lng: 72.8479, city: 'Mumbai' }, // Byculla
  '400012': { lat: 19.0176, lng: 72.8479, city: 'Mumbai' }, // Byculla
  '400013': { lat: 19.0176, lng: 72.8479, city: 'Mumbai' }, // Byculla
  '400014': { lat: 19.0176, lng: 72.8479, city: 'Mumbai' }, // Byculla
  '400015': { lat: 19.0176, lng: 72.8479, city: 'Mumbai' }, // Byculla
  '400016': { lat: 19.0176, lng: 72.8479, city: 'Mumbai' }, // Byculla
  '400017': { lat: 19.0176, lng: 72.8479, city: 'Mumbai' }, // Byculla
  '400018': { lat: 19.0176, lng: 72.8479, city: 'Mumbai' }, // Byculla
  '400019': { lat: 19.0176, lng: 72.8479, city: 'Mumbai' }, // Byculla
  '400020': { lat: 19.0176, lng: 72.8479, city: 'Mumbai' }, // Byculla
  '400050': { lat: 19.0760, lng: 72.8777, city: 'Mumbai' }, // Dadar
  '400051': { lat: 19.0760, lng: 72.8777, city: 'Mumbai' }, // Dadar
  '400052': { lat: 19.0760, lng: 72.8777, city: 'Mumbai' }, // Dadar
  '400053': { lat: 19.0760, lng: 72.8777, city: 'Mumbai' }, // Dadar
  '400054': { lat: 19.0760, lng: 72.8777, city: 'Mumbai' }, // Dadar
  '400055': { lat: 19.0760, lng: 72.8777, city: 'Mumbai' }, // Dadar
  '400056': { lat: 19.0760, lng: 72.8777, city: 'Mumbai' }, // Dadar
  '400057': { lat: 19.0760, lng: 72.8777, city: 'Mumbai' }, // Dadar
  '400058': { lat: 19.0760, lng: 72.8777, city: 'Mumbai' }, // Dadar
  '400059': { lat: 19.0760, lng: 72.8777, city: 'Mumbai' }, // Dadar
  '400060': { lat: 19.1136, lng: 72.8697, city: 'Mumbai' }, // Shivaji Park
  '400061': { lat: 19.1136, lng: 72.8697, city: 'Mumbai' }, // Shivaji Park
  '400062': { lat: 19.1136, lng: 72.8697, city: 'Mumbai' }, // Shivaji Park
  '400063': { lat: 19.1136, lng: 72.8697, city: 'Mumbai' }, // Shivaji Park
  '400064': { lat: 19.1136, lng: 72.8697, city: 'Mumbai' }, // Shivaji Park
  '400065': { lat: 19.1136, lng: 72.8697, city: 'Mumbai' }, // Shivaji Park
  '400066': { lat: 19.1136, lng: 72.8697, city: 'Mumbai' }, // Shivaji Park
  '400067': { lat: 19.1136, lng: 72.8697, city: 'Mumbai' }, // Shivaji Park
  '400068': { lat: 19.1136, lng: 72.8697, city: 'Mumbai' }, // Shivaji Park
  '400069': { lat: 19.1136, lng: 72.8697, city: 'Mumbai' }, // Shivaji Park
  '400070': { lat: 19.1136, lng: 72.8697, city: 'Mumbai' }, // Shivaji Park
  '400071': { lat: 19.1136, lng: 72.8697, city: 'Mumbai' }, // Shivaji Park
  '400072': { lat: 19.1136, lng: 72.8697, city: 'Mumbai' }, // Shivaji Park
  '400073': { lat: 19.1136, lng: 72.8697, city: 'Mumbai' }, // Shivaji Park
  '400074': { lat: 19.1136, lng: 72.8697, city: 'Mumbai' }, // Shivaji Park
  '400075': { lat: 19.1136, lng: 72.8697, city: 'Mumbai' }, // Shivaji Park
  '400076': { lat: 19.1136, lng: 72.8697, city: 'Mumbai' }, // Shivaji Park
  '400077': { lat: 19.1136, lng: 72.8697, city: 'Mumbai' }, // Shivaji Park
  '400078': { lat: 19.1136, lng: 72.8697, city: 'Mumbai' }, // Shivaji Park
  '400079': { lat: 19.1136, lng: 72.8697, city: 'Mumbai' }, // Shivaji Park
  '400080': { lat: 19.1136, lng: 72.8697, city: 'Mumbai' }, // Shivaji Park
  '400081': { lat: 19.1136, lng: 72.8697, city: 'Mumbai' }, // Shivaji Park
  '400082': { lat: 19.1136, lng: 72.8697, city: 'Mumbai' }, // Shivaji Park
  '400083': { lat: 19.1136, lng: 72.8697, city: 'Mumbai' }, // Shivaji Park
  '400084': { lat: 19.1136, lng: 72.8697, city: 'Mumbai' }, // Shivaji Park
  '400085': { lat: 19.1136, lng: 72.8697, city: 'Mumbai' }, // Shivaji Park
  '400086': { lat: 19.1136, lng: 72.8697, city: 'Mumbai' }, // Shivaji Park
  '400087': { lat: 19.1136, lng: 72.8697, city: 'Mumbai' }, // Shivaji Park
  '400088': { lat: 19.1136, lng: 72.8697, city: 'Mumbai' }, // Shivaji Park
  '400089': { lat: 19.1136, lng: 72.8697, city: 'Mumbai' }, // Shivaji Park
  '400090': { lat: 19.1136, lng: 72.8697, city: 'Mumbai' }, // Shivaji Park
  '400091': { lat: 19.1136, lng: 72.8697, city: 'Mumbai' }, // Shivaji Park
  '400092': { lat: 19.1136, lng: 72.8697, city: 'Mumbai' }, // Shivaji Park
  '400093': { lat: 19.1136, lng: 72.8697, city: 'Mumbai' }, // Shivaji Park
  '400094': { lat: 19.1136, lng: 72.8697, city: 'Mumbai' }, // Shivaji Park
  '400095': { lat: 19.1136, lng: 72.8697, city: 'Mumbai' }, // Shivaji Park
  '400096': { lat: 19.1136, lng: 72.8697, city: 'Mumbai' }, // Shivaji Park
  '400097': { lat: 19.1136, lng: 72.8697, city: 'Mumbai' }, // Shivaji Park
  '400098': { lat: 19.1136, lng: 72.8697, city: 'Mumbai' }, // Shivaji Park
  '400099': { lat: 19.1136, lng: 72.8697, city: 'Mumbai' }, // Shivaji Park
  '401107': { lat: 19.2183, lng: 72.9781, city: 'Thane' }, // Thane
};

export async function POST(req) {
  try {
    const { lat, lng, pincode } = await req.json();

    if (!lat && !lng && !pincode) {
      return NextResponse.json({ error: 'Missing lat/lng or pincode' }, { status: 400 });
    }

    let latitude = lat;
    let longitude = lng;

    // If pincode provided, look up coordinates
    if (pincode && (!lat || !lng)) {
      const coords = PINCODE_COORDS[pincode];
      if (!coords) {
        return NextResponse.json({ error: 'Pincode not found in our database. Please use location detection.' }, { status: 400 });
      }
      latitude = coords.lat;
      longitude = coords.lng;
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

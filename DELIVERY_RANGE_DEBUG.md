# Delivery Range Debugging Guide

If pincode check is not working, follow these steps:

## Step 1: Check Shop Configuration

Open your browser console and run:
```javascript
fetch('/api/debug/config').then(r => r.json()).then(d => console.log(d))
```

You should see:
```json
{
  "shopLat": 19.2183,
  "shopLng": 72.9781,
  "deliveryRadiusKm": 10,
  "configured": true
}
```

**If `configured` is `false`:**
1. Go to `/admin/settings`
2. Scroll to "Delivery Settings"
3. Set "Shop Latitude" and "Shop Longitude"
4. Save settings

## Step 2: Check Pincode Database

Open browser console and run:
```javascript
fetch('/api/delivery-range', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ pincode: '400050' })
}).then(r => r.json()).then(d => console.log(d))
```

You should see:
```json
{
  "inRange": true/false,
  "distance": 5.2,
  "radiusKm": 10,
  "message": "..."
}
```

**If you get "Pincode not found":**
- The pincode is not in the database
- Add it to `lib/pincode-coords.js`

## Step 3: Check Browser Console

1. Open DevTools (F12)
2. Go to Console tab
3. Try entering a pincode
4. Look for logs like:
   - `Checking pincode: 400050`
   - `Sending payload: {pincode: "400050"}`
   - `Response status: 200`
   - `Response data: {...}`

## Step 4: Common Issues

### Issue: "Pincode not found"
**Solution:** Add pincode to `lib/pincode-coords.js`

Example:
```javascript
'400100': { lat: 19.1234, lng: 72.8567, city: 'Mumbai' },
```

### Issue: "Shop location not configured"
**Solution:** Set shop coordinates in `/admin/settings`

### Issue: "Network error"
**Solution:** Check:
1. Internet connection
2. Server is running
3. No CORS errors in console

## Step 5: Add More Pincodes

Edit `lib/pincode-coords.js` and add:

```javascript
export const PINCODE_COORDS = {
  // ... existing pincodes ...
  '400100': { lat: 19.1234, lng: 72.8567, city: 'Mumbai' },
  '400101': { lat: 19.1245, lng: 72.8578, city: 'Mumbai' },
  '401201': { lat: 19.2345, lng: 72.9678, city: 'Thane' },
};
```

## Finding Coordinates for a Pincode

1. Go to Google Maps
2. Search for the pincode (e.g., "400050 Mumbai")
3. Right-click on the location
4. Copy the coordinates (lat, lng)

Example: `19.0760, 72.8777` → `{ lat: 19.0760, lng: 72.8777 }`

## Testing Pincodes

Available test pincodes:
- `400001` - Mumbai Fort
- `400050` - Dadar
- `400060` - Shivaji Park
- `401107` - Thane

Try these in the pincode entry field.

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'chemistshop_location';

export function useLocation() {
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setLocation(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  const save = useCallback((data) => {
    setLocation(data);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* ignore */ }
  }, []);

  const detect = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          // Use OpenStreetMap Nominatim (free, no API key)
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
            { headers: { 'Accept-Language': 'en' } }
          );
          const data = await res.json();
          const addr = data.address || {};

          const locationData = {
            lat: latitude,
            lng: longitude,
            displayName: data.display_name || '',
            city: addr.city || addr.town || addr.village || addr.suburb || '',
            state: addr.state || '',
            pincode: addr.postcode || '',
            country: addr.country || '',
            line1: addr.road ? `${addr.road}${addr.house_number ? ' ' + addr.house_number : ''}` : '',
            line2: addr.neighbourhood || addr.suburb || '',
          };

          save(locationData);
        } catch (e) {
          setError('Failed to fetch address details');
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        let msg = 'Unable to retrieve location';
        if (err.code === 1) msg = 'Location permission denied. Please allow access in browser settings.';
        if (err.code === 2) msg = 'Location unavailable. Check your device GPS.';
        if (err.code === 3) msg = 'Location request timed out.';
        setError(msg);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 600000 }
    );
  }, [save]);

  const clear = useCallback(() => {
    setLocation(null);
    setError(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }, []);

  return { location, loading, error, detect, clear };
}

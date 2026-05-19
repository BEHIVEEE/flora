import { useMemo } from 'react';
import { useLocation } from './useLocation';
import { useSettings } from '@/components/SettingsProvider';
import { distanceKm } from '@/lib/distance';

/**
 * Computes the delivery serviceability based on user location vs shop coordinates.
 * Returns: { location, distance, inRange, radiusKm, configured, detect, loading, error }
 */
export function useDeliveryRange() {
  const { location, loading, error, detect, clear } = useLocation();
  const { shopLat, shopLng, deliveryRadiusKm } = useSettings();

  const radiusKm = Number(deliveryRadiusKm) || 10;
  const configured = shopLat != null && shopLng != null;

  const distance = useMemo(() => {
    if (!location || !configured) return null;
    return distanceKm(location.lat, location.lng, shopLat, shopLng);
  }, [location, shopLat, shopLng, configured]);

  const inRange = distance != null ? distance <= radiusKm : null;

  return { location, distance, inRange, radiusKm, configured, detect, clear, loading, error };
}

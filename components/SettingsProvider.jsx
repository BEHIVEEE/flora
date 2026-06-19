'use client';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const DEFAULT_SETTINGS = {
  shopName: 'FloraChemist',
  tagline: 'Apka Apna Chemist',
  contactPhone: '+91 91672 61103',
  contactEmail: 'florachemistsupport@gmail.com',
  address: 'Thane, Maharashtra, India',
  deliveryCharge: 49,
  freeDeliveryAbove: 499,
  pickupFee: 0,
  minOrderValue: 99,
  businessHours: { open: '09:00', close: '21:00' },
  slotsEnabled: true,
  logo: '',
  shopLat: null,
  shopLng: null,
  deliveryRadiusKm: 10,
};

const SettingsCtx = createContext(null);
export const useSettings = () => useContext(SettingsCtx) || DEFAULT_SETTINGS;

const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const refreshSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      const d = await res.json();
      if (d.settings) setSettings({ ...DEFAULT_SETTINGS, ...d.settings });
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { refreshSettings(); }, [refreshSettings]);

  const value = { settings, loading, refreshSettings, ...settings };
  return <SettingsCtx.Provider value={value}>{children}</SettingsCtx.Provider>;
};

export default SettingsProvider;

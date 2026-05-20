'use client';
import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, Loader2 } from 'lucide-react';

/**
 * Address autocomplete using Photon (OpenStreetMap) — free, no API key.
 * Biases results around given lat/lng if provided (user's detected location).
 * onPick(parsed) returns { line1, line2, city, state, pincode, country, lat, lng, displayName }.
 */
const AddressAutocomplete = ({ label = 'Address Line 1 *', value, onChange, onPick, biasLat, biasLng, className = '', placeholder = 'Search building, street, area…' }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const wrapRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!value || value.trim().length < 3) { setItems([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({ q: value.trim(), limit: '6', lang: 'en' });
        if (biasLat && biasLng) { params.set('lat', biasLat); params.set('lon', biasLng); }
        const r = await fetch(`https://photon.komoot.io/api/?${params.toString()}`);
        const d = await r.json();
        const feats = (d?.features || []).filter(f => f?.geometry?.coordinates && f?.properties);
        setItems(feats);
        setOpen(true);
      } catch { setItems([]); }
      finally { setLoading(false); }
    }, 280);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [value, biasLat, biasLng]);

  useEffect(() => {
    const onDoc = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const formatLine = (p) => {
    const parts = [p.name, p.housenumber && p.street ? `${p.housenumber} ${p.street}` : p.street].filter(Boolean);
    return parts.join(', ');
  };
  const formatSecondary = (p) => [p.locality, p.district, p.city, p.state, p.postcode, p.country].filter(Boolean).join(', ');

  const pick = (f) => {
    const p = f.properties || {};
    const [lng, lat] = f.geometry.coordinates;
    const line1 = formatLine(p) || p.name || '';
    const line2 = [p.locality, p.district].filter(Boolean).join(', ');
    const parsed = {
      line1,
      line2,
      city: p.city || p.town || p.village || p.county || '',
      state: p.state || '',
      pincode: p.postcode || '',
      country: p.country || '',
      lat, lng,
      displayName: [line1, formatSecondary(p)].filter(Boolean).join(' · '),
    };
    onChange?.(line1);
    onPick?.(parsed);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      {label && <Label className="text-xs font-semibold text-slate-700">{label}</Label>}
      <div className="relative mt-1.5">
        <Input
          value={value || ''}
          onChange={(e) => onChange?.(e.target.value)}
          onFocus={() => items.length && setOpen(true)}
          placeholder={placeholder}
          className="h-11 rounded-xl bg-white pr-9"
          autoComplete="off"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
        </div>
      </div>
      {open && items.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          {items.map((f, i) => {
            const p = f.properties || {};
            return (
              <button
                key={`${p.osm_id || i}-${i}`}
                type="button"
                onClick={() => pick(f)}
                className="w-full text-left px-3 py-2.5 hover:bg-slate-50 border-b border-slate-100 last:border-0 flex items-start gap-2"
              >
                <MapPin className="w-4 h-4 text-teal-600 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-900 truncate">{formatLine(p) || p.name}</div>
                  <div className="text-xs text-slate-500 truncate">{formatSecondary(p)}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AddressAutocomplete;

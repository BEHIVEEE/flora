'use client';
import { useState } from 'react';
import { MapPin, Loader, CheckCircle, XCircle, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const QuickDeliveryCheck = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [distance, setDistance] = useState(null);
  const [showManual, setShowManual] = useState(false);
  const [manualPincode, setManualPincode] = useState('');

  const checkDelivery = async () => {
    setLoading(true);
    setResult(null);
    setDistance(null);

    try {
      // Check if geolocation is available
      if (!navigator.geolocation) {
        toast.error('Geolocation not supported in your browser. Please use Chrome, Firefox, or Safari.');
        setResult('error');
        setLoading(false);
        return;
      }

      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            timeout: 15000,
            enableHighAccuracy: false,
            maximumAge: 0,
          }
        );
      });

      const { latitude, longitude } = position.coords;

      const res = await fetch('/api/delivery-range', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: latitude, lng: longitude }),
      });

      const data = await res.json();

      if (data.inRange) {
        setResult('in-range');
        setDistance(data.distance);
        toast.success(`✅ We deliver to your area! You're ${data.distance.toFixed(1)} km away.`);
      } else {
        setResult('out-of-range');
        setDistance(data.distance);
        toast.error(`❌ Sorry, we don't deliver to your location yet. You're ${data.distance.toFixed(1)} km away.`);
        
        // Log out-of-range view for analytics
        fetch('/api/analytics/out-of-range', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lat: latitude,
            lng: longitude,
            distance: data.distance,
            radiusKm: data.radiusKm,
          }),
        }).catch(() => {});
      }
    } catch (error) {
      console.error('Geolocation error:', error);
      
      if (error.code === 1) {
        toast.error('📍 Location access denied. Enable location in your browser settings to check delivery.');
      } else if (error.code === 2) {
        toast.error('📍 Could not determine your location. Please check your GPS/WiFi and try again.');
      } else if (error.code === 3) {
        toast.error('📍 Location request timed out. Please try again with better signal.');
      } else if (error.message?.includes('User denied')) {
        toast.error('📍 You denied location access. Click the location icon in your address bar to allow it.');
      } else {
        toast.error('📍 Could not get your location. Try:\n1. Check browser location permission\n2. Use WiFi instead of mobile data\n3. Refresh the page');
      }
      setResult('error');
    } finally {
      setLoading(false);
    }
  };

  const checkByPincode = async () => {
    if (!manualPincode || manualPincode.length < 6) {
      toast.error('Please enter a valid 6-digit pincode');
      return;
    }

    setLoading(true);
    setResult(null);
    setDistance(null);

    try {
      const res = await fetch('/api/delivery-range', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pincode: manualPincode }),
      });

      const data = await res.json();

      if (data.inRange) {
        setResult('in-range');
        setDistance(data.distance);
        toast.success(`✅ We deliver to pincode ${manualPincode}! Distance: ${data.distance.toFixed(1)} km`);
      } else {
        setResult('out-of-range');
        setDistance(data.distance);
        toast.error(`❌ We don't deliver to pincode ${manualPincode} yet. Distance: ${data.distance.toFixed(1)} km`);
      }
    } catch (error) {
      toast.error('Could not check pincode. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-6 space-y-4">
      {!showManual ? (
        <>
          <Button
            onClick={checkDelivery}
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-full h-12 font-semibold flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Detecting location…
              </>
            ) : (
              <>
                <MapPin className="w-4 h-4" />
                Check Delivery Availability
              </>
            )}
          </Button>
          <button
            onClick={() => setShowManual(true)}
            className="w-full text-sm text-blue-600 hover:text-blue-700 font-semibold flex items-center justify-center gap-1 py-2"
          >
            <ChevronDown className="w-4 h-4" />
            Or enter pincode manually
          </button>
        </>
      ) : (
        <>
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="Enter 6-digit pincode"
              value={manualPincode}
              onChange={(e) => setManualPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength="6"
              className="rounded-full h-12"
            />
            <Button
              onClick={checkByPincode}
              disabled={loading || manualPincode.length < 6}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-6 font-semibold h-12"
            >
              {loading ? <Loader className="w-4 h-4 animate-spin" /> : 'Check'}
            </Button>
          </div>
          <button
            onClick={() => { setShowManual(false); setManualPincode(''); setResult(null); }}
            className="w-full text-sm text-slate-600 hover:text-slate-700 font-semibold py-2"
          >
            ← Back to location detection
          </button>
        </>
      )}

      {result === 'in-range' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-emerald-900">Great! We deliver to your area</div>
            <div className="text-sm text-emerald-700 mt-1">You're {distance?.toFixed(1)} km away from our shop. Order now for fast delivery!</div>
          </div>
        </div>
      )}

      {result === 'out-of-range' && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-rose-900">Outside delivery range</div>
            <div className="text-sm text-rose-700 mt-1">You're {distance?.toFixed(1)} km away. We currently deliver within 10 km. Check back soon!</div>
          </div>
        </div>
      )}

      {result === 'error' && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="text-sm text-amber-800">Unable to detect your location. Please enable location access and try again.</div>
        </div>
      )}
    </div>
  );
};

export default QuickDeliveryCheck;

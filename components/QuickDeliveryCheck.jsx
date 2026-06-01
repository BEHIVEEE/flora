'use client';
import { useState } from 'react';
import { MapPin, Loader, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const QuickDeliveryCheck = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [distance, setDistance] = useState(null);

  const checkDelivery = async () => {
    setLoading(true);
    setResult(null);
    setDistance(null);

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
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
      }
    } catch (error) {
      console.error('Geolocation error:', error);
      if (error.code === 1) {
        toast.error('Location access denied. Please enable location in your browser settings.');
      } else if (error.code === 3) {
        toast.error('Location request timed out. Please try again.');
      } else {
        toast.error('Could not get your location. Please try again.');
      }
      setResult('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-6 space-y-4">
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

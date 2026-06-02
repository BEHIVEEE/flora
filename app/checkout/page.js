'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '@/components/CartProvider';
import { useSettings } from '@/components/SettingsProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ShieldCheck, Truck, Wallet, CreditCard, Smartphone, ChevronRight, MapPin, Lock, Clock, Calendar, Crosshair, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { useDeliveryRange } from '@/hooks/useDeliveryRange';
import AddressAutocomplete from '@/components/AddressAutocomplete';

const CheckoutPage = () => {
  const router = useRouter();
  const { items, subtotal, savings, totalQty, clear, userId } = useCart() || {};
  const { deliveryCharge, freeDeliveryAbove, pickupFee = 0, slotsEnabled } = useSettings();
  const [step, setStep] = useState(1);
  const [address, setAddress] = useState({ name: '', phone: '', email: '', line1: '', line2: '', city: 'Mumbai', state: 'Maharashtra', pincode: '', type: 'Home', lat: null, lng: null });
  const [payment, setPayment] = useState('COD');
  const [placing, setPlacing] = useState(false);
  const [rzpLoaded, setRzpLoaded] = useState(false);
  const [slotDate, setSlotDate] = useState(() => {
    const d = new Date(Date.now() + 86400000); return d.toISOString().slice(0, 10);
  });
  const [slots, setSlots] = useState([]);
  const [slotId, setSlotId] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState('home');
  const { location, loading: locLoading, error: locError, detect, distance, inRange, radiusKm, configured } = useDeliveryRange();

  // PayU is loaded via form submission, no script needed
  useEffect(() => {
    setRzpLoaded(true);
  }, []);
  const homeDeliveryFee = (subtotal || 0) >= freeDeliveryAbove ? 0 : deliveryCharge;
  const pickupCharge = Number(pickupFee) || 0;
  const deliveryFee = deliveryMethod === 'home' ? homeDeliveryFee : pickupCharge;
  const total = (subtotal || 0) + deliveryFee;

  // Auto-fill address from detected location
  useEffect(() => {
    if (location) {
      setAddress(prev => ({
        ...prev,
        line1: location.line1 || prev.line1,
        line2: location.line2 || prev.line2,
        city: location.city || prev.city,
        state: location.state || prev.state,
        pincode: location.pincode || prev.pincode,
        lat: location.lat ?? prev.lat,
        lng: location.lng ?? prev.lng,
      }));
    }
  }, [location]);
  useEffect(() => {
    if (!slotsEnabled) return;
    fetch(`/api/slots/available?date=${slotDate}`).then(r => r.json()).then(d => {
      setSlots(d.slots || []);
      if (!slotId && d.slots?.length) setSlotId(d.slots.find(s => s.available > 0)?.id || '');
    });
  }, [slotDate, slotsEnabled]);

  if (!items || items.length === 0) {
    return (
      <div className="container max-w-3xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-black">Your cart is empty</h1>
        <Link href="/products"><Button className="mt-6 bg-teal-600 hover:bg-teal-700 rounded-full">Shop now</Button></Link>
      </div>
    );
  }

  const validateAddress = () => {
    if (!address.name || !address.phone || !address.line1 || !address.pincode) {
      toast.error('Please fill all required fields');
      return false;
    }
    if (address.phone.length < 10) { toast.error('Enter a valid phone'); return false; }
    if (address.pincode.length < 6) { toast.error('Enter a valid pincode'); return false; }
    return true;
  };

  const orderPayload = () => ({ userId, items, address: deliveryMethod === 'home' ? address : null, payment, subtotal, discount: savings, deliveryFee, total, slotId: deliveryMethod === 'home' && slotsEnabled ? slotId : null, slotDate: deliveryMethod === 'home' && slotsEnabled ? slotDate : null, deliveryMethod });

  const placeOrderCOD = async () => {
    setPlacing(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload()),
      });
      const data = await res.json();
      if (data.order) { clear(); toast.success('Order placed! 🎉'); router.push(`/order-confirmed?id=${data.order.id}`); }
      else toast.error(data.error || 'Failed to place order');
    } catch { toast.error('Network error'); }
    finally { setPlacing(false); }
  };

  const placeOrderPayU = async () => {
    if (!rzpLoaded) { toast.error('Payment gateway loading, please wait…'); return; }
    setPlacing(true);
    try {
      const orderId = `FLC-${Date.now()}`;
      const res = await fetch('/api/payu/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Math.round(total * 100) / 100,
          orderId,
          email: address.email || 'customer@florachemist.online',
          phone: address.phone,
          name: address.name,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Could not initiate payment'); setPlacing(false); return; }

      // Create hidden form and submit to PayU
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = data.payuUrl;
      form.style.display = 'none';

      const fields = {
        key: data.merchantKey,
        txnid: data.orderId,
        amount: data.amount,
        productinfo: `Order · ${items.length} item${items.length > 1 ? 's' : ''}`,
        firstname: data.name,
        email: data.email,
        phone: data.phone,
        hash: data.hash,
        surl: `${window.location.origin}/api/payu/success`,
        furl: `${window.location.origin}/api/payu/failure`,
        udf1: JSON.stringify(orderPayload()),
      };

      Object.keys(fields).forEach(key => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = fields[key];
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();
    } catch { toast.error('Network error'); setPlacing(false); }
  };

  const placeOrder = async () => {
    if (deliveryMethod === 'home') {
      if (!validateAddress()) return;
      if (configured && inRange === false) {
        toast.error(`Sorry, we don't deliver to your location. You're ${distance?.toFixed(1)} km away (max ${radiusKm} km).`);
        return;
      }
      if (slotsEnabled && !slotId) { toast.error('Please choose a delivery slot'); return; }
    }
    if (payment === 'COD') await placeOrderCOD();
    else await placeOrderPayU();
  };

  return (
    <div className="bg-slate-50 min-h-screen pb-32 md:pb-12">
      <div className="container max-w-6xl mx-auto px-4 py-6 md:py-10">
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Checkout</h1>
        <div className="flex items-center gap-2 mt-2 text-xs text-slate-500"><Lock className="w-3 h-3" /> Secure SSL encrypted checkout</div>

        <div className="grid lg:grid-cols-[1fr_360px] gap-5 mt-6">
          <div className="space-y-4">
            {/* Delivery Method */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="font-bold text-slate-900 mb-4">How would you like to receive your order?</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <button
                  onClick={() => setDeliveryMethod('home')}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${deliveryMethod === 'home' ? 'border-teal-500 bg-teal-50/60 ring-2 ring-teal-100' : 'border-slate-200 hover:border-teal-300 bg-white'}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Truck className={`w-5 h-5 ${deliveryMethod === 'home' ? 'text-teal-700' : 'text-slate-500'}`} />
                    <div className="font-bold text-slate-900">Home Delivery</div>
                  </div>
                  <div className="text-xs text-slate-500">Get it delivered to your doorstep</div>
                </button>
                <button
                  onClick={() => setDeliveryMethod('pickup')}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${deliveryMethod === 'pickup' ? 'border-teal-500 bg-teal-50/60 ring-2 ring-teal-100' : 'border-slate-200 hover:border-teal-300 bg-white'}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <ShieldCheck className={`w-5 h-5 ${deliveryMethod === 'pickup' ? 'text-teal-700' : 'text-slate-500'}`} />
                    <div className="font-bold text-slate-900">Store Pickup</div>
                  </div>
                  <div className="text-xs text-slate-500">Pick up from our store</div>
                </button>
              </div>
            </div>

            {/* Step 1: address (only for home delivery) */}
            {deliveryMethod === 'home' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2"><div className="w-7 h-7 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-sm">1</div><h3 className="font-bold text-slate-900">Delivery Address</h3></div>
                <Button type="button" variant="outline" size="sm" onClick={detect} disabled={locLoading} className="rounded-full text-xs font-semibold">
                  <Crosshair className={`w-3.5 h-3.5 mr-1 ${locLoading ? 'animate-spin' : ''}`} />
                  {locLoading ? 'Detecting…' : 'Use my location'}
                </Button>
              </div>
              {locError && <p className="text-xs text-rose-600 mb-2">{locError}</p>}
              {location?.displayName && !locError && <p className="text-xs text-teal-700 mb-2 flex items-center gap-1"><MapPin className="w-3 h-3" /> {location.displayName.slice(0, 80)}…</p>}
              {configured && distance != null && (
                inRange ? (
                  <div className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mb-3 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" /> You are {distance.toFixed(1)} km away — within our {radiusKm} km delivery range.
                  </div>
                ) : (
                  <div className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 mb-3">
                    Sorry — your location is {distance.toFixed(1)} km away. We only deliver within {radiusKm} km of our shop.
                  </div>
                )
              )}
              <div className="grid md:grid-cols-2 gap-3">
                <Field label="Full Name *" value={address.name} onChange={v => setAddress({ ...address, name: v })} />
                <Field label="Phone *" value={address.phone} onChange={v => setAddress({ ...address, phone: v.replace(/\D/g, '').slice(0, 10) })} />
                <Field className="md:col-span-2" label="Email" value={address.email} onChange={v => setAddress({ ...address, email: v })} />
                <AddressAutocomplete
                  className="md:col-span-2"
                  label="Address Line 1 *"
                  value={address.line1}
                  onChange={v => setAddress({ ...address, line1: v })}
                  biasLat={location?.lat}
                  biasLng={location?.lng}
                  onPick={(p) => setAddress(prev => ({
                    ...prev,
                    line1: p.line1 || prev.line1,
                    line2: p.line2 || prev.line2,
                    city: p.city || prev.city,
                    state: p.state || prev.state,
                    pincode: p.pincode || prev.pincode,
                    lat: p.lat ?? prev.lat,
                    lng: p.lng ?? prev.lng,
                  }))}
                />
                <Field className="md:col-span-2" label="Address Line 2 (Optional)" value={address.line2} onChange={v => setAddress({ ...address, line2: v })} />
                <Field label="City *" value={address.city} onChange={v => setAddress({ ...address, city: v })} />
                <Field label="State *" value={address.state} onChange={v => setAddress({ ...address, state: v })} />
                <Field label="Pincode *" value={address.pincode} onChange={v => setAddress({ ...address, pincode: v.replace(/\D/g, '').slice(0, 6) })} />
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Address Type</Label>
                  <div className="flex gap-2 mt-1.5">
                    {['Home', 'Work', 'Other'].map(t => (
                      <button key={t} onClick={() => setAddress({ ...address, type: t })} className={`px-4 py-2 rounded-full text-sm font-semibold border ${address.type === t ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-slate-700 border-slate-200'}`}>{t}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            )}

            {/* Step 2: delivery slot */}
            {deliveryMethod === 'home' && slotsEnabled && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="flex items-center gap-2 mb-4"><div className="w-7 h-7 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-sm">2</div><h3 className="font-bold text-slate-900">Choose Delivery Slot</h3></div>
                <div className="mb-4">
                  <Label className="text-xs font-semibold text-slate-700">Delivery date</Label>
                  <div className="flex gap-2 mt-2 overflow-x-auto scrollbar-hide">
                    {Array(7).fill(0).map((_, i) => {
                      const d = new Date(Date.now() + (i + 1) * 86400000);
                      const iso = d.toISOString().slice(0, 10);
                      const active = slotDate === iso;
                      return (
                        <button key={iso} type="button" onClick={() => setSlotDate(iso)} className={`shrink-0 min-w-[78px] px-3 py-2.5 rounded-xl border text-center transition-all ${active ? 'bg-teal-600 text-white border-teal-600 shadow-lift' : 'bg-white border-slate-200 hover:border-teal-300'}`}>
                          <div className={`text-[10px] font-bold uppercase ${active ? 'text-teal-50' : 'text-slate-500'}`}>{d.toLocaleDateString('en-IN', { weekday: 'short' })}</div>
                          <div className={`text-lg font-black leading-none mt-0.5 ${active ? 'text-white' : 'text-slate-900'}`}>{d.getDate()}</div>
                          <div className={`text-[10px] ${active ? 'text-teal-50' : 'text-slate-500'}`}>{d.toLocaleDateString('en-IN', { month: 'short' })}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-2">
                  {slots.length === 0 && <div className="col-span-2 text-sm text-slate-500 text-center p-4">No slots configured. Contact support.</div>}
                  {slots.map(s => {
                    const full = s.available <= 0;
                    const sel = slotId === s.id;
                    return (
                      <button key={s.id} type="button" disabled={full} onClick={() => setSlotId(s.id)} className={`text-left p-3 rounded-xl border-2 transition-all ${full ? 'border-slate-200 bg-slate-50 opacity-50 cursor-not-allowed' : sel ? 'border-teal-500 bg-teal-50/60 ring-2 ring-teal-100' : 'border-slate-200 hover:border-teal-300 bg-white'}`}>
                        <div className="flex items-center gap-2"><Clock className={`w-4 h-4 ${sel ? 'text-teal-700' : 'text-slate-500'}`} /><div className="font-bold text-slate-900 text-sm">{s.startTime} – {s.endTime}</div></div>
                        <div className="flex items-center justify-between mt-1">
                          <div className="text-xs text-slate-500">{s.label}</div>
                          <div className={`text-[11px] font-bold ${full ? 'text-rose-600' : s.available <= 3 ? 'text-amber-600' : 'text-emerald-600'}`}>{full ? 'Full' : `${s.available} left`}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Store Pickup Info */}
            {deliveryMethod === 'pickup' && (
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200 p-5">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-bold text-emerald-900 mb-2">Store Pickup Details</h3>
                    <div className="space-y-1 text-sm text-emerald-800">
                      <p>📍 <strong>Location:</strong> Thane, Maharashtra</p>
                      <p>🕐 <strong>Hours:</strong> 9:00 AM - 9:00 PM (Daily)</p>
                      <p>✅ <strong>Ready in:</strong> 2-4 hours after order confirmation</p>
                    </div>
                    <p className="text-xs text-emerald-700 mt-3">Please bring a valid ID and order confirmation when picking up.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2/3: payment */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-4"><div className="w-7 h-7 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-sm">{deliveryMethod === 'home' && slotsEnabled ? 3 : 2}</div><h3 className="font-bold text-slate-900">Payment Method</h3></div>
              <RadioGroup value={payment} onValueChange={setPayment} className="space-y-2">
                {[
                  { id: 'UPI', label: 'UPI', sub: 'GPay, PhonePe, Paytm, BHIM', icon: Smartphone, badge: 'Instant' },
                  { id: 'COD', label: 'Cash on Delivery', sub: 'Pay when you receive your order', icon: Truck, badge: 'No charges' },
                ].map(opt => (
                  <label key={opt.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${payment === opt.id ? 'border-teal-500 bg-teal-50/50 ring-2 ring-teal-100' : 'border-slate-200 hover:border-slate-300'}`}>
                    <RadioGroupItem value={opt.id} id={opt.id} className="shrink-0" />
                    <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0"><opt.icon className="w-5 h-5" /></div>
                    <div className="flex-1">
                      <div className="font-semibold text-slate-900 text-sm flex items-center gap-2">{opt.label} {opt.badge && <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-1.5 py-0.5 rounded">{opt.badge}</span>}</div>
                      <div className="text-xs text-slate-500">{opt.sub}</div>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </div>
          </div>

          {/* Summary */}
          <aside className="lg:sticky lg:top-32 self-start">
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="font-bold text-slate-900 mb-3">Order Summary</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto mb-3 pr-1">
                {items.map(i => (
                  <div key={i.id} className="flex items-center gap-2 text-sm">
                    <div className="w-10 h-10 bg-slate-50 rounded-md overflow-hidden shrink-0"><img src={i.image} alt={i.name} className="w-full h-full object-cover" /></div>
                    <div className="flex-1 min-w-0"><div className="truncate text-slate-800 text-xs font-medium">{i.name}</div><div className="text-[11px] text-slate-500">Qty {i.qty}</div></div>
                    <div className="font-semibold text-sm">₹{i.price * i.qty}</div>
                  </div>
                ))}
              </div>
              <div className="space-y-2 text-sm border-t border-slate-100 pt-3">
                <Row k={`Subtotal (${totalQty})`} v={`₹${subtotal}`} />
                <Row k="Savings" v={`- ₹${savings}`} good />
                <Row k={deliveryMethod === 'home' ? 'Delivery' : 'Pickup Fee'} v={deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`} good={deliveryFee === 0} />
                <div className="border-t border-slate-100 my-2" />
                <div className="flex items-center justify-between font-black text-base"><span>Total</span><span>₹{total}</span></div>
              </div>
              <Button onClick={() => placeOrder()} disabled={placing || (deliveryMethod === 'home' && configured && inRange === false)} className="hidden md:flex w-full mt-5 bg-teal-600 hover:bg-teal-700 text-white h-12 rounded-full font-bold shadow-lift">{placing ? 'Placing order…' : (deliveryMethod === 'home' && configured && inRange === false) ? 'Out of delivery range' : `Place Order · ₹${total}`}</Button>
              <div className="mt-4 text-[11px] text-slate-500 flex items-center justify-center gap-1.5"><ShieldCheck className="w-3 h-3 text-emerald-600" /> 100% secure · Easy returns · Authentic products</div>
            </div>
          </aside>
        </div>
      </div>

      <div className="md:hidden fixed bottom-16 left-0 right-0 z-30 bg-white border-t border-slate-200 p-3">
        <Button onClick={() => placeOrder()} disabled={placing || (deliveryMethod === 'home' && configured && inRange === false)} className="w-full bg-teal-600 hover:bg-teal-700 text-white h-12 rounded-full font-bold">{placing ? 'Placing order…' : (deliveryMethod === 'home' && configured && inRange === false) ? 'Out of delivery range' : `Place Order · ₹${total}`}</Button>
      </div>
    </div>
  );
};

const Field = ({ label, value, onChange, className = '' }) => (
  <div className={className}>
    <Label className="text-xs font-semibold text-slate-700">{label}</Label>
    <Input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1.5 h-11 rounded-xl bg-white" />
  </div>
);

const Row = ({ k, v, good }) => (
  <div className="flex items-center justify-between">
    <span className="text-slate-600">{k}</span>
    <span className={`font-semibold ${good ? 'text-emerald-600' : 'text-slate-900'}`}>{v}</span>
  </div>
);

export default CheckoutPage;

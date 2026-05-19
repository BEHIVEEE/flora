'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Phone, MapPin, Navigation, Package, CheckCircle2, Truck, Home, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const statusColors = {
  Confirmed: 'bg-blue-100 text-blue-800',
  'Out for Delivery': 'bg-violet-100 text-violet-800',
  Delivered: 'bg-emerald-100 text-emerald-800',
  Cancelled: 'bg-rose-100 text-rose-700',
};

const RiderOrderDetail = () => {
  const { id } = useParams();
  const router = useRouter();
  const [order, setOrder] = useState(null);
  const [updating, setUpdating] = useState(false);

  const load = async () => {
    const token = localStorage.getItem('cs_token');
    if (!token) { router.push('/rider/login'); return; }
    const res = await fetch(`/api/orders/${id}`);
    const d = await res.json();
    if (!d.order) { toast.error('Order not found'); router.push('/rider'); return; }
    setOrder(d.order);
  };

  useEffect(() => { load(); }, [id]);

  const updateStatus = async (status) => {
    const token = localStorage.getItem('cs_token');
    if (!token) { router.push('/rider/login'); return; }
    setUpdating(true);
    const res = await fetch(`/api/orders/${id}/rider-status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ status }),
    });
    const d = await res.json();
    if (d.ok) {
      toast.success(`Marked as ${status}`);
      setOrder(d.order);
    } else {
      toast.error(d.error || 'Failed to update');
    }
    setUpdating(false);
  };

  if (!order) return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading…</div>;

  const addr = order.address || {};
  const fullAddress = `${addr.line1 || ''}, ${addr.line2 ? addr.line2 + ', ' : ''}${addr.city || ''}, ${addr.state || ''} - ${addr.pincode || ''}`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
  const callUrl = addr.phone ? `tel:${addr.phone}` : '#';

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-2">
          <Link href="/rider"><Button variant="ghost" size="icon" className="rounded-full"><ChevronLeft className="w-5 h-5" /></Button></Link>
          <div className="flex-1 min-w-0">
            <div className="font-black text-slate-900 truncate">{order.id}</div>
            <div className="text-xs text-slate-500">{new Date(order.createdAt).toLocaleString('en-IN')}</div>
          </div>
          <span className={`text-[11px] font-bold px-2 py-1 rounded-md ${statusColors[order.status] || 'bg-slate-100 text-slate-700'}`}>{order.status}</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        {/* Customer info */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-900">Customer</h3>
            <div className="flex gap-2">
              <a href={callUrl} className="px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1"><Phone className="w-3 h-3" /> Call</a>
              <a href={mapsUrl} target="_blank" rel="noopener" className="px-3 py-1.5 rounded-full bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-1"><Navigation className="w-3 h-3" /> Navigate</a>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="font-bold text-slate-900">{addr.name}</div>
            <div className="flex items-start gap-2 text-slate-600"><MapPin className="w-4 h-4 text-teal-600 mt-0.5 shrink-0" /><div>{fullAddress}</div></div>
            <div className="flex items-center gap-2 text-slate-600"><Phone className="w-4 h-4 text-teal-600" /> {addr.phone}</div>
            <div className="flex items-center gap-2 text-slate-600"><CreditCard className="w-4 h-4 text-teal-600" /> Payment: <span className="font-bold text-slate-900">{order.payment}</span></div>
          </div>
        </div>

        {/* COD note */}
        {order.payment === 'COD' && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center font-black">₹</div>
            <div className="flex-1">
              <div className="font-bold text-slate-900">Collect ₹{order.total} on delivery</div>
              <div className="text-xs text-slate-500">Cash on Delivery order</div>
            </div>
          </div>
        )}

        {/* Items */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-100"><h3 className="font-bold text-slate-900">Items ({order.items?.length})</h3></div>
          <div className="divide-y divide-slate-100">
            {order.items?.map(i => (
              <div key={i.id} className="p-3 flex items-center gap-3">
                <div className="w-12 h-12 bg-slate-50 rounded-lg overflow-hidden shrink-0"><img src={i.image} alt={i.name} className="w-full h-full object-cover" /></div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-900 text-sm line-clamp-1">{i.name}</div>
                  <div className="text-xs text-slate-500">{i.brand} · Qty {i.qty}</div>
                </div>
                <div className="font-bold text-slate-900 text-sm">₹{i.price * i.qty}</div>
              </div>
            ))}
          </div>
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <span className="font-semibold text-slate-700">Total</span>
            <span className="font-black text-slate-900 text-lg">₹{order.total}</span>
          </div>
        </div>

        {/* Tracking */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="font-bold text-slate-900">Tracking</h3>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {order.trackingSteps?.map((s, i) => {
              const Ic = [CheckCircle2, Package, Truck, Home][i] || CheckCircle2;
              return (
                <div key={i} className={`text-center ${s.done ? 'text-emerald-600' : 'text-slate-300'}`}>
                  <div className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center ${s.done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100'}`}><Ic className="w-5 h-5" /></div>
                  <div className="text-[10px] font-semibold mt-1.5">{s.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sticky action bar */}
      {order.status !== 'Delivered' && order.status !== 'Cancelled' && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3 z-20">
          <div className="max-w-3xl mx-auto">
            {order.status === 'Out for Delivery' ? (
              <Button onClick={() => updateStatus('Delivered')} disabled={updating} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 rounded-full font-bold text-base">
                <CheckCircle2 className="w-5 h-5 mr-1" /> {updating ? 'Updating…' : 'Mark as Delivered'}
              </Button>
            ) : (
              <Button onClick={() => updateStatus('Out for Delivery')} disabled={updating} className="w-full bg-teal-600 hover:bg-teal-700 text-white h-12 rounded-full font-bold text-base">
                <Truck className="w-5 h-5 mr-1" /> {updating ? 'Updating…' : 'Start Delivery'}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RiderOrderDetail;

'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Phone, MapPin, Calendar, CreditCard, CheckCircle2, Truck, Package, Home, Clock, Bike } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const statusColors = {
  Pending: 'bg-amber-100 text-amber-800',
  Confirmed: 'bg-blue-100 text-blue-800',
  'Out for Delivery': 'bg-violet-100 text-violet-800',
  Delivered: 'bg-emerald-100 text-emerald-800',
  Cancelled: 'bg-rose-100 text-rose-700',
};

const OrderDetail = () => {
  const { id } = useParams();
  const router = useRouter();
  const [order, setOrder] = useState(null);
  const [slots, setSlots] = useState([]);
  const [riders, setRiders] = useState([]);
  const [selectedRider, setSelectedRider] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => fetch(`/api/orders/${id}`).then(r => r.json()).then(d => {
    setOrder(d.order);
    if (d.order?.riderId) setSelectedRider(d.order.riderId);
  });
  useEffect(() => {
    load();
    fetch('/api/slots').then(r => r.json()).then(d => setSlots(d.slots || []));
    fetch('/api/riders').then(r => r.json()).then(d => setRiders(d.riders || []));
  }, [id]);

  const setStatus = async (status) => {
    setSaving(true);
    await fetch(`/api/orders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    toast.success(`Status updated to ${status}`);
    setSaving(false);
    load();
  };

  const assignRider = async () => {
    if (!selectedRider) { toast.error('Select a rider'); return; }
    setSaving(true);
    const res = await fetch(`/api/orders/${id}/assign`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (localStorage.getItem('cs_token') || '') },
      body: JSON.stringify({ riderId: selectedRider }),
    });
    const d = await res.json();
    if (d.ok) { toast.success('Rider assigned'); load(); }
    else toast.error(d.error || 'Failed');
    setSaving(false);
  };

  if (!order) return <div className="space-y-3"><div className="h-8 w-1/3 skeleton rounded" /><div className="h-96 skeleton rounded-2xl" /></div>;

  const slot = slots.find(s => s.id === order.slotId);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/admin/orders"><Button variant="ghost" size="icon" className="rounded-full"><ChevronLeft className="w-5 h-5" /></Button></Link>
        <div className="flex-1">
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Order {order.id}</h1>
          <p className="text-slate-500 text-sm">Placed {new Date(order.createdAt).toLocaleString('en-IN')}</p>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-md ${statusColors[order.status] || 'bg-slate-100 text-slate-700'}`}>{order.status}</span>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* Items */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-100"><h3 className="font-bold text-slate-900">Items ({order.items?.length})</h3></div>
            <div className="divide-y divide-slate-100">
              {order.items?.map(i => (
                <div key={i.id} className="p-4 flex items-center gap-4">
                  <div className="w-14 h-14 bg-slate-50 rounded-lg overflow-hidden shrink-0"><img src={i.image} alt={i.name} className="w-full h-full object-cover" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-900 line-clamp-1">{i.name}</div>
                    <div className="text-xs text-slate-500">{i.brand} · {i.packSize}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-slate-900">₹{i.price * i.qty}</div>
                    <div className="text-xs text-slate-500">Qty {i.qty} × ₹{i.price}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-5 bg-slate-50 border-t border-slate-100">
              <div className="max-w-xs ml-auto space-y-1.5 text-sm">
                <Row k="Subtotal" v={`₹${order.subtotal}`} />
                <Row k="Delivery" v={order.deliveryFee === 0 ? 'FREE' : `₹${order.deliveryFee}`} />
                {order.discount > 0 && <Row k="Discount" v={`- ₹${order.discount}`} good />}
                <div className="border-t border-slate-200 pt-1.5 flex items-center justify-between font-black text-base"><span>Total</span><span>₹{order.total}</span></div>
              </div>
            </div>
          </div>

          {/* Tracking */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h3 className="font-bold text-slate-900">Tracking</h3>
            <div className="mt-4 grid grid-cols-4 gap-2">
              {order.trackingSteps?.map((s, i) => {
                const Ic = [CheckCircle2, Package, Truck, Home][i] || CheckCircle2;
                return (
                  <div key={i} className={`text-center ${s.done ? 'text-emerald-600' : 'text-slate-300'}`}>
                    <div className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center ${s.done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100'}`}><Ic className="w-5 h-5" /></div>
                    <div className="text-[11px] font-semibold mt-1.5">{s.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          {/* Update Status */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h3 className="font-bold text-slate-900">Update Status</h3>
            <Select value={order.status} onValueChange={setStatus}>
              <SelectTrigger className="mt-3 h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Confirmed">Confirmed</SelectItem>
                <SelectItem value="Out for Delivery">Out for Delivery</SelectItem>
                <SelectItem value="Delivered">Delivered</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <div className="mt-2 text-xs text-slate-500">{saving ? 'Updating…' : 'Changes apply immediately'}</div>
          </div>

          {/* Rider Assignment */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h3 className="font-bold text-slate-900 flex items-center gap-2"><Bike className="w-4 h-4 text-teal-600" /> Delivery Rider</h3>
            {order.riderId ? (
              <div className="mt-3">
                <div className="font-semibold text-slate-900">{order.riderName || riders.find(r => r.id === order.riderId)?.name || 'Rider'}</div>
                <div className="text-xs text-slate-500">Assigned {order.riderAssignedAt ? new Date(order.riderAssignedAt).toLocaleString('en-IN') : ''}</div>
              </div>
            ) : (
              <div className="text-xs text-slate-500 mt-1">No rider assigned</div>
            )}
            <div className="mt-3 space-y-2">
              <Select value={selectedRider} onValueChange={setSelectedRider}>
                <SelectTrigger className="h-10 rounded-xl bg-white"><SelectValue placeholder="Select rider…" /></SelectTrigger>
                <SelectContent>
                  {riders.filter(r => r.status === 'active').map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.name} {r.vehicleNumber ? `(${r.vehicleNumber})` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={assignRider} disabled={saving || !selectedRider} className="w-full bg-teal-600 hover:bg-teal-700 rounded-full text-sm font-semibold">
                {saving ? 'Assigning…' : 'Assign Rider'}
              </Button>
            </div>
          </div>

          {/* Customer */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h3 className="font-bold text-slate-900">Customer & Delivery</h3>
            <div className="mt-3 space-y-3 text-sm">
              <div className="flex items-start gap-2"><MapPin className="w-4 h-4 text-teal-600 mt-0.5" /><div><div className="font-semibold text-slate-900">{order.address?.name}</div><div className="text-slate-600 text-xs">{order.address?.line1}, {order.address?.city}, {order.address?.state} - {order.address?.pincode}</div></div></div>
              <div className="flex items-center gap-2 text-slate-700"><Phone className="w-4 h-4 text-teal-600" /> {order.address?.phone}</div>
              <div className="flex items-center gap-2 text-slate-700"><CreditCard className="w-4 h-4 text-teal-600" /> Payment: <span className="font-semibold">{order.payment}</span></div>
              {slot && <div className="flex items-center gap-2 text-slate-700"><Clock className="w-4 h-4 text-teal-600" /> Slot: <span className="font-semibold">{slot.label}</span> {order.slotDate && <span className="text-xs text-slate-500">({order.slotDate})</span>}</div>}
              {!slot && <div className="flex items-center gap-2 text-slate-500 text-xs"><Clock className="w-4 h-4" /> No delivery slot assigned</div>}
              <div className="flex items-center gap-2 text-slate-700"><Calendar className="w-4 h-4 text-teal-600" /> Estimated: {new Date(order.estimatedDelivery).toDateString()}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Row = ({ k, v, good }) => (
  <div className="flex items-center justify-between"><span className="text-slate-600">{k}</span><span className={`font-semibold ${good ? 'text-emerald-600' : 'text-slate-900'}`}>{v}</span></div>
);

export default OrderDetail;

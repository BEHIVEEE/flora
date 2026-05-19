'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Bike, LogOut, Phone, MapPin, Package, Clock, CheckCircle2, Truck, ChevronRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const statusColors = {
  Confirmed: 'bg-blue-100 text-blue-800',
  'Out for Delivery': 'bg-violet-100 text-violet-800',
  Delivered: 'bg-emerald-100 text-emerald-800',
  Cancelled: 'bg-rose-100 text-rose-700',
};

const RiderDashboard = () => {
  const router = useRouter();
  const [rider, setRider] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('active');

  const load = async () => {
    const token = localStorage.getItem('cs_token');
    if (!token) { router.push('/rider/login'); return; }
    const res = await fetch('/api/rider/orders', { headers: { Authorization: 'Bearer ' + token } });
    if (res.status === 401 || res.status === 403) { router.push('/rider/login'); return; }
    const d = await res.json();
    setOrders(d.orders || []);
    setLoading(false);
  };

  useEffect(() => {
    const stored = localStorage.getItem('cs_rider');
    if (stored) setRider(JSON.parse(stored));
    else { router.push('/rider/login'); return; }
    load();
    // Auto-refresh every 30 seconds
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  const logout = () => {
    localStorage.removeItem('cs_token');
    localStorage.removeItem('cs_rider');
    router.push('/rider/login');
  };

  const active = orders.filter(o => !['Delivered', 'Cancelled'].includes(o.status));
  const completed = orders.filter(o => ['Delivered', 'Cancelled'].includes(o.status));
  const list = tab === 'active' ? active : completed;

  const todayDelivered = orders.filter(o => {
    if (o.status !== 'Delivered' || !o.deliveryCompletedAt) return false;
    const d = new Date(o.deliveryCompletedAt);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return d >= today;
  }).length;

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-teal-600 to-emerald-600 text-white">
        <div className="max-w-3xl mx-auto px-4 py-5 flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center"><Bike className="w-5 h-5" /></div>
          <div className="flex-1 min-w-0">
            <div className="text-xs opacity-80 leading-none">Welcome back</div>
            <div className="font-black text-lg leading-tight truncate">{rider?.name || 'Rider'}</div>
            <div className="text-[11px] opacity-80">{rider?.vehicleNumber || rider?.phone || ''}</div>
          </div>
          <Button onClick={logout} variant="ghost" size="icon" className="text-white hover:bg-white/10 rounded-full"><LogOut className="w-5 h-5" /></Button>
        </div>
        {/* Stats */}
        <div className="max-w-3xl mx-auto px-4 pb-5 grid grid-cols-3 gap-2">
          <Stat label="Active" value={active.length} />
          <Stat label="Today Done" value={todayDelivered} />
          <Stat label="Total" value={orders.length} />
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-4">
        {/* Tabs */}
        <div className="flex items-center justify-between mb-4 gap-2">
          <div className="bg-white border border-slate-200 rounded-full p-1 inline-flex">
            <button onClick={() => setTab('active')} className={`px-4 py-1.5 rounded-full text-sm font-bold ${tab === 'active' ? 'bg-teal-600 text-white' : 'text-slate-600'}`}>Active ({active.length})</button>
            <button onClick={() => setTab('completed')} className={`px-4 py-1.5 rounded-full text-sm font-bold ${tab === 'completed' ? 'bg-teal-600 text-white' : 'text-slate-600'}`}>Completed ({completed.length})</button>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
            <Button onClick={load} variant="outline" size="sm" className="rounded-full"><RefreshCw className="w-3.5 h-3.5" /></Button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-28 skeleton rounded-2xl" />)}</div>
        ) : list.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <div className="font-bold text-slate-900">No {tab} orders</div>
            <p className="text-sm text-slate-500 mt-1">{tab === 'active' ? 'New assignments will appear here' : 'Completed deliveries will show here'}</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {list.map(o => (
              <Link key={o.id} href={`/rider/orders/${o.id}`} className="block bg-white rounded-2xl border border-slate-200 p-4 hover:border-teal-300 hover:shadow-soft transition-all">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="font-bold text-slate-900 text-sm">{o.id.slice(0, 16)}…</div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${statusColors[o.status] || 'bg-slate-100 text-slate-700'}`}>{o.status}</span>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-teal-600 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-900 truncate">{o.address?.name}</div>
                    <div className="text-xs text-slate-500 line-clamp-2">{o.address?.line1}, {o.address?.city} - {o.address?.pincode}</div>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {o.address?.phone}</span>
                    <span className="flex items-center gap-1"><Package className="w-3 h-3" /> {o.items?.length} items</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-slate-900 text-sm">₹{o.total}</span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase">{o.payment}</span>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const Stat = ({ label, value }) => (
  <div className="bg-white/10 rounded-xl p-3 text-center">
    <div className="text-2xl font-black leading-none">{value}</div>
    <div className="text-[10px] uppercase tracking-wider opacity-80 mt-1">{label}</div>
  </div>
);

export default RiderDashboard;

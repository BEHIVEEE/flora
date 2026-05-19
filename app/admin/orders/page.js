'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, Eye, Filter, ShoppingBag, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const STATUSES = ['all', 'Pending', 'Confirmed', 'Out for Delivery', 'Delivered', 'Cancelled'];
const statusColors = {
  Pending: 'bg-amber-100 text-amber-800',
  Confirmed: 'bg-blue-100 text-blue-800',
  'Out for Delivery': 'bg-violet-100 text-violet-800',
  Delivered: 'bg-emerald-100 text-emerald-800',
  Cancelled: 'bg-rose-100 text-rose-700',
};

const Orders = () => {
  const [orders, setOrders] = useState(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');

  const load = () => {
    setOrders(null);
    const params = new URLSearchParams();
    if (status !== 'all') params.set('status', status);
    if (search) params.set('search', search);
    fetch(`/api/admin/orders?${params.toString()}`).then(r => r.json()).then(d => setOrders(d.orders || []));
  };
  useEffect(() => { load(); }, [status]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [search]);

  const totals = orders ? {
    count: orders.length,
    revenue: orders.reduce((s, o) => s + (o.total || 0), 0),
    pending: orders.filter(o => o.status === 'Pending').length,
  } : { count: 0, revenue: 0, pending: 0 };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Orders</h1>
          <p className="text-slate-500 text-sm mt-0.5">{orders ? `${totals.count} orders · ₹${totals.revenue.toLocaleString('en-IN')} total · ${totals.pending} pending` : 'Loading…'}</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by order ID, customer name or phone…" className="pl-9 h-10 rounded-xl" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[180px] h-10 rounded-xl"><Filter className="w-4 h-4 mr-1.5 text-slate-500" /><SelectValue /></SelectTrigger>
          <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s === 'all' ? 'All Statuses' : s}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-5 py-3 font-semibold">Order ID</th>
                <th className="text-left px-5 py-3 font-semibold">Date</th>
                <th className="text-left px-5 py-3 font-semibold">Customer</th>
                <th className="text-left px-5 py-3 font-semibold">Items</th>
                <th className="text-left px-5 py-3 font-semibold">Total</th>
                <th className="text-left px-5 py-3 font-semibold">Payment</th>
                <th className="text-left px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!orders && Array(8).fill(0).map((_, i) => <tr key={i}><td colSpan={8} className="px-5 py-4"><div className="h-8 skeleton rounded" /></td></tr>)}
              {orders?.length === 0 && (
                <tr><td colSpan={8} className="px-5 py-16 text-center text-slate-500">
                  <ShoppingBag className="w-10 h-10 mx-auto text-slate-300" />
                  <div className="mt-2 font-semibold text-slate-700">No orders found</div>
                </td></tr>
              )}
              {orders?.map(o => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-bold text-slate-900 text-xs">{o.id.slice(0, 18)}…</td>
                  <td className="px-5 py-3 text-slate-700 text-xs">{new Date(o.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}<div className="text-[10px] text-slate-500">{new Date(o.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div></td>
                  <td className="px-5 py-3">
                    <div className="font-semibold text-slate-900">{o.address?.name || 'Guest'}</div>
                    <div className="text-xs text-slate-500">{o.address?.phone}</div>
                  </td>
                  <td className="px-5 py-3 text-slate-700">{o.items?.length || 0}</td>
                  <td className="px-5 py-3 font-bold text-slate-900">₹{o.total?.toLocaleString('en-IN')}</td>
                  <td className="px-5 py-3"><span className="text-[11px] bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded">{o.payment}</span></td>
                  <td className="px-5 py-3"><span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${statusColors[o.status] || 'bg-slate-100 text-slate-700'}`}>{o.status}</span></td>
                  <td className="px-5 py-3 text-right">
                    <Link href={`/admin/orders/${o.id}`}><Button size="sm" variant="ghost" className="h-8 px-2 text-slate-600 hover:text-teal-700"><Eye className="w-4 h-4" /></Button></Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Orders;

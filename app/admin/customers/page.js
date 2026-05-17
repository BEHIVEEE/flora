'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, TrendingUp, Repeat, Crown, Phone, MapPin, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import StatCard from '@/components/admin/StatCard';

const segColors = {
  New: 'bg-slate-100 text-slate-700',
  Returning: 'bg-blue-100 text-blue-800',
  Loyal: 'bg-violet-100 text-violet-800',
  VIP: 'bg-amber-100 text-amber-800',
};

const Customers = () => {
  const [data, setData] = useState(null);
  const [q, setQ] = useState('');
  const [seg, setSeg] = useState('all');

  useEffect(() => { fetch('/api/admin/customers').then(r => r.json()).then(setData); }, []);
  if (!data) return <div className="space-y-3"><div className="h-8 w-1/3 skeleton rounded" /><div className="h-96 skeleton rounded-2xl" /></div>;

  const filtered = data.customers.filter(c => {
    if (seg !== 'all' && c.segment !== seg) return false;
    if (q && !(c.name.toLowerCase().includes(q.toLowerCase()) || c.phone.includes(q))) return false;
    return true;
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Customers</h1>
        <p className="text-slate-500 text-sm mt-0.5">Top customers, lifetime value & retention.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard icon={Users} label="Total Customers" value={data.summary.total} sub={`Avg ${data.summary.avgOrderCount} orders each`} accent="teal" />
        <StatCard icon={TrendingUp} label="Avg Lifetime Value" value={`₹${data.summary.avgLTV.toLocaleString('en-IN')}`} sub={`₹${data.summary.totalLTV.toLocaleString('en-IN')} total`} accent="emerald" />
        <StatCard icon={Repeat} label="Retention Rate" value={`${data.summary.retentionRate}%`} sub="customers with 2+ orders" accent="violet" />
        <StatCard icon={Crown} label="VIP Customers" value={data.summary.segments.VIP} sub={`${data.summary.segments.Loyal} loyal · ${data.summary.segments.Returning} returning`} accent="amber" />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or phone…" className="pl-9 h-10 rounded-xl" />
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          {['all', 'VIP', 'Loyal', 'Returning', 'New'].map(s => (
            <button key={s} onClick={() => setSeg(s)} className={`px-3 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap border ${seg === s ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'}`}>{s === 'all' ? 'All Segments' : s}{s !== 'all' && data.summary.segments[s] !== undefined && <span className="ml-1 opacity-70">({data.summary.segments[s]})</span>}</button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-5 py-3 font-semibold">Customer</th>
                <th className="text-left px-5 py-3 font-semibold">Segment</th>
                <th className="text-left px-5 py-3 font-semibold">Orders</th>
                <th className="text-left px-5 py-3 font-semibold">Lifetime Spend</th>
                <th className="text-left px-5 py-3 font-semibold">Avg Order</th>
                <th className="text-left px-5 py-3 font-semibold">Last Order</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 && <tr><td colSpan={6} className="px-5 py-16 text-center text-slate-500"><Users className="w-10 h-10 mx-auto text-slate-300" /><div className="mt-2 font-semibold text-slate-700">No customers found</div></td></tr>}
              {filtered.map(c => (
                <tr key={c.phone} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-emerald-500 text-white font-bold flex items-center justify-center">{c.name[0]?.toUpperCase()}</div>
                      <div>
                        <div className="font-semibold text-slate-900">{c.name}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-2"><Phone className="w-3 h-3" /> {c.phone} {c.city && <><MapPin className="w-3 h-3 ml-1" /> {c.city}</>}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3"><span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${segColors[c.segment] || 'bg-slate-100'}`}>{c.segment}</span></td>
                  <td className="px-5 py-3 font-bold text-slate-900">{c.orderCount}</td>
                  <td className="px-5 py-3 font-bold text-slate-900">₹{c.totalSpent.toLocaleString('en-IN')}</td>
                  <td className="px-5 py-3 text-slate-700">₹{c.avgOrderValue.toLocaleString('en-IN')}</td>
                  <td className="px-5 py-3 text-xs text-slate-700">{new Date(c.lastOrderDate).toLocaleDateString('en-IN')}<div className="text-[11px] text-slate-500">{c.daysSinceLast === 0 ? 'Today' : `${c.daysSinceLast}d ago`}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Customers;

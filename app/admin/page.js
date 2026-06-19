'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { IndianRupee, ShoppingBag, Package, AlertTriangle, TrendingUp, Clock, Eye, ArrowUpRight, Boxes, ImageOff } from 'lucide-react';
import StatCard from '@/components/admin/StatCard';
import { Button } from '@/components/ui/button';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid } from 'recharts';

const statusColors = {
  Pending: 'bg-amber-100 text-amber-800',
  Confirmed: 'bg-blue-100 text-blue-800',
  'Out for Delivery': 'bg-violet-100 text-violet-800',
  Delivered: 'bg-emerald-100 text-emerald-800',
  Cancelled: 'bg-rose-100 text-rose-700',
};

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    const token = localStorage.getItem('cs_token');
    fetch('/api/admin/stats', {
      headers: token ? { Authorization: 'Bearer ' + token } : {},
    }).then(r => r.json()).then(d => {
      // Provide safe defaults for any missing fields
      setStats({
        todayRevenue: 0, todayOrders: 0, pendingCount: 0,
        productsCount: 0, lowStockCount: 0,
        monthRevenue: 0, monthOrders: 0,
        weekRevenue: 0, weekOrders: 0,
        series: [], topProducts: [], recent: [], lowStock: [],
        ...d,
      });
    }).catch(() => setStats({
      todayRevenue: 0, todayOrders: 0, pendingCount: 0,
      productsCount: 0, lowStockCount: 0,
      monthRevenue: 0, monthOrders: 0,
      weekRevenue: 0, weekOrders: 0,
      series: [], topProducts: [], recent: [], lowStock: [],
    }));
  }, []);

  if (!stats) {
    return (
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array(4).fill(0).map((_, i) => <div key={i} className="h-32 skeleton rounded-2xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">Welcome back. Here's what's happening with your shop today.</p>
        </div>
        <div className="text-sm text-slate-500">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard icon={IndianRupee} label="Today's Revenue" value={`₹${stats.todayRevenue.toLocaleString('en-IN')}`} sub={`from ${stats.todayOrders} orders`} accent="emerald" />
        <StatCard icon={ShoppingBag} label="Today's Orders" value={stats.todayOrders} sub={`${stats.pendingCount} pending`} accent="teal" />
        <StatCard icon={Package} label="Total Products" value={stats.productsCount} sub={`${stats.lowStockCount} low stock`} accent="blue" />
        <StatCard icon={TrendingUp} label="Month Revenue" value={`₹${stats.monthRevenue.toLocaleString('en-IN')}`} sub={`${stats.monthOrders} orders · 30 days`} accent="violet" />
      </div>

      {stats.pendingImageReports > 0 && (
        <Link href="/admin/image-reports" className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 hover:bg-amber-100 transition-colors">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <ImageOff className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-amber-900">{stats.pendingImageReports} wrong image report{stats.pendingImageReports === 1 ? '' : 's'} pending</div>
              <div className="text-xs text-amber-800">Review flagged product photos from customers or staff.</div>
            </div>
          </div>
          <Button variant="outline" size="sm" className="rounded-full shrink-0 border-amber-300 bg-white">Review</Button>
        </Link>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Chart */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900">Sales Overview</h3>
              <p className="text-xs text-slate-500">Last 7 days revenue trend</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black text-slate-900">₹{stats.weekRevenue.toLocaleString('en-IN')}</div>
              <div className="text-xs text-slate-500">{stats.weekOrders} orders this week</div>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.series} margin={{ top: 10, right: 0, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0d9488" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#0d9488" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} formatter={(v) => [`₹${v.toLocaleString('en-IN')}`, 'Revenue']} />
                <Area type="monotone" dataKey="revenue" stroke="#0d9488" strokeWidth={2.5} fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top products */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h3 className="font-bold text-slate-900">Top Selling</h3>
          <p className="text-xs text-slate-500">Most sold products</p>
          <div className="mt-4 space-y-3">
            {stats.topProducts.length === 0 && <div className="text-sm text-slate-500">No sales data yet</div>}
            {stats.topProducts.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3">
                <div className="text-lg font-black text-slate-300 w-5">{i + 1}</div>
                <div className="w-10 h-10 rounded-lg bg-slate-50 overflow-hidden shrink-0"><img src={p.image} alt={p.name} className="w-full h-full object-cover" /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-900 line-clamp-1">{p.name}</div>
                  <div className="text-xs text-slate-500">{p.qty} sold · ₹{(p.price * p.qty).toLocaleString('en-IN')}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Recent orders */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="p-5 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900">Recent Orders</h3>
              <p className="text-xs text-slate-500">Latest 8 orders</p>
            </div>
            <Link href="/admin/orders"><Button variant="outline" size="sm" className="rounded-full">View all <ArrowUpRight className="w-3 h-3 ml-1" /></Button></Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-5 py-2.5 font-semibold">Order</th>
                  <th className="text-left px-5 py-2.5 font-semibold">Customer</th>
                  <th className="text-left px-5 py-2.5 font-semibold">Total</th>
                  <th className="text-left px-5 py-2.5 font-semibold">Status</th>
                  <th className="px-5 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats.recent.map(o => (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <div className="font-bold text-slate-900 text-xs">{o.id.slice(0, 16)}…</div>
                      <div className="text-xs text-slate-500">{new Date(o.createdAt).toLocaleDateString('en-IN')}</div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="font-semibold text-slate-900 text-sm">{o.address?.name}</div>
                      <div className="text-xs text-slate-500">{o.address?.city}</div>
                    </td>
                    <td className="px-5 py-3 font-bold text-slate-900">₹{o.total}</td>
                    <td className="px-5 py-3">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${statusColors[o.status] || 'bg-slate-100 text-slate-700'}`}>{o.status}</span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link href={`/admin/orders/${o.id}`}><Button size="sm" variant="ghost" className="h-8 px-2"><Eye className="w-4 h-4" /></Button></Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Low stock */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" /><h3 className="font-bold text-slate-900">Low Stock Alerts</h3></div>
          <p className="text-xs text-slate-500 mt-0.5">Restock these soon</p>
          <div className="mt-4 space-y-2.5">
            {stats.lowStock.length === 0 && <div className="text-sm text-slate-500">All stocked up 🎉</div>}
            {stats.lowStock.slice(0, 5).map(p => (
              <Link key={p.id} href={`/admin/products/${p.id}`} className="flex items-center gap-3 p-2 -mx-2 rounded-xl hover:bg-slate-50">
                <div className="w-10 h-10 rounded-lg bg-slate-50 overflow-hidden shrink-0"><img src={p.image} alt={p.name} className="w-full h-full object-cover" /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-900 line-clamp-1">{p.name}</div>
                  <div className="text-xs text-slate-500">₹{p.price}</div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-black ${p.stock < 20 ? 'text-rose-600' : 'text-amber-600'}`}>{p.stock}</div>
                  <div className="text-[10px] text-slate-500">in stock</div>
                </div>
              </Link>
            ))}
          </div>
          <Link href="/admin/products"><Button variant="outline" size="sm" className="w-full mt-4 rounded-full">Manage Inventory</Button></Link>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

'use client';
import { useEffect, useState } from 'react';
import { Boxes, TrendingUp, TrendingDown, Plus, Search, Package, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

const typeColors = {
  restock: 'bg-emerald-100 text-emerald-700',
  sale: 'bg-blue-100 text-blue-700',
  adjustment: 'bg-amber-100 text-amber-700',
  return: 'bg-violet-100 text-violet-700',
  initial: 'bg-slate-100 text-slate-700',
  import: 'bg-teal-100 text-teal-700',
};

const Inventory = () => {
  const [logs, setLogs] = useState(null);
  const [products, setProducts] = useState([]);
  const [restock, setRestock] = useState({ open: false, productId: '', qty: '', reason: 'Manual restock' });
  const [q, setQ] = useState('');
  const [filterPid, setFilterPid] = useState('all');

  const load = () => {
    const params = new URLSearchParams();
    if (filterPid !== 'all') params.set('productId', filterPid);
    fetch(`/api/inventory/logs?${params.toString()}`).then(r => r.json()).then(d => setLogs(d.logs || []));
  };
  useEffect(() => { fetch('/api/products?limit=200').then(r => r.json()).then(d => setProducts(d.products || [])); }, []);
  useEffect(load, [filterPid]);

  const submitRestock = async () => {
    if (!restock.productId || !restock.qty) { toast.error('Pick product & quantity'); return; }
    const res = await fetch('/api/inventory/restock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: restock.productId, qty: Number(restock.qty), reason: restock.reason }) });
    const d = await res.json();
    if (d.ok) { toast.success(`Stock updated to ${d.stock}`); setRestock({ open: false, productId: '', qty: '', reason: 'Manual restock' }); load(); }
    else toast.error(d.error || 'Failed');
  };

  const filteredLogs = (logs || []).filter(l => !q || l.productName.toLowerCase().includes(q.toLowerCase()));
  const lowStock = products.filter(p => p.stock < 50).sort((a, b) => a.stock - b.stock);
  const outStock = products.filter(p => p.stock === 0);
  const totalUnits = products.reduce((s, p) => s + (p.stock || 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Inventory</h1>
          <p className="text-slate-500 text-sm mt-0.5">Track stock movements, restock low items, audit adjustments.</p>
        </div>
        <Button onClick={() => setRestock({ ...restock, open: true })} className="bg-teal-600 hover:bg-teal-700 rounded-full font-semibold"><Plus className="w-4 h-4 mr-1" /> Restock / Adjust</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Stock Units</div>
          <div className="text-2xl font-black text-slate-900 mt-2">{totalUnits.toLocaleString('en-IN')}</div>
          <div className="text-xs text-slate-500 mt-1.5">across {products.length} products</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Low Stock</div>
          <div className="text-2xl font-black text-amber-600 mt-2">{lowStock.length}</div>
          <div className="text-xs text-slate-500 mt-1.5">stock below 50</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Out of Stock</div>
          <div className="text-2xl font-black text-rose-600 mt-2">{outStock.length}</div>
          <div className="text-xs text-slate-500 mt-1.5">need urgent restock</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Movements</div>
          <div className="text-2xl font-black text-slate-900 mt-2">{logs?.length || 0}</div>
          <div className="text-xs text-slate-500 mt-1.5">last 200 logged</div>
        </div>
      </div>

      {lowStock.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h3 className="font-bold text-slate-900 mb-3">Needs Restock</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {lowStock.slice(0, 6).map(p => (
              <div key={p.id} className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl">
                <div className="w-12 h-12 rounded-lg bg-slate-50 overflow-hidden shrink-0"><img src={p.image} alt={p.name} className="w-full h-full object-cover" /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-900 line-clamp-1">{p.name}</div>
                  <div className="text-xs text-slate-500">{p.brand} · {p.packSize}</div>
                </div>
                <div className="text-right">
                  <div className={`font-black ${p.stock === 0 ? 'text-rose-600' : 'text-amber-600'}`}>{p.stock}</div>
                  <button onClick={() => setRestock({ open: true, productId: p.id, qty: 100, reason: 'Restock low stock' })} className="text-[11px] font-bold text-teal-700 hover:text-teal-800">Restock →</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by product name…" className="pl-9 h-10 rounded-xl" />
          </div>
          <Select value={filterPid} onValueChange={setFilterPid}>
            <SelectTrigger className="w-[220px] h-10 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Products</SelectItem>
              {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-5 py-3 font-semibold">Date</th>
                <th className="text-left px-5 py-3 font-semibold">Product</th>
                <th className="text-left px-5 py-3 font-semibold">Type</th>
                <th className="text-left px-5 py-3 font-semibold">Change</th>
                <th className="text-left px-5 py-3 font-semibold">Before → After</th>
                <th className="text-left px-5 py-3 font-semibold">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!logs && Array(6).fill(0).map((_, i) => <tr key={i}><td colSpan={6} className="px-5 py-4"><div className="h-6 skeleton rounded" /></td></tr>)}
              {logs && filteredLogs.length === 0 && <tr><td colSpan={6} className="px-5 py-16 text-center text-slate-500"><Boxes className="w-10 h-10 mx-auto text-slate-300" /><div className="mt-2 font-semibold text-slate-700">No inventory movements yet</div><div className="text-xs">Stock changes will appear here as orders & restocks happen.</div></td></tr>}
              {filteredLogs.map(l => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 text-xs text-slate-700">{new Date(l.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}<div className="text-[11px] text-slate-500">{new Date(l.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div></td>
                  <td className="px-5 py-3 font-semibold text-slate-900">{l.productName}</td>
                  <td className="px-5 py-3"><span className={`text-[11px] font-bold px-2 py-0.5 rounded-md uppercase ${typeColors[l.type] || 'bg-slate-100'}`}>{l.type}</span></td>
                  <td className="px-5 py-3"><span className={`font-bold inline-flex items-center gap-0.5 ${l.qtyChange >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{l.qtyChange >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}{Math.abs(l.qtyChange)}</span></td>
                  <td className="px-5 py-3 text-slate-700 text-xs">{l.before} → <span className="font-bold text-slate-900">{l.after}</span></td>
                  <td className="px-5 py-3 text-slate-600 text-xs">{l.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={restock.open} onOpenChange={(o) => setRestock({ ...restock, open: o })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Restock / Adjust Inventory</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Label className="text-xs font-semibold text-slate-700">Product</Label>
              <Select value={restock.productId} onValueChange={(v) => setRestock({ ...restock, productId: v })}>
                <SelectTrigger className="mt-1.5 h-11 rounded-xl"><SelectValue placeholder="Pick a product" /></SelectTrigger>
                <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.stock} in stock)</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700">Quantity change (positive = restock, negative = adjustment)</Label>
              <Input type="number" value={restock.qty} onChange={(e) => setRestock({ ...restock, qty: e.target.value })} placeholder="e.g. 100 or -5" className="mt-1.5 h-11 rounded-xl" />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700">Reason</Label>
              <Textarea rows={2} value={restock.reason} onChange={(e) => setRestock({ ...restock, reason: e.target.value })} placeholder="e.g. Received supplier shipment" className="mt-1.5 rounded-xl" />
            </div>
            <Button onClick={submitRestock} className="w-full bg-teal-600 hover:bg-teal-700 rounded-full font-semibold">Apply Change</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Inventory;

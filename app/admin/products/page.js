'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Edit3, Trash2, Filter, Package, Upload, Trash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const ProductsList = () => {
  const [products, setProducts] = useState(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('newest');
  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch('/api/categories?tree=true').then(r => r.json()).then(d => setCategories(d.categories || []));
  }, []);

  const flatCats = (cats) => cats.reduce((acc, c) => { acc.push(c); if (c.children?.length) acc.push(...flatCats(c.children)); return acc; }, []);
  const allCats = flatCats(categories);

  const load = () => {
    setProducts(null);
    const params = new URLSearchParams();
    if (category !== 'all') params.set('category', category);
    if (search) params.set('search', search);
    params.set('sort', sort);
    params.set('limit', '200');
    fetch(`/api/products?${params.toString()}`).then(r => r.json()).then(d => setProducts(d.products || []));
  };
  useEffect(() => { load(); }, [category, sort]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [search]);

  const del = async (id, name) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    await fetch(`/api/products/${id}`, { method: 'DELETE' });
    toast.success('Product deleted');
    load();
  };

  const toggleSelect = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const toggleSelectAll = () => {
    if (selected.size === products?.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(products?.map(p => p.id) || []));
    }
  };

  const deleteSelected = async () => {
    if (!selected.size) { toast.error('No products selected'); return; }
    if (!confirm(`Delete ${selected.size} product${selected.size > 1 ? 's' : ''}? This cannot be undone.`)) return;
    
    setDeleting(true);
    let deleted = 0;
    const ids = Array.from(selected);
    
    for (const id of ids) {
      try {
        const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
        if (res.ok) deleted++;
      } catch (e) {
        console.error(`Failed to delete ${id}:`, e);
      }
    }
    
    toast.success(`Deleted ${deleted} product${deleted > 1 ? 's' : ''}`);
    setSelected(new Set());
    setDeleting(false);
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Products</h1>
          <p className="text-slate-500 text-sm mt-0.5">{products ? `${products.length} products` : 'Loading…'}</p>
        </div>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <Button variant="destructive" onClick={deleteSelected} disabled={deleting} className="rounded-full h-10 font-semibold">
              <Trash className="w-4 h-4 mr-1" /> {deleting ? 'Deleting…' : `Delete ${selected.size}`}
            </Button>
          )}
          <Link href="/admin/products/import"><Button variant="outline" className="rounded-full h-10 font-semibold"><Upload className="w-4 h-4 mr-1" /> Import CSV</Button></Link>
          <Link href="/admin/products/new"><Button className="bg-teal-600 hover:bg-teal-700 rounded-full h-10 font-semibold"><Plus className="w-4 h-4 mr-1" /> Add Product</Button></Link>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by product name…" className="pl-9 h-10 rounded-xl" />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-[200px] h-10 rounded-xl"><Filter className="w-4 h-4 mr-1.5 text-slate-500" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {allCats.filter(c => c.type === 'main').map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-[180px] h-10 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="popular">Most Popular</SelectItem>
              <SelectItem value="price_asc">Price (Low → High)</SelectItem>
              <SelectItem value="price_desc">Price (High → Low)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3 w-10"><input type="checkbox" checked={products?.length > 0 && selected.size === products?.length} onChange={toggleSelectAll} className="w-4 h-4 rounded cursor-pointer" /></th>
                <th className="text-left px-5 py-3 font-semibold">Product</th>
                <th className="text-left px-5 py-3 font-semibold">Category</th>
                <th className="text-left px-5 py-3 font-semibold">Price</th>
                <th className="text-left px-5 py-3 font-semibold">Stock</th>
                <th className="text-left px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!products && Array(8).fill(0).map((_, i) => (
                <tr key={i}><td colSpan={7} className="px-5 py-4"><div className="h-8 skeleton rounded" /></td></tr>
              ))}
              {products?.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-16 text-center text-slate-500">
                  <Package className="w-10 h-10 mx-auto text-slate-300" />
                  <div className="mt-2 font-semibold text-slate-700">No products found</div>
                  <div className="text-xs">Try clearing filters or add a new product.</div>
                </td></tr>
              )}
              {products?.map(p => {
                const lowStock = p.stock < 50;
                const outOfStock = p.stock === 0;
                return (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 w-10"><input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} className="w-4 h-4 rounded cursor-pointer" /></td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-lg bg-slate-50 overflow-hidden shrink-0 border border-slate-100"><img src={p.image} alt={p.name} className="w-full h-full object-cover" /></div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 line-clamp-1">{p.name}</div>
                          <div className="text-xs text-slate-500">{p.brand} · {p.packSize}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-700 text-xs"><span className="bg-slate-100 px-2 py-0.5 rounded-md capitalize">{p.category.replace('-', ' ')}</span></td>
                    <td className="px-5 py-3">
                      <div className="font-bold text-slate-900">₹{p.price}</div>
                      {p.mrp > p.price && <div className="text-[11px] text-slate-400 line-through">₹{p.mrp}</div>}
                    </td>
                    <td className="px-5 py-3">
                      <div className={`font-bold ${outOfStock ? 'text-rose-600' : lowStock ? 'text-amber-600' : 'text-slate-900'}`}>{p.stock}</div>
                    </td>
                    <td className="px-5 py-3">
                      {outOfStock ? <span className="text-[11px] font-bold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-md">Out of stock</span>
                        : lowStock ? <span className="text-[11px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md">Low stock</span>
                        : <span className="text-[11px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md">Active</span>}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Link href={`/admin/products/${p.id}`}><Button size="sm" variant="ghost" className="h-8 px-2 text-slate-600 hover:text-teal-700"><Edit3 className="w-4 h-4" /></Button></Link>
                        <Button size="sm" variant="ghost" onClick={() => del(p.id, p.name)} className="h-8 px-2 text-slate-600 hover:text-rose-600"><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ProductsList;

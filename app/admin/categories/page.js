'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Save, X, Trash2, ChevronRight, ChevronDown, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const TYPES = [
  { value: 'main', label: 'Main Category' },
  { value: 'sub', label: 'Subcategory' },
  { value: 'brand', label: 'Brand' },
];

const CategoryManager = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', slug: '', parentCategoryId: '', type: 'main', description: '', sortOrder: 0 });

  const load = () => {
    fetch('/api/categories?tree=true').then(r => r.json()).then(d => {
      setCategories(d.categories || []);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const flat = (cats, depth = 0) => cats.reduce((acc, c) => {
    acc.push({ ...c, depth });
    if (c.children?.length) acc.push(...flat(c.children, depth + 1));
    return acc;
  }, []);

  const allFlat = flat(categories);
  const mainCats = allFlat.filter(c => c.type === 'main');

  const save = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    const url = editing ? `/api/categories/${editing.id}` : '/api/categories';
    const method = editing ? 'PUT' : 'POST';
    const body = { ...form, parentCategoryId: form.parentCategoryId || null };
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await res.json();
    if (d.category) {
      toast.success(editing ? 'Category updated' : 'Category created');
      setEditing(null);
      setForm({ name: '', slug: '', parentCategoryId: '', type: 'main', description: '', sortOrder: 0 });
      load();
    } else {
      toast.error(d.error || 'Failed to save');
    }
  };

  const startEdit = (cat) => {
    setEditing(cat);
    setForm({
      name: cat.name,
      slug: cat.slug,
      parentCategoryId: cat.parentCategoryId || '',
      type: cat.type,
      description: cat.description || '',
      sortOrder: cat.sortOrder || 0,
    });
  };

  const del = async (cat) => {
    if (!confirm(`Delete "${cat.name}"? Subcategories must be removed first.`)) return;
    const res = await fetch(`/api/categories/${cat.id}`, { method: 'DELETE' });
    const d = await res.json();
    if (d.ok) { toast.success('Deleted'); load(); }
    else toast.error(d.error || 'Failed to delete');
  };

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Categories</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage your store's category hierarchy and brands.</p>
        </div>
        <Button onClick={() => { setEditing(null); setForm({ name: '', slug: '', parentCategoryId: '', type: 'main', description: '', sortOrder: 0 }); }} className="bg-teal-600 hover:bg-teal-700 rounded-full font-semibold"><Plus className="w-4 h-4 mr-1" /> New Category</Button>
      </div>

      {/* Form */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h3 className="font-bold text-slate-900 mb-4">{editing ? 'Edit Category' : 'New Category'}</h3>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs font-semibold text-slate-700">Name *</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Orthopedic Products" className="mt-1.5 h-11 rounded-xl bg-white" />
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-700">Slug (auto-generated)</Label>
            <Input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="orthopedic-products" className="mt-1.5 h-11 rounded-xl bg-white" />
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-700">Type</Label>
            <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
              <SelectTrigger className="mt-1.5 h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-700">Parent Category</Label>
            <Select value={form.parentCategoryId} onValueChange={v => setForm({ ...form, parentCategoryId: v })}>
              <SelectTrigger className="mt-1.5 h-11 rounded-xl bg-white"><SelectValue placeholder="None (main category)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">None (main category)</SelectItem>
                {allFlat.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {'\u00A0'.repeat(c.depth * 2)}{c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-700">Sort Order</Label>
            <Input type="number" value={form.sortOrder} onChange={e => setForm({ ...form, sortOrder: Number(e.target.value) })} className="mt-1.5 h-11 rounded-xl bg-white" />
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-700">Description</Label>
            <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Short description…" className="mt-1.5 h-11 rounded-xl bg-white" />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <Button onClick={save} className="bg-teal-600 hover:bg-teal-700 rounded-full font-semibold"><Save className="w-4 h-4 mr-1" /> {editing ? 'Update' : 'Create'}</Button>
          {editing && <Button variant="outline" onClick={() => { setEditing(null); setForm({ name: '', slug: '', parentCategoryId: '', type: 'main', description: '', sortOrder: 0 }); }} className="rounded-full"><X className="w-4 h-4 mr-1" /> Cancel</Button>}
        </div>
      </div>

      {/* Tree */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {Array(5).fill(0).map((_, i) => <div key={i} className="h-10 skeleton rounded" />)}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-5 py-3 font-semibold">Name</th>
                <th className="text-left px-5 py-3 font-semibold">Slug</th>
                <th className="text-left px-5 py-3 font-semibold">Type</th>
                <th className="text-left px-5 py-3 font-semibold">Sort</th>
                <th className="text-right px-5 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {allFlat.map(cat => (
                <tr key={cat.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span style={{ marginLeft: `${cat.depth * 24}px` }} className="flex items-center gap-1">
                        {cat.depth > 0 && <ChevronRight className="w-3 h-3 text-slate-400" />}
                        <span className="font-semibold text-slate-900">{cat.name}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-slate-500">/{cat.slug}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${cat.type === 'main' ? 'bg-teal-50 text-teal-700' : cat.type === 'brand' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>{cat.type}</span>
                  </td>
                  <td className="px-5 py-3 text-slate-500">{cat.sortOrder}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => startEdit(cat)} className="rounded-lg h-8">Edit</Button>
                      <Button size="sm" variant="ghost" onClick={() => del(cat)} className="rounded-lg h-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default CategoryManager;

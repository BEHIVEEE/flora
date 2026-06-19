'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, Save, X, Boxes, Search, Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ImageUploader from '@/components/admin/ImageUploader';
import ReportWrongImage from '@/components/ReportWrongImage';

const ProductForm = ({ title, initial = {}, onSave, saving }) => {
  const [form, setForm] = useState({
    name: initial.name || '',
    brand: initial.brand || '',
    manufacturer: initial.manufacturer || '',
    category: initial.category || 'medicines',
    price: initial.price || '',
    mrp: initial.mrp || '',
    stock: initial.stock || 0,
    packSize: initial.packSize || '',
    description: initial.description || '',
    prescription: !!initial.prescription,
    images: initial.images || (initial.image ? [initial.image] : []),
    tags: initial.tags || [],
  });
  const [hasVariants, setHasVariants] = useState(!!initial.hasVariants);
  const [variants, setVariants] = useState(
    initial.variants?.length > 0 ? initial.variants : [{ id: 'v-new-1', packSize: '', price: '', mrp: '', stock: 0 }]
  );

  const [categories, setCategories] = useState([]);
  useEffect(() => {
    fetch('/api/categories?tree=true').then(r => r.json()).then(d => setCategories(d.categories || []));
  }, []);

  const flatCats = (cats) => cats.reduce((acc, c) => { acc.push(c); if (c.children?.length) acc.push(...flatCats(c.children)); return acc; }, []);
  const allCats = flatCats(categories);

  const update = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const addVariant = () => setVariants(v => [...v, { id: 'v-new-' + Date.now(), packSize: '', price: '', mrp: '', stock: 0 }]);
  const removeVariant = (id) => setVariants(v => v.filter(x => x.id !== id));
  const updateVariant = (id, key, val) => setVariants(v => v.map(x => x.id === id ? { ...x, [key]: val } : x));

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const cleanVariants = variants.map(v => ({ ...v, price: Number(v.price) || 0, mrp: Number(v.mrp) || Number(v.price) || 0, stock: Number(v.stock) || 0 }));
    const basePrice = hasVariants ? Math.min(...cleanVariants.map(v => v.price).filter(Boolean)) || 0 : Number(form.price) || 0;
    const baseMrp = hasVariants ? Math.min(...cleanVariants.map(v => v.mrp).filter(Boolean)) || basePrice : Number(form.mrp) || Number(form.price) || 0;
    const baseStock = hasVariants ? cleanVariants.reduce((s, v) => s + v.stock, 0) : Number(form.stock) || 0;
    onSave({
      ...form,
      price: basePrice,
      mrp: baseMrp,
      stock: baseStock,
      hasVariants,
      variants: hasVariants ? cleanVariants : [],
      packSize: hasVariants ? cleanVariants.map(v => v.packSize).filter(Boolean).join(' / ') : form.packSize,
    });
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/admin/products"><Button type="button" variant="ghost" size="icon" className="rounded-full"><ChevronLeft className="w-5 h-5" /></Button></Link>
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">{title}</h1>
          <p className="text-slate-500 text-sm mt-0.5">Fill in the details below. The first image will be used as the product cover.</p>
        </div>
        <div className="hidden md:flex gap-2">
          <Link href="/admin/products"><Button type="button" variant="outline" className="rounded-full"><X className="w-4 h-4 mr-1" /> Cancel</Button></Link>
          <Button type="submit" disabled={saving} className="bg-teal-600 hover:bg-teal-700 text-white rounded-full font-semibold"><Save className="w-4 h-4 mr-1" /> {saving ? 'Saving…' : 'Save Product'}</Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card title="Basic Information">
            <div className="grid md:grid-cols-2 gap-4">
              <Field className="md:col-span-2" label="Product Name *" value={form.name} onChange={v => update('name', v)} placeholder="e.g. Crocin Advance 500mg Tablet" />
              <Field label="Brand" value={form.brand} onChange={v => update('brand', v)} placeholder="e.g. GSK" />
              <Field label="Manufacturer" value={form.manufacturer} onChange={v => update('manufacturer', v)} placeholder="e.g. GlaxoSmithKline" />
              <div className="md:col-span-2">
                <Label className="text-xs font-semibold text-slate-700">Description</Label>
                <Textarea rows={4} value={form.description} onChange={e => update('description', e.target.value)} placeholder="Describe key benefits, ingredients, usage…" className="mt-1.5 rounded-xl bg-white" />
              </div>
            </div>
          </Card>

          <Card title="Product Images" subtitle="Upload, paste image URLs, or find images on the web.">
            {form.name?.trim() && (
              <div className="mb-3 flex flex-wrap gap-2">
                <a
                  href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(form.name + ' ' + (form.brand || ''))}`}
                  target="_blank" rel="noopener"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-teal-50 hover:bg-teal-100 text-teal-700 text-xs font-bold border border-teal-200"
                >
                  <Search className="w-3.5 h-3.5" /> Find images on Google
                </a>
                <a
                  href={`https://www.bing.com/images/search?q=${encodeURIComponent(form.name + ' ' + (form.brand || ''))}`}
                  target="_blank" rel="noopener"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200"
                >
                  <Search className="w-3.5 h-3.5" /> Bing Images
                </a>
                <span className="text-[11px] text-slate-500 self-center">→ right-click an image → Copy image address → paste below</span>
              </div>
            )}
            <ImageUploader images={form.images} onChange={(imgs) => update('images', typeof imgs === 'function' ? imgs(form.images) : imgs)} />
            {initial.id && form.images?.[0] && (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <ReportWrongImage
                  productId={initial.id}
                  productName={form.name || initial.name}
                  imageUrl={form.images[0]}
                  variant="admin"
                />
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Pricing & Inventory">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-semibold text-sm text-slate-900">Multiple pack sizes / variants</div>
                <div className="text-xs text-slate-500">e.g. Strip of 10, Strip of 30, 100ml, 200ml</div>
              </div>
              <Switch checked={hasVariants} onCheckedChange={setHasVariants} />
            </div>
            {hasVariants ? (
              <div className="space-y-3">
                <div className="grid grid-cols-[1fr_80px_80px_70px_32px] gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-wide px-1">
                  <span>Pack Size</span><span>Price ₹</span><span>MRP ₹</span><span>Stock</span><span></span>
                </div>
                {variants.map(v => (
                  <div key={v.id} className="grid grid-cols-[1fr_80px_80px_70px_32px] gap-2 items-center">
                    <Input value={v.packSize} onChange={e => updateVariant(v.id, 'packSize', e.target.value)} placeholder="Strip of 10" className="h-9 rounded-lg text-sm bg-white" />
                    <Input type="number" value={v.price} onChange={e => updateVariant(v.id, 'price', e.target.value)} placeholder="99" className="h-9 rounded-lg text-sm bg-white" />
                    <Input type="number" value={v.mrp} onChange={e => updateVariant(v.id, 'mrp', e.target.value)} placeholder="120" className="h-9 rounded-lg text-sm bg-white" />
                    <Input type="number" value={v.stock} onChange={e => updateVariant(v.id, 'stock', e.target.value)} placeholder="50" className="h-9 rounded-lg text-sm bg-white" />
                    <button type="button" onClick={() => removeVariant(v.id)} disabled={variants.length === 1} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-600 disabled:opacity-30">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={addVariant} className="flex items-center gap-1.5 text-teal-600 text-sm font-semibold mt-1 hover:text-teal-700">
                  <Plus className="w-4 h-4" /> Add size
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Selling Price (₹) *" type="number" value={form.price} onChange={v => update('price', v)} placeholder="99" />
                <Field label="MRP (₹)" type="number" value={form.mrp} onChange={v => update('mrp', v)} placeholder="120" />
                <Field label="Stock" type="number" value={form.stock} onChange={v => update('stock', v)} placeholder="100" />
                <Field label="Pack Size" value={form.packSize} onChange={v => update('packSize', v)} placeholder="Strip of 15 tablets" />
              </div>
            )}
          </Card>

          <Card title="Organization">
            <Label className="text-xs font-semibold text-slate-700">Category</Label>
            <Select value={form.category} onValueChange={v => update('category', v)}>
              <SelectTrigger className="mt-1.5 h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>{allCats.filter(c => c.type === 'main').map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            <div className="mt-4 flex items-center justify-between">
              <div>
                <div className="font-semibold text-sm text-slate-900">Prescription Required</div>
                <div className="text-xs text-slate-500">Customers must upload an Rx to buy</div>
              </div>
              <Switch checked={form.prescription} onCheckedChange={v => update('prescription', v)} />
            </div>
          </Card>
        </div>
      </div>

      {/* Mobile sticky save */}
      <div className="md:hidden sticky bottom-4 left-0 right-0 z-20">
        <div className="bg-white border border-slate-200 shadow-lift rounded-2xl p-2 flex gap-2">
          <Link href="/admin/products" className="flex-1"><Button type="button" variant="outline" className="w-full rounded-xl">Cancel</Button></Link>
          <Button type="submit" disabled={saving} className="flex-1 bg-teal-600 hover:bg-teal-700 text-white rounded-xl">{saving ? 'Saving…' : 'Save Product'}</Button>
        </div>
      </div>
    </form>
  );
};

const Card = ({ title, subtitle, children }) => (
  <div className="bg-white border border-slate-200 rounded-2xl p-5">
    <h3 className="font-bold text-slate-900">{title}</h3>
    {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
    <div className="mt-4">{children}</div>
  </div>
);

const Field = ({ label, value, onChange, type = 'text', placeholder = '', className = '' }) => (
  <div className={className}>
    <Label className="text-xs font-semibold text-slate-700">{label}</Label>
    <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1.5 h-11 rounded-xl bg-white" />
  </div>
);

export default ProductForm;

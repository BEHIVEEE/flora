'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Star, ShieldCheck, Truck, BadgePercent, Minus, Plus, ShoppingCart, Heart, Share2, Check, FileText } from 'lucide-react';
import { useCart } from '@/components/CartProvider';
import ProductCard from '@/components/ProductCard';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const PDP = () => {
  const { id } = useParams();
  const { addItem, items } = useCart() || { addItem: () => {}, items: [] };
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const inCart = data && items.some(i => i.id === data.product.id);

  useEffect(() => {
    fetch(`/api/products/${id}`).then(r => r.json()).then(d => { setData(d); setLoading(false); });
  }, [id]);

  if (loading) return <div className="container max-w-7xl mx-auto px-4 py-10"><div className="grid md:grid-cols-2 gap-8"><div className="aspect-square skeleton rounded-3xl" /><div><div className="h-8 w-3/4 skeleton rounded mb-3" /><div className="h-6 w-1/3 skeleton rounded mb-3" /><div className="h-24 skeleton rounded" /></div></div></div>;
  if (!data?.product) return <div className="container max-w-7xl mx-auto px-4 py-10 text-center">Product not found</div>;

  const p = data.product;
  const discount = Math.round(((p.mrp - p.price) / p.mrp) * 100);

  const handleAdd = () => {
    const result = addItem(p, qty);
    if (result?.ok === false) {
      if (result.error === 'rx_required') {
        toast.error('Prescription required', { description: 'Upload a prescription and get it approved by our pharmacist first.' });
      } else {
        toast.error(result.message || 'Could not add to cart');
      }
      return;
    }
    toast.success(`Added ${qty} × ${p.name} to cart`);
  };

  return (
    <div className="bg-white pb-36 md:pb-0">
      {/* Breadcrumb */}
      <div className="container max-w-7xl mx-auto px-3 md:px-4 py-2 md:py-4">
        <div className="text-[11px] text-slate-500 flex items-center gap-1 flex-wrap">
          <Link href="/" className="hover:text-teal-700">Home</Link>
          <ChevronRight className="w-3 h-3" />
          <Link href={`/products?category=${p.category}`} className="hover:text-teal-700 capitalize">{p.category.replace('-', ' ')}</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-slate-900 font-medium line-clamp-1">{p.name}</span>
        </div>
      </div>

      {/* ===== MOBILE LAYOUT (1mg style — image card → info below) ===== */}
      <div className="md:hidden">
        {/* Hero image card — like 1mg: centered product in a light card */}
        <div className="relative mx-3 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden" style={{ height: '55vw', maxHeight: '300px' }}>
          <img
            src={p.image}
            alt={p.name}
            className="max-w-[70%] max-h-[85%] object-contain"
          />
          {discount > 0 && <span className="absolute top-3 left-3 bg-rose-500 text-white text-xs font-bold px-2.5 py-1 rounded-md">{discount}% OFF</span>}
        </div>

        {/* Thumbnail strip */}
        <div className="mt-2 px-3 flex gap-2 overflow-x-auto scrollbar-hide">
          {Array(4).fill(0).map((_, i) => (
            <div key={i} className="shrink-0 w-14 h-14 bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
              <img src={p.image} alt="" className="w-full h-full object-cover" />
            </div>
          ))}
        </div>

        {/* Product info */}
        <div className="px-3 mt-4">
          <div className="text-xs font-bold uppercase tracking-wider text-teal-700">{p.brand}</div>
          <h1 className="text-lg font-black text-slate-900 leading-snug mt-0.5">{p.name}</h1>
          <div className="text-xs text-slate-500 mt-0.5">{p.packSize} · by {p.manufacturer}</div>

          <div className="flex items-center gap-2.5 mt-2.5">
            <div className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-xs font-bold">
              <Star className="w-3 h-3 fill-emerald-600 stroke-emerald-600" />
              {p.rating}
            </div>
            <span className="text-xs text-slate-500">{p.ratingCount.toLocaleString('en-IN')} ratings</span>
            {p.tags?.[0] && <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded">{p.tags[0]}</span>}
          </div>

          {/* Price */}
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">₹{p.price}</span>
            {p.mrp > p.price && (<><span className="text-sm text-slate-400 line-through">₹{p.mrp}</span><span className="text-xs font-bold text-emerald-600">{discount}% off</span></>)}
          </div>
          <div className="text-[11px] text-slate-500">Inclusive of all taxes</div>
          {p.stock > 0 ? (
            <div className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><Check className="w-3.5 h-3.5" /> In Stock</div>
          ) : (
            <div className="mt-1.5 text-xs font-semibold text-rose-600">Out of stock</div>
          )}

          {p.prescription && (
            <div className="mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
              <FileText className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-amber-800">Prescription Required</div>
                <div className="text-[11px] text-amber-700 mt-0.5">Upload a valid prescription. <Link href="/prescription" className="font-bold underline">Upload now</Link></div>
              </div>
            </div>
          )}

          {/* Trust badges */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { icon: Truck, t: 'Free delivery', s: 'Above ₹499' },
              { icon: ShieldCheck, t: 'Authentic', s: '100% verified' },
              { icon: BadgePercent, t: 'Easy returns', s: '7-day policy' },
            ].map((f, i) => (
              <div key={i} className="text-center p-2 bg-slate-50 rounded-lg border border-slate-100">
                <f.icon className="w-4 h-4 mx-auto text-teal-700 mb-0.5" />
                <div className="text-[10px] font-bold text-slate-900 leading-tight">{f.t}</div>
                <div className="text-[9px] text-slate-500">{f.s}</div>
              </div>
            ))}
          </div>

          {/* Description */}
          <div className="mt-4">
            <h3 className="font-bold text-slate-900 mb-1 text-sm">Product Information</h3>
            <p className="text-xs text-slate-600 leading-relaxed">{p.description}</p>
          </div>

          {/* Specs */}
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <Row k="Brand" v={p.brand} />
            <Row k="Manufacturer" v={p.manufacturer} />
            <Row k="Pack size" v={p.packSize} />
            <Row k="Prescription" v={p.prescription ? 'Required' : 'Not required'} />
          </div>
        </div>
      </div>

      {/* ===== DESKTOP LAYOUT (2-column) ===== */}
      <div className="hidden md:block container max-w-7xl mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-12">
          <div>
            <div className="relative bg-slate-50 rounded-3xl overflow-hidden border border-slate-100 mx-auto w-full" style={{ paddingBottom: '100%' }}>
              <img src={p.image} alt={p.name} className="absolute inset-0 w-full h-full object-cover" />
              {discount > 0 && <span className="absolute top-3 left-3 bg-rose-500 text-white text-xs font-bold px-2.5 py-1 rounded-md">{discount}% OFF</span>}
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {Array(4).fill(0).map((_, i) => (
                <div key={i} className="aspect-square bg-slate-50 rounded-xl border border-slate-200 overflow-hidden hover:border-teal-400 cursor-pointer">
                  <img src={p.image} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-teal-700 mb-1">{p.brand}</div>
            <h1 className="text-3xl font-black text-slate-900 leading-tight tracking-tight">{p.name}</h1>
            <div className="text-sm text-slate-500 mt-1">{p.packSize} · by {p.manufacturer}</div>

            <div className="flex items-center gap-3 mt-3">
              <div className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-md text-sm font-bold">
                <Star className="w-3.5 h-3.5 fill-emerald-600 stroke-emerald-600" />
                {p.rating}
              </div>
              <span className="text-sm text-slate-500">{p.ratingCount.toLocaleString('en-IN')} ratings</span>
              {p.tags?.[0] && <span className="text-xs bg-amber-100 text-amber-800 font-bold px-2 py-1 rounded-md">{p.tags[0]}</span>}
            </div>

            <div className="mt-6 p-5 bg-slate-50 border border-slate-200 rounded-2xl">
              <div className="flex items-baseline gap-3">
                <div className="text-4xl font-black text-slate-900">₹{p.price}</div>
                {p.mrp > p.price && (<><div className="text-base text-slate-400 line-through">MRP ₹{p.mrp}</div><div className="text-sm font-bold text-emerald-600">{discount}% off</div></>)}
              </div>
              <div className="text-xs text-slate-500 mt-1">Inclusive of all taxes</div>
              {p.stock > 0 ? (
                <div className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700"><Check className="w-4 h-4" /> In Stock · Ships in 24 hours</div>
              ) : (
                <div className="mt-3 text-sm font-semibold text-rose-600">Currently out of stock</div>
              )}
            </div>

            {p.prescription && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5">
                <FileText className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-bold text-amber-800">Prescription Required</div>
                  <div className="text-xs text-amber-700 mt-0.5">This medicine requires a valid prescription. <Link href="/prescription" className="font-bold underline">Upload yours now</Link> and our pharmacist will review it.</div>
                </div>
              </div>
            )}

            <div className="mt-6 flex items-center gap-3">
              <div className="inline-flex items-center border border-slate-300 rounded-full overflow-hidden">
                <button onClick={() => setQty(q => Math.max(1, q - 1))} className="w-10 h-11 hover:bg-slate-50"><Minus className="w-4 h-4 mx-auto" /></button>
                <span className="w-10 text-center font-bold">{qty}</span>
                <button onClick={() => setQty(q => q + 1)} className="w-10 h-11 hover:bg-slate-50"><Plus className="w-4 h-4 mx-auto" /></button>
              </div>
              <Button onClick={handleAdd} className="flex-1 bg-teal-600 hover:bg-teal-700 text-white h-12 rounded-full font-bold shadow-lift"><ShoppingCart className="w-4 h-4 mr-2" /> {inCart ? 'Update Cart' : 'Add to Cart'}</Button>
              <Button variant="outline" className="h-12 w-12 rounded-full p-0"><Heart className="w-4 h-4" /></Button>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3">
              {[
                { icon: Truck, t: 'Free delivery', s: 'Above ₹499' },
                { icon: ShieldCheck, t: 'Authentic', s: '100% verified' },
                { icon: BadgePercent, t: 'Easy returns', s: '7-day policy' },
              ].map((f, i) => (
                <div key={i} className="text-center p-3 bg-white rounded-xl border border-slate-200">
                  <f.icon className="w-5 h-5 mx-auto text-teal-700 mb-1" />
                  <div className="text-xs font-bold text-slate-900">{f.t}</div>
                  <div className="text-[10px] text-slate-500">{f.s}</div>
                </div>
              ))}
            </div>

            <div className="mt-8">
              <h3 className="font-bold text-slate-900 mb-2">Product Information</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{p.description}</p>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
              <Row k="Brand" v={p.brand} />
              <Row k="Manufacturer" v={p.manufacturer} />
              <Row k="Pack size" v={p.packSize} />
              <Row k="Prescription" v={p.prescription ? 'Required' : 'Not required'} />
            </div>
          </div>
        </div>
      </div>

      {/* Related */}
      {data.related?.length > 0 && (
        <section className="container max-w-7xl mx-auto px-3 md:px-4 py-8 md:py-12">
          <h2 className="text-lg md:text-2xl font-black text-slate-900 mb-4">You may also like</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-4">
            {data.related.slice(0, 5).map(rp => <ProductCard key={rp.id} product={rp} />)}
          </div>
        </section>
      )}

      {/* Sticky add-to-cart bar mobile */}
      <div className="md:hidden fixed bottom-16 left-0 right-0 z-30 bg-white border-t border-slate-200 px-3 py-2.5 shadow-[0_-4px_20px_-4px_rgba(15,23,42,0.08)]">
        <div className="flex items-center gap-3">
          <div>
            <div className="text-lg font-black text-slate-900 leading-none">₹{p.price}</div>
            {p.mrp > p.price && <div className="text-[10px] text-slate-400 line-through">₹{p.mrp}</div>}
          </div>
          <div className="inline-flex items-center border border-slate-300 rounded-full overflow-hidden">
            <button onClick={() => setQty(q => Math.max(1, q - 1))} className="w-8 h-9"><Minus className="w-3.5 h-3.5 mx-auto" /></button>
            <span className="w-6 text-center text-sm font-bold">{qty}</span>
            <button onClick={() => setQty(q => q + 1)} className="w-8 h-9"><Plus className="w-3.5 h-3.5 mx-auto" /></button>
          </div>
          <Button onClick={handleAdd} className="flex-1 bg-teal-600 hover:bg-teal-700 text-white h-10 rounded-full font-bold text-sm">Add to Cart</Button>
        </div>
      </div>
    </div>
  );
};

const Row = ({ k, v }) => (
  <div className="flex flex-col p-2.5 md:p-3 bg-slate-50 rounded-xl border border-slate-100">
    <span className="text-[11px] md:text-xs text-slate-500">{k}</span>
    <span className="font-semibold text-slate-900 text-xs md:text-sm mt-0.5">{v}</span>
  </div>
);

export default PDP;

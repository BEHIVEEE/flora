'use client';
import Link from 'next/link';
import { Star, Plus, Check } from 'lucide-react';
import { useCart } from './CartProvider';
import { toast } from 'sonner';
import { useState } from 'react';

const ProductCard = ({ product, compact = false }) => {
  const { addItem, items } = useCart() || { addItem: () => {}, items: [] };
  const inCart = items.some(i => i.id === product.id);
  const [adding, setAdding] = useState(false);
  const discount = Math.round(((product.mrp - product.price) / product.mrp) * 100);

  const handleAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    addItem(product, 1);
    setAdding(true);
    toast.success(`${product.name} added to cart`, { duration: 1600 });
    setTimeout(() => setAdding(false), 900);
  };

  return (
    <Link href={`/product/${product.id}`} className="group relative bg-white border border-slate-200 rounded-2xl p-2 md:p-3 hover:border-teal-300 hover:shadow-lift transition-all duration-300 flex flex-col">
      {discount > 0 && (
        <span className="absolute top-3 left-3 z-10 bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">{discount}% OFF</span>
      )}
      {product.prescription && (
        <span className="absolute top-3 right-3 z-10 bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-md">Rx</span>
      )}
      <div className="aspect-square rounded-xl bg-slate-50 overflow-hidden mb-2 md:mb-3 relative">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            decoding="async"
            fetchPriority="low"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
            <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </div>
        )}
      </div>
      <div className="flex-1 flex flex-col">
        <div className="text-[10px] font-semibold text-teal-700 uppercase tracking-wide mb-0.5">{product.brand}</div>
        <h3 className={`font-semibold text-slate-900 leading-snug line-clamp-2 ${compact ? 'text-xs' : 'text-sm'} group-hover:text-teal-700`}>{product.name}</h3>
        <div className="text-[11px] text-slate-500 mt-0.5">{product.packSize}</div>
        <div className="flex items-center gap-1 mt-1.5">
          <div className="flex items-center gap-0.5 bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded text-[11px] font-semibold">
            <Star className="w-3 h-3 fill-emerald-600 stroke-emerald-600" />
            <span>{product.rating}</span>
          </div>
          <span className="text-[11px] text-slate-400">({product.ratingCount > 999 ? (product.ratingCount/1000).toFixed(1)+'k' : product.ratingCount})</span>
        </div>
        <div className="mt-auto pt-2.5 flex items-end justify-between gap-2">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-bold text-slate-900 text-base">₹{product.price}</span>
              {product.mrp > product.price && <span className="text-xs text-slate-400 line-through">₹{product.mrp}</span>}
            </div>
          </div>
          <button onClick={handleAdd} aria-label="Add to cart" className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-bold transition-all ${inCart ? 'bg-emerald-500 text-white' : 'bg-teal-600 hover:bg-teal-700 text-white shadow-lift hover:scale-105'} ${adding ? 'scale-90' : ''}`}>
            {inCart ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </Link>
  );
};

export default ProductCard;

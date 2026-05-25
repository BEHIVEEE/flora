'use client';
import Link from 'next/link';
import { useCart } from '@/components/CartProvider';
import { useSettings } from '@/components/SettingsProvider';
import { Button } from '@/components/ui/button';
import { Minus, Plus, Trash2, Tag, ShieldCheck, Truck, ArrowRight, ShoppingBag } from 'lucide-react';

const CartPage = () => {
  const { items, updateQty, removeItem, subtotal, savings, totalQty } = useCart() || {};
  const { deliveryCharge, freeDeliveryAbove } = useSettings();
  const deliveryFee = subtotal >= freeDeliveryAbove ? 0 : deliveryCharge;
  const total = (subtotal || 0) + deliveryFee;

  if (!items || items.length === 0) {
    return (
      <div className="container max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="w-24 h-24 mx-auto bg-teal-50 rounded-full flex items-center justify-center mb-4">
          <ShoppingBag className="w-10 h-10 text-teal-600" />
        </div>
        <h1 className="text-2xl font-black text-slate-900">Your cart is empty</h1>
        <p className="text-slate-500 mt-2">Add medicines, devices and wellness essentials to get started.</p>
        <Link href="/products"><Button className="mt-6 bg-teal-600 hover:bg-teal-700 rounded-full h-12 px-7 font-semibold">Start Shopping</Button></Link>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen pb-32 md:pb-12">
      <div className="container max-w-6xl mx-auto px-4 py-6 md:py-10">
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Your Cart <span className="text-slate-400 font-bold text-lg">({totalQty} items)</span></h1>
        <div className="grid lg:grid-cols-[1fr_360px] gap-6 mt-6">
          <div className="space-y-3">
            {items.map(i => (
              <div key={i.cartKey || i.id} className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col sm:flex-row gap-4">
                <Link href={`/product/${i.id}`} className="w-20 h-20 md:w-24 md:h-24 bg-slate-50 rounded-xl overflow-hidden shrink-0">
                  <img src={i.image} alt={i.name} className="w-full h-full object-cover" />
                </Link>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold text-teal-700 uppercase">{i.brand}</div>
                      <Link href={`/product/${i.id}`} className="font-semibold text-slate-900 leading-snug hover:text-teal-700 line-clamp-2 text-sm md:text-base">{i.name}</Link>
                      <div className="text-xs text-slate-500 mt-0.5">{i.packSize}</div>
                    </div>
                    <button onClick={() => removeItem(i.cartKey || i.id)} className="text-slate-400 hover:text-rose-600 p-1" aria-label="Remove"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-3">
                    <div className="inline-flex items-center border border-slate-300 rounded-full self-start sm:self-auto">
                      <button onClick={() => updateQty(i.cartKey || i.id, i.qty - 1)} className="w-8 h-8 hover:bg-slate-50"><Minus className="w-3.5 h-3.5 mx-auto" /></button>
                      <span className="w-8 text-center text-sm font-bold">{i.qty}</span>
                      <button onClick={() => updateQty(i.cartKey || i.id, i.qty + 1)} className="w-8 h-8 hover:bg-slate-50"><Plus className="w-3.5 h-3.5 mx-auto" /></button>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-slate-900">₹{i.price * i.qty}</div>
                      {i.mrp > i.price && <div className="text-xs text-slate-400 line-through">₹{i.mrp * i.qty}</div>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center shrink-0"><Tag className="w-5 h-5" /></div>
              <div className="text-sm text-emerald-900"><span className="font-bold">You're saving ₹{savings}</span> on this order. Apply coupons at checkout for additional savings.</div>
            </div>
          </div>

          <aside className="lg:sticky lg:top-32 self-start">
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="font-bold text-slate-900 mb-4">Order Summary</h3>
              <div className="space-y-2.5 text-sm">
                <Row k={`Subtotal (${totalQty} items)`} v={`₹${subtotal}`} />
                <Row k="Savings" v={`- ₹${savings}`} good />
                <Row k="Delivery" v={deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`} good={deliveryFee === 0} />
                <div className="border-t border-slate-200 my-2" />
                <div className="flex items-center justify-between font-black text-base text-slate-900"><span>Total</span><span>₹{total}</span></div>
              </div>
              {deliveryFee > 0 && (
                <div className="mt-3 text-xs bg-amber-50 text-amber-800 p-2 rounded-lg">Add ₹{freeDeliveryAbove - subtotal} more to get FREE delivery!</div>
              )}
              <Link href="/checkout"><Button className="hidden md:flex w-full mt-5 bg-teal-600 hover:bg-teal-700 text-white h-12 rounded-full font-bold shadow-lift">Proceed to Checkout <ArrowRight className="ml-1 w-4 h-4" /></Button></Link>
              <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                <div className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-emerald-600" /> Secure checkout</div>
                <div className="flex items-center gap-1.5"><Truck className="w-4 h-4 text-emerald-600" /> Fast delivery</div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Sticky checkout bar mobile */}
      <div className="md:hidden fixed bottom-16 left-0 right-0 z-30 bg-white border-t border-slate-200 p-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500">Total ({totalQty} items)</div>
            <div className="text-xl font-black text-slate-900 leading-none">₹{total}</div>
          </div>
          <Link href="/checkout"><Button className="bg-teal-600 hover:bg-teal-700 text-white h-11 px-6 rounded-full font-bold">Checkout <ArrowRight className="ml-1 w-4 h-4" /></Button></Link>
        </div>
      </div>
    </div>
  );
};

const Row = ({ k, v, good }) => (
  <div className="flex items-center justify-between">
    <span className="text-slate-600">{k}</span>
    <span className={`font-semibold ${good ? 'text-emerald-600' : 'text-slate-900'}`}>{v}</span>
  </div>
);

export default CartPage;

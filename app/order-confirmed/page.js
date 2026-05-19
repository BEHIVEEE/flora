'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Package, Truck, Home as HomeIcon, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ConfirmedInner = () => {
  const sp = useSearchParams();
  const id = sp.get('id');
  const [order, setOrder] = useState(null);
  useEffect(() => {
    if (id) fetch(`/api/orders/${id}`).then(r => r.json()).then(d => setOrder(d.order));
  }, [id]);

  return (
    <div className="container max-w-3xl mx-auto px-4 py-10 md:py-16">
      <div className="bg-white rounded-3xl border border-slate-200 p-8 md:p-12 text-center shadow-lift">
        <div className="w-20 h-20 mx-auto bg-emerald-100 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 className="w-12 h-12 text-emerald-600" />
        </div>
        <h1 className="text-2xl md:text-3xl font-black text-slate-900">Order Confirmed! 🎉</h1>
        <p className="text-slate-600 mt-2">Thank you for shopping with ChemistShop. Your order is on its way.</p>
        {order && (
          <>
            <div className="mt-6 inline-block bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3">
              <div className="text-xs text-slate-500">Order ID</div>
              <div className="text-lg font-black text-slate-900 tracking-wide">{order.id}</div>
            </div>
            <div className="mt-2 text-sm text-slate-600">Estimated delivery: <span className="font-semibold text-slate-900">{new Date(order.estimatedDelivery).toDateString()}</span></div>

            <div className="mt-8 grid grid-cols-4 gap-2 text-xs">
              {order.trackingSteps?.map((s, i) => (
                <div key={i} className={`flex flex-col items-center gap-1.5 ${s.done ? 'text-emerald-600' : 'text-slate-400'}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${s.done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100'}`}>
                    {i === 0 ? <CheckCircle2 className="w-5 h-5" /> : i === 1 ? <Package className="w-5 h-5" /> : i === 2 ? <Truck className="w-5 h-5" /> : <HomeIcon className="w-5 h-5" />}
                  </div>
                  <span className="font-semibold leading-tight">{s.label}</span>
                </div>
              ))}
            </div>

            <div className="mt-8 text-left bg-slate-50 rounded-2xl p-5">
              <h3 className="font-bold text-slate-900 mb-3">Order Summary</h3>
              <div className="space-y-2">
                {order.items?.map(i => (
                  <div key={i.id} className="flex items-center gap-3 text-sm">
                    <div className="w-12 h-12 bg-white rounded-lg overflow-hidden border border-slate-200"><img src={i.image} alt={i.name} className="w-full h-full object-cover" /></div>
                    <div className="flex-1 min-w-0"><div className="font-medium text-slate-900 truncate">{i.name}</div><div className="text-xs text-slate-500">Qty {i.qty} · ₹{i.price * i.qty}</div></div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between font-black"><span>Total Paid</span><span>₹{order.total}</span></div>
            </div>
          </>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/account?tab=orders"><Button className="bg-teal-600 hover:bg-teal-700 rounded-full h-11 px-6 font-semibold"><FileText className="w-4 h-4 mr-2" /> View My Orders</Button></Link>
          <Link href="/products"><Button variant="outline" className="rounded-full h-11 px-6 font-semibold">Continue Shopping</Button></Link>
        </div>
      </div>
    </div>
  );
};

const Page = () => <Suspense fallback={<div className="p-10 text-center">Loading…</div>}><ConfirmedInner /></Suspense>;
export default Page;

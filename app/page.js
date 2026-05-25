'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ShieldCheck, Truck, Stethoscope, Pill, HeartPulse, Bandage, Baby, Leaf, Sparkles, Activity, Star, Clock, Award, MessageCircle, Upload, Scissors, Bone, Wheat, Clipboard, Sun, Cat, BriefcaseMedical } from 'lucide-react';
import ProductCard from '@/components/ProductCard';
import ProductSkeleton from '@/components/ProductSkeleton';
import { Button } from '@/components/ui/button';
import { useSettings } from '@/components/SettingsProvider';

const ICONS = { Pill, Stethoscope, HeartPulse, Bandage, Baby, Leaf, Sparkles, Activity, Scissors, Bone, Wheat, Clipboard, Sun, Cat, BriefcaseMedical };
const CAT_COLORS = [
  'from-teal-500 to-emerald-500',
  'from-blue-500 to-cyan-500',
  'from-pink-500 to-rose-500',
  'from-red-500 to-orange-500',
  'from-amber-400 to-yellow-500',
  'from-green-500 to-emerald-500',
  'from-fuchsia-500 to-purple-500',
  'from-indigo-500 to-violet-500',
  'from-orange-400 to-amber-500',
  'from-cyan-500 to-blue-500',
  'from-rose-400 to-pink-500',
  'from-emerald-400 to-teal-500',
];

const Home = () => {
  const { shopName, tagline, freeDeliveryAbove, slotsEnabled } = useSettings();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/products?limit=20')
      .then(r => r.json())
      .then(d => { setProducts(d.products || []); setLoading(false); })
      .catch(() => setLoading(false));
    fetch('/api/categories?tree=true')
      .then(r => r.json())
      .then(d => setCategories(d.categories || []));
  }, []);

  const bestSellers = products.filter(p => p.tags?.includes('Best Seller')).slice(0, 8);
  const trending = products.filter(p => p.tags?.includes('Trending')).slice(0, 8);
  const newArrivals = products.filter(p => p.tags?.includes('New Arrivals')).slice(0, 8);

  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-br from-teal-50 via-white to-emerald-50">
        <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, #99f6e4 0%, transparent 35%), radial-gradient(circle at 80% 70%, #a7f3d0 0%, transparent 40%)' }} />
        <div className="container max-w-7xl mx-auto px-4 py-10 md:py-16 grid md:grid-cols-2 gap-8 items-center relative">
          <div>
            <div className="inline-flex items-center gap-2 bg-teal-100 text-teal-800 text-xs font-semibold px-3 py-1.5 rounded-full mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-600 animate-pulse" />
              {tagline} · Trusted by 1L+ families
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-6xl font-black text-slate-900 leading-[1.05] tracking-tight text-balance">
              Your health.<br />
              <span className="bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-700 bg-clip-text text-transparent">Delivered with care.</span>
            </h1>
            <p className="mt-4 text-[15px] md:text-lg text-slate-600 max-w-lg text-balance">Order medicines, healthcare devices, and wellness essentials from certified pharmacists. Fast delivery, authentic products, expert support — every single time.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/products">
                <Button size="lg" className="bg-teal-600 hover:bg-teal-700 text-white h-12 px-6 rounded-full shadow-lift font-semibold">Shop Now <ArrowRight className="ml-1 w-4 h-4" /></Button>
              </Link>
              <Link href="/prescription">
                <Button size="lg" variant="outline" className="h-12 px-6 rounded-full border-teal-200 text-teal-800 hover:bg-teal-50 font-semibold"><Upload className="mr-1 w-4 h-4" /> Upload Prescription</Button>
              </Link>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-3 md:gap-4 max-w-md">
              {[
                { icon: Truck, t: 'Free delivery', s: `Above ₹${freeDeliveryAbove}` },
                { icon: ShieldCheck, t: '100% authentic', s: 'Verified meds' },
                { icon: Clock, t: 'Slot Delivery', s: 'Choose your time' },
              ].map((b, i) => (
                <div key={i} className="text-left">
                  <div className="w-9 h-9 rounded-lg bg-white text-teal-700 shadow-soft flex items-center justify-center mb-2"><b.icon className="w-4 h-4" /></div>
                  <div className="text-sm font-semibold text-slate-900">{b.t}</div>
                  <div className="text-xs text-slate-500">{b.s}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="relative aspect-[4/5] md:aspect-square rounded-3xl overflow-hidden shadow-lift">
              <img src="https://images.unsplash.com/photo-1576602976047-174e57a47881?w=900&q=85" alt="Pharmacy" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-teal-900/30 via-transparent to-transparent" />
            </div>
            {/* Floating cards */}
            <div className="absolute -bottom-4 -left-4 md:left-6 bg-white rounded-2xl shadow-lift p-3 flex items-center gap-3 max-w-[220px]">
              <div className="w-11 h-11 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center"><ShieldCheck className="w-5 h-5" /></div>
              <div>
                <div className="text-xs text-slate-500">Verified by</div>
                <div className="text-sm font-bold text-slate-900">Licensed Pharmacists</div>
              </div>
            </div>
            <div className="hidden md:flex absolute -top-4 right-4 bg-white rounded-2xl shadow-lift p-3 items-center gap-3">
              <div className="w-11 h-11 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center"><Star className="w-5 h-5 fill-amber-500 stroke-amber-500" /></div>
              <div>
                <div className="text-lg font-black text-slate-900 leading-none">4.8/5</div>
                <div className="text-xs text-slate-500">28,400+ reviews</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Marquee strip */}
      <div className="bg-teal-700 text-white overflow-hidden">
        <div className="flex animate-marquee whitespace-nowrap py-2.5 text-sm font-medium">
          {Array(2).fill(0).map((_, k) => (
            <div key={k} className="flex shrink-0">
              {['🏥 Apka Apna Chemist – Trusted Care Near You','💖 Your Health, Our Priority Always','🚚 Free delivery on orders above ₹499','💊 60%–70% off on generic products','💊 10% off on medicines','⏱️ Scheduled slot-based delivery'].map((t, i) => (
                <span key={i} className="mx-8 flex items-center gap-2 opacity-90">{t}</span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Categories */}
      <section className="container max-w-7xl mx-auto px-4 py-10 md:py-16">
        <div className="flex items-end justify-between mb-7">
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Shop by Category</h2>
            <p className="text-slate-500 mt-1">Curated essentials for every health need</p>
          </div>
          <Link href="/products" className="hidden md:flex items-center text-sm font-semibold text-teal-700 hover:text-teal-800">View all <ArrowRight className="ml-1 w-4 h-4" /></Link>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 md:gap-4">
          {categories.filter(c => c.type === 'main').map((c, i) => {
            const Ic = ICONS[c.icon] || Pill;
            const color = CAT_COLORS[i % CAT_COLORS.length];
            return (
              <Link key={c.id} href={`/category/${c.slug}`} className="group bg-white rounded-2xl border border-slate-200 p-3 md:p-4 hover:shadow-lift hover:border-teal-200 transition-all text-center flex flex-col items-center justify-center min-h-[112px] md:min-h-[128px]">
                <div className={`w-12 h-12 md:w-14 md:h-14 rounded-xl bg-gradient-to-br ${color} text-white flex items-center justify-center mb-2 md:mb-3 group-hover:scale-110 transition-transform shadow-lift shrink-0`}>
                  <Ic className="w-6 h-6" />
                </div>
                <div className="text-[11px] md:text-sm font-semibold text-slate-800 leading-tight line-clamp-2 text-balance">{c.name}</div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Prescription banner */}
      <section className="container max-w-7xl mx-auto px-4 pb-12 md:pb-16">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-600 via-teal-700 to-emerald-700 text-white">
          <div className="absolute -right-10 -bottom-10 w-72 h-72 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -left-10 -top-10 w-64 h-64 rounded-full bg-emerald-400/20 blur-2xl" />
          <div className="relative grid md:grid-cols-2 gap-6 p-7 md:p-12 items-center">
            <div>
              <span className="inline-flex items-center gap-1 bg-white/15 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-semibold mb-4">Save up to 25%</span>
              <h3 className="text-2xl md:text-4xl font-black tracking-tight text-balance">Upload your prescription, we’ll deliver at your chosen slot.</h3>
              <p className="mt-3 text-teal-50 max-w-md text-balance">Our certified pharmacists review every prescription. Authentic medicines, doorstep delivery, full privacy.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/prescription">
                  <Button size="lg" className="bg-white text-teal-700 hover:bg-teal-50 rounded-full h-12 px-6 font-bold shadow-lift"><Upload className="mr-2 w-4 h-4" /> Upload Prescription</Button>
                </Link>
                <Link href="/chat">
                  <Button size="lg" variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white rounded-full h-12 px-6 font-semibold"><MessageCircle className="mr-2 w-4 h-4" /> Chat with Pharmacist</Button>
                </Link>
              </div>
            </div>
            <div className="relative h-60 md:h-72">
              <img src="https://images.unsplash.com/photo-1638202993928-7267aad84c31?w=800&q=85" alt="Doctor" className="absolute inset-0 w-full h-full object-cover rounded-2xl shadow-lift" />
            </div>
          </div>
        </div>
      </section>

      {/* Best Sellers */}
      <Section title="Best Sellers" subtitle="Loved by thousands across India" loading={loading} products={bestSellers.length ? bestSellers : products.slice(0, 8)} />

      {/* Promo banners */}
      <section className="container max-w-7xl mx-auto px-4 py-4">
        <div className="grid md:grid-cols-2 gap-4">
          <Link href="/products?category=devices" className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white p-7 md:p-9 min-h-[200px] flex flex-col justify-between">
            <div>
              <div className="text-xs font-bold tracking-widest opacity-90 mb-2">HEALTHCARE DEVICES</div>
              <div className="text-2xl md:text-3xl font-black leading-tight">BP Monitors, Oximeters<br />& Thermometers</div>
              <div className="mt-2 text-blue-50">Up to 30% off · Free shipping</div>
            </div>
            <div className="text-sm font-semibold flex items-center gap-1 group-hover:translate-x-1 transition-transform">Shop devices <ArrowRight className="w-4 h-4" /></div>
            <Stethoscope className="absolute -right-4 -bottom-4 w-40 h-40 text-white/15" />
          </Link>
          <Link href="/products?category=wellness" className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-7 md:p-9 min-h-[200px] flex flex-col justify-between">
            <div>
              <div className="text-xs font-bold tracking-widest opacity-90 mb-2">VITAMINS & WELLNESS</div>
              <div className="text-2xl md:text-3xl font-black leading-tight">Boost your immunity<br />everyday</div>
              <div className="mt-2 text-emerald-50">Trusted brands · Save 25%</div>
            </div>
            <div className="text-sm font-semibold flex items-center gap-1 group-hover:translate-x-1 transition-transform">Explore wellness <ArrowRight className="w-4 h-4" /></div>
            <Leaf className="absolute -right-4 -bottom-4 w-40 h-40 text-white/15" />
          </Link>
        </div>
      </section>

      <Section title="Trending Now" subtitle="What India is shopping right now" loading={loading} products={trending.length ? trending : products.slice(8, 16)} />
      <Section title="New Arrivals" subtitle="Fresh stock added this week" loading={loading} products={newArrivals.length ? newArrivals : products.slice(16, 24)} />

      {/* Why us */}
      <section className="bg-slate-50 py-14 md:py-20 mt-6">
        <div className="container max-w-7xl mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Why thousands choose ChemistShop</h2>
            <p className="text-slate-500 mt-2">Dependable healthcare backed by rigorous quality checks</p>
          </div>
          <div className="grid md:grid-cols-4 gap-5">
            {[
              { icon: Award, t: 'Premium Quality', s: 'Every batch undergoes rigorous testing for reliable, safe, high-performing supplies.' },
              { icon: Truck, t: 'Swift Shipping', s: 'Fast, trackable delivery across India — you receive essentials exactly when you need them.' },
              { icon: MessageCircle, t: 'Expert Support', s: 'Certified pharmacists answer queries and recommend optimal product use.' },
              { icon: ShieldCheck, t: 'Guaranteed Safety', s: 'All products comply with global healthcare standards and regulatory compliance.' },
            ].map((f, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-slate-200 hover:border-teal-200 hover:shadow-lift transition-all">
                <div className="w-12 h-12 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center mb-4"><f.icon className="w-6 h-6" /></div>
                <h3 className="font-bold text-slate-900">{f.t}</h3>
                <p className="text-sm text-slate-600 mt-1.5">{f.s}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="container max-w-7xl mx-auto px-4 py-14 md:py-20">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Trusted by Thousands</h2>
          <p className="text-slate-500 mt-2">Real reviews from real customers</p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {[
            { name: 'Aaruhi Patel', role: 'Verified Customer', text: 'Amazing product quality! The delivery was super fast and packaging was perfect. Highly recommend.', rating: 5 },
            { name: 'Ishika Sharma', role: 'Loyal Customer', text: 'Customer service was outstanding. The pharmacist helped me find exactly what I needed.', rating: 5 },
            { name: 'Ruhani Gupta', role: 'First-time Buyer', text: 'Fast delivery, great packaging and authentic medicines. Will definitely shop again!', rating: 5 },
          ].map((r, i) => (
            <div key={i} className="bg-white rounded-2xl p-6 border border-slate-200 hover:shadow-lift transition-all">
              <div className="flex gap-0.5 mb-3">{Array(r.rating).fill(0).map((_, k) => <Star key={k} className="w-4 h-4 fill-amber-400 stroke-amber-400" />)}</div>
              <p className="text-slate-700 leading-relaxed text-[15px]">“{r.text}”</p>
              <div className="mt-5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-emerald-500 text-white font-bold flex items-center justify-center">{r.name[0]}</div>
                <div>
                  <div className="font-semibold text-slate-900 text-sm">{r.name}</div>
                  <div className="text-xs text-slate-500">{r.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

const Section = ({ title, subtitle, products, loading }) => (
  <section className="container max-w-7xl mx-auto px-4 py-8">
    <div className="flex items-end justify-between mb-5">
      <div>
        <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">{title}</h2>
        {subtitle && <p className="text-slate-500 text-sm mt-0.5">{subtitle}</p>}
      </div>
      <Link href="/products" className="text-sm font-semibold text-teal-700 hover:text-teal-800 flex items-center">See all <ArrowRight className="ml-1 w-4 h-4" /></Link>
    </div>
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
      {loading
        ? Array(8).fill(0).map((_, i) => <ProductSkeleton key={i} />)
        : products.map(p => <ProductCard key={p.id} product={p} />)}
    </div>
  </section>
);

export default Home;

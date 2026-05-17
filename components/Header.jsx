'use client';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Search, ShoppingCart, User, MapPin, Menu, X, Heart, FileText, Phone } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCart } from './CartProvider';
import { CATEGORIES } from '@/lib/seed-data';

const Header = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { totalQty } = useCart() || { totalQty: 0 };
  const [q, setQ] = useState('');
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (pathname?.startsWith('/admin')) return null;

  const onSearch = (e) => {
    e.preventDefault();
    if (q.trim()) router.push(`/products?search=${encodeURIComponent(q.trim())}`);
  };

  return (
    <header className={`sticky top-0 z-40 bg-white/95 backdrop-blur-md transition-all ${scrolled ? 'shadow-soft border-b border-slate-100' : 'border-b border-transparent'}`}>
      {/* Top promo bar */}
      <div className="hidden md:block bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-600 text-white text-xs">
        <div className="container max-w-7xl mx-auto flex items-center justify-between py-1.5 px-4">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> Deliver to Mumbai 400001</span>
            <span className="opacity-80">Free delivery on orders above ₹499</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/prescription" className="hover:underline">Upload Prescription</Link>
            <Link href="/account" className="hover:underline">Track Order</Link>
            <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> 1800-XXX-XXXX</span>
          </div>
        </div>
      </div>

      {/* Main bar */}
      <div className="container max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden text-slate-700"><Menu className="w-5 h-5" /></Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 p-0">
            <div className="p-5 bg-gradient-to-br from-teal-600 to-emerald-600 text-white">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-10 h-10 bg-white text-teal-700 rounded-xl flex items-center justify-center font-black text-xl">+</div>
                <div>
                  <div className="font-black text-lg leading-tight">ChemistShop</div>
                  <div className="text-[11px] opacity-90 leading-none">Apka Apna Chemist</div>
                </div>
              </Link>
            </div>
            <nav className="p-2">
              <Link href="/" className="block px-4 py-3 rounded-lg hover:bg-slate-50 font-medium">Home</Link>
              <Link href="/products" className="block px-4 py-3 rounded-lg hover:bg-slate-50 font-medium">All Products</Link>
              <Link href="/prescription" className="block px-4 py-3 rounded-lg hover:bg-slate-50 font-medium">Upload Prescription</Link>
              <Link href="/account" className="block px-4 py-3 rounded-lg hover:bg-slate-50 font-medium">My Account</Link>
              <Link href="/account?tab=orders" className="block px-4 py-3 rounded-lg hover:bg-slate-50 font-medium">My Orders</Link>
              <div className="px-4 pt-4 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Categories</div>
              {CATEGORIES.map(c => (
                <Link key={c.id} href={`/products?category=${c.id}`} className="block px-4 py-2.5 rounded-lg hover:bg-slate-50">{c.name}</Link>
              ))}
            </nav>
          </SheetContent>
        </Sheet>

        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-10 h-10 bg-gradient-to-br from-teal-600 to-emerald-600 text-white rounded-xl flex items-center justify-center font-black text-2xl shadow-lift">+</div>
          <div className="hidden sm:block">
            <div className="font-black text-[17px] leading-tight text-slate-900">ChemistShop</div>
            <div className="text-[10px] text-teal-700 font-semibold leading-none tracking-wide">APKA APNA CHEMIST</div>
          </div>
        </Link>

        <form onSubmit={onSearch} className="flex-1 max-w-2xl mx-auto">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search medicines, devices, wellness…" className="pl-10 pr-20 h-11 rounded-full border-slate-200 bg-slate-50/70 focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-100" />
            <Button type="submit" size="sm" className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 rounded-full bg-teal-600 hover:bg-teal-700 text-white px-4">Search</Button>
          </div>
        </form>

        <Link href="/prescription" className="hidden lg:flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-teal-700 px-3 py-2 rounded-lg hover:bg-teal-50 transition-colors">
          <FileText className="w-4 h-4" />
          <span>Upload Rx</span>
        </Link>
        <Link href="/account" className="hidden md:flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-teal-700 px-3 py-2 rounded-lg hover:bg-teal-50 transition-colors">
          <User className="w-4 h-4" />
          <span>Account</span>
        </Link>
        <Link href="/cart" className="relative flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-teal-700 px-3 py-2 rounded-lg hover:bg-teal-50 transition-colors">
          <ShoppingCart className="w-5 h-5" />
          <span className="hidden md:inline">Cart</span>
          {totalQty > 0 && <span className="absolute -top-0.5 -right-0.5 md:static md:ml-1 bg-rose-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">{totalQty}</span>}
        </Link>
      </div>

      {/* Category strip - desktop */}
      <div className="hidden md:block border-t border-slate-100 bg-white">
        <div className="container max-w-7xl mx-auto px-4 py-1">
          <nav className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
            <Link href="/products" className="text-sm font-medium text-slate-700 hover:text-teal-700 px-3 py-2 whitespace-nowrap rounded-md hover:bg-teal-50">All</Link>
            {CATEGORIES.map(c => (
              <Link key={c.id} href={`/products?category=${c.id}`} className="text-sm font-medium text-slate-700 hover:text-teal-700 px-3 py-2 whitespace-nowrap rounded-md hover:bg-teal-50">{c.name}</Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;

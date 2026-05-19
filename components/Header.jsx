'use client';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Search, ShoppingCart, User, MapPin, Menu, X, Heart, FileText, Phone, LogOut, Package, LogIn, UserPlus, ShieldCheck, Bike } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useCart } from './CartProvider';
import { useAuth } from './AuthProvider';
import { useSettings } from './SettingsProvider';
import { useDeliveryRange } from '@/hooks/useDeliveryRange';

const Header = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { totalQty } = useCart() || { totalQty: 0 };
  const { user, logout } = useAuth() || { user: null, logout: () => {} };
  const { shopName, tagline, contactPhone, freeDeliveryAbove } = useSettings();
  const [q, setQ] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const [categories, setCategories] = useState([]);
  const { location, distance, inRange, radiusKm, configured, detect } = useDeliveryRange();

  useEffect(() => {
    fetch('/api/categories?tree=true').then(r => r.json()).then(d => setCategories(d.categories || []));
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (pathname?.startsWith('/admin')) return null;
  if (pathname === '/login' || pathname === '/signup') return null;

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
            {location?.city ? (
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3 h-3" /> Deliver to {location.city} {location.pincode}
                {configured && distance != null && (
                  inRange
                    ? <span className="ml-1 px-1.5 py-0.5 rounded-full bg-emerald-500/30 text-emerald-50 text-[10px] font-bold">In range · {distance.toFixed(1)} km</span>
                    : <span className="ml-1 px-1.5 py-0.5 rounded-full bg-rose-500/30 text-rose-50 text-[10px] font-bold">Out of {radiusKm} km range</span>
                )}
              </span>
            ) : (
              <button onClick={detect} className="flex items-center gap-1 hover:underline"><MapPin className="w-3 h-3" /> Select delivery location</button>
            )}
            <span className="opacity-80">Free delivery on orders above ₹{freeDeliveryAbove}</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/prescription" className="hover:underline">Upload Prescription</Link>
            <Link href="/account" className="hover:underline">Track Order</Link>
            <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {contactPhone}</span>
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
                  <div className="font-black text-lg leading-tight">{shopName}</div>
                  <div className="text-[11px] opacity-90 leading-none">{tagline}</div>
                </div>
              </Link>
            </div>
            <nav className="p-2">
              {user ? (
                <div className="px-4 py-3 mb-2 bg-teal-50/60 mx-2 rounded-xl flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-emerald-500 text-white font-bold flex items-center justify-center">{(user.name || user.email)[0].toUpperCase()}</div>
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-slate-900 truncate">{user.name || 'Welcome'}</div>
                    <div className="text-[11px] text-slate-500 truncate">{user.email}</div>
                  </div>
                </div>
              ) : (
                <div className="px-2 mb-2 grid grid-cols-2 gap-2">
                  <Link href="/login" className="block text-center px-3 py-2.5 rounded-lg bg-teal-600 text-white text-sm font-bold">Sign In</Link>
                  <Link href="/signup" className="block text-center px-3 py-2.5 rounded-lg border border-teal-600 text-teal-700 text-sm font-bold">Sign Up</Link>
                </div>
              )}
              <Link href="/" className="block px-4 py-3 rounded-lg hover:bg-slate-50 font-medium">Home</Link>
              <Link href="/products" className="block px-4 py-3 rounded-lg hover:bg-slate-50 font-medium">All Products</Link>
              <Link href="/prescription" className="block px-4 py-3 rounded-lg hover:bg-slate-50 font-medium">Upload Prescription</Link>
              <Link href="/account" className="block px-4 py-3 rounded-lg hover:bg-slate-50 font-medium">My Account</Link>
              <Link href="/account?tab=orders" className="block px-4 py-3 rounded-lg hover:bg-slate-50 font-medium">My Orders</Link>
              {user?.role === 'admin' && <Link href="/admin" className="block px-4 py-3 rounded-lg bg-teal-50 text-teal-800 font-bold">Admin Panel</Link>}
              {user?.role === 'rider' && <Link href="/rider" className="block px-4 py-3 rounded-lg bg-teal-50 text-teal-800 font-bold">Rider Panel</Link>}
              {user && <button onClick={logout} className="w-full text-left block px-4 py-3 rounded-lg hover:bg-rose-50 text-rose-600 font-medium">Sign Out</button>}
              <div className="px-4 pt-4 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Categories</div>
              {categories.map(c => (
                <Link key={c.id} href={`/category/${c.slug}`} className="block px-4 py-2.5 rounded-lg hover:bg-slate-50">{c.name}</Link>
              ))}
            </nav>
          </SheetContent>
        </Sheet>

        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-10 h-10 bg-gradient-to-br from-teal-600 to-emerald-600 text-white rounded-xl flex items-center justify-center font-black text-2xl shadow-lift">+</div>
          <div className="hidden sm:block">
            <div className="font-black text-[17px] leading-tight text-slate-900">{shopName}</div>
            <div className="text-[10px] text-teal-700 font-semibold leading-none tracking-wide">{tagline?.toUpperCase()}</div>
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

        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="hidden md:flex items-center gap-2 px-2.5 py-1.5 rounded-full hover:bg-teal-50 transition-colors">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-500 to-emerald-500 text-white font-bold flex items-center justify-center text-sm">{(user.name || user.email || 'U')[0].toUpperCase()}</div>
                <div className="text-left max-w-[120px]">
                  <div className="text-[10px] text-slate-500 leading-none">Hi,</div>
                  <div className="text-xs font-bold text-slate-900 leading-tight truncate">{(user.name || user.email).split(' ')[0]}</div>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-bold">
                <div className="text-sm truncate">{user.name || 'Welcome'}</div>
                <div className="text-[11px] text-slate-500 font-normal truncate">{user.email}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/account')}><User className="w-4 h-4 mr-2" /> My Account</DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/account?tab=orders')}><Package className="w-4 h-4 mr-2" /> My Orders</DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/account?tab=prescriptions')}><FileText className="w-4 h-4 mr-2" /> Prescriptions</DropdownMenuItem>
              {user.role === 'admin' && (<><DropdownMenuSeparator /><DropdownMenuItem onClick={() => router.push('/admin')}><ShieldCheck className="w-4 h-4 mr-2 text-teal-700" /> <span className="font-semibold text-teal-700">Admin Panel</span></DropdownMenuItem></>)}
              {user.role === 'rider' && (<><DropdownMenuSeparator /><DropdownMenuItem onClick={() => router.push('/rider')}><Bike className="w-4 h-4 mr-2 text-teal-700" /> <span className="font-semibold text-teal-700">Rider Panel</span></DropdownMenuItem></>)}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-rose-600 focus:text-rose-700 focus:bg-rose-50"><LogOut className="w-4 h-4 mr-2" /> Sign Out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Link href="/login" className="hidden md:flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-teal-700 px-3 py-2 rounded-lg hover:bg-teal-50 transition-colors">
            <LogIn className="w-4 h-4" />
            <span>Sign In</span>
          </Link>
        )}
        <Link href="/cart" className="relative flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-teal-700 px-3 py-2 rounded-lg hover:bg-teal-50 transition-colors">
          <ShoppingCart className="w-5 h-5" />
          <span className="hidden md:inline">Cart</span>
          {totalQty > 0 && <span className="absolute -top-0.5 -right-0.5 md:static md:ml-1 bg-rose-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">{totalQty}</span>}
        </Link>
      </div>

      {/* Mobile location strip */}
      <div className={`md:hidden border-t border-slate-100 ${configured && inRange === false ? 'bg-rose-50' : 'bg-teal-50/50'}`}>
        <div className="container max-w-7xl mx-auto px-4 py-2">
          {location?.city ? (
            <button onClick={detect} className="w-full flex items-center justify-between text-left">
              <div className="flex items-center gap-2 min-w-0">
                <MapPin className={`w-4 h-4 shrink-0 ${configured && inRange === false ? 'text-rose-600' : 'text-teal-700'}`} />
                <div className="min-w-0">
                  <div className="text-[10px] text-slate-500 leading-none uppercase tracking-wider font-semibold">Deliver to</div>
                  <div className="text-xs font-bold text-slate-900 truncate">
                    {location.city}{location.pincode ? `, ${location.pincode}` : ''}
                    {configured && distance != null && (
                      inRange
                        ? <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px]">In range · {distance.toFixed(1)} km</span>
                        : <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px]">Out of {radiusKm} km</span>
                    )}
                  </div>
                </div>
              </div>
              <span className="text-[11px] text-teal-700 font-bold shrink-0">Change</span>
            </button>
          ) : (
            <button onClick={detect} className="w-full flex items-center gap-2 text-teal-700">
              <MapPin className="w-4 h-4 shrink-0" />
              <span className="text-xs font-bold">Detect my delivery location</span>
            </button>
          )}
        </div>
      </div>

      {/* Category strip - desktop */}
      <div className="hidden md:block border-t border-slate-100 bg-white">
        <div className="container max-w-7xl mx-auto px-4 py-1">
          <nav className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
            <Link href="/products" className="text-sm font-medium text-slate-700 hover:text-teal-700 px-3 py-2 whitespace-nowrap rounded-md hover:bg-teal-50">All</Link>
            {categories.map(c => (
              <Link key={c.id} href={`/category/${c.slug}`} className="text-sm font-medium text-slate-700 hover:text-teal-700 px-3 py-2 whitespace-nowrap rounded-md hover:bg-teal-50">{c.name}</Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;

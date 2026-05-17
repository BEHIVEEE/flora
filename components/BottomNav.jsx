'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, ShoppingCart, User, FileText } from 'lucide-react';
import { useCart } from './CartProvider';

const items = [
  { href: '/', label: 'Home', icon: Home, match: (p) => p === '/' },
  { href: '/products', label: 'Shop', icon: Search, match: (p) => p.startsWith('/products') || p.startsWith('/product') },
  { href: '/prescription', label: 'Upload Rx', icon: FileText, match: (p) => p.startsWith('/prescription') },
  { href: '/cart', label: 'Cart', icon: ShoppingCart, match: (p) => p.startsWith('/cart') || p.startsWith('/checkout') },
  { href: '/account', label: 'Account', icon: User, match: (p) => p.startsWith('/account') },
];

const BottomNav = () => {
  const pathname = usePathname();
  const { totalQty } = useCart() || { totalQty: 0 };
  if (pathname?.startsWith('/admin')) return null;
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-[0_-4px_20px_-4px_rgba(15,23,42,0.06)]" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="grid grid-cols-5">
        {items.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname || '/');
          return (
            <Link key={href} href={href} className={`flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium relative ${active ? 'text-teal-700' : 'text-slate-500'}`}>
              <div className={`relative ${active ? 'scale-110' : ''} transition-transform`}>
                <Icon className={`w-5 h-5 ${active ? 'stroke-[2.5]' : ''}`} />
                {href === '/cart' && totalQty > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-rose-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1">{totalQty}</span>
                )}
              </div>
              <span className="leading-none">{label}</span>
              {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-teal-600 rounded-full" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;

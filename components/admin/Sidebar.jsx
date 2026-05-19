'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Package, ShoppingBag, Clock, Settings, ExternalLink, LogOut, X, Menu, FileText, Users, Boxes, Bike } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/products', label: 'Products', icon: Package },
  { href: '/admin/orders', label: 'Orders', icon: ShoppingBag },
  { href: '/admin/riders', label: 'Riders', icon: Bike },
  { href: '/admin/prescriptions', label: 'Prescriptions', icon: FileText },
  { href: '/admin/customers', label: 'Customers', icon: Users },
  { href: '/admin/inventory', label: 'Inventory', icon: Boxes },
  { href: '/admin/categories', label: 'Categories', icon: Boxes },
  { href: '/admin/slots', label: 'Delivery Slots', icon: Clock },
  { href: '/admin/settings', label: 'Shop Settings', icon: Settings },
];

const NavItems = ({ pathname, onNavigate }) => (
  <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
    {NAV.map(item => {
      const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
      return (
        <Link key={item.href} href={item.href} onClick={onNavigate} className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${active ? 'bg-teal-600 text-white shadow-lift' : 'text-slate-700 hover:bg-slate-100'}`}>
          <item.icon className={`w-[18px] h-[18px] ${active ? 'text-white' : 'text-slate-500 group-hover:text-slate-700'}`} />
          <span>{item.label}</span>
        </Link>
      );
    })}
  </nav>
);

const SidebarContent = ({ pathname, onNavigate, router, user, signOut }) => (
  <>
    <div className="p-5 border-b border-slate-200">
      <Link href="/admin" onClick={onNavigate} className="flex items-center gap-2.5">
        <div className="w-10 h-10 bg-gradient-to-br from-teal-600 to-emerald-600 text-white rounded-xl flex items-center justify-center font-black text-2xl shadow-lift">+</div>
        <div>
          <div className="font-black text-slate-900 leading-tight">ChemistShop</div>
          <div className="text-[10px] font-bold text-teal-700 tracking-widest uppercase leading-none mt-0.5">Admin Panel</div>
        </div>
      </Link>
    </div>
    <NavItems pathname={pathname} onNavigate={onNavigate} />
    <div className="p-3 border-t border-slate-200 space-y-1">
      {user && (
        <div className="px-3 py-2 mb-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-500 to-emerald-500 text-white font-bold flex items-center justify-center text-sm">{(user.name || user.email || 'A')[0].toUpperCase()}</div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 truncate">{user.name || 'Admin'}</div>
              <div className="text-[10px] text-slate-500 truncate">{user.email}</div>
            </div>
          </div>
        </div>
      )}
      <Link href="/" onClick={onNavigate} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-100">
        <ExternalLink className="w-4 h-4 text-slate-500" /><span>View Storefront</span>
      </Link>
      <button onClick={signOut} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-rose-600 hover:bg-rose-50">
        <LogOut className="w-4 h-4" /><span>Sign Out</span>
      </button>
    </div>
  </>
);

const Sidebar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth() || { user: null, logout: () => {} };

  const signOut = () => { logout(); toast.success('Signed out'); setOpen(false); };

  return (
    <>
      <div className="lg:hidden sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="p-2 -ml-2 hover:bg-slate-100 rounded-lg"><Menu className="w-5 h-5" /></button>
        <Link href="/admin" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-teal-600 to-emerald-600 text-white rounded-lg flex items-center justify-center font-black text-lg">+</div>
          <div className="font-black text-slate-900">Admin</div>
        </Link>
      </div>

      <aside className="hidden lg:flex flex-col fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 z-30">
        <SidebarContent pathname={pathname} onNavigate={() => {}} router={router} user={user} signOut={signOut} />
      </aside>

      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-white flex flex-col shadow-2xl">
            <button onClick={() => setOpen(false)} className="absolute top-4 right-4 p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
            <SidebarContent pathname={pathname} onNavigate={() => setOpen(false)} router={router} user={user} signOut={signOut} />
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;

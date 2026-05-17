'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Sidebar from '@/components/admin/Sidebar';

const AdminLayout = ({ children }) => {
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState('checking'); // checking | authed | unauth

  useEffect(() => {
    if (pathname === '/admin/login') { setState('authed'); return; }
    const token = typeof window !== 'undefined' ? localStorage.getItem('cs_admin_token') : null;
    if (!token) { router.replace('/admin/login'); return; }
    fetch('/api/admin/me', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(d => {
        if (d.ok) setState('authed');
        else { localStorage.removeItem('cs_admin_token'); router.replace('/admin/login'); }
      })
      .catch(() => { localStorage.removeItem('cs_admin_token'); router.replace('/admin/login'); });
  }, [pathname, router]);

  if (pathname === '/admin/login') return <div className="min-h-screen bg-slate-50">{children}</div>;
  if (state !== 'authed') return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex items-center gap-3 text-slate-500">
        <div className="w-5 h-5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
        Checking access…
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <div className="lg:pl-64">
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">{children}</div>
      </div>
    </div>
  );
};

export default AdminLayout;

'use client';
import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const lastPath = useRef('');

  const refresh = useCallback(async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('cs_token') : null;
    if (!token) { setUser(null); setLoading(false); return null; }
    try {
      const res = await fetch('/api/auth/me', { headers: { Authorization: 'Bearer ' + token } });
      const d = await res.json();
      if (d.ok) { setUser(d.user); setLoading(false); return d.user; }
      localStorage.removeItem('cs_token'); setUser(null); setLoading(false); return null;
    } catch { setUser(null); setLoading(false); return null; }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Route guard: enforce role-based access whenever path or user changes
  useEffect(() => {
    if (loading) return;
    if (lastPath.current === pathname && user) return;
    lastPath.current = pathname;
    const isAdminRoute = pathname?.startsWith('/admin') && pathname !== '/admin/login';
    const isAuthPage = pathname === '/login' || pathname === '/signup' || pathname === '/admin/login';
    const isProtectedUserRoute = pathname?.startsWith('/account');

    if (isAdminRoute) {
      if (!user) { router.replace('/login?next=' + encodeURIComponent(pathname) + '&hint=admin'); return; }
      if (user.role !== 'admin') { router.replace('/'); return; }
    }
    if (isProtectedUserRoute && !user) {
      router.replace('/login?next=' + encodeURIComponent(pathname));
      return;
    }
    if (isAuthPage && user) {
      if (user.role === 'admin') router.replace('/admin');
      else router.replace('/');
    }
  }, [pathname, user, loading, router]);

  const setTokenCookie = (token) => {
    document.cookie = `cs_token=${token}; path=/; max-age=${7 * 86400}; SameSite=Lax`;
  };
  const clearTokenCookie = () => {
    document.cookie = `cs_token=; path=/; max-age=0; SameSite=Lax`;
  };

  const login = async (email, password) => {
    const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const d = await res.json();
    if (!d.ok) throw new Error(d.error || 'Login failed');
    localStorage.setItem('cs_token', d.token);
    setTokenCookie(d.token);
    setUser(d.user);
    return d.user;
  };

  const signup = async ({ name, email, password, phone }) => {
    const res = await fetch('/api/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, password, phone }) });
    const d = await res.json();
    if (!d.ok) throw new Error(d.error || 'Signup failed');
    localStorage.setItem('cs_token', d.token);
    setTokenCookie(d.token);
    setUser(d.user);
    return d.user;
  };

  const logout = () => {
    localStorage.removeItem('cs_token');
    localStorage.removeItem('cs_admin_token'); // legacy cleanup
    clearTokenCookie();
    setUser(null);
    router.push('/');
  };

  const authFetch = async (url, options = {}) => {
    const token = localStorage.getItem('cs_token');
    return fetch(url, { ...options, headers: { ...(options.headers || {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) } });
  };

  const isAdmin = user?.role === 'admin';
  return <AuthCtx.Provider value={{ user, loading, login, signup, logout, refresh, authFetch, isAdmin }}>{children}</AuthCtx.Provider>;
};

export default AuthProvider;

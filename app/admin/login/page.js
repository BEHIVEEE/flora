'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Mail, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const Login = () => {
  const router = useRouter();
  const [email, setEmail] = useState('admin@chemistshop.top');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const d = await res.json();
      if (d.ok && d.token) {
        localStorage.setItem('cs_admin_token', d.token);
        toast.success(`Welcome back, ${d.user.name || 'Admin'}`);
        router.push('/admin');
      } else {
        toast.error(d.error || 'Login failed');
      }
    } catch { toast.error('Network error'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-teal-50 via-white to-emerald-50">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 bg-gradient-to-br from-teal-600 to-emerald-600 text-white rounded-2xl flex items-center justify-center font-black text-3xl shadow-lift">+</div>
          <h1 className="mt-4 text-2xl font-black text-slate-900 tracking-tight">ChemistShop Admin</h1>
          <p className="text-sm text-slate-500 mt-1">Sign in to manage your shop</p>
        </div>

        <form onSubmit={submit} className="bg-white border border-slate-200 rounded-2xl p-6 md:p-7 shadow-lift">
          <div className="space-y-4">
            <div>
              <Label className="text-xs font-semibold text-slate-700">Email</Label>
              <div className="relative mt-1.5">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="admin@chemistshop.top" className="pl-9 h-11 rounded-xl" />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700">Password</Label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input value={password} onChange={(e) => setPassword(e.target.value)} type={show ? 'text' : 'password'} required placeholder="••••••••" className="pl-9 pr-10 h-11 rounded-xl" />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700">{show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
              </div>
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full mt-6 bg-teal-600 hover:bg-teal-700 text-white h-11 rounded-full font-bold shadow-lift">{loading ? 'Signing in…' : 'Sign In'}</Button>
          <div className="mt-5 p-3 bg-teal-50 border border-teal-100 rounded-xl text-xs text-teal-900">
            <div className="font-bold">Demo credentials</div>
            <div className="mt-0.5">Email: <code className="font-mono">admin@chemistshop.top</code></div>
            <div>Password: <code className="font-mono">admin123</code></div>
            <div className="mt-1 text-teal-700/80">Change your password from Shop Settings after login.</div>
          </div>
        </form>
        <div className="text-center mt-5 text-xs text-slate-500">© {new Date().getFullYear()} ChemistShop · <a href="/" className="hover:text-teal-700">View Storefront</a></div>
      </div>
    </div>
  );
};

export default Login;

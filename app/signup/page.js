'use client';
import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Lock, Mail, Eye, EyeOff, ArrowRight, User as UserIcon, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';

const SignupInner = () => {
  const router = useRouter();
  const sp = useSearchParams();
  const { signup } = useAuth() || {};
  const next = sp.get('next');
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      const user = await signup(form);
      toast.success(`Welcome to ChemistShop, ${user.name || user.email.split('@')[0]}!`);
      router.replace(next || '/');
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  const u = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-teal-50 via-white to-emerald-50">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-6">
          <Link href="/" className="w-14 h-14 bg-gradient-to-br from-teal-600 to-emerald-600 text-white rounded-2xl flex items-center justify-center font-black text-3xl shadow-lift">+</Link>
          <h1 className="mt-4 text-2xl font-black text-slate-900 tracking-tight">Create your account</h1>
          <p className="text-sm text-slate-500 mt-1">Order medicines & wellness essentials in minutes</p>
        </div>
        <form onSubmit={submit} className="bg-white border border-slate-200 rounded-2xl p-6 md:p-7 shadow-lift">
          <div className="space-y-4">
            <div>
              <Label className="text-xs font-semibold text-slate-700">Full Name</Label>
              <div className="relative mt-1.5">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input value={form.name} onChange={(e) => u('name', e.target.value)} required placeholder="Your name" className="pl-9 h-11 rounded-xl" />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700">Email</Label>
              <div className="relative mt-1.5">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input value={form.email} onChange={(e) => u('email', e.target.value)} type="email" required placeholder="you@example.com" className="pl-9 h-11 rounded-xl" />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700">Phone (optional)</Label>
              <div className="relative mt-1.5">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input value={form.phone} onChange={(e) => u('phone', e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit mobile" className="pl-9 h-11 rounded-xl" />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700">Password</Label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input value={form.password} onChange={(e) => u('password', e.target.value)} type={show ? 'text' : 'password'} required minLength={6} placeholder="Min 6 characters" className="pl-9 pr-10 h-11 rounded-xl" />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700">{show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
              </div>
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full mt-6 bg-teal-600 hover:bg-teal-700 text-white h-11 rounded-full font-bold shadow-lift">{loading ? 'Creating account…' : 'Create Account'} <ArrowRight className="w-4 h-4 ml-1" /></Button>
          <div className="mt-4 text-center text-sm text-slate-600">
            Already have an account? <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-bold text-teal-700 hover:text-teal-800">Sign in</Link>
          </div>
          <div className="mt-3 text-[11px] text-slate-500 text-center">By signing up you agree to our Terms & Privacy Policy.</div>
        </form>
      </div>
    </div>
  );
};

const SignupPage = () => <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading…</div>}><SignupInner /></Suspense>;
export default SignupPage;

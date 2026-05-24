'use client';
import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Lock, Mail, Eye, EyeOff, ArrowRight, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';
import GoogleLoginButton from '@/components/GoogleLoginButton';
import OTPLogin from '@/components/OTPLogin';

const LoginInner = () => {
  const router = useRouter();
  const sp = useSearchParams();
  const { login } = useAuth() || {};
  const next = sp.get('next');
  const hint = sp.get('hint');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginMethod, setLoginMethod] = useState('email'); // 'email', 'otp', 'google'

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(email, password);
      toast.success(`Welcome back, ${user.name || user.email.split('@')[0]}`);
      if (user.role === 'admin') router.replace('/admin');
      else router.replace(next || '/');
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-teal-50 via-white to-emerald-50">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-6">
          <Link href="/" className="w-14 h-14 bg-gradient-to-br from-teal-600 to-emerald-600 text-white rounded-2xl flex items-center justify-center font-black text-3xl shadow-lift">+</Link>
          <h1 className="mt-4 text-2xl font-black text-slate-900 tracking-tight">{hint === 'admin' ? 'Admin Sign In' : 'Welcome back'}</h1>
          <p className="text-sm text-slate-500 mt-1">{hint === 'admin' ? 'Sign in to manage your shop' : 'Sign in to ChemistShop'}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-7 shadow-lift">
          {/* Login method tabs */}
          <div className="flex gap-2 mb-6 border-b border-slate-200">
            {['email', 'otp', 'google'].map((method) => (
              <button
                key={method}
                onClick={() => setLoginMethod(method)}
                className={`pb-3 px-2 text-sm font-bold transition-colors ${
                  loginMethod === method
                    ? 'text-teal-700 border-b-2 border-teal-700'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {method === 'email' && 'Email'}
                {method === 'otp' && 'Phone OTP'}
                {method === 'google' && 'Google'}
              </button>
            ))}
          </div>

          {/* Email login */}
          {loginMethod === 'email' && (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Email</Label>
                <div className="relative mt-1.5">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="you@example.com" className="pl-9 h-11 rounded-xl" />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-slate-700">Password</Label>
                  <button type="button" className="text-[11px] font-semibold text-teal-700 hover:text-teal-800">Forgot?</button>
                </div>
                <div className="relative mt-1.5">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input value={password} onChange={(e) => setPassword(e.target.value)} type={show ? 'text' : 'password'} required placeholder="••••••••" className="pl-9 pr-10 h-11 rounded-xl" />
                  <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700">{show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                </div>
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-teal-600 hover:bg-teal-700 text-white h-11 rounded-full font-bold shadow-lift">{loading ? 'Signing in…' : 'Sign In'} <ArrowRight className="w-4 h-4 ml-1" /></Button>
            </form>
          )}

          {/* OTP login */}
          {loginMethod === 'otp' && <OTPLogin />}

          {/* Google login */}
          {loginMethod === 'google' && <GoogleLoginButton />}

          <div className="mt-4 text-center text-sm text-slate-600">
            New to ChemistShop? <Link href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-bold text-teal-700 hover:text-teal-800">Create an account</Link>
          </div>

          {hint === 'admin' && (
            <div className="mt-5 p-3 bg-teal-50 border border-teal-100 rounded-xl text-xs text-teal-900">
              <div className="font-bold flex items-center gap-1"><Shield className="w-3 h-3" /> Demo admin credentials</div>
              <div className="mt-0.5">Email: <code className="font-mono">admin@chemistshop.top</code></div>
              <div>Password: <code className="font-mono">admin123</code></div>
            </div>
          )}
        </div>
        <div className="text-center mt-4">
          <Link href="/rider/login" className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-700 hover:text-teal-800">
            Are you a delivery rider? <span className="underline">Sign in here</span>
          </Link>
        </div>
        <div className="text-center mt-3 text-xs text-slate-500">© {new Date().getFullYear()} ChemistShop · <Link href="/" className="hover:text-teal-700">Back to storefront</Link></div>
      </div>
    </div>
  );
};

const LoginPage = () => <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading…</div>}><LoginInner /></Suspense>;
export default LoginPage;

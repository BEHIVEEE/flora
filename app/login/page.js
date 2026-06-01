'use client';
import { useState, Suspense, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Lock, Mail, Eye, EyeOff, ArrowRight, Shield, Phone, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';
import GoogleLoginButton from '@/components/GoogleLoginButton';

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
  const [loginMethod, setLoginMethod] = useState('email'); // 'email', 'google', 'otp'
  
  // OTP state
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const recaptchaRef = useRef(null);
  const [recaptchaLoaded, setRecaptchaLoaded] = useState(false);

  // Load and initialize reCAPTCHA when OTP tab is active
  useEffect(() => {
    if (loginMethod !== 'otp') return;
    
    const initRecaptcha = () => {
      if (!window.grecaptcha || !recaptchaRef.current) return;
      
      // Render reCAPTCHA
      try {
        window.grecaptcha.render(recaptchaRef.current, {
          sitekey: '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI',
          size: 'invisible',
          callback: () => console.log('reCAPTCHA solved'),
          'expired-callback': () => console.log('reCAPTCHA expired')
        });
        setRecaptchaLoaded(true);
      } catch (e) {
        console.log('reCAPTCHA render error:', e);
      }
    };
    
    // Load script if not loaded
    if (!document.getElementById('recaptcha-script')) {
      const script = document.createElement('script');
      script.id = 'recaptcha-script';
      script.src = 'https://www.google.com/recaptcha/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.onload = initRecaptcha;
      document.body.appendChild(script);
    } else {
      // Script already loaded, try to init
      setTimeout(initRecaptcha, 500);
    }
  }, [loginMethod]);

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

  const sendOTP = async () => {
    if (!phone || phone.length !== 10) {
      toast.error('Enter a valid 10-digit phone number');
      return;
    }
    setOtpLoading(true);
    setOtpError('');
    
    try {
      // Execute reCAPTCHA to get token
      let recaptchaToken = '';
      try {
        if (window.grecaptcha && recaptchaRef.current) {
          recaptchaToken = await window.grecaptcha.execute();
        }
      } catch (e) {
        console.log('reCAPTCHA execute error:', e);
      }
      
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, recaptchaToken }),
      });
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      
      const data = await res.json();
      
      if (data.ok) {
        setOtpSent(true);
        toast.success('OTP sent! Check your phone or Vercel logs.');
      } else {
        setOtpError(data.error || 'Failed to send OTP');
        toast.error(data.error || 'Failed to send OTP');
      }
    } catch (err) {
      console.error('OTP send error:', err);
      setOtpError('Failed to send. Check console.');
      toast.error('Failed to send OTP. Please try again.');
    }
    
    setOtpLoading(false);
  };

  const verifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      toast.error('Enter the 6-digit OTP');
      return;
    }
    setOtpLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp }),
      });
      const data = await res.json();
      
      if (data.ok && data.token) {
        localStorage.setItem('cs_token', data.token);
        localStorage.setItem('cs_user', JSON.stringify(data.user));
        toast.success('Logged in successfully!');
        if (data.user?.role === 'admin') router.replace('/admin');
        else router.replace(next || '/');
      } else {
        setOtpError(data.error || 'Invalid OTP');
        toast.error(data.error || 'Invalid OTP');
      }
    } catch (err) {
      console.error('Verify error:', err);
      setOtpError('Verification failed');
      toast.error('Verification failed');
    }
    setOtpLoading(false);
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
                onClick={() => { setLoginMethod(method); setOtpSent(false); setOtpError(''); }}
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

          {/* Google login */}
          {loginMethod === 'google' && <GoogleLoginButton />}

          {/* OTP login */}
          {loginMethod === 'otp' && (
            <div className="space-y-4">
              {!otpSent ? (
                <>
                  <div>
                    <Label className="text-xs font-semibold text-slate-700">Phone Number</Label>
                    <div className="relative mt-1.5">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input 
                        value={phone} 
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} 
                        type="tel" 
                        required 
                        placeholder="9876543210" 
                        className="pl-9 h-11 rounded-xl" 
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Enter 10-digit mobile number</p>
                  </div>
                  
                  {/* reCAPTCHA container */}
                  <div ref={recaptchaRef} style={{ position: 'absolute', left: '-9999px' }} />
                  
                  <Button 
                    type="button" 
                    onClick={sendOTP} 
                    disabled={otpLoading || phone.length !== 10 || !recaptchaLoaded}
                    className="w-full bg-teal-600 hover:bg-teal-700 text-white h-11 rounded-full font-bold"
                  >
                    {otpLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    {!recaptchaLoaded ? 'Loading...' : 'Send OTP'}
                  </Button>
                </>
              ) : (
                <>
                  <div className="text-center text-sm text-slate-600 mb-2">
                    OTP sent to <span className="font-bold">+91 {phone}</span>
                    <button type="button" onClick={() => setOtpSent(false)} className="ml-2 text-teal-700 font-bold text-xs">(Change)</button>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-slate-700">Enter OTP</Label>
                    <div className="relative mt-1.5">
                      <Input 
                        value={otp} 
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} 
                        type="tel" 
                        required 
                        placeholder="123456" 
                        className="pl-3 h-11 rounded-xl text-center text-lg tracking-widest font-mono" 
                      />
                    </div>
                    {otpError && <p className="text-xs text-rose-600 mt-1">{otpError}</p>}
                  </div>
                  <Button 
                    type="button" 
                    onClick={verifyOTP} 
                    disabled={otpLoading || otp.length !== 6}
                    className="w-full bg-teal-600 hover:bg-teal-700 text-white h-11 rounded-full font-bold"
                  >
                    {otpLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Verify & Login
                  </Button>
                  <button 
                    type="button" 
                    onClick={sendOTP} 
                    disabled={otpLoading}
                    className="w-full text-sm text-teal-700 font-bold hover:text-teal-800"
                  >
                    Resend OTP
                  </button>
                </>
              )}
            </div>
          )}

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

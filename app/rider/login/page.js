'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bike, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const RiderLogin = () => {
  const router = useRouter();
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const inputs = useRef([]);

  useEffect(() => { inputs.current[0]?.focus(); }, []);

  const onChange = (i, v) => {
    const val = v.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = val;
    setDigits(next);
    if (val && i < 5) inputs.current[i + 1]?.focus();
  };

  const onKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputs.current[i - 1]?.focus();
    }
    if (e.key === 'Enter') submit();
  };

  const onPaste = (e) => {
    const text = (e.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, 6);
    if (text.length === 6) {
      e.preventDefault();
      setDigits(text.split(''));
      inputs.current[5]?.focus();
    }
  };

  const submit = async (e) => {
    e?.preventDefault?.();
    const code = digits.join('');
    if (!/^\d{6}$/.test(code)) { toast.error('Enter your 6-digit code'); return; }
    setLoading(true);
    const res = await fetch('/api/riders/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const d = await res.json();
    setLoading(false);
    if (d.ok) {
      localStorage.setItem('cs_token', d.token);
      localStorage.setItem('cs_rider', JSON.stringify(d.user));
      toast.success('Welcome, ' + d.user.name);
      router.push('/rider');
    } else {
      toast.error(d.error || 'Login failed');
      setDigits(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto bg-teal-500 text-white rounded-2xl flex items-center justify-center shadow-lg mb-4">
            <Bike className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black text-white">Rider Portal</h1>
          <p className="text-slate-400 text-sm mt-1">Enter your 6-digit code to sign in</p>
        </div>
        <form onSubmit={submit} className="bg-white rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex justify-between gap-2" onPaste={onPaste}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => (inputs.current[i] = el)}
                type="tel"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={(e) => onChange(i, e.target.value)}
                onKeyDown={(e) => onKeyDown(i, e)}
                className="w-11 h-14 text-center text-xl font-black bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-100 focus:outline-none"
              />
            ))}
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-teal-600 hover:bg-teal-700 rounded-full font-bold h-11">
            {loading ? 'Signing in…' : 'Sign In'}
          </Button>
          <p className="text-[11px] text-center text-slate-500">Don't have a code? Ask your shop admin.</p>
        </form>
        <div className="text-center mt-6">
          <button onClick={() => router.push('/')} className="text-sm text-slate-400 hover:text-white flex items-center gap-1 mx-auto">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to store
          </button>
        </div>
      </div>
    </div>
  );
};

export default RiderLogin;

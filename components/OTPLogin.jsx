'use client';
import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Phone, Lock, Loader } from 'lucide-react';

export default function OTPLogin() {
  const router = useRouter();
  const [step, setStep] = useState('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(0);
  const timerRef = useRef(null);

  const startTimer = () => {
    setTimer(300);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimer(t => {
        if (t <= 1) { clearInterval(timerRef.current); return 0; }
        return t - 1;
      });
    }, 1000);
  };

  const sendOTP = async (e) => {
    e.preventDefault();
    const phoneClean = phone.replace(/\D/g, '').slice(-10);
    if (phoneClean.length !== 10) {
      toast.error('Enter a valid 10-digit phone number');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneClean }),
      });
      const data = await res.json();
      if (!data.ok) {
        toast.error(data.error || 'Failed to send OTP');
        return;
      }
      toast.success('OTP sent to +91 ' + phoneClean);
      setStep('otp');
      startTimer();
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) {
      toast.error('Enter the 6-digit OTP');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.replace(/\D/g, '').slice(-10), otp }),
      });
      const data = await res.json();
      if (!data.ok) {
        toast.error(data.error || 'Invalid OTP');
        return;
      }
      localStorage.setItem('cs_token', data.token);
      document.cookie = `cs_token=${data.token}; path=/; max-age=${7 * 86400}; SameSite=Lax`;
      toast.success('Logged in successfully!');
      router.replace('/');
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'phone') {
    return (
      <form onSubmit={sendOTP} className="space-y-4">
        <div>
          <Label className="text-xs font-semibold text-slate-700">Mobile Number</Label>
          <div className="relative mt-1.5">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="10-digit mobile"
              className="pl-9 h-11 rounded-xl"
              disabled={loading}
              autoComplete="tel"
            />
          </div>
        </div>
        <Button type="submit" disabled={loading} className="w-full bg-teal-600 hover:bg-teal-700 text-white h-11 rounded-full font-bold">
          {loading ? <><Loader className="w-4 h-4 mr-2 animate-spin" />Sending OTP...</> : 'Send OTP'}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={verifyOTP} className="space-y-4">
      <div>
        <Label className="text-xs font-semibold text-slate-700">Enter OTP</Label>
        <p className="text-xs text-slate-500 mt-0.5">Sent to +91 {phone}</p>
        <div className="relative mt-1.5">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="6-digit OTP"
            className="pl-9 h-11 rounded-xl font-mono text-center text-lg tracking-widest"
            disabled={loading}
            autoComplete="one-time-code"
          />
        </div>
      </div>

      {timer > 0 && (
        <p className="text-xs text-slate-500 text-center">
          Expires in {Math.floor(timer / 60)}:{String(timer % 60).padStart(2, '0')}
        </p>
      )}
      {timer === 0 && (
        <p className="text-xs text-center">
          <button type="button" onClick={() => setStep('phone')} className="text-teal-600 font-semibold underline">
            Resend OTP
          </button>
        </p>
      )}

      <Button type="submit" disabled={loading} className="w-full bg-teal-600 hover:bg-teal-700 text-white h-11 rounded-full font-bold">
        {loading ? <><Loader className="w-4 h-4 mr-2 animate-spin" />Verifying...</> : 'Verify OTP'}
      </Button>

      <Button type="button" onClick={() => { setStep('phone'); setOtp(''); clearInterval(timerRef.current); }} variant="ghost" className="w-full text-sm">
        Use different number
      </Button>
    </form>
  );
}

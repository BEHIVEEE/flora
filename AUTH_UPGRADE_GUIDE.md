# 🔐 Authentication System Upgrade Guide

Complete guide to integrate Google OAuth 2.0 and Mobile OTP login into your existing auth system.

---

## 📋 Table of Contents

1. [Setup & Configuration](#setup--configuration)
2. [Database Schema Updates](#database-schema-updates)
3. [API Routes Integration](#api-routes-integration)
4. [Frontend Components](#frontend-components)
5. [Security Best Practices](#security-best-practices)
6. [Testing](#testing)
7. [Troubleshooting](#troubleshooting)

---

## 🔧 Setup & Configuration

### 1. Environment Variables

Add these to your `.env.local`:

```env
# Existing
AUTH_SECRET=your-super-secret-key-min-32-chars
MONGO_URL=mongodb+srv://user:pass@cluster.mongodb.net/dbname

# Google OAuth 2.0
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback

# OTP Service (choose one)
# Option 1: Firebase (Recommended for India)
FIREBASE_API_KEY=your-firebase-api-key

# Option 2: Twilio
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE=+1234567890

# Option 3: MSG91 (Popular in India)
MSG91_AUTH_KEY=your-auth-key
MSG91_ROUTE=4
```

### 2. Google OAuth Setup

#### Step 1: Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable "Google+ API"

#### Step 2: Create OAuth 2.0 Credentials
1. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
2. Choose "Web application"
3. Add authorized redirect URIs:
   - `http://localhost:3000/auth/google/callback` (development)
   - `https://yourdomain.com/auth/google/callback` (production)
4. Copy `Client ID` and `Client Secret`

#### Step 3: Add to Environment
```env
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
```

### 3. Firebase Setup (for OTP)

#### Step 1: Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable "Authentication" → "Phone" sign-in method

#### Step 2: Get API Key
1. Go to Project Settings → Service Accounts
2. Copy the API Key from the REST API section
3. Or use the Web API Key from Project Settings

```env
FIREBASE_API_KEY=your-api-key
```

---

## 📊 Database Schema Updates

### Update User Schema

Your existing users collection needs these new fields:

```javascript
{
  // Existing fields
  id: String,                    // Unique user ID
  email: String,                 // Email (now optional if using phone)
  name: String,
  phone: String,                 // Phone (now used for OTP login)
  role: String,                  // 'user', 'admin', 'rider'
  createdAt: Date,

  // NEW: OAuth & Auth Methods
  googleId: String,              // Google ID (optional)
  picture: String,               // Profile picture URL (optional)
  isVerified: Boolean,           // Email/phone verified
  
  // NEW: Password auth (keep existing)
  salt: String,                  // Password salt
  hash: String,                  // Password hash

  // NEW: Timestamps
  updatedAt: Date,
  lastLoginAt: Date,
}
```

### Create OTP Sessions Collection

```javascript
db.collection('otp_sessions').createIndex({ phone: 1 }, { unique: true });
db.collection('otp_sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Document structure:
{
  phone: String,                 // 10-digit phone
  otpHash: String,              // SHA256 hash of OTP
  expiresAt: Date,              // Expiry timestamp (5 min)
  attempts: Number,             // Failed verification attempts
  createdAt: Date,
}
```

### MongoDB Migration Script

```javascript
// Run this in MongoDB to add new fields to existing users
db.users.updateMany(
  {},
  {
    $set: {
      googleId: null,
      picture: null,
      isVerified: true,  // Assume existing users are verified
      updatedAt: new Date(),
      lastLoginAt: null,
    }
  }
);

// Create indexes
db.users.createIndex({ googleId: 1 }, { sparse: true });
db.users.createIndex({ phone: 1, role: 1 }, { sparse: true });

// Create OTP sessions collection
db.createCollection('otp_sessions');
db.otp_sessions.createIndex({ phone: 1 }, { unique: true });
db.otp_sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
```

---

## 🔌 API Routes Integration

### Add Routes to Your API

In `app/api/[[...path]]/route.js`, add these imports at the top:

```javascript
import {
  handleGoogleCallback,
  handleGoogleAuth,
  handleSendOTP,
  handleVerifyOTP,
  handleLinkAccount,
} from '@/lib/auth-routes.js';
```

### Add to POST Handler

Add these routes in your `POST` function (after existing auth routes):

```javascript
// Google OAuth callback
if (path === 'auth/google/callback') {
  return await handleGoogleCallback(req, db, json);
}

// Send OTP to phone
if (path === 'auth/send-otp') {
  return await handleSendOTP(req, db, json, rateLimit, getClientIp);
}

// Verify OTP and login
if (path === 'auth/verify-otp') {
  return await handleVerifyOTP(req, db, json, rateLimit, getClientIp);
}

// Link account (requires auth)
if (path === 'auth/link-account') {
  return await handleLinkAccount(req, db, json, verifyToken);
}
```

### Add to GET Handler

Add this route in your `GET` function:

```javascript
// Get Google OAuth URL
if (path === 'auth/google') {
  return handleGoogleAuth(json);
}
```

---

## 🎨 Frontend Components

### 1. Google Login Button

Create `components/GoogleLoginButton.jsx`:

```javascript
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

export default function GoogleLoginButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login: authLogin } = useAuth() || {};

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      // Get Google OAuth URL
      const res = await fetch('/api/auth/google');
      const data = await res.json();

      if (!data.ok) {
        toast.error('Failed to initialize Google login');
        return;
      }

      // Store state in sessionStorage for verification
      sessionStorage.setItem('oauth_state', data.state);

      // Redirect to Google
      window.location.href = data.authUrl;
    } catch (error) {
      toast.error('Google login failed');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleGoogleLogin}
      disabled={loading}
      variant="outline"
      className="w-full h-11 rounded-full font-bold"
    >
      {loading ? 'Signing in...' : '🔵 Sign in with Google'}
    </Button>
  );
}
```

### 2. OTP Login Component

Create `components/OTPLogin.jsx`:

```javascript
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { Phone, Lock } from 'lucide-react';

export default function OTPLogin() {
  const router = useRouter();
  const { login: authLogin } = useAuth() || {};
  const [step, setStep] = useState('phone'); // 'phone' or 'otp'
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(0);

  // Send OTP
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

      toast.success('OTP sent to your phone');
      setStep('otp');
      setTimer(300); // 5 minutes

      // Countdown timer
      const interval = setInterval(() => {
        setTimer((t) => {
          if (t <= 1) {
            clearInterval(interval);
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    } catch (error) {
      toast.error('Error sending OTP');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP
  const verifyOTP = async (e) => {
    e.preventDefault();

    if (otp.length !== 6) {
      toast.error('Enter a 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone.replace(/\D/g, '').slice(-10),
          otp,
        }),
      });

      const data = await res.json();

      if (!data.ok) {
        toast.error(data.error || 'Invalid OTP');
        return;
      }

      // Store token
      localStorage.setItem('cs_token', data.token);
      document.cookie = `cs_token=${data.token}; path=/; max-age=${7 * 86400}; SameSite=Lax`;

      toast.success('Logged in successfully!');
      router.replace('/');
    } catch (error) {
      toast.error('OTP verification failed');
      console.error(error);
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
            />
          </div>
        </div>
        <Button type="submit" disabled={loading} className="w-full bg-teal-600 hover:bg-teal-700 text-white h-11 rounded-full font-bold">
          {loading ? 'Sending OTP...' : 'Send OTP'}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={verifyOTP} className="space-y-4">
      <div>
        <Label className="text-xs font-semibold text-slate-700">Enter OTP</Label>
        <p className="text-xs text-slate-500 mt-0.5">Sent to {phone}</p>
        <div className="relative mt-1.5">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="6-digit OTP"
            className="pl-9 h-11 rounded-xl font-mono text-center text-lg tracking-widest"
            disabled={loading}
          />
        </div>
      </div>

      {timer > 0 && (
        <p className="text-xs text-slate-500 text-center">
          OTP expires in {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}
        </p>
      )}

      <Button type="submit" disabled={loading || timer === 0} className="w-full bg-teal-600 hover:bg-teal-700 text-white h-11 rounded-full font-bold">
        {loading ? 'Verifying...' : 'Verify OTP'}
      </Button>

      <Button
        type="button"
        onClick={() => {
          setStep('phone');
          setOtp('');
          setTimer(0);
        }}
        variant="ghost"
        className="w-full text-sm"
      >
        Use different number
      </Button>
    </form>
  );
}
```

### 3. Updated Login Page

Update `app/login/page.js` to include Google & OTP options:

```javascript
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
          <h1 className="mt-4 text-2xl font-black text-slate-900 tracking-tight">Welcome back</h1>
          <p className="text-sm text-slate-500 mt-1">Sign in to ChemistShop</p>
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
        </div>

        <div className="text-center mt-4">
          <Link href="/rider/login" className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-700 hover:text-teal-800">
            Are you a delivery rider? <span className="underline">Sign in here</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

const LoginPage = () => <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading…</div>}><LoginInner /></Suspense>;
export default LoginPage;
```

### 4. Google Callback Handler Page

Create `app/auth/google/callback/page.js`:

```javascript
'use client';
import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';

export default function GoogleCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');

      if (error) {
        toast.error(`Google login failed: ${error}`);
        router.replace('/login');
        return;
      }

      if (!code) {
        toast.error('No authorization code received');
        router.replace('/login');
        return;
      }

      try {
        // Verify state
        const storedState = sessionStorage.getItem('oauth_state');
        if (state !== storedState) {
          toast.error('Invalid state parameter');
          router.replace('/login');
          return;
        }

        // Exchange code for token
        const res = await fetch('/api/auth/google/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, state }),
        });

        const data = await res.json();

        if (!data.ok) {
          toast.error(data.error || 'Google authentication failed');
          router.replace('/login');
          return;
        }

        // Store token
        localStorage.setItem('cs_token', data.token);
        document.cookie = `cs_token=${data.token}; path=/; max-age=${7 * 86400}; SameSite=Lax`;

        toast.success(`Welcome, ${data.user.name}!`);
        router.replace('/');
      } catch (error) {
        toast.error('Authentication failed');
        console.error(error);
        router.replace('/login');
      }
    };

    handleCallback();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
        <p className="text-slate-600">Completing sign in...</p>
      </div>
    </div>
  );
}
```

---

## 🔒 Security Best Practices

### 1. Password Hashing
- ✅ Using PBKDF2 with 100,000 iterations
- ✅ Unique salt per user
- ✅ SHA-512 hash function

### 2. OTP Security
- ✅ 6-digit OTP (1 million combinations)
- ✅ 5-minute expiry
- ✅ Hash stored in DB (not plaintext)
- ✅ Rate limiting: 3 OTP per phone per 10 min
- ✅ Max 5 verification attempts per minute

### 3. JWT Security
- ✅ HMAC-SHA256 signing
- ✅ 7-day expiry
- ✅ Stored in localStorage + cookie
- ✅ Bearer token in Authorization header

### 4. Google OAuth
- ✅ CSRF protection via state parameter
- ✅ Secure token exchange
- ✅ Email verification via Google
- ✅ Automatic account linking

### 5. Rate Limiting
- ✅ 5 login attempts per minute
- ✅ 5 signup attempts per minute
- ✅ 3 OTP requests per phone per 10 min
- ✅ 5 OTP verifications per minute

### 6. Input Validation
- ✅ Email format validation (Zod)
- ✅ Phone number format validation
- ✅ OTP format validation
- ✅ Password minimum length (6 chars)

---

## 🧪 Testing

### Test Email/Password Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
```

### Test OTP Flow
```bash
# 1. Send OTP
curl -X POST http://localhost:3000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"9876543210"}'

# 2. Verify OTP (check console logs for OTP in dev mode)
curl -X POST http://localhost:3000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"9876543210","otp":"123456"}'
```

### Test Google OAuth
1. Visit `http://localhost:3000/login`
2. Click "Google" tab
3. Click "Sign in with Google"
4. Complete Google sign-in
5. Should redirect to home page

---

## 🐛 Troubleshooting

### "GOOGLE_CLIENT_ID not configured"
- Add `GOOGLE_CLIENT_ID` to `.env.local`
- Restart dev server

### "OTP not found"
- Make sure OTP was sent first
- Check `otp_sessions` collection in MongoDB

### "Invalid state parameter"
- Clear browser cache/cookies
- Make sure `oauth_state` is stored in sessionStorage

### "Too many attempts"
- Wait for rate limit window to expire
- Check rate limiter configuration

### Google login redirects to login page
- Check browser console for errors
- Verify `GOOGLE_REDIRECT_URI` matches Google Cloud settings
- Check that callback page is created at `/app/auth/google/callback/page.js`

---

## 📚 API Reference

### POST /auth/login
Login with email and password
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

### POST /auth/signup
Create new account
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "phone": "9876543210"
}
```

### GET /auth/google
Get Google OAuth URL
```json
{
  "ok": true,
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?...",
  "state": "random-state-token"
}
```

### POST /auth/google/callback
Google OAuth callback
```json
{
  "code": "auth-code-from-google",
  "state": "state-token"
}
```

### POST /auth/send-otp
Send OTP to phone
```json
{
  "phone": "9876543210"
}
```

### POST /auth/verify-otp
Verify OTP and login
```json
{
  "phone": "9876543210",
  "otp": "123456",
  "name": "John Doe" // Optional, for new users
}
```

### POST /auth/link-account
Link phone/email to existing account (requires auth)
```json
{
  "phone": "9876543210"
  // OR
  "email": "newemail@example.com"
}
```

---

## 🚀 Production Checklist

- [ ] Set strong `AUTH_SECRET` (min 32 chars)
- [ ] Configure Google OAuth with production domain
- [ ] Set up Firebase/Twilio/MSG91 for OTP
- [ ] Enable HTTPS for all OAuth redirects
- [ ] Set `GOOGLE_REDIRECT_URI` to production domain
- [ ] Remove OTP logging from console in production
- [ ] Test all auth flows in production environment
- [ ] Set up monitoring for auth failures
- [ ] Enable CORS only for your domain
- [ ] Rotate secrets regularly
- [ ] Set up backup authentication method

---

## 📞 Support

For issues or questions:
1. Check the Troubleshooting section
2. Review API Reference
3. Check MongoDB indexes are created
4. Verify environment variables are set
5. Check browser console for errors
6. Check server logs for detailed errors

---

**Last Updated:** 2024
**Version:** 1.0.0

# ✅ Auth Upgrade Integration Checklist

Follow these steps to integrate Google OAuth 2.0 and OTP login into your existing system.

---

## 📦 Step 1: Add New Files

- [x] `lib/auth-enhanced.js` - Enhanced auth utilities
- [x] `lib/google-auth.js` - Google OAuth helper
- [x] `lib/otp-service.js` - OTP sending service
- [x] `lib/auth-routes.js` - Auth route handlers
- [x] `components/GoogleLoginButton.jsx` - Google login button
- [x] `components/OTPLogin.jsx` - OTP login form
- [x] `app/auth/google/callback/page.js` - Google callback handler

---

## 🔧 Step 2: Environment Setup

Add to `.env.local`:

```env
# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback

# OTP Service (choose one)
FIREBASE_API_KEY=your-firebase-api-key
# OR
TWILIO_ACCOUNT_SID=your-sid
TWILIO_AUTH_TOKEN=your-token
TWILIO_PHONE=+1234567890
# OR
MSG91_AUTH_KEY=your-key
```

---

## 📊 Step 3: Database Updates

Run in MongoDB:

```javascript
// Add new fields to existing users
db.users.updateMany(
  {},
  {
    $set: {
      googleId: null,
      picture: null,
      isVerified: true,
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

## 🔌 Step 4: API Routes Integration

In `app/api/[[...path]]/route.js`:

### Add imports (at top):
```javascript
import {
  handleGoogleCallback,
  handleGoogleAuth,
  handleSendOTP,
  handleVerifyOTP,
  handleLinkAccount,
} from '@/lib/auth-routes.js';
```

### Add to POST handler (after existing auth routes):
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

### Add to GET handler:
```javascript
// Get Google OAuth URL
if (path === 'auth/google') {
  return handleGoogleAuth(json);
}
```

---

## 🎨 Step 5: Frontend Components

- [x] Create `components/GoogleLoginButton.jsx`
- [x] Create `components/OTPLogin.jsx`
- [x] Update `app/login/page.js` with new login methods
- [x] Create `app/auth/google/callback/page.js`

---

## 🧪 Step 6: Testing

### Test Email/Password (existing)
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@chemistshop.top","password":"admin123"}'
```

### Test OTP
```bash
# Send OTP
curl -X POST http://localhost:3000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"9876543210"}'

# Check console logs for OTP (dev mode)
# Verify OTP
curl -X POST http://localhost:3000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"9876543210","otp":"123456"}'
```

### Test Google OAuth
1. Go to `http://localhost:3000/login`
2. Click "Google" tab
3. Click "Sign in with Google"
4. Complete sign-in
5. Should redirect to home

---

## 🔍 Step 7: Verification

- [ ] Email/password login still works
- [ ] OTP login works (check console for OTP in dev)
- [ ] Google login works
- [ ] Users can switch between login methods
- [ ] Account linking works (same email = same account)
- [ ] Rate limiting works (try 6 login attempts)
- [ ] JWT tokens are valid
- [ ] User data is saved correctly in MongoDB

---

## 🚀 Step 8: Production Deployment

Before deploying to production:

- [ ] Set strong `AUTH_SECRET` (min 32 chars, random)
- [ ] Configure Google OAuth with production domain
- [ ] Set up Firebase/Twilio/MSG91 credentials
- [ ] Set `GOOGLE_REDIRECT_URI` to production domain
- [ ] Remove OTP logging from console
- [ ] Test all auth flows in staging
- [ ] Enable HTTPS for all OAuth redirects
- [ ] Set up monitoring for auth failures
- [ ] Configure CORS for production domain
- [ ] Backup database before migration
- [ ] Test rollback procedure

---

## 📋 Existing Features (Preserved)

✅ Email/password login still works
✅ Signup with email/password still works
✅ Admin login still works
✅ Rider login still works
✅ JWT token generation unchanged
✅ Rate limiting still active
✅ Password hashing (PBKDF2) unchanged
✅ All existing routes work

---

## 🆕 New Features Added

✅ Google OAuth 2.0 login
✅ Mobile OTP login
✅ Account linking (email/phone/Google)
✅ OTP expiry (5 minutes)
✅ OTP rate limiting (3 per 10 min)
✅ Firebase/Twilio/MSG91 support
✅ CSRF protection (state token)
✅ User profile pictures (from Google)
✅ Phone verification
✅ Multiple login methods per account

---

## 🔐 Security Features

✅ PBKDF2 password hashing (100k iterations)
✅ SHA256 OTP hashing
✅ HMAC-SHA256 JWT signing
✅ CSRF protection (state token)
✅ Rate limiting (login, signup, OTP)
✅ Input validation (Zod)
✅ Email format validation
✅ Phone format validation
✅ OTP expiry enforcement
✅ Secure token storage (localStorage + cookie)

---

## 📞 Quick Reference

### API Endpoints
- `POST /api/auth/login` - Email/password login
- `POST /api/auth/signup` - Email/password signup
- `GET /api/auth/google` - Get Google OAuth URL
- `POST /api/auth/google/callback` - Google callback
- `POST /api/auth/send-otp` - Send OTP
- `POST /api/auth/verify-otp` - Verify OTP
- `POST /api/auth/link-account` - Link account
- `GET /api/auth/me` - Get current user

### Frontend Routes
- `/login` - Login page (email/OTP/Google)
- `/signup` - Signup page
- `/auth/google/callback` - Google callback handler
- `/account` - User account (protected)

### Database Collections
- `users` - User accounts
- `otp_sessions` - Active OTP sessions
- `orders` - Orders (existing)
- `products` - Products (existing)

---

## ⚠️ Important Notes

1. **Backward Compatibility**: All existing auth still works. This is purely additive.

2. **Database Migration**: Run the MongoDB migration script before deploying.

3. **Environment Variables**: Must be set before starting the app.

4. **Google Setup**: Requires Google Cloud project setup (see guide).

5. **OTP Service**: Choose Firebase, Twilio, or MSG91 (Firebase recommended for India).

6. **Testing**: Test all auth flows before production deployment.

7. **Rate Limiting**: In-memory rate limiter. For production, consider Redis.

8. **Secrets**: Never commit `.env.local` to version control.

---

## 🐛 Common Issues

| Issue | Solution |
|-------|----------|
| "GOOGLE_CLIENT_ID not configured" | Add to `.env.local` and restart |
| "OTP not found" | Send OTP first, then verify |
| "Invalid state parameter" | Clear cookies, try again |
| "Too many attempts" | Wait for rate limit window |
| Google redirects to login | Check callback page exists |
| OTP not received | Check Firebase/Twilio credentials |

---

## 📚 Documentation

- `AUTH_UPGRADE_GUIDE.md` - Complete setup guide
- `lib/auth-enhanced.js` - Auth utilities
- `lib/google-auth.js` - Google OAuth helper
- `lib/otp-service.js` - OTP service
- `lib/auth-routes.js` - Route handlers

---

**Status**: Ready for Integration
**Version**: 1.0.0
**Last Updated**: 2024

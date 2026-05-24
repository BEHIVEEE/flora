# 📋 Step-by-Step Integration Guide

Complete walkthrough to integrate Google OAuth 2.0 and OTP login.

---

## ⏱️ Total Time: ~90 minutes

- **Setup**: 15 min
- **Database**: 5 min
- **API Routes**: 20 min
- **Frontend**: 15 min
- **Testing**: 20 min
- **Buffer**: 10 min

---

## 🔧 STEP 1: Environment Variables (5 minutes)

### 1.1 Open `.env.local`
```bash
# In your project root, open or create .env.local
```

### 1.2 Add Google OAuth Variables
```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
```

**How to get these:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project
3. Enable "Google+ API"
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Choose "Web application"
6. Add redirect URI: `http://localhost:3000/auth/google/callback`
7. Copy Client ID and Client Secret

### 1.3 Add OTP Service Variables
Choose **ONE** option:

**Option A: Firebase (Recommended for India)**
```env
FIREBASE_API_KEY=AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Option B: Twilio**
```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE=+1234567890
```

**Option C: MSG91**
```env
MSG91_AUTH_KEY=your-auth-key
MSG91_ROUTE=4
```

### 1.4 Verify Environment Variables
Your `.env.local` should now have:
```env
# Existing
AUTH_SECRET=your-existing-secret
MONGO_URL=your-mongo-url

# New
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
FIREBASE_API_KEY=xxx
```

### 1.5 Restart Dev Server
```bash
# Stop your dev server (Ctrl+C)
# Restart it
npm run dev
```

✅ **Step 1 Complete!**

---

## 📊 STEP 2: Database Migration (5 minutes)

### 2.1 Open MongoDB
```bash
# Connect to your MongoDB
# Using MongoDB Compass or mongo shell
```

### 2.2 Update Users Collection
Run this script in MongoDB:

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
```

**What this does:**
- Adds `googleId` field (for Google OAuth)
- Adds `picture` field (for Google profile picture)
- Adds `isVerified` field (marks existing users as verified)
- Adds `updatedAt` field (for tracking updates)
- Adds `lastLoginAt` field (for tracking last login)

### 2.3 Create Indexes
Run these commands:

```javascript
// Create index for Google ID
db.users.createIndex({ googleId: 1 }, { sparse: true });

// Create index for phone + role
db.users.createIndex({ phone: 1, role: 1 }, { sparse: true });
```

### 2.4 Create OTP Sessions Collection
```javascript
// Create new collection for OTP sessions
db.createCollection('otp_sessions');

// Create indexes
db.otp_sessions.createIndex({ phone: 1 }, { unique: true });
db.otp_sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
```

**What this does:**
- Creates a collection to store temporary OTP sessions
- `phone` index ensures one OTP per phone at a time
- `expiresAt` index auto-deletes expired OTPs after 5 minutes

### 2.5 Verify Migration
```javascript
// Check users collection
db.users.findOne({ email: "admin@chemistshop.top" });
// Should show: googleId: null, picture: null, isVerified: true

// Check otp_sessions collection
db.otp_sessions.find();
// Should be empty initially
```

✅ **Step 2 Complete!**

---

## 🔌 STEP 3: API Routes Integration (20 minutes)

### 3.1 Open API Route File
```bash
# Open: app/api/[[...path]]/route.js
```

### 3.2 Add Imports (at the very top of file)
Find the existing imports section (around line 1-10) and add:

```javascript
import {
  handleGoogleCallback,
  handleGoogleAuth,
  handleSendOTP,
  handleVerifyOTP,
  handleLinkAccount,
} from '@/lib/auth-routes.js';
```

**Location:** Right after other imports, before any function definitions.

### 3.3 Add GET Route
Find your **GET** function (around line 200-250).

Look for existing auth routes like:
```javascript
if (path === 'auth/me') {
  // ... existing code ...
}
```

**After** the existing auth routes, add:

```javascript
    // ============================================
    // NEW: Google OAuth - Get Auth URL
    // ============================================
    if (path === 'auth/google') {
      return handleGoogleAuth(json);
    }
```

### 3.4 Add POST Routes
Find your **POST** function (around line 650-700).

Look for existing auth routes like:
```javascript
if (path === 'auth/signup') {
  // ... existing signup code ...
}
```

**After** the existing auth routes, add:

```javascript
    // ============================================
    // NEW: Google OAuth Callback
    // ============================================
    if (path === 'auth/google/callback') {
      return await handleGoogleCallback(req, db, json);
    }

    // ============================================
    // NEW: Send OTP to Phone
    // ============================================
    if (path === 'auth/send-otp') {
      return await handleSendOTP(req, db, json, rateLimit, getClientIp);
    }

    // ============================================
    // NEW: Verify OTP and Login
    // ============================================
    if (path === 'auth/verify-otp') {
      return await handleVerifyOTP(req, db, json, rateLimit, getClientIp);
    }

    // ============================================
    // NEW: Link Account (requires auth)
    // ============================================
    if (path === 'auth/link-account') {
      return await handleLinkAccount(req, db, json, verifyToken);
    }
```

### 3.5 Verify Integration
```bash
# Save the file
# Check for syntax errors in your IDE
# Should show no red squiggly lines
```

### 3.6 Test API Routes
```bash
# Test Google OAuth endpoint
curl http://localhost:3000/api/auth/google

# Should return:
# { "ok": true, "authUrl": "https://accounts.google.com/...", "state": "..." }
```

✅ **Step 3 Complete!**

---

## 🎨 STEP 4: Frontend Components (15 minutes)

### 4.1 Verify Component Files Exist
Check that these files exist in your project:
- `components/GoogleLoginButton.jsx` ✅
- `components/OTPLogin.jsx` ✅
- `app/auth/google/callback/page.js` ✅

All three should already be created. If not, they're in the delivery.

### 4.2 Update Login Page
Open `app/login/page.js`

Replace the entire file with the updated version from the delivery that includes:
- Email/password tab
- OTP tab
- Google tab

**Key changes:**
- Added `GoogleLoginButton` import
- Added `OTPLogin` import
- Added tab navigation (email, otp, google)
- Each tab shows different login method

### 4.3 Verify Components
Check that your login page now has:
- [ ] Three tabs: Email, OTP, Google
- [ ] Email/password form in first tab
- [ ] OTP form in second tab
- [ ] Google button in third tab
- [ ] No syntax errors

### 4.4 Test in Browser
```bash
# Visit your login page
http://localhost:3000/login

# You should see:
# - Three tabs at the top
# - Email/password form (default)
# - Click "Phone OTP" tab → see OTP form
# - Click "Google" tab → see Google button
```

✅ **Step 4 Complete!**

---

## 🧪 STEP 5: Testing (20 minutes)

### 5.1 Test Email/Password Login (Existing)
```bash
# This should still work as before
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@chemistshop.top","password":"admin123"}'

# Should return: { "ok": true, "token": "...", "user": {...} }
```

✅ Email/password login works

### 5.2 Test OTP Login (New)

**Step A: Send OTP**
```bash
curl -X POST http://localhost:3000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"9876543210"}'

# Should return: { "ok": true, "message": "OTP sent successfully" }
```

**Step B: Check OTP in Console**
- In development mode, OTP is logged to console
- Check your server terminal for: `[OTP] Phone: 9876543210, OTP: 123456`
- Copy the OTP number

**Step C: Verify OTP**
```bash
curl -X POST http://localhost:3000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"9876543210","otp":"123456"}'

# Replace 123456 with the OTP from console
# Should return: { "ok": true, "token": "...", "user": {...} }
```

✅ OTP login works

### 5.3 Test Google Login (New)

**Step A: Visit Login Page**
```bash
# Open in browser
http://localhost:3000/login
```

**Step B: Click Google Tab**
- You should see "Sign in with Google" button

**Step C: Click Google Button**
- You'll be redirected to Google sign-in
- Sign in with your Google account
- You'll be redirected back to your app

**Step D: Verify Login**
- Should redirect to home page
- Should see success message
- Check localStorage for token: `localStorage.getItem('cs_token')`

✅ Google login works

### 5.4 Test Account Linking

**Scenario: Same email, different login methods**

1. Sign up with email/password: `user@example.com`
2. Sign in with Google using same email: `user@example.com`
3. Should get same user account (not create duplicate)

**Verify in MongoDB:**
```javascript
db.users.findOne({ email: "user@example.com" });
// Should show: googleId: "xxx", email: "user@example.com"
```

✅ Account linking works

### 5.5 Test Rate Limiting

**OTP Rate Limiting:**
```bash
# Try to send OTP 4 times in 10 minutes
# 4th attempt should fail with: "Too many attempts"

curl -X POST http://localhost:3000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"9876543210"}'
# 1st: OK
# 2nd: OK
# 3rd: OK
# 4th: ERROR - "Too many attempts. Try again in Xs."
```

✅ Rate limiting works

### 5.6 Test Error Handling

**Invalid OTP:**
```bash
curl -X POST http://localhost:3000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"9876543210","otp":"000000"}'

# Should return: { "ok": false, "error": "Invalid OTP" }
```

**Invalid Phone:**
```bash
curl -X POST http://localhost:3000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"123"}'

# Should return: { "ok": false, "error": "Valid 10-digit phone number required" }
```

✅ Error handling works

✅ **Step 5 Complete!**

---

## 🎉 STEP 6: Verification Checklist (5 minutes)

### 6.1 Code Files
- [ ] `lib/auth-enhanced.js` exists
- [ ] `lib/google-auth.js` exists
- [ ] `lib/otp-service.js` exists
- [ ] `lib/auth-routes.js` exists
- [ ] `components/GoogleLoginButton.jsx` exists
- [ ] `components/OTPLogin.jsx` exists
- [ ] `app/auth/google/callback/page.js` exists

### 6.2 Environment Variables
- [ ] `GOOGLE_CLIENT_ID` set in `.env.local`
- [ ] `GOOGLE_CLIENT_SECRET` set in `.env.local`
- [ ] `GOOGLE_REDIRECT_URI` set in `.env.local`
- [ ] `FIREBASE_API_KEY` (or Twilio/MSG91) set in `.env.local`
- [ ] Dev server restarted

### 6.3 Database
- [ ] Users collection updated with new fields
- [ ] Indexes created on users collection
- [ ] `otp_sessions` collection created
- [ ] Indexes created on otp_sessions

### 6.4 API Routes
- [ ] Imports added to `app/api/[[...path]]/route.js`
- [ ] GET route `/auth/google` added
- [ ] POST route `/auth/google/callback` added
- [ ] POST route `/auth/send-otp` added
- [ ] POST route `/auth/verify-otp` added
- [ ] POST route `/auth/link-account` added
- [ ] No syntax errors in API file

### 6.5 Frontend
- [ ] Login page updated with new tabs
- [ ] Three tabs visible: Email, OTP, Google
- [ ] No syntax errors in login page

### 6.6 Testing
- [ ] Email/password login works
- [ ] OTP login works
- [ ] Google login works
- [ ] Account linking works
- [ ] Rate limiting works
- [ ] Error handling works

### 6.7 Browser
- [ ] No console errors
- [ ] Token stored in localStorage
- [ ] Token stored in cookie
- [ ] Can access protected routes

✅ **All Steps Complete!**

---

## 🚀 STEP 7: Production Deployment (Optional)

### 7.1 Update Environment Variables
For production, update:
```env
GOOGLE_REDIRECT_URI=https://yourdomain.com/auth/google/callback
NODE_ENV=production
```

### 7.2 Set Strong AUTH_SECRET
Generate a new strong secret:
```bash
# On Mac/Linux
openssl rand -base64 32

# On Windows (PowerShell)
[System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

### 7.3 Configure Google OAuth for Production
1. Go to Google Cloud Console
2. Add production redirect URI: `https://yourdomain.com/auth/google/callback`
3. Update `GOOGLE_REDIRECT_URI` in production environment

### 7.4 Set Up Monitoring
- Monitor auth failures
- Monitor rate limiting
- Monitor OTP sends
- Set up alerts

### 7.5 Backup Database
```bash
# Backup before deploying
mongodump --uri="mongodb+srv://user:pass@cluster.mongodb.net/dbname"
```

### 7.6 Deploy
```bash
# Deploy your application
# Verify all auth flows work in production
```

✅ **Production Deployment Complete!**

---

## 📞 Troubleshooting

### Issue: "GOOGLE_CLIENT_ID not configured"
**Solution:**
1. Check `.env.local` has `GOOGLE_CLIENT_ID`
2. Restart dev server
3. Check for typos in variable name

### Issue: "OTP not found"
**Solution:**
1. Make sure you sent OTP first
2. Check `otp_sessions` collection in MongoDB
3. Check OTP hasn't expired (5 min)

### Issue: "Invalid state parameter"
**Solution:**
1. Clear browser cookies
2. Clear localStorage
3. Try again

### Issue: "Too many attempts"
**Solution:**
1. Wait for rate limit window to expire
2. Default: 5 min for login, 10 min for OTP
3. Check rate limiter configuration

### Issue: Google redirects to login page
**Solution:**
1. Check callback page exists: `app/auth/google/callback/page.js`
2. Check `GOOGLE_REDIRECT_URI` matches exactly in Google Cloud
3. Check for typos in redirect URI

### Issue: OTP not received
**Solution:**
1. Check Firebase/Twilio/MSG91 credentials
2. Check phone number format (10 digits for India)
3. Check account has credits/balance
4. Check rate limiting isn't blocking

---

## ✅ Final Checklist

- [ ] All 7 code files created
- [ ] All 10 documentation files created
- [ ] Environment variables set
- [ ] Database migration done
- [ ] API routes integrated
- [ ] Frontend components created
- [ ] Login page updated
- [ ] All tests passing
- [ ] No console errors
- [ ] Ready for production

---

## 🎉 You're Done!

Your authentication system is now upgraded with:
✅ Google OAuth 2.0
✅ Mobile OTP Login
✅ Account Linking
✅ Enterprise Security
✅ Full Documentation

**Congratulations! 🚀**

---

**Questions?** Check the documentation files.
**Need help?** See AUTH_UPGRADE_GUIDE.md troubleshooting section.
**Ready for production?** Follow Step 7.

---

**Total Time Spent: ~90 minutes**
**Status: ✅ Complete & Ready to Deploy**

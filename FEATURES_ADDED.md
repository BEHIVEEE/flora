# Features Added - Firebase SMS & Account Linking

## ✅ What's New

### 1. Firebase SMS Integration
- OTP is now sent via Firebase (if configured)
- Falls back to console logs if Firebase not configured
- Supports Indian phone numbers (+91 prefix)
- Real SMS delivery to user's phone

### 2. Account Linking UI
- New component: `components/AccountLinking.jsx`
- Link phone to existing account
- Link email to existing account
- Shows current linked accounts
- Easy-to-use interface

---

## 🔧 Setup Firebase SMS

### Step 1: Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create new project: `Flora-Chemist`
3. Enable Phone Authentication

### Step 2: Get Firebase Config
1. Go to Project Settings
2. Copy the Web config

### Step 3: Add to `.env.local`
```env
FIREBASE_API_KEY=AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Step 4: Install Firebase SDK
```bash
npm install firebase
```

### Step 5: Restart Dev Server
```bash
npm run dev
```

---

## 📱 How to Use Account Linking

### In Your App
Add the `AccountLinking` component to a user profile/settings page:

```jsx
import AccountLinking from '@/components/AccountLinking';

export default function SettingsPage() {
  return (
    <div>
      <h1>Account Settings</h1>
      <AccountLinking />
    </div>
  );
}
```

### User Flow
1. User logs in with Google
2. Goes to settings page
3. Clicks "Link Phone" button
4. Enters phone number
5. Phone is linked to their account
6. Can now login with phone + OTP

---

## 🎯 Features

### Firebase SMS
- ✅ Real SMS delivery
- ✅ Automatic phone number formatting (+91)
- ✅ Fallback to console logs (development)
- ✅ Error handling

### Account Linking
- ✅ Link phone to account
- ✅ Link email to account
- ✅ Shows current linked accounts
- ✅ Prevents duplicate links
- ✅ Loading states
- ✅ Error messages

---

## 📝 API Endpoint

### POST /api/auth/link-account
**Requires:** Authentication token

**Body:**
```json
{
  "phone": "9876543210"
}
```

or

```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "ok": true,
  "message": "Account linked successfully"
}
```

---

## 🧪 Testing

### Test Firebase SMS
1. Set `FIREBASE_API_KEY` in `.env.local`
2. Send OTP to real phone number
3. Check your phone for SMS

### Test Account Linking
1. Log in with Google
2. Go to settings page (add AccountLinking component)
3. Click "Link Phone"
4. Enter phone number
5. Phone is now linked
6. Can login with phone + OTP

---

## 🔐 Security

- ✅ Phone numbers validated (10 digits)
- ✅ OTP hashed before storage
- ✅ Rate limiting on OTP sends
- ✅ Rate limiting on OTP verification
- ✅ Account linking requires authentication
- ✅ Prevents duplicate phone/email links

---

## 📊 Database Schema

### otp_sessions Collection
```javascript
{
  phone: "9876543210",
  otpHash: "sha256hash...",
  expiresAt: ISODate,
  attempts: 0,
  createdAt: ISODate
}
```

### users Collection (Updated)
```javascript
{
  id: "u-xxx",
  email: "user@example.com",
  phone: "9876543210",      // NEW: linked phone
  googleId: "google-id",    // NEW: linked Google
  picture: "url",           // NEW: profile picture
  isVerified: true,
  role: "user",
  createdAt: ISODate,
  updatedAt: ISODate        // NEW: last update
}
```

---

## 🚀 Next Steps

1. **Set up Firebase** (follow FIREBASE_SETUP.md)
2. **Add AccountLinking component** to settings page
3. **Test Firebase SMS** with real phone number
4. **Test account linking** flow
5. **Deploy to production**

---

## 📞 Support

- Firebase Setup: See `FIREBASE_SETUP.md`
- Account Linking: See `components/AccountLinking.jsx`
- OTP Service: See `lib/otp-service.js`
- Auth Routes: See `lib/auth-routes.js`

---

**Everything is ready to go!** 🚀

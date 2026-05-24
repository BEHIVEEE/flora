# 🔐 Authentication Environment Variables

Copy these to your `.env.local` file and fill in the values.

---

## Existing Variables (Keep These)

```env
# Database
MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/dbname

# Authentication Secret (keep existing)
AUTH_SECRET=your-super-secret-key-minimum-32-characters-long-random-string
```

---

## New Variables (Add These)

### Google OAuth 2.0

```env
# Get from: https://console.cloud.google.com/
# 1. Create project
# 2. Enable Google+ API
# 3. Create OAuth 2.0 credentials (Web application)
# 4. Add redirect URIs

GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret-xxxxx
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
```

**For Production:**
```env
GOOGLE_REDIRECT_URI=https://yourdomain.com/auth/google/callback
```

---

### OTP Service (Choose ONE)

#### Option 1: Firebase (Recommended for India)

```env
# Get from: https://console.firebase.google.com/
# 1. Create project
# 2. Enable Authentication → Phone sign-in
# 3. Go to Project Settings → Service Accounts
# 4. Copy Web API Key

FIREBASE_API_KEY=AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

#### Option 2: Twilio

```env
# Get from: https://www.twilio.com/
# 1. Create account
# 2. Get Account SID and Auth Token from dashboard
# 3. Verify phone number or get Twilio number

TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-auth-token-xxxxx
TWILIO_PHONE=+1234567890
```

#### Option 3: MSG91 (Popular in India)

```env
# Get from: https://www.msg91.com/
# 1. Create account
# 2. Get Auth Key from dashboard
# 3. Choose route (4 = Transactional)

MSG91_AUTH_KEY=your-auth-key-xxxxx
MSG91_ROUTE=4
```

---

## Complete Example (.env.local)

```env
# ============================================
# DATABASE
# ============================================
MONGO_URL=mongodb+srv://chemist:password123@cluster0.mongodb.net/chemistshop

# ============================================
# AUTHENTICATION
# ============================================
AUTH_SECRET=your-super-secret-key-minimum-32-characters-long-random-string-here-1234567890

# ============================================
# GOOGLE OAUTH 2.0
# ============================================
GOOGLE_CLIENT_ID=123456789.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback

# ============================================
# OTP SERVICE (Firebase)
# ============================================
FIREBASE_API_KEY=AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# ============================================
# ADMIN
# ============================================
ADMIN_PASSWORD=admin123

# ============================================
# NODE ENVIRONMENT
# ============================================
NODE_ENV=development
```

---

## How to Get Each Secret

### AUTH_SECRET
Generate a random 32+ character string:
```bash
# On Mac/Linux
openssl rand -base64 32

# On Windows (PowerShell)
[System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

### GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable "Google+ API"
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Choose "Web application"
6. Add authorized redirect URIs:
   - `http://localhost:3000/auth/google/callback` (development)
   - `https://yourdomain.com/auth/google/callback` (production)
7. Copy Client ID and Client Secret

### FIREBASE_API_KEY

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (or select existing)
3. Enable "Authentication" → "Phone" sign-in method
4. Go to "Project Settings" → "Service Accounts"
5. Copy the "Web API Key" or generate a new one
6. Or go to "Project Settings" → "General" and copy the API Key

### TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE

1. Go to [Twilio Console](https://www.twilio.com/console)
2. Copy "Account SID" and "Auth Token" from dashboard
3. Go to "Phone Numbers" → "Manage Numbers"
4. Get your Twilio phone number (e.g., +1234567890)
5. Or verify your own number for testing

### MSG91_AUTH_KEY

1. Go to [MSG91 Dashboard](https://www.msg91.com/user/dashboard)
2. Go to "Settings" → "API"
3. Copy your "Auth Key"
4. Choose route (usually 4 for Transactional)

---

## Testing Environment Variables

After setting up, test with:

```bash
# Test Google OAuth
curl http://localhost:3000/api/auth/google

# Test OTP (send)
curl -X POST http://localhost:3000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"9876543210"}'

# Test OTP (verify)
curl -X POST http://localhost:3000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"9876543210","otp":"123456"}'
```

---

## Security Notes

⚠️ **IMPORTANT:**
- Never commit `.env.local` to version control
- Never share your secrets publicly
- Rotate secrets regularly in production
- Use strong, random values for AUTH_SECRET
- Keep API keys private and secure
- Use different keys for development and production

---

## Production Checklist

Before deploying to production:

- [ ] Generate new AUTH_SECRET
- [ ] Create new Google OAuth credentials for production domain
- [ ] Set up Firebase/Twilio/MSG91 for production
- [ ] Update GOOGLE_REDIRECT_URI to production domain
- [ ] Test all auth flows in staging
- [ ] Enable HTTPS for all OAuth redirects
- [ ] Set NODE_ENV=production
- [ ] Use environment variables from your hosting provider
- [ ] Never hardcode secrets in code
- [ ] Set up monitoring for auth failures

---

## Troubleshooting

### "GOOGLE_CLIENT_ID not configured"
- Check `.env.local` has `GOOGLE_CLIENT_ID` set
- Restart dev server after adding to `.env.local`
- Make sure no typos in variable name

### "Firebase API Key not configured"
- Check `.env.local` has `FIREBASE_API_KEY` set
- Verify key is valid in Firebase console
- Restart dev server

### "Invalid redirect URI"
- Make sure `GOOGLE_REDIRECT_URI` matches exactly in Google Cloud console
- Check for trailing slashes
- Use `http://localhost:3000` for local development
- Use `https://yourdomain.com` for production

### OTP not sending
- Check OTP service credentials are correct
- Verify phone number format (10 digits for India)
- Check Firebase/Twilio/MSG91 account has credits
- Check rate limiting isn't blocking requests

---

**Last Updated:** 2024
**Version:** 1.0.0

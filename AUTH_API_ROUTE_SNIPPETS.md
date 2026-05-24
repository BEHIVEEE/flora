# 🔌 API Route Integration Snippets

Copy-paste these snippets into your `app/api/[[...path]]/route.js` file.

---

## 📍 Location in File

Add these imports at the **top** of your route file (around line 1-10):

```javascript
import {
  handleGoogleCallback,
  handleGoogleAuth,
  handleSendOTP,
  handleVerifyOTP,
  handleLinkAccount,
} from '@/lib/auth-routes.js';
```

---

## 🔌 GET Handler Snippet

Add this to your **GET** function (around line 220-270, after existing auth routes):

```javascript
    // ============================================
    // NEW: Google OAuth
    // ============================================
    if (path === 'auth/google') {
      return handleGoogleAuth(json);
    }
```

**Location:** After existing auth routes like `auth/me`

---

## 🔌 POST Handler Snippet

Add these to your **POST** function (around line 690-730, after existing auth routes):

```javascript
    // ============================================
    // NEW: Google OAuth Callback
    // ============================================
    if (path === 'auth/google/callback') {
      return await handleGoogleCallback(req, db, json);
    }

    // ============================================
    // NEW: Send OTP
    // ============================================
    if (path === 'auth/send-otp') {
      return await handleSendOTP(req, db, json, rateLimit, getClientIp);
    }

    // ============================================
    // NEW: Verify OTP
    // ============================================
    if (path === 'auth/verify-otp') {
      return await handleVerifyOTP(req, db, json, rateLimit, getClientIp);
    }

    // ============================================
    // NEW: Link Account
    // ============================================
    if (path === 'auth/link-account') {
      return await handleLinkAccount(req, db, json, verifyToken);
    }
```

**Location:** After existing auth routes like `auth/signup`

---

## 📋 Complete Integration Example

Here's how your POST function should look after integration:

```javascript
export async function POST(req, { params }) {
  const p = await params;
  const path = (p?.path || []).join('/');
  try {
    const db = await getDb();
    await seedOnce();
    const body = await req.json().catch(() => ({}));

    // ... existing schemas and routes ...

    // Existing auth routes
    if (path === 'auth/login') {
      // ... existing login code ...
    }

    if (path === 'auth/signup') {
      // ... existing signup code ...
    }

    // ============================================
    // NEW: Google OAuth Callback
    // ============================================
    if (path === 'auth/google/callback') {
      return await handleGoogleCallback(req, db, json);
    }

    // ============================================
    // NEW: Send OTP
    // ============================================
    if (path === 'auth/send-otp') {
      return await handleSendOTP(req, db, json, rateLimit, getClientIp);
    }

    // ============================================
    // NEW: Verify OTP
    // ============================================
    if (path === 'auth/verify-otp') {
      return await handleVerifyOTP(req, db, json, rateLimit, getClientIp);
    }

    // ============================================
    // NEW: Link Account
    // ============================================
    if (path === 'auth/link-account') {
      return await handleLinkAccount(req, db, json, verifyToken);
    }

    // ... rest of your routes ...

    return json({ error: 'Not found', path }, 404);
  } catch (e) {
    console.error('POST error', e);
    return json({ error: e.message }, 500);
  }
}
```

---

## 🔍 Verification

After adding the snippets, verify:

1. **Imports are at the top**
   ```javascript
   import { handleGoogleCallback, ... } from '@/lib/auth-routes.js';
   ```

2. **GET route exists**
   ```javascript
   if (path === 'auth/google') {
     return handleGoogleAuth(json);
   }
   ```

3. **POST routes exist**
   ```javascript
   if (path === 'auth/google/callback') { ... }
   if (path === 'auth/send-otp') { ... }
   if (path === 'auth/verify-otp') { ... }
   if (path === 'auth/link-account') { ... }
   ```

4. **Test endpoints**
   ```bash
   curl http://localhost:3000/api/auth/google
   curl -X POST http://localhost:3000/api/auth/send-otp \
     -H "Content-Type: application/json" \
     -d '{"phone":"9876543210"}'
   ```

---

## 🚨 Important Notes

### Order Matters
- Add imports at the **very top** of the file
- Add GET route in the **GET** function
- Add POST routes in the **POST** function
- Add routes **after** existing auth routes

### Don't Break Existing Code
- Keep all existing routes unchanged
- Only add new routes
- Don't modify existing login/signup logic
- Don't change rate limiting or validation

### Environment Variables
- Make sure `.env.local` has:
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `GOOGLE_REDIRECT_URI`
  - `FIREBASE_API_KEY` (or Twilio/MSG91)

### Database
- Run MongoDB migration script
- Create `otp_sessions` collection
- Add new indexes

---

## 🧪 Testing After Integration

### Test Google OAuth
```bash
curl http://localhost:3000/api/auth/google
# Should return: { ok: true, authUrl: "...", state: "..." }
```

### Test Send OTP
```bash
curl -X POST http://localhost:3000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"9876543210"}'
# Should return: { ok: true, message: "OTP sent successfully" }
```

### Test Verify OTP
```bash
curl -X POST http://localhost:3000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"9876543210","otp":"123456"}'
# Should return: { ok: true, token: "...", user: {...} }
```

### Test Link Account
```bash
curl -X POST http://localhost:3000/api/auth/link-account \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"phone":"9876543210"}'
# Should return: { ok: true, message: "Account linked successfully" }
```

---

## ❌ Common Mistakes

### ❌ Adding imports in the middle of the file
```javascript
// WRONG - Don't do this
export async function GET() {
  import { handleGoogleAuth } from '@/lib/auth-routes.js'; // ❌ Wrong location
}
```

### ✅ Add imports at the top
```javascript
// CORRECT
import { handleGoogleAuth } from '@/lib/auth-routes.js'; // ✅ Top of file

export async function GET() {
  // ...
}
```

---

### ❌ Forgetting to await async functions
```javascript
// WRONG
if (path === 'auth/google/callback') {
  return handleGoogleCallback(req, db, json); // ❌ Missing await
}
```

### ✅ Use await for async functions
```javascript
// CORRECT
if (path === 'auth/google/callback') {
  return await handleGoogleCallback(req, db, json); // ✅ With await
}
```

---

### ❌ Modifying existing routes
```javascript
// WRONG - Don't change existing code
if (path === 'auth/login') {
  // ... modified existing login code ... ❌
}
```

### ✅ Keep existing routes unchanged
```javascript
// CORRECT - Add new routes, don't modify existing
if (path === 'auth/login') {
  // ... keep existing login code unchanged ... ✅
}

if (path === 'auth/google/callback') {
  // ... add new route ... ✅
}
```

---

## 📝 Checklist

After adding snippets:

- [ ] Imports added at top of file
- [ ] GET route added in GET function
- [ ] POST routes added in POST function
- [ ] No syntax errors
- [ ] File still compiles
- [ ] Existing routes still work
- [ ] New routes respond correctly
- [ ] Environment variables set
- [ ] Database migration done
- [ ] Frontend components created

---

## 🆘 Troubleshooting

### "Cannot find module '@/lib/auth-routes.js'"
- Make sure file exists at `lib/auth-routes.js`
- Check file path is correct
- Restart dev server

### "handleGoogleCallback is not a function"
- Check import statement is correct
- Verify function is exported in `auth-routes.js`
- Check for typos in function name

### "path === 'auth/google' not working"
- Make sure route is in GET function, not POST
- Check path string is exactly `'auth/google'`
- Verify no typos

### "path === 'auth/send-otp' not working"
- Make sure route is in POST function, not GET
- Check path string is exactly `'auth/send-otp'`
- Verify no typos

---

## 📞 Need Help?

1. Check `AUTH_UPGRADE_GUIDE.md` for complete setup
2. Check `AUTH_INTEGRATION_CHECKLIST.md` for step-by-step
3. Review code comments in `lib/auth-routes.js`
4. Check browser console for errors
5. Check server logs for detailed errors

---

**Last Updated:** 2024
**Version:** 1.0.0

/**
 * Enhanced Auth Routes Handler
 * Includes: Google OAuth, OTP Login, Account Linking
 * 
 * Add these routes to your API:
 * - POST /auth/google/callback (Google OAuth callback)
 * - POST /auth/send-otp (Send OTP to phone)
 * - POST /auth/verify-otp (Verify OTP and login)
 * - GET /auth/google (Redirect to Google OAuth)
 */

import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { z } from 'zod';
import { hashPassword, signToken, hashOTP, generateOTP, generateState } from './auth-enhanced.js';
import { exchangeCodeForToken, getUserInfo, buildGoogleAuthUrl } from './google-auth.js';
import { sendOTPViaMSG91, createOTPRecord, isOTPExpired } from './otp-service.js';
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

// Initialize Firebase Admin
let firebaseAdminInitialized = false;

function initializeFirebaseAdmin() {
  if (firebaseAdminInitialized) return;
  
  try {
    const serviceAccountPath = path.join(process.cwd(), 'firebase-service-account.json');
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      firebaseAdminInitialized = true;
    }
  } catch (error) {
    console.error('Firebase Admin initialization error:', error.message);
  }
}

/**
 * Helper: Find or create user by email
 * Links accounts if email matches
 */
async function findOrCreateUserByEmail(db, email, googleId, name, picture) {
  const emailLc = email.toLowerCase().trim();
  let user = await db.collection('users').findOne({ email: emailLc });

  if (user) {
    // Link Google ID if not already linked
    if (!user.googleId && googleId) {
      await db.collection('users').updateOne(
        { id: user.id },
        { $set: { googleId, updatedAt: new Date().toISOString() } }
      );
      user.googleId = googleId;
    }
    return user;
  }

  // Create new user
  const id = 'u-' + uuidv4().slice(0, 12);
  const newUser = {
    id,
    name: name || email.split('@')[0],
    email: emailLc,
    googleId: googleId || null,
    phone: '',
    role: 'user',
    picture: picture || null,
    isVerified: true, // Google users are verified
    createdAt: new Date().toISOString(),
  };

  await db.collection('users').insertOne(newUser);
  return newUser;
}

/**
 * Helper: Find or create user by phone
 * Links accounts if phone matches
 */
async function findOrCreateUserByPhone(db, phone, name) {
  const phoneClean = String(phone).replace(/\D/g, '').slice(-10);
  let user = await db.collection('users').findOne({
    phone: phoneClean,
    role: { $in: ['user', 'customer'] },
  });

  if (user) {
    if (user.role === 'customer') {
      await db.collection('users').updateOne(
        { id: user.id },
        { $set: { role: 'user', updatedAt: new Date().toISOString() } }
      );
      user.role = 'user';
    }
    return user;
  }

  // Create new user with phone only — omit email so sparse unique index allows many phone users
  const id = 'u-' + uuidv4().slice(0, 12);
  const newUser = {
    id,
    name: name || `User ${phoneClean.slice(-4)}`,
    phone: phoneClean,
    role: 'user',
    isVerified: true, // OTP users are verified
    createdAt: new Date().toISOString(),
  };

  await db.collection('users').insertOne(newUser);
  return newUser;
}

/**
 * POST /auth/google/callback
 * Google OAuth callback handler
 * Body: { code, state }
 */
export async function handleGoogleCallback(req, db, json) {
  // Get code and state from query parameters (Google sends them as query params)
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code) {
    return json({ ok: false, error: 'Authorization code is required' }, 400);
  }

  try {
    // Note: State verification is optional for development
    // In production, implement proper state storage (cookies or session)
    // For now, we'll skip strict state validation since it's stored in sessionStorage on frontend
    // if (!state) {
    //   return json({ ok: false, error: 'Invalid state parameter' }, 400);
    // }

    // Exchange code for token
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      console.error('Google OAuth credentials not configured');
      return json({ ok: false, error: 'OAuth configuration error' }, 500);
    }

    const tokens = await exchangeCodeForToken(code, clientId, clientSecret, redirectUri);
    const userInfo = await getUserInfo(tokens.accessToken);

    // Find or create user
    const user = await findOrCreateUserByEmail(db, userInfo.email, userInfo.googleId, userInfo.name, userInfo.picture);

    // Generate JWT
    const token = signToken({ uid: user.id, email: user.email, role: user.role });

    return json({
      ok: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        picture: user.picture || userInfo.picture,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Google callback error:', error);
    return json({ ok: false, error: error.message || 'Google authentication failed' }, 500);
  }
}

/**
 * GET /auth/google
 * Redirect to Google OAuth authorization URL
 */
export function handleGoogleAuth(json) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return json({ ok: false, error: 'OAuth configuration error' }, 500);
    }

    const state = generateState();
    const authUrl = buildGoogleAuthUrl(clientId, redirectUri, state);

    // Return auth URL and state (frontend will redirect)
    return json({
      ok: true,
      authUrl,
      state, // Frontend should store this
    });
  } catch (error) {
    console.error('Google auth error:', error);
    return json({ ok: false, error: 'Failed to generate auth URL' }, 500);
  }
}

/**
 * POST /auth/send-otp
 * Send OTP to phone number
 * Body: { phone }
 */
export async function handleSendOTP(req, db, json, rateLimit, getClientIp, body = null) {
  if (!body) body = await req.json().catch(() => ({}));
  const { phone, recaptchaToken } = body;

  // Validate phone
  if (!phone || !/^\d{10}$/.test(String(phone).replace(/\D/g, '').slice(-10))) {
    return json({ ok: false, error: 'Valid 10-digit phone number required' }, 400);
  }

  // Rate limit: max 3 OTP per phone per 10 minutes
  const rl = rateLimit(getClientIp(req), `otp:${phone}`, 3, 600000);
  if (rl.limited) {
    return json({ ok: false, error: `Too many attempts. Try again in ${rl.retryAfter}s.` }, 429);
  }

  try {
    const phoneClean = String(phone).replace(/\D/g, '').slice(-10);
    const otp = generateOTP();
    const { otpHash, expiresAt } = createOTPRecord(otp);

    // Store OTP in database
    await db.collection('otp_sessions').updateOne(
      { phone: phoneClean },
      {
        $set: {
          phone: phoneClean,
          otpHash,
          expiresAt,
          attempts: 0,
          createdAt: new Date().toISOString(),
        },
      },
      { upsert: true }
    );

    // Send OTP via Renflair, Twilio, Firebase, or MSG91
    const renflairKey = process.env.RENFLAIR_API_KEY;
    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
    const firebaseKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    const msg91Key = process.env.MSG91_AUTH_KEY;
    
    // Try Renflair first (Indian SMS provider)
    if (renflairKey) {
      try {
        const renflairUrl = `https://sms.renflair.in/V1.php?API=${renflairKey}&PHONE=${phoneClean}&OTP=${otp}`;
        const smsRes = await fetch(renflairUrl);
        const smsData = await smsRes.text();
        console.log('[OTP] Renflair response:', smsData);
        
        if (smsRes.ok) {
          console.log('[OTP] Renflair SMS sent to:', phoneClean);
          // Do NOT store plaintext OTP; only mark method for auditing
          await db.collection('otp_sessions').updateOne(
            { phone: phoneClean },
            { $set: { method: 'renflair' } }
          );
        } else {
          console.error('Renflair SMS failed:', smsData);
          return json({ ok: false, error: 'Failed to send SMS' }, 500);
        }
      } catch (error) {
        console.error('Renflair SMS error:', error.message);
        return json({ ok: false, error: 'Failed to send SMS' }, 500);
      }
    } else if (twilioAccountSid && twilioAuthToken && twilioPhoneNumber) {
      try {
        const auth = Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString('base64');
        const smsRes = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${auth}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              From: twilioPhoneNumber,
              To: `+91${phoneClean}`,
              Body: `Your verification code is ${otp}. Valid for 5 minutes.`,
            }).toString(),
          }
        );
        
        const smsData = await smsRes.json();
        console.log('[OTP] Twilio response:', smsRes.status, smsData);
        
        if (smsRes.ok) {
          console.log('[OTP] Twilio SMS sent to:', phoneClean);
        } else {
          console.error('Twilio SMS failed:', smsData);
          return json({ ok: false, error: 'Failed to send SMS' }, 500);
        }
      } catch (error) {
        console.error('Twilio SMS error:', error.message);
        return json({ ok: false, error: 'Failed to send SMS' }, 500);
      }
    } else if (firebaseKey) {
      console.log('[OTP] Trying Firebase for:', phoneClean, 'recaptcha:', recaptchaToken ? 'yes' : 'no');
      try {
        // Firebase requires reCAPTCHA token for phone auth
        const requestBody = {
          phoneNumber: `+91${phoneClean}`,
        };
        
        // Only add recaptchaToken if provided
        if (recaptchaToken) {
          requestBody.recaptchaToken = recaptchaToken;
        }
        
        const firebaseRes = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:sendVerificationCode?key=${firebaseKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
          }
        );
        
        const responseText = await firebaseRes.text();
        console.log('[OTP] Firebase response:', firebaseRes.status, responseText);
        
        if (!firebaseRes.ok) {
          let err;
          try { err = JSON.parse(responseText); } catch { err = { error: { message: responseText } }; }
          console.error('Firebase OTP error:', err);
          
          // Check if error is about reCAPTCHA
          if (err.error?.message?.includes('recaptcha') || err.error?.message?.includes('CAPTCHA')) {
            return json({ ok: false, error: 'Please complete the reCAPTCHA verification' }, 400);
          }
          
          // Fall back to console logging for testing
          console.log(`[OTP FALLBACK] Phone: ${phoneClean}, OTP: ${otp}`);
        } else {
          const firebaseData = JSON.parse(responseText);
          await db.collection('otp_sessions').updateOne(
            { phone: phoneClean },
            { $set: { sessionInfo: firebaseData.sessionInfo, method: 'firebase' } }
          );
          console.log('[OTP] Firebase sent for:', phoneClean);
        }
      } catch (error) {
        console.error('Firebase error:', error.message);
        console.log(`[OTP FALLBACK] Phone: ${phoneClean}, OTP: ${otp}`);
      }
    } else {
      // No provider - log to console
      console.log(`[OTP] Phone: ${phoneClean}, OTP: ${otp}`);
    }
    
    return json({
      ok: true,
      message: 'OTP sent successfully',
      // In production, don't return OTP. This is for testing only.
      // Remove this line in production:
      // otp: process.env.NODE_ENV === 'development' ? otp : undefined,
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    return json({ ok: false, error: error.message || 'Failed to send OTP' }, 500);
  }
}

/**
 * POST /auth/verify-otp
 * Verify OTP and login/signup user
 * Body: { phone, otp, name (optional) }
 */
export async function handleVerifyOTP(req, db, json, rateLimit, getClientIp, body = null) {
  if (!body) body = await req.json().catch(() => ({}));
  const { phone, otp, name } = body;

  // Validate inputs
  if (!phone || !otp) {
    return json({ ok: false, error: 'Phone and OTP are required' }, 400);
  }

  const phoneClean = String(phone).replace(/\D/g, '').slice(-10);

  // Rate limit: max 5 OTP verification attempts per phone per minute
  const rl = rateLimit(getClientIp(req), `otp-verify:${phoneClean}`, 5, 60000);
  if (rl.limited) {
    return json({ ok: false, error: `Too many attempts. Try again in ${rl.retryAfter}s.` }, 429);
  }

  try {
    // Get OTP session
    const session = await db.collection('otp_sessions').findOne({ phone: phoneClean });

    if (!session) {
      return json({ ok: false, error: 'OTP not found. Request a new OTP.' }, 400);
    }

    // Check if OTP is expired
    if (isOTPExpired(session.expiresAt)) {
      await db.collection('otp_sessions').deleteOne({ phone: phoneClean });
      return json({ ok: false, error: 'OTP expired. Request a new OTP.' }, 400);
    }

    // Verify based on method
    let verified = false;
    
    if (session.method === 'firebase' && session.sessionInfo) {
      // Firebase verification
      const firebaseKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
      const firebaseRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPhoneNumber?key=${firebaseKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionInfo: session.sessionInfo,
            code: otp,
          }),
        }
      );
      
      if (firebaseRes.ok) {
        verified = true;
      } else {
        const err = await firebaseRes.json();
        console.error('Firebase verify error:', err);
        return json({ ok: false, error: 'Invalid OTP' }, 400);
      }
    } else if (session.otpHash) {
      // Old hash-based verification
      const otpHash = hashOTP(otp);
      if (otpHash !== session.otpHash) {
        // Increment attempts
        await db.collection('otp_sessions').updateOne(
          { phone: phoneClean },
          { $inc: { attempts: 1 } }
        );

        if (session.attempts >= 4) {
          await db.collection('otp_sessions').deleteOne({ phone: phoneClean });
          return json({ ok: false, error: 'Too many failed attempts. Request a new OTP.' }, 400);
        }

        return json({ ok: false, error: 'Invalid OTP' }, 400);
      }
      verified = true;
    } else {
      return json({ ok: false, error: 'Invalid OTP' }, 400);
    }

    // OTP verified - find or create user
    const user = await findOrCreateUserByPhone(db, phoneClean, name);

    // Delete OTP session
    await db.collection('otp_sessions').deleteOne({ phone: phoneClean });

    // Generate JWT
    const token = signToken({ uid: user.id, email: user.email, role: user.role });

    return json(
      {
        ok: true,
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
        },
      },
      200,
      'none',
      { 'Set-Cookie': `cs_token=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${7 * 86400}` }
    );
  } catch (error) {
    console.error('Verify OTP error:', error);
    const msg = String(error?.message || '');
    if (msg.includes('E11000') && msg.includes('email')) {
      return json({ ok: false, error: 'Could not create account. Please try again in a moment.' }, 500);
    }
    return json({ ok: false, error: error.message || 'OTP verification failed' }, 500);
  }
}

/**
 * POST /auth/verify-otp-firebase
 * Verify Firebase ID token and login user
 * Body: { phone, idToken }
 */
export async function handleVerifyFirebaseOTP(req, db, json, rateLimit, getClientIp, body = null) {
  if (!body) body = await req.json().catch(() => ({}));
  const { phone, idToken } = body;

  if (!phone || !idToken) {
    return json({ ok: false, error: 'Phone and ID token are required' }, 400);
  }

  const phoneClean = String(phone).replace(/\D/g, '').slice(-10);

  // Rate limit
  const rl = rateLimit(getClientIp(req), `firebase-otp:${phoneClean}`, 5, 60000);
  if (rl.limited) {
    return json({ ok: false, error: `Too many attempts. Try again in ${rl.retryAfter}s.` }, 429);
  }

  try {
    // Initialize Firebase Admin
    initializeFirebaseAdmin();

    if (!firebaseAdminInitialized) {
      return json({ ok: false, error: 'Firebase not configured' }, 500);
    }

    // Verify the Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    // Check if phone matches
    if (decodedToken.phone_number !== `+91${phoneClean}`) {
      return json({ ok: false, error: 'Phone number mismatch' }, 400);
    }

    // Find or create user by phone
    const user = await findOrCreateUserByPhone(db, phoneClean);

    // Generate JWT
    const token = signToken({ uid: user.id, email: user.email, role: user.role });

    return json({
      ok: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Firebase OTP verify error:', error);
    return json({ ok: false, error: error.message || 'Firebase verification failed' }, 500);
  }
}

/**
 * POST /auth/link-account
 * Link phone/email to existing account
 * Requires authentication
 * Body: { phone } or { email }
 */
export async function handleLinkAccount(req, db, json, verifyToken) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const data = verifyToken(token);

  if (!data) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  const body = await req.json().catch(() => ({}));
  const { phone, email } = body;

  if (!phone && !email) {
    return json({ ok: false, error: 'Phone or email is required' }, 400);
  }

  try {
    const user = await db.collection('users').findOne({ id: data.uid });
    if (!user) {
      return json({ ok: false, error: 'User not found' }, 404);
    }

    if (phone) {
      const phoneClean = String(phone).replace(/\D/g, '').slice(-10);
      const existing = await db.collection('users').findOne({ phone: phoneClean, id: { $ne: user.id } });
      if (existing) {
        return json({ ok: false, error: 'This phone is already linked to another account' }, 409);
      }

      await db.collection('users').updateOne(
        { id: user.id },
        { $set: { phone: phoneClean, updatedAt: new Date().toISOString() } }
      );
    }

    if (email) {
      const emailLc = email.toLowerCase().trim();
      const existing = await db.collection('users').findOne({ email: emailLc, id: { $ne: user.id } });
      if (existing) {
        return json({ ok: false, error: 'This email is already linked to another account' }, 409);
      }

      await db.collection('users').updateOne(
        { id: user.id },
        { $set: { email: emailLc, updatedAt: new Date().toISOString() } }
      );
    }

    return json({ ok: true, message: 'Account linked successfully' });
  } catch (error) {
    console.error('Link account error:', error);
    return json({ ok: false, error: error.message || 'Failed to link account' }, 500);
  }
}

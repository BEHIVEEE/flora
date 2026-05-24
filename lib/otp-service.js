/**
 * OTP Service - Send & Verify OTP
 * Supports: Firebase Admin SDK, Twilio, MSG91
 * Currently configured for Firebase Admin SDK (recommended for India)
 */

import { hashOTP } from './auth-enhanced.js';
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

let firebaseInitialized = false;

function initializeFirebase() {
  if (firebaseInitialized) return;
  
  try {
    const serviceAccountPath = path.join(process.cwd(), 'firebase-service-account.json');
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      firebaseInitialized = true;
    }
  } catch (error) {
    console.error('Firebase initialization error:', error.message);
  }
}

const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Send OTP via Firebase Admin SDK (Recommended for India)
 * Uses Firebase Authentication backend to send real SMS
 */
export async function sendOTPViaFirebase(phoneNumber) {
  try {
    initializeFirebase();
    
    if (!firebaseInitialized) {
      throw new Error('Firebase not initialized. Check firebase-service-account.json');
    }

    const phone = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
    
    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Use Firebase to send SMS via Twilio integration
    // Note: This requires Firebase to have SMS provider configured
    // For now, we'll use the REST API approach with proper auth
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendVerificationCode?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: phone,
          recaptchaToken: '', // Can be added for production
        }),
      }
    );

    if (!response.ok) {
      const err = await response.json();
      console.error('Firebase SMS error:', err);
      throw new Error(`Firebase OTP send failed: ${err.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return {
      success: true,
      sessionInfo: data.sessionInfo,
      message: 'OTP sent successfully via Firebase',
    };
  } catch (error) {
    console.error('Firebase OTP send error:', error.message);
    throw error;
  }
}

/**
 * Send OTP via Twilio (Alternative - requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE)
 */
export async function sendOTPViaTwilio(phoneNumber, otp) {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhone = process.env.TWILIO_PHONE;

    if (!accountSid || !authToken || !twilioPhone) {
      throw new Error('Twilio credentials not configured');
    }

    if (!otp) otp = Math.floor(100000 + Math.random() * 900000).toString();

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: twilioPhone,
          To: phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`,
          Body: `Your ChemistShop verification code is: ${otp}. Valid for 5 minutes.`,
        }).toString(),
      }
    );

    if (!response.ok) {
      const err = await response.json();
      throw new Error(`Twilio send failed: ${err.message || 'Unknown error'}`);
    }

    return {
      success: true,
      otp, // Return OTP for testing; in production, store hash in DB
      message: 'OTP sent successfully',
    };
  } catch (error) {
    console.error('Twilio OTP send error:', error);
    throw error;
  }
}

/**
 * Send OTP via MSG91 (Alternative - requires MSG91_AUTH_KEY, MSG91_ROUTE)
 */
export async function sendOTPViaMSG91(phoneNumber) {
  try {
    const authKey = process.env.MSG91_AUTH_KEY;
    const route = process.env.MSG91_ROUTE || '4';

    if (!authKey) {
      throw new Error('MSG91_AUTH_KEY not configured');
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const phoneClean = phoneNumber.replace(/\D/g, '').slice(-10);

    const response = await fetch('https://api.msg91.com/api/sendotp.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        authkey: authKey,
        mobile: `91${phoneClean}`,
        message: `Your ChemistShop verification code is: ${otp}. Valid for 5 minutes.`,
        route,
        country: '91',
      }).toString(),
    });

    if (!response.ok) {
      throw new Error('MSG91 send failed');
    }

    return {
      success: true,
      otp, // Return OTP for testing; in production, store hash in DB
      message: 'OTP sent successfully',
    };
  } catch (error) {
    console.error('MSG91 OTP send error:', error);
    throw error;
  }
}

/**
 * Store OTP in database with expiry
 * Returns: { otpHash, expiresAt }
 */
export function createOTPRecord(otp) {
  const otpHash = hashOTP(otp);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS).toISOString();
  return { otpHash, expiresAt };
}

/**
 * Check if OTP is expired
 */
export function isOTPExpired(expiresAt) {
  return new Date() > new Date(expiresAt);
}

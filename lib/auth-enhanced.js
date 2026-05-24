import crypto from 'crypto';

const getSecret = () => {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET environment variable is required');
  return secret;
};

export const hashPassword = (pwd, salt) => crypto.pbkdf2Sync(pwd, salt, 100000, 64, 'sha512').toString('hex');

export const signToken = (payload) => {
  const body = Buffer.from(JSON.stringify({ ...payload, iat: Date.now() })).toString('base64url');
  const sig = crypto.createHmac('sha256', getSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
};

export const verifyToken = (token) => {
  if (!token) return null;
  const [body, sig] = (token || '').split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', getSecret()).update(body).digest('base64url');
  if (expected !== sig) return null;
  try {
    const d = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (Date.now() - d.iat > 7 * 86400000) return null;
    return d;
  } catch { return null; }
};

export const getBearer = (req) => (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');

/**
 * Hash OTP using SHA256 (for secure storage in DB)
 */
export const hashOTP = (otp) => crypto.createHash('sha256').update(otp).digest('hex');

/**
 * Generate random 6-digit OTP
 */
export const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

/**
 * Verify OTP by comparing hashes
 */
export const verifyOTP = (inputOtp, storedHash) => {
  const inputHash = hashOTP(inputOtp);
  return inputHash === storedHash;
};

/**
 * Generate Google OAuth state token (CSRF protection)
 */
export const generateState = () => crypto.randomBytes(32).toString('hex');

/**
 * Verify Google OAuth state token
 */
export const verifyState = (state, storedState) => state === storedState;

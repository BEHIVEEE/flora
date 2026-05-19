import crypto from 'crypto';

const SECRET = process.env.AUTH_SECRET;
if (!SECRET) throw new Error('AUTH_SECRET environment variable is required');

export const hashPassword = (pwd, salt) => crypto.pbkdf2Sync(pwd, salt, 100000, 64, 'sha512').toString('hex');

export const signToken = (payload) => {
  const body = Buffer.from(JSON.stringify({ ...payload, iat: Date.now() })).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
};

export const verifyToken = (token) => {
  if (!token) return null;
  const [body, sig] = (token || '').split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  if (expected !== sig) return null;
  try {
    const d = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (Date.now() - d.iat > 7 * 86400000) return null;
    return d;
  } catch { return null; }
};

export const getBearer = (req) => (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');

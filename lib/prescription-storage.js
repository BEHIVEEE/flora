/**
 * Prescription Storage Helper
 * - Stores files on local disk in structured folders
 * - Validates MIME types (real bytes, not extension)
 * - Prevents path traversal
 * - Optional image compression via sharp (if installed)
 *
 * Folder layout:
 *   <PRESCRIPTION_DIR>/YYYY/MM/DD/<orderId>_<userId>/prescription_<orderId>_<timestamp>.<ext>
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Where to save files. Override with env PRESCRIPTION_DIR.
// Defaults to a "prescriptions" folder inside the project (safe & portable).
export const PRESCRIPTION_DIR =
  process.env.PRESCRIPTION_DIR ||
  path.join(process.cwd(), 'prescriptions');

// Max 5 MB
export const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Allowed MIME types -> file extension
const ALLOWED_MIME = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'application/pdf': 'pdf',
};

// Magic-number signatures (first bytes of file) for real type detection
function detectMimeFromBytes(buffer) {
  if (!buffer || buffer.length < 8) return null;
  const b = buffer;

  // JPEG: FF D8 FF
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a
  )
    return 'image/png';

  // PDF: 25 50 44 46  ("%PDF")
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46)
    return 'application/pdf';

  return null;
}

/**
 * Sanitize a single path segment (no slashes, no traversal).
 */
function safeSegment(s) {
  return String(s || '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 64) || 'unknown';
}

/**
 * Make sure a resolved path stays inside the base dir (path traversal guard).
 */
function ensureInside(basePath, targetPath) {
  const resolved = path.resolve(targetPath);
  const baseResolved = path.resolve(basePath);
  if (!resolved.startsWith(baseResolved + path.sep) && resolved !== baseResolved) {
    throw new Error('Path traversal attempt detected');
  }
  return resolved;
}

/**
 * Validate a File/Blob (from req.formData()) and return a Buffer + metadata.
 * Throws on invalid input.
 */
export async function validateAndReadFile(file) {
  if (!file || typeof file.arrayBuffer !== 'function') {
    throw new Error('No file provided');
  }
  if (typeof file.size === 'number' && file.size > MAX_FILE_SIZE) {
    throw new Error(`File too large (max ${MAX_FILE_SIZE / 1024 / 1024} MB)`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length === 0) throw new Error('Empty file');
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`File too large (max ${MAX_FILE_SIZE / 1024 / 1024} MB)`);
  }

  // Real MIME detection (don't trust client-provided type)
  const detectedMime = detectMimeFromBytes(buffer);
  if (!detectedMime || !ALLOWED_MIME[detectedMime]) {
    throw new Error('Invalid or unsupported file type. Only JPG, PNG, PDF allowed.');
  }

  return {
    buffer,
    mimeType: detectedMime,
    extension: ALLOWED_MIME[detectedMime],
    originalName: file.name || 'upload',
    size: buffer.length,
  };
}

/**
 * Optionally compress images via sharp (if installed).
 * Returns the (possibly compressed) buffer + final extension.
 */
async function maybeCompressImage(buffer, mimeType, ext) {
  if (mimeType === 'application/pdf') return { buffer, ext };
  try {
    // dynamic import so app still works if sharp isn't installed
    const sharp = (await import('sharp')).default;
    if (mimeType === 'image/png') {
      const out = await sharp(buffer)
        .rotate() // honor EXIF
        .resize({ width: 2000, withoutEnlargement: true })
        .png({ compressionLevel: 9 })
        .toBuffer();
      return { buffer: out, ext: 'png' };
    }
    // JPEG (and any image/jpg)
    const out = await sharp(buffer)
      .rotate()
      .resize({ width: 2000, withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
    return { buffer: out, ext: 'jpg' };
  } catch {
    // sharp not installed or failed — keep original
    return { buffer, ext };
  }
}

/**
 * Save a validated buffer to disk using the structured folder layout.
 * @param {Object} args
 * @param {Buffer} args.buffer
 * @param {string} args.mimeType
 * @param {string} args.extension
 * @param {string} args.userId
 * @param {string} args.orderId
 * @returns {Promise<{filePath: string, relativePath: string, size: number, mimeType: string, sha256: string}>}
 */
export async function savePrescriptionFile({
  buffer,
  mimeType,
  extension,
  userId,
  orderId,
}) {
  const userSeg = safeSegment(userId);
  const orderSeg = safeSegment(orderId);

  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');

  const dirRel = path.join(yyyy, mm, dd, `${orderSeg}_${userSeg}`);
  const dirAbs = ensureInside(PRESCRIPTION_DIR, path.join(PRESCRIPTION_DIR, dirRel));

  await fs.promises.mkdir(dirAbs, { recursive: true });

  // Compress images if sharp is available
  const compressed = await maybeCompressImage(buffer, mimeType, extension);

  const ts = Date.now();
  const fileName = `prescription_${orderSeg}_${ts}.${compressed.ext}`;
  const fileAbs = ensureInside(PRESCRIPTION_DIR, path.join(dirAbs, fileName));

  // Hash for dedup / integrity
  const sha256 = crypto.createHash('sha256').update(compressed.buffer).digest('hex');

  await fs.promises.writeFile(fileAbs, compressed.buffer, { mode: 0o600 });

  return {
    filePath: fileAbs,
    relativePath: path.join(dirRel, fileName).replace(/\\/g, '/'),
    fileName,
    size: compressed.buffer.length,
    mimeType,
    sha256,
  };
}

/**
 * Resolve a stored relative path back to an absolute path inside PRESCRIPTION_DIR.
 * Throws if the path tries to escape the base directory.
 */
export function resolveStoredPath(relativePath) {
  if (!relativePath || typeof relativePath !== 'string') {
    throw new Error('Invalid path');
  }
  if (relativePath.includes('..')) throw new Error('Invalid path');
  const abs = path.resolve(PRESCRIPTION_DIR, relativePath);
  return ensureInside(PRESCRIPTION_DIR, abs);
}

export function mimeTypeFor(extOrPath) {
  const e = String(extOrPath).toLowerCase();
  if (e.endsWith('.pdf')) return 'application/pdf';
  if (e.endsWith('.png')) return 'image/png';
  if (e.endsWith('.jpg') || e.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}

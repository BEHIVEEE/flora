import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export { cloudinary };

const ALLOWED_FORMATS = ['jpg', 'jpeg', 'png', 'webp'];
const MAX_SIZE_MB = 2;

export function validateImage(fileName, sizeBytes) {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (!ALLOWED_FORMATS.includes(ext)) {
    return { ok: false, error: `Only ${ALLOWED_FORMATS.join(', ')} files are allowed` };
  }
  if (sizeBytes > MAX_SIZE_MB * 1024 * 1024) {
    return { ok: false, error: `Max file size is ${MAX_SIZE_MB}MB` };
  }
  return { ok: true };
}

export async function uploadToCloudinary(base64Data, folder = 'chemistshop') {
  const result = await cloudinary.uploader.upload(base64Data, {
    folder,
    resource_type: 'image',
    quality: 'auto:good',
    fetch_format: 'auto',
  });
  return result.secure_url;
}

export async function deleteFromCloudinary(url) {
  try {
    const publicId = extractPublicId(url);
    if (!publicId) return;
    await cloudinary.uploader.destroy(publicId);
  } catch (e) { console.error('Cloudinary delete error', e); }
}

function extractPublicId(url) {
  try {
    const match = url.match(/\/upload\/.*\/(.*)\.(jpg|jpeg|png|webp|gif)/);
    return match ? match[1] : null;
  } catch { return null; }
}

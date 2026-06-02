export function cdn(src, { w, h, fit = 'fit', gravity = 'auto', quality = 'auto', format = 'auto' } = {}) {
  try {
    if (!src) return src;
    // Skip data URLs or already-cloudinary
    if (src.startsWith('data:') || src.includes('res.cloudinary.com')) return src;

    const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME;
    if (!cloud) return src; // graceful fallback

    // Map generic fit to Cloudinary crop modes
    const FIT_MAP = {
      fill: 'fill',
      cover: 'fill',
      contain: 'fit',
      fit: 'fit',
      limit: 'limit',
      scale: 'scale',
      pad: 'pad',
      crop: 'crop',
    };
    const cropMode = FIT_MAP[fit] || 'fit';

    const parts = [];
    if (cropMode) parts.push(`c_${cropMode}`);
    if ((cropMode === 'fill' || cropMode === 'crop' || cropMode === 'pad') && gravity) parts.push(`g_${gravity}`);
    if (w) parts.push(`w_${Math.round(w)}`);
    if (h) parts.push(`h_${Math.round(h)}`);
    if (quality) parts.push(`q_${quality}`);
    if (format) parts.push(`f_${format}`);

    const transform = parts.join(',');
    // For fetch, Cloudinary accepts the remote URL appended unencoded
    return `https://res.cloudinary.com/${cloud}/image/fetch/${transform}/${src}`;
  } catch {
    return src;
  }
}

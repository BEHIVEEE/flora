export function cdn(src, { w, h, fit = 'fill', gravity = 'auto', quality = 'auto', format = 'auto' } = {}) {
  try {
    if (!src) return src;
    // Skip data URLs or already-cloudinary
    if (src.startsWith('data:') || src.includes('res.cloudinary.com')) return src;

    const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME;
    if (!cloud) return src; // graceful fallback

    const parts = [];
    if (fit) parts.push(`c_${fit}`);
    if (gravity) parts.push(`g_${gravity}`);
    if (w) parts.push(`w_${Math.round(w)}`);
    if (h) parts.push(`h_${Math.round(h)}`);
    if (quality) parts.push(`q_${quality}`);
    if (format) parts.push(`f_${format}`);

    const transform = parts.join(',');
    const encoded = encodeURIComponent(src);
    return `https://res.cloudinary.com/${cloud}/image/fetch/${transform}/${encoded}`;
  } catch {
    return src;
  }
}

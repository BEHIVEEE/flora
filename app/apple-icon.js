import { ImageResponse } from 'next/og';
import { pwaIconMarkup } from '@/lib/pwa-icon';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  const { width, height, element } = pwaIconMarkup(180);
  return new ImageResponse(element, { width, height });
}

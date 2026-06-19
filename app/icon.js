import { ImageResponse } from 'next/og';
import { pwaIconMarkup } from '@/lib/pwa-icon';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  const { width, height, element } = pwaIconMarkup(32);
  return new ImageResponse(element, { width, height });
}

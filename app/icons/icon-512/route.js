import { ImageResponse } from 'next/og';
import { pwaIconMarkup } from '@/lib/pwa-icon';

export const runtime = 'edge';

export async function GET() {
  const { width, height, element } = pwaIconMarkup(512);
  return new ImageResponse(element, { width, height });
}

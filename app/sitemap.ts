import { getDb } from '@/lib/mongo';

const SITE_URL = 'https://www.florachemist.online';

export default async function sitemap() {
  const staticPages = [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/login`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/cart`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/checkout`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/prescription`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/chat`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  ];

  let productPages = [];
  try {
    const db = await getDb();
    const products = await db.collection('products')
      .find({}, { projection: { slug: 1, _id: 0 } })
      .toArray();
    productPages = products.map(p => ({
      url: `${SITE_URL}/product/${p.slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    }));
  } catch (e) {
    console.error('Sitemap: failed to fetch products', e);
  }

  return [...staticPages, ...productPages];
}

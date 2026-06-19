export default function manifest() {
  return {
    id: '/',
    name: 'FloraChemist — Online Pharmacy',
    short_name: 'FloraChemist',
    description: 'Buy medicines, wellness products and healthcare essentials online. Fast delivery across India.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#ffffff',
    theme_color: '#0d9488',
    categories: ['shopping', 'medical', 'health'],
    lang: 'en-IN',
    dir: 'ltr',
    icons: [
      {
        src: '/icons/icon-192',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Search medicines',
        short_name: 'Search',
        url: '/products',
        icons: [{ src: '/icons/icon-192', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'My orders',
        short_name: 'Orders',
        url: '/account/orders',
        icons: [{ src: '/icons/icon-192', sizes: '192x192', type: 'image/png' }],
      },
    ],
  };
}

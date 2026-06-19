import './globals.css';
import { Inter } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Footer from '@/components/Footer';
import CartProvider from '@/components/CartProvider';
import AuthProvider from '@/components/AuthProvider';
import SettingsProvider from '@/components/SettingsProvider';
import PwaRegister from '@/components/PwaRegister';
import PwaInstall from '@/components/PwaInstall';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

const SITE_URL = 'https://www.florachemist.online';
const SITE_NAME = 'FloraChemist';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'FloraChemist — Online Pharmacy | Buy Medicines Online in India',
    template: '%s | FloraChemist',
  },
  description: 'FloraChemist is your trusted online pharmacy. Buy medicines, healthcare devices, wellness products & more. Scheduled slot delivery, licensed pharmacists, 100% authentic — trusted by 1 lakh+ families across India.',
  keywords: 'FloraChemist, online pharmacy India, buy medicines online, chemist near me, prescription medicines, healthcare store, wellness products, florachemist.online',
  authors: [{ name: 'FloraChemist', url: SITE_URL }],
  creator: 'FloraChemist',
  publisher: 'FloraChemist',
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  alternates: { canonical: SITE_URL },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: 'FloraChemist — Online Pharmacy | Buy Medicines Online in India',
    description: 'Buy medicines, healthcare devices, wellness products & more. Fast delivery, licensed pharmacists, 100% authentic. Trusted by 1L+ families.',
    images: [{ url: `${SITE_URL}/og-image.png`, width: 1200, height: 630, alt: 'FloraChemist — Online Pharmacy' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FloraChemist — Online Pharmacy | Buy Medicines Online in India',
    description: 'Buy medicines, healthcare devices, wellness products & more. Fast delivery, licensed pharmacists, 100% authentic.',
    images: [`${SITE_URL}/og-image.png`],
  },
  icons: { icon: '/icon', apple: '/apple-icon' },
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: SITE_NAME,
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
  verification: {},
};

export const viewport = { themeColor: '#0d9488', width: 'device-width', initialScale: 1 };

const App = ({ children }) => {
  return (
    <html lang="en" className={inter.variable} style={{ colorScheme: 'light' }} suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover" />
        <link rel="preconnect" href="https://res.cloudinary.com" crossOrigin="" />
        <link rel="preconnect" href="https://images.unsplash.com" crossOrigin="" />
        <link rel="dns-prefetch" href="https://res.cloudinary.com" />
        <link rel="dns-prefetch" href="https://images.unsplash.com" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@graph': [
              {
                '@type': 'Organization',
                '@id': 'https://www.florachemist.online/#org',
                name: 'FloraChemist',
                url: 'https://www.florachemist.online',
                logo: { '@type': 'ImageObject', url: 'https://www.florachemist.online/logo.png' },
                sameAs: [],
              },
              {
                '@type': 'WebSite',
                '@id': 'https://www.florachemist.online/#website',
                url: 'https://www.florachemist.online',
                name: 'FloraChemist',
                description: 'Online Pharmacy & Healthcare Store in India',
                publisher: { '@id': 'https://www.florachemist.online/#org' },
                potentialAction: {
                  '@type': 'SearchAction',
                  target: { '@type': 'EntryPoint', urlTemplate: 'https://www.florachemist.online/products?q={search_term_string}' },
                  'query-input': 'required name=search_term_string',
                },
              },
              {
                '@type': 'FAQPage',
                '@id': 'https://www.florachemist.online/#faq',
                mainEntity: [
                  { '@type': 'Question', name: 'Is FloraChemist a licensed online pharmacy?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. FloraChemist is a licensed online pharmacy in India. All medicines are sourced from authorised distributors and verified by certified pharmacists.' } },
                  { '@type': 'Question', name: 'How do I buy medicines online at FloraChemist?', acceptedAnswer: { '@type': 'Answer', text: 'Search for your medicine, add to cart, and place your order. Upload a prescription for Rx medicines. We accept UPI, cards, and cash on delivery.' } },
                  { '@type': 'Question', name: 'How does delivery work at FloraChemist?', acceptedAnswer: { '@type': 'Answer', text: 'Choose a scheduled delivery slot at checkout. Our team delivers your order in the time window you select. Free delivery on orders above ₹499.' } },
                  { '@type': 'Question', name: 'Are medicines on FloraChemist authentic?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. All medicines are sourced directly from authorised pharmaceutical distributors and verified for authenticity, batch number, and expiry.' } },
                ],
              },
              {
                '@type': 'Pharmacy',
                '@id': 'https://www.florachemist.online/#pharmacy',
                name: 'FloraChemist',
                description: 'Trusted online pharmacy offering medicines, healthcare devices, and wellness products across India.',
                url: 'https://www.florachemist.online',
                telephone: '+919167261103',
                priceRange: '₹₹',
                image: 'https://www.florachemist.online/og-image.png',
                address: { '@type': 'PostalAddress', addressCountry: 'IN' },
              },
            ],
          }) }}
        />
      </head>
      <body className="min-h-screen bg-white text-slate-900 font-sans antialiased pb-20 md:pb-0 overflow-x-hidden" suppressHydrationWarning>
        <SettingsProvider>
          <AuthProvider>
            <CartProvider>
              <Header />
              <main className="min-h-[60vh]">{children}</main>
              <Footer />
              <BottomNav />
            </CartProvider>
          </AuthProvider>
        </SettingsProvider>
        <Toaster richColors position="top-center" />
        <PwaRegister />
        <PwaInstall />
      </body>
    </html>
  );
};

export default App;

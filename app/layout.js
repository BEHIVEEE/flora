import './globals.css';
import { Inter } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Footer from '@/components/Footer';
import CartProvider from '@/components/CartProvider';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata = {
  title: 'ChemistShop — Apka Apna Chemist | Online Pharmacy & Healthcare Store',
  description: 'Buy medicines, healthcare devices, wellness products & more online. Fast delivery, expert pharmacists, trusted by thousands across India.',
  keywords: 'online pharmacy, buy medicines, healthcare, pharmacy near me, chemist shop, prescription, wellness',
  icons: { icon: '/favicon.ico' },
};

export const viewport = { themeColor: '#0d9488', width: 'device-width', initialScale: 1 };

const App = ({ children }) => {
  return (
    <html lang="en" className={inter.variable} style={{ colorScheme: 'light' }} suppressHydrationWarning>
      <body className="min-h-screen bg-white text-slate-900 font-sans antialiased pb-20 md:pb-0" suppressHydrationWarning>
        <CartProvider>
          <Header />
          <main className="min-h-[60vh]">{children}</main>
          <Footer />
          <BottomNav />
        </CartProvider>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
};

export default App;

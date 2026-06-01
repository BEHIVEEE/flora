'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Truck, ShieldCheck, BadgePercent, Phone, Mail, MapPin, Facebook, Instagram, Twitter, Youtube } from 'lucide-react';
import { useSettings } from './SettingsProvider';

const Footer = () => {
  const { shopName, tagline, contactPhone, contactEmail, address, freeDeliveryAbove } = useSettings();
  const pathname = usePathname();
  if (pathname?.startsWith('/admin')) return null;
  return (
    <footer className="bg-slate-50 border-t border-slate-200 mt-16">
      <div className="container max-w-7xl mx-auto px-4">
        {/* Trust strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-8 border-b border-slate-200">
          {[
            { icon: Truck, title: 'Free Delivery', sub: `On orders above ₹${freeDeliveryAbove}` },
            { icon: ShieldCheck, title: '100% Authentic', sub: 'Genuine medicines only' },
            { icon: BadgePercent, title: 'Up to 25% Off', sub: 'On prescription orders' },
            { icon: Phone, title: 'Expert Pharmacists', sub: 'Free consultation' },
          ].map((t, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                <t.icon className="w-5 h-5" />
              </div>
              <div>
                <div className="font-semibold text-slate-900 text-sm">{t.title}</div>
                <div className="text-xs text-slate-500">{t.sub}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 py-10">
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-teal-600 to-emerald-600 text-white rounded-xl flex items-center justify-center font-black text-2xl">+</div>
              <div>
                <div className="font-black text-lg text-slate-900">{shopName}</div>
                <div className="text-[11px] text-teal-700 font-semibold tracking-wide">{tagline?.toUpperCase()}</div>
              </div>
            </Link>
            <p className="text-sm text-slate-600 max-w-md mb-4">Your trusted online pharmacy delivering authentic medicines, healthcare devices, and wellness essentials across India. Backed by certified pharmacists and rigorous safety standards.</p>
            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-teal-600" /> {address}</div>
              <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-teal-600" /> {contactPhone}</div>
              <div className="flex items-center gap-2" suppressHydrationWarning><Mail className="w-4 h-4 text-teal-600" /> <span suppressHydrationWarning>{contactEmail}</span></div>
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-slate-900 mb-3 text-sm">Shop</h4>
            <ul className="space-y-2 text-sm text-slate-600">
              <li><Link href="/products?category=medicines" className="hover:text-teal-700">Medicines</Link></li>
              <li><Link href="/products?category=devices" className="hover:text-teal-700">Healthcare Devices</Link></li>
              <li><Link href="/products?category=wellness" className="hover:text-teal-700">Wellness</Link></li>
              <li><Link href="/products?category=baby-care" className="hover:text-teal-700">Mom & Baby</Link></li>
              <li><Link href="/products?category=skincare" className="hover:text-teal-700">Skin Care</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-slate-900 mb-3 text-sm">Company</h4>
            <ul className="space-y-2 text-sm text-slate-600">
              <li><a href="#" className="hover:text-teal-700">About Us</a></li>
              <li><a href="#" className="hover:text-teal-700">Careers</a></li>
              <li><a href="#" className="hover:text-teal-700">Press</a></li>
              <li><a href="#" className="hover:text-teal-700">Blog</a></li>
              <li><a href="#" className="hover:text-teal-700">Contact</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-slate-900 mb-3 text-sm">Help</h4>
            <ul className="space-y-2 text-sm text-slate-600">
              <li><Link href="/prescription" className="hover:text-teal-700">Upload Prescription</Link></li>
              <li><Link href="/refund-policy" className="hover:text-teal-700">Refund & Replacement Policy</Link></li>
              <li><a href="#" className="hover:text-teal-700">FAQ</a></li>
              <li><Link href="/privacy-policy" className="hover:text-teal-700">Privacy Policy</Link></li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 py-6 border-t border-slate-200">
          <p className="text-xs text-slate-500">© {new Date().getFullYear()} {shopName}. All rights reserved. {tagline} – Trusted Care Near You.</p>
          <div className="flex items-center gap-3 text-slate-400">
            <a href="#" className="hover:text-teal-600"><Facebook className="w-4 h-4" /></a>
            <a href="#" className="hover:text-teal-600"><Instagram className="w-4 h-4" /></a>
            <a href="#" className="hover:text-teal-600"><Twitter className="w-4 h-4" /></a>
            <a href="#" className="hover:text-teal-600"><Youtube className="w-4 h-4" /></a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

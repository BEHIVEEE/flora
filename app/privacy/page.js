import Link from 'next/link';
import { ChevronRight, Shield, Lock, Mail, FileText } from 'lucide-react';

export const metadata = {
  title: 'Privacy Policy — Flora Chemist',
  description: 'How Flora Chemist collects, uses, and protects your personal information.',
};

const SECTIONS = [
  {
    id: 'info-we-collect',
    title: '1. Information We Collect',
    body: (
      <>
        <p>We collect information to provide you with a safer, faster, and more reliable pharmacy experience. The types of data we collect include:</p>
        <ul>
          <li><b>Account details</b> — name, email, phone number, password, and profile information when you sign up.</li>
          <li><b>Order information</b> — delivery addresses, items purchased, payment method, and order history.</li>
          <li><b>Prescription uploads</b> — images or files of valid prescriptions you upload to purchase prescription medicines.</li>
          <li><b>Location data</b> — only when you choose to share your location for accurate delivery and pincode detection.</li>
          <li><b>Device & usage data</b> — browser type, IP address, pages visited, and interactions, collected automatically via cookies and similar technologies.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'how-we-use',
    title: '2. How We Use Your Information',
    body: (
      <>
        <ul>
          <li>Process orders, deliveries, and returns.</li>
          <li>Verify prescriptions with a licensed pharmacist before dispensing Rx medicines.</li>
          <li>Communicate order status, support replies, and important service announcements.</li>
          <li>Personalize product recommendations and improve our app.</li>
          <li>Detect and prevent fraud, abuse, or illegal activity.</li>
          <li>Comply with applicable laws and regulations (including the Drugs & Cosmetics Act, 1940).</li>
        </ul>
      </>
    ),
  },
  {
    id: 'sharing',
    title: '3. Sharing Your Information',
    body: (
      <>
        <p>We <b>do not sell</b> your personal data. We share information only with:</p>
        <ul>
          <li><b>Delivery partners and riders</b> — name, phone, and address required to complete delivery.</li>
          <li><b>Payment processors</b> — to securely process transactions (we never store card details on our servers).</li>
          <li><b>Pharmacists & medical reviewers</b> — to verify prescriptions before dispensing.</li>
          <li><b>Law enforcement or regulators</b> — when required by court order or applicable law.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'cookies',
    title: '4. Cookies & Tracking',
    body: (
      <>
        <p>We use cookies and similar technologies to keep you signed in, remember your cart, and understand how visitors use our site. You can control cookies through your browser settings. Disabling them may affect site functionality.</p>
      </>
    ),
  },
  {
    id: 'security',
    title: '5. Data Security',
    body: (
      <>
        <p>All data is transmitted over encrypted HTTPS connections. Passwords are hashed using industry-standard algorithms. We restrict internal access to personal data on a need-to-know basis. However, no system is 100% secure, so please use a strong, unique password and never share it.</p>
      </>
    ),
  },
  {
    id: 'retention',
    title: '6. Data Retention',
    body: (
      <>
        <p>We retain account and order data for as long as your account is active, and as required to comply with tax, accounting, and legal obligations (typically up to 7 years for invoices, as per Indian law). Prescriptions are stored as required by pharmacy regulations.</p>
      </>
    ),
  },
  {
    id: 'rights',
    title: '7. Your Rights',
    body: (
      <>
        <p>You have the right to:</p>
        <ul>
          <li>Access and download your personal data.</li>
          <li>Request correction of inaccurate information.</li>
          <li>Request deletion of your account and associated data (subject to legal retention requirements).</li>
          <li>Opt out of marketing communications at any time.</li>
        </ul>
        <p>To exercise these rights, write to us at <a href="mailto:privacy@florachemist.online" className="text-teal-700 font-semibold">privacy@florachemist.online</a>.</p>
      </>
    ),
  },
  {
    id: 'children',
    title: '8. Children\u2019s Privacy',
    body: (
      <>
        <p>Our services are not directed at children under 18. We do not knowingly collect data from minors. If you believe a child has provided us with personal information, contact us and we will delete it promptly.</p>
      </>
    ),
  },
  {
    id: 'changes',
    title: '9. Changes to This Policy',
    body: (
      <>
        <p>We may update this Privacy Policy from time to time. The latest version will always be available on this page with a revised &ldquo;Last updated&rdquo; date. Material changes will be communicated via email or an in-app notice.</p>
      </>
    ),
  },
  {
    id: 'contact',
    title: '10. Contact Us',
    body: (
      <>
        <p>Questions, concerns, or grievances? Reach our Data Protection Officer:</p>
        <ul>
          <li>Email: <a href="mailto:privacy@florachemist.online" className="text-teal-700 font-semibold">privacy@florachemist.online</a></li>
          <li>Address: Flora Chemist, [Your Registered Business Address], India</li>
        </ul>
      </>
    ),
  },
];

const PrivacyPage = () => {
  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Hero */}
      <div className="bg-gradient-to-br from-teal-600 to-emerald-700 text-white">
        <div className="container max-w-4xl mx-auto px-4 py-10 md:py-14">
          <div className="text-xs text-white/80 flex items-center gap-1 mb-3">
            <Link href="/" className="hover:text-white">Home</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-white font-medium">Privacy Policy</span>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
              <Shield className="w-6 h-6 md:w-7 md:h-7" />
            </div>
            <div>
              <h1 className="text-2xl md:text-4xl font-black tracking-tight">Privacy Policy</h1>
              <p className="text-sm md:text-base text-white/85 mt-1.5 max-w-2xl">Your privacy matters. This policy explains what data we collect, why, and how we keep it safe.</p>
              <p className="text-xs text-white/70 mt-2">Last updated: 22 May 2026</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-4xl mx-auto px-4 py-8 md:py-12">
        <div className="grid lg:grid-cols-[240px_1fr] gap-8">
          {/* Table of contents (desktop) */}
          <aside className="hidden lg:block">
            <div className="sticky top-32 bg-white rounded-2xl border border-slate-200 p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                <FileText className="w-3.5 h-3.5" /> On this page
              </div>
              <nav className="space-y-1">
                {SECTIONS.map(s => (
                  <a key={s.id} href={`#${s.id}`} className="block text-sm text-slate-700 hover:text-teal-700 hover:bg-teal-50 px-2 py-1.5 rounded-lg">{s.title}</a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Content */}
          <article className="bg-white rounded-2xl border border-slate-200 p-5 md:p-8">
            <div className="flex items-start gap-3 bg-teal-50 border border-teal-100 rounded-xl p-4 mb-6">
              <Lock className="w-5 h-5 text-teal-700 mt-0.5 shrink-0" />
              <div className="text-sm text-teal-900">
                We never sell your personal data. All transactions are encrypted and your prescriptions are reviewed only by licensed pharmacists.
              </div>
            </div>

            <div className="space-y-8 [&_a]:text-teal-700 [&_a:hover]:underline [&_p]:text-slate-600 [&_p]:leading-relaxed [&_p]:my-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-3 [&_ul]:space-y-1.5 [&_ul]:text-slate-600 [&_li]:leading-relaxed">
              {SECTIONS.map(s => (
                <section key={s.id} id={s.id} className="scroll-mt-28">
                  <h2 className="text-lg md:text-xl font-black text-slate-900 tracking-tight mb-2">{s.title}</h2>
                  {s.body}
                </section>
              ))}
            </div>

            <div className="mt-10 pt-6 border-t border-slate-100">
              <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-4">
                <Mail className="w-5 h-5 text-slate-500 shrink-0" />
                <div className="text-sm text-slate-700">
                  Have a question about your data? Email <a href="mailto:privacy@florachemist.online" className="text-teal-700 font-semibold hover:underline">privacy@florachemist.online</a>
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPage;

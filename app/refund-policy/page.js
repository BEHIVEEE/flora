import Link from 'next/link';
import { ChevronRight, RotateCw, ShieldCheck, Package, Headphones, ClipboardCheck } from 'lucide-react';

export const metadata = {
  title: 'Refund & Replacement Policy — Flora Chemist',
  description: 'Understand Flora Chemist’s policy for medicine replacements, damaged parcels, and return eligibility.',
};

const SECTIONS = [
  {
    id: 'overview',
    title: '1. Overview',
    points: [
      'Medicines once sold are <strong>not eligible for cash or payment refunds</strong> in accordance with the Drugs & Cosmetics Act, 1940 and allied pharmacy regulations.',
      'We offer hassle-free <strong>replacements only</strong> in cases where products are incorrect, damaged, expired, or missing from the shipment.',
      'Requests must be raised within <strong>48 hours</strong> of delivery so that we can investigate and process replacements quickly.',
    ],
  },
  {
    id: 'eligible',
    title: '2. Eligible for Replacement',
    points: [
      'You received a different medicine or variant than what was ordered.',
      'The product reached you in a damaged, tampered, or leaked condition (include photos of the parcel and inner packaging).',
      'The product supplied is past its expiry date or has less than 3 months of shelf life remaining.',
      'Items missing from your order box (partial delivery).',
    ],
  },
  {
    id: 'not-eligible',
    title: '3. Not Eligible for Replacement',
    points: [
      'Opened, partially used, or seal-broken medicines and health consumables unless the issue existed at the time of delivery.',
      'Cold chain / temperature-sensitive products after successful delivery.',
      'Orders reported after 48 hours of delivery completion.',
      'Products showing damage caused by improper storage at the customer’s premises.',
    ],
  },
  {
    id: 'process',
    title: '4. Replacement Process',
    points: [
      'Share your order ID, product details, and clear photos/videos highlighting the issue via WhatsApp or email at <a href="mailto:support@florachemist.online">support@florachemist.online</a>.',
      'Our pharmacist team verifies the claim within 24 business hours and may request additional documentation (e.g., prescription copy).',
      'Once approved, a replacement dispatch is scheduled immediately or during the next available delivery slot.',
      'If the product is out of stock, we issue a store credit of equal value valid for 12 months.',
    ],
  },
  {
    id: 'pickup',
    title: '5. Pickup & Exchange',
    points: [
      'Courier pickup is arranged for damaged / incorrect items where retrieval is required by regulation.',
      'For store pickup orders, return the item to our Dombivli store with the original invoice for inspection.',
      'Ensure products remain unopened and are stored under recommended conditions until pickup/return.',
    ],
  },
  {
    id: 'contact',
    title: '6. Need Help?',
    points: [
      'Call or WhatsApp our helpline: <a href="tel:+919987654321">+91 99876 54321</a>.',
      'Email our support desk: <a href="mailto:support@florachemist.online">support@florachemist.online</a>.',
      'Visit our store: Flora Chemist, Dombivli, Maharashtra, India.',
    ],
  },
];

const RefundPolicyPage = () => {
  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-amber-600 to-orange-600 text-white">
        <div className="container max-w-4xl mx-auto px-4 py-10 md:py-14">
          <div className="text-xs text-white/80 flex items-center gap-1 mb-3">
            <Link href="/" className="hover:text-white">Home</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-white font-medium">Refund & Replacement Policy</span>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
              <RotateCw className="w-6 h-6 md:w-7 md:h-7" />
            </div>
            <div>
              <h1 className="text-2xl md:text-4xl font-black tracking-tight">Refund & Replacement Policy</h1>
              <p className="text-sm md:text-base text-white/85 mt-1.5 max-w-2xl">Medicines are not refundable. If something goes wrong, we replace the item quickly with zero hassle.</p>
              <p className="text-xs text-white/70 mt-2">Last updated: 02 June 2026</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-4xl mx-auto px-4 py-8 md:py-12">
        <div className="grid lg:grid-cols-[240px_1fr] gap-8">
          {/* Sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-32 bg-white rounded-2xl border border-slate-200 p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                <ClipboardCheck className="w-3.5 h-3.5" /> Overview
              </div>
              <nav className="space-y-1">
                {SECTIONS.map(section => (
                  <a key={section.id} href={`#${section.id}`} className="block text-sm text-slate-700 hover:text-amber-600 hover:bg-amber-50 px-2 py-1.5 rounded-lg">
                    {section.title}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Content */}
          <article className="bg-white rounded-2xl border border-slate-200 p-5 md:p-8">
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-xl p-4 mb-6">
              <ShieldCheck className="w-5 h-5 text-amber-700 mt-0.5 shrink-0" />
              <div className="text-sm text-amber-900">
                We follow the Drugs & Cosmetics Act, 1940. Medicines once sold cannot be refunded, but we guarantee replacements whenever there is an issue with quality, damage, or accuracy.
              </div>
            </div>

            <div className="space-y-8 [&_h2]:text-lg [&_h2]:md:text-xl [&_h2]:font-black [&_h2]:text-slate-900 [&_h2]:tracking-tight [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-3 [&_ul]:space-y-1.5 [&_li]:leading-relaxed [&_li]:text-slate-600 [&_p]:text-slate-600 [&_p]:leading-relaxed">
              {SECTIONS.map(section => (
                <section key={section.id} id={section.id} className="scroll-mt-28">
                  <h2>{section.title}</h2>
                  <ul>
                    {section.points.map((point, index) => (
                      <li key={index} dangerouslySetInnerHTML={{ __html: point }} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>

            <div className="mt-10 pt-6 border-t border-slate-100">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-4 bg-slate-50 rounded-xl p-4">
                <Package className="w-5 h-5 text-slate-500 shrink-0" />
                <div className="text-sm text-slate-700">
                  Need to raise a replacement request? Email <a href="mailto:support@florachemist.online" className="text-amber-700 font-semibold hover:underline">support@florachemist.online</a> or WhatsApp us on <a href="tel:+919987654321" className="text-amber-700 font-semibold hover:underline">+91 99876 54321</a> within 48 hours of delivery.
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
};

export default RefundPolicyPage;

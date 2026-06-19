import Link from 'next/link';
import { WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'You are offline',
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <div className="container max-w-lg mx-auto px-4 py-20 text-center">
      <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mb-5">
        <WifiOff className="w-8 h-8" />
      </div>
      <h1 className="text-2xl font-black text-slate-900">You&apos;re offline</h1>
      <p className="text-slate-600 mt-2 text-sm leading-relaxed">
        Check your internet connection, then try again. Pages you opened recently may still be available.
      </p>
      <Link href="/" className="inline-block mt-6">
        <Button className="rounded-full bg-teal-600 hover:bg-teal-700">Go to home</Button>
      </Link>
    </div>
  );
}

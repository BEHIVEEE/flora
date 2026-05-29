import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="text-center">
        <h1 className="text-6xl font-black text-slate-200">404</h1>
        <h2 className="text-xl font-bold text-slate-800 mt-4">Page Not Found</h2>
        <p className="text-slate-500 mt-2 max-w-md mx-auto">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link href="/" className="inline-block mt-6 px-6 py-3 bg-teal-600 text-white font-bold rounded-full hover:bg-teal-700 transition-colors">
          Back to Home
        </Link>
      </div>
    </div>
  );
}

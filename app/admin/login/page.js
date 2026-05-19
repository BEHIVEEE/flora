'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const Page = () => {
  const router = useRouter();
  useEffect(() => { router.replace('/login?hint=admin'); }, [router]);
  return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">Redirecting…</div>;
};
export default Page;

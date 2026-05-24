'use client';
import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';

export default function GoogleCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');

      if (error) {
        toast.error(`Google login failed: ${error}`);
        router.replace('/login');
        return;
      }

      if (!code) {
        toast.error('No authorization code received');
        router.replace('/login');
        return;
      }

      try {
        // Call backend with query parameters (Google sends them as query params)
        const res = await fetch(`/api/auth/google/callback?code=${code}&state=${state}`);
        const data = await res.json();

        if (!data.ok) {
          toast.error(data.error || 'Google authentication failed');
          router.replace('/login');
          return;
        }

        // Store token in localStorage and cookie
        localStorage.setItem('cs_token', data.token);
        document.cookie = `cs_token=${data.token}; path=/; max-age=${7 * 86400}; SameSite=Lax`;

        // Wait a moment for token to be set, then redirect
        await new Promise(resolve => setTimeout(resolve, 500));
        
        toast.success(`Welcome, ${data.user.name}!`);
        
        // Use push instead of replace to allow back navigation
        router.push('/');
      } catch (error) {
        toast.error('Authentication failed');
        console.error(error);
        router.replace('/login');
      }
    };

    handleCallback();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
        <p className="text-slate-600">Completing sign in...</p>
      </div>
    </div>
  );
}

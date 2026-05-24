'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export default function GoogleLoginButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      // Get Google OAuth URL
      const res = await fetch('/api/auth/google');
      const data = await res.json();

      if (!data.ok) {
        toast.error('Failed to initialize Google login');
        return;
      }

      // Store state in sessionStorage for verification
      sessionStorage.setItem('oauth_state', data.state);

      // Redirect to Google
      window.location.href = data.authUrl;
    } catch (error) {
      toast.error('Google login failed');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleGoogleLogin}
      disabled={loading}
      variant="outline"
      className="w-full h-11 rounded-full font-bold"
    >
      {loading ? 'Signing in...' : '🔵 Sign in with Google'}
    </Button>
  );
}

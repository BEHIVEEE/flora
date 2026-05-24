'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '@/components/AuthProvider';
import { Phone, Mail, Link2, Loader } from 'lucide-react';

export default function AccountLinking() {
  const { user, authFetch, refresh } = useAuth();
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPhoneForm, setShowPhoneForm] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);

  if (!user) return null;

  // Link phone to account
  const linkPhone = async (e) => {
    e.preventDefault();
    const phoneClean = phone.replace(/\D/g, '').slice(-10);

    if (phoneClean.length !== 10) {
      toast.error('Enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    try {
      const res = await authFetch('/api/auth/link-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneClean }),
      });

      const data = await res.json();

      if (!data.ok) {
        toast.error(data.error || 'Failed to link phone');
        return;
      }

      toast.success('Phone linked successfully!');
      setPhone('');
      setShowPhoneForm(false);
      await refresh();
    } catch (error) {
      toast.error('Error linking phone');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Link email to account
  const linkEmail = async (e) => {
    e.preventDefault();
    const emailLc = email.toLowerCase().trim();

    if (!emailLc.includes('@')) {
      toast.error('Enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const res = await authFetch('/api/auth/link-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailLc }),
      });

      const data = await res.json();

      if (!data.ok) {
        toast.error(data.error || 'Failed to link email');
        return;
      }

      toast.success('Email linked successfully!');
      setEmail('');
      setShowEmailForm(false);
      await refresh();
    } catch (error) {
      toast.error('Error linking email');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-slate-900">Linked Accounts</h3>

      {/* Email */}
      <div className="p-4 border border-slate-200 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-teal-600" />
            <div>
              <p className="text-sm font-semibold text-slate-900">Email</p>
              <p className="text-sm text-slate-600">{user.email || 'Not linked'}</p>
            </div>
          </div>
          {!user.email && (
            <Button
              onClick={() => setShowEmailForm(!showEmailForm)}
              variant="outline"
              size="sm"
              className="text-teal-600"
            >
              <Link2 className="w-4 h-4 mr-1" />
              Link
            </Button>
          )}
        </div>

        {showEmailForm && (
          <form onSubmit={linkEmail} className="mt-4 space-y-3">
            <div>
              <Label className="text-xs font-semibold text-slate-700">Email Address</Label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="your@email.com"
                className="mt-1 h-10 rounded-lg"
                disabled={loading}
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white h-10 rounded-lg font-bold"
              >
                {loading ? (
                  <>
                    <Loader className="w-4 h-4 mr-2 animate-spin" />
                    Linking...
                  </>
                ) : (
                  'Link Email'
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEmailForm(false)}
                className="h-10 rounded-lg"
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* Phone */}
      <div className="p-4 border border-slate-200 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Phone className="w-5 h-5 text-teal-600" />
            <div>
              <p className="text-sm font-semibold text-slate-900">Phone</p>
              <p className="text-sm text-slate-600">{user.phone || 'Not linked'}</p>
            </div>
          </div>
          {!user.phone && (
            <Button
              onClick={() => setShowPhoneForm(!showPhoneForm)}
              variant="outline"
              size="sm"
              className="text-teal-600"
            >
              <Link2 className="w-4 h-4 mr-1" />
              Link
            </Button>
          )}
        </div>

        {showPhoneForm && (
          <form onSubmit={linkPhone} className="mt-4 space-y-3">
            <div>
              <Label className="text-xs font-semibold text-slate-700">Phone Number</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                type="tel"
                placeholder="10-digit mobile"
                className="mt-1 h-10 rounded-lg"
                disabled={loading}
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white h-10 rounded-lg font-bold"
              >
                {loading ? (
                  <>
                    <Loader className="w-4 h-4 mr-2 animate-spin" />
                    Linking...
                  </>
                ) : (
                  'Link Phone'
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowPhoneForm(false)}
                className="h-10 rounded-lg"
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

'use client';
import { useState } from 'react';
import { Flag, ImageOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useAuth } from '@/components/AuthProvider';

const ReportWrongImage = ({
  productId,
  productName,
  imageUrl = '',
  variant = 'default',
  className = '',
}) => {
  const { user } = useAuth() || {};
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!productId || !imageUrl) return null;

  const submit = async () => {
    setSubmitting(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('cs_token') : null;
      const res = await fetch('/api/report-wrong-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
        },
        body: JSON.stringify({
          productId,
          note: note.trim(),
          reporterType: user?.role === 'admin' ? 'admin' : 'customer',
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || payload?.ok === false) {
        throw new Error(payload?.error || 'Could not submit report');
      }
      toast.success(
        user?.role === 'admin'
          ? 'Image flagged for review'
          : 'Thanks — we will review this image shortly'
      );
      setNote('');
      setOpen(false);
    } catch (err) {
      toast.error(err?.message || 'Could not submit report');
    } finally {
      setSubmitting(false);
    }
  };

  const trigger =
    variant === 'overlay' ? (
      <button
        type="button"
        className={`absolute bottom-3 right-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-white/95 backdrop-blur px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow border border-slate-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 transition-colors ${className}`}
      >
        <ImageOff className="w-3.5 h-3.5" />
        Wrong image?
      </button>
    ) : variant === 'admin' ? (
      <Button type="button" variant="outline" size="sm" className={`rounded-full text-rose-700 border-rose-200 hover:bg-rose-50 ${className}`}>
        <Flag className="w-3.5 h-3.5 mr-1.5" />
        Flag wrong image
      </Button>
    ) : (
      <button
        type="button"
        className={`inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-rose-600 transition-colors ${className}`}
      >
        <ImageOff className="w-3.5 h-3.5" />
        Wrong image?
      </button>
    );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle>Report wrong image</DialogTitle>
          <DialogDescription>
            Let us know if the photo does not match <span className="font-medium text-slate-700">{productName}</span>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {imageUrl && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex justify-center">
              <img src={imageUrl} alt="" className="max-h-32 object-contain" />
            </div>
          )}
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional: describe what is wrong (e.g. different brand, wrong pack size)…"
            rows={3}
            className="rounded-xl resize-none"
            maxLength={500}
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" className="rounded-full" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="rounded-full bg-rose-600 hover:bg-rose-700 text-white"
          >
            {submitting ? 'Submitting…' : 'Submit report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReportWrongImage;

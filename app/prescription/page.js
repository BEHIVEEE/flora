'use client';
import { useState, useRef } from 'react';
import Link from 'next/link';
import { Upload, FileText, ShieldCheck, Clock, CheckCircle2, X, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCart } from '@/components/CartProvider';
import { toast } from 'sonner';

const PrescriptionPage = () => {
  const { userId } = useCart() || {};
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [form, setForm] = useState({ patientName: '', phone: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);

  const handleFile = (f) => {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { toast.error('File too large (max 5MB)'); return; }
    setFile(f);
    const reader = new FileReader();
    reader.onload = e => setPreview(e.target.result);
    reader.readAsDataURL(f);
  };

  const submit = async () => {
    if (!file) { toast.error('Please upload a prescription'); return; }
    if (!form.patientName || !form.phone) { toast.error('Please fill patient name and phone'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/prescriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...form, fileName: file.name, fileDataUrl: preview }),
      });
      const data = await res.json();
      if (data.prescription) {
        setDone(data.prescription);
        toast.success('Prescription uploaded! Our pharmacist will contact you shortly.');
      } else {
        toast.error(data.error || 'Failed to upload');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="container max-w-2xl mx-auto px-4 py-10">
        <div className="bg-white rounded-3xl border border-slate-200 p-8 md:p-10 text-center shadow-lift">
          <div className="w-20 h-20 mx-auto bg-emerald-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-black text-slate-900">Prescription Received</h1>
          <p className="text-slate-600 mt-2">Reference: <span className="font-bold text-teal-700">{done.id}</span></p>
          <p className="text-slate-500 mt-2">Our certified pharmacist will review your prescription and call you within 30 minutes to confirm medicines & delivery details.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/account?tab=prescriptions"><Button className="bg-teal-600 hover:bg-teal-700 rounded-full font-semibold">Track Prescription</Button></Link>
            <Link href="/products"><Button variant="outline" className="rounded-full font-semibold">Shop Other Products</Button></Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="container max-w-5xl mx-auto px-4 py-6 md:py-10">
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Upload Prescription</h1>
        <p className="text-slate-500 mt-1">Our pharmacist reviews each Rx · Save up to 25% · Delivered to your doorstep</p>

        <div className="grid lg:grid-cols-[1fr_360px] gap-6 mt-6">
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 md:p-6">
              <h3 className="font-bold text-slate-900 mb-3">1. Upload your prescription</h3>
              {!preview ? (
                <div onClick={() => fileRef.current?.click()} className="cursor-pointer border-2 border-dashed border-teal-300 bg-teal-50/40 hover:bg-teal-50 rounded-2xl p-10 text-center transition-colors">
                  <div className="w-16 h-16 mx-auto bg-teal-100 text-teal-700 rounded-2xl flex items-center justify-center mb-3"><Upload className="w-7 h-7" /></div>
                  <div className="font-bold text-slate-900">Click to upload prescription</div>
                  <div className="text-sm text-slate-500 mt-1">JPG, PNG, PDF · Max 5 MB</div>
                  <div className="flex justify-center gap-2 mt-4">
                    <Button type="button" className="bg-teal-600 hover:bg-teal-700 rounded-full"><Upload className="w-4 h-4 mr-2" /> Upload File</Button>
                    <Button type="button" variant="outline" className="rounded-full"><Camera className="w-4 h-4 mr-2" /> Take Photo</Button>
                  </div>
                </div>
              ) : (
                <div className="relative inline-block">
                  <img src={preview} alt="Preview" className="max-h-80 rounded-2xl border border-slate-200" />
                  <button onClick={() => { setFile(null); setPreview(''); }} className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-lift"><X className="w-4 h-4" /></button>
                  <div className="text-sm text-slate-600 mt-2">{file?.name}</div>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 md:p-6">
              <h3 className="font-bold text-slate-900 mb-3">2. Patient & contact details</h3>
              <div className="grid md:grid-cols-2 gap-3">
                <Field label="Patient Name *" value={form.patientName} onChange={v => setForm({ ...form, patientName: v })} />
                <Field label="Phone Number *" value={form.phone} onChange={v => setForm({ ...form, phone: v.replace(/\D/g, '').slice(0, 10) })} />
                <div className="md:col-span-2">
                  <Label className="text-xs font-semibold text-slate-700">Notes for pharmacist (optional)</Label>
                  <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} className="mt-1.5 rounded-xl bg-white" placeholder="Any allergies, preferred brand, specific quantity…" />
                </div>
              </div>
              <Button onClick={submit} disabled={submitting} className="w-full md:w-auto md:px-10 mt-5 bg-teal-600 hover:bg-teal-700 text-white h-12 rounded-full font-bold shadow-lift">{submitting ? 'Submitting…' : 'Submit Prescription'}</Button>
            </div>
          </div>

          <aside className="space-y-3">
            <div className="bg-gradient-to-br from-teal-600 to-emerald-600 text-white rounded-2xl p-5">
              <h3 className="font-bold text-lg">How it works</h3>
              <div className="mt-3 space-y-3">
                {[
                  { icon: Upload, t: 'Upload prescription', s: 'Snap a clear photo or PDF' },
                  { icon: FileText, t: 'Pharmacist reviews', s: 'Within 30 minutes' },
                  { icon: Clock, t: 'Confirm & checkout', s: 'We call you to confirm' },
                  { icon: CheckCircle2, t: 'Delivered home', s: 'Same-day in select cities' },
                ].map((s, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-9 h-9 bg-white/15 backdrop-blur-sm rounded-lg flex items-center justify-center shrink-0"><s.icon className="w-4 h-4" /></div>
                    <div><div className="font-semibold text-sm">{s.t}</div><div className="text-xs text-teal-50 opacity-90">{s.s}</div></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-2"><ShieldCheck className="w-5 h-5 text-emerald-600" /><h3 className="font-bold text-slate-900">Your data is safe</h3></div>
              <p className="text-xs text-slate-500">Prescriptions are stored encrypted and shared only with our licensed pharmacist. We never sell or share your medical data.</p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, value, onChange }) => (
  <div>
    <Label className="text-xs font-semibold text-slate-700">{label}</Label>
    <Input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1.5 h-11 rounded-xl bg-white" />
  </div>
);

export default PrescriptionPage;

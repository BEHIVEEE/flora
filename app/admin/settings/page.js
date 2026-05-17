'use client';
import React, { useEffect, useState } from 'react';
import { Save, Store, Phone, MapPin, Truck, Clock, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

const Settings = () => {
  const [s, setS] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetch('/api/settings').then(r => r.json()).then(d => setS(d.settings)); }, []);

  const save = async () => {
    setSaving(true);
    const res = await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) });
    const d = await res.json();
    if (d.settings) toast.success('Settings saved');
    setSaving(false);
  };

  if (!s) return <div className="space-y-3"><div className="h-8 w-1/3 skeleton rounded" /><div className="h-96 skeleton rounded-2xl" /></div>;
  const u = (k, v) => setS(prev => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Shop Settings</h1>
          <p className="text-slate-500 text-sm mt-0.5">Configure your store's details, delivery preferences, and business hours.</p>
        </div>
        <Button onClick={save} disabled={saving} className="bg-teal-600 hover:bg-teal-700 rounded-full font-semibold"><Save className="w-4 h-4 mr-1" /> {saving ? 'Saving…' : 'Save Changes'}</Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card icon={Store} title="Shop Information" subtitle="Visible to customers across the storefront">
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Shop Name *" value={s.shopName} onChange={v => u('shopName', v)} />
            <Field label="Tagline" value={s.tagline} onChange={v => u('tagline', v)} />
          </div>
        </Card>

        <Card icon={Phone} title="Contact Details">
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Phone" value={s.contactPhone} onChange={v => u('contactPhone', v)} />
            <Field label="Email" value={s.contactEmail} onChange={v => u('contactEmail', v)} />
          </div>
        </Card>

        <Card icon={MapPin} title="Shop Address" subtitle="Where customers can reach you">
          <div>
            <Label className="text-xs font-semibold text-slate-700">Address</Label>
            <Textarea rows={2} value={s.address} onChange={e => u('address', e.target.value)} className="mt-1.5 rounded-xl bg-white" />
          </div>
        </Card>

        <Card icon={Truck} title="Delivery & Pricing">
          <div className="grid md:grid-cols-3 gap-3">
            <Field label="Delivery Charge (₹)" type="number" value={s.deliveryCharge} onChange={v => u('deliveryCharge', Number(v))} />
            <Field label="Free Delivery Above (₹)" type="number" value={s.freeDeliveryAbove} onChange={v => u('freeDeliveryAbove', Number(v))} />
            <Field label="Min Order Value (₹)" type="number" value={s.minOrderValue} onChange={v => u('minOrderValue', Number(v))} />
          </div>
        </Card>

        <Card icon={Clock} title="Business Hours">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Open" type="time" value={s.businessHours?.open} onChange={v => u('businessHours', { ...s.businessHours, open: v })} />
            <Field label="Close" type="time" value={s.businessHours?.close} onChange={v => u('businessHours', { ...s.businessHours, close: v })} />
          </div>
        </Card>

        <Card icon={ToggleRight} title="Delivery System" subtitle="Choose between slot-based or instant delivery">
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
            <div>
              <div className="font-semibold text-slate-900">Slot-Based Delivery</div>
              <div className="text-xs text-slate-500">Customers pick a delivery time window at checkout</div>
            </div>
            <Switch checked={s.slotsEnabled} onCheckedChange={v => u('slotsEnabled', v)} />
          </div>
        </Card>

        <Card icon={ToggleRight} title="Change Admin Password" subtitle="Secure your admin access">
          <ChangePasswordForm />
        </Card>
      </div>
    </div>
  );
};

const ChangePasswordForm = () => {
  const [form, setForm] = React.useState({ current: '', next: '', confirm: '' });
  const [saving, setSaving] = React.useState(false);
  const submit = async () => {
    if (!form.current || !form.next) { toast.error('Fill all fields'); return; }
    if (form.next.length < 6) { toast.error('New password must be at least 6 characters'); return; }
    if (form.next !== form.confirm) { toast.error('Passwords do not match'); return; }
    setSaving(true);
    const token = localStorage.getItem('cs_admin_token');
    const res = await fetch('/api/admin/password', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ current: form.current, next: form.next }) });
    const d = await res.json();
    if (d.ok) { toast.success('Password updated'); setForm({ current: '', next: '', confirm: '' }); }
    else toast.error(d.error || 'Failed to update');
    setSaving(false);
  };
  return (
    <div className="grid md:grid-cols-3 gap-3">
      <Field label="Current Password" type="password" value={form.current} onChange={v => setForm({ ...form, current: v })} />
      <Field label="New Password" type="password" value={form.next} onChange={v => setForm({ ...form, next: v })} />
      <Field label="Confirm New" type="password" value={form.confirm} onChange={v => setForm({ ...form, confirm: v })} />
      <div className="md:col-span-3">
        <Button onClick={submit} disabled={saving} className="bg-teal-600 hover:bg-teal-700 rounded-full font-semibold">{saving ? 'Updating…' : 'Update Password'}</Button>
      </div>
    </div>
  );
};

const Card = ({ icon: Icon, title, subtitle, children }) => (
  <div className="bg-white border border-slate-200 rounded-2xl p-5">
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0"><Icon className="w-5 h-5" /></div>
      <div className="flex-1">
        <h3 className="font-bold text-slate-900">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
    <div className="mt-4">{children}</div>
  </div>
);

const Field = ({ label, value, onChange, type = 'text' }) => (
  <div>
    <Label className="text-xs font-semibold text-slate-700">{label}</Label>
    <Input type={type} value={value || ''} onChange={(e) => onChange(e.target.value)} className="mt-1.5 h-11 rounded-xl bg-white" />
  </div>
);

export default Settings;

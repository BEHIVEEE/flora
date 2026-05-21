'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Package, MapPin, FileText, Heart, LogOut, ChevronRight, Plus, Trash2, CheckCircle2, Clock, Truck } from 'lucide-react';
import { toast } from 'sonner';
import AddressAutocomplete from '@/components/AddressAutocomplete';

const TABS = [
  { id: 'orders', label: 'My Orders', icon: Package },
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'addresses', label: 'Addresses', icon: MapPin },
  { id: 'prescriptions', label: 'Prescriptions', icon: FileText },
  { id: 'wishlist', label: 'Wishlist', icon: Heart },
];

const AccountInner = () => {
  const sp = useSearchParams();
  const router = useRouter();
  const { user, logout, loading } = useAuth() || {};
  const userId = user?.id;
  const [tab, setTab] = useState(sp.get('tab') || 'orders');
  const [profile, setProfile] = useState({ name: '', email: '', phone: '' });

  useEffect(() => {
    if (user) setProfile({ name: user.name || '', email: user.email || '', phone: user.phone || '' });
  }, [user]);
  useEffect(() => { const t = sp.get('tab'); if (t) setTab(t); }, [sp]);

  const saveProfile = () => {
    localStorage.setItem('cs_profile', JSON.stringify(profile));
    toast.success('Profile saved');
  };

  if (loading || !user) return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="flex items-center gap-3 text-slate-500"><div className="w-5 h-5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" /> Loading…</div>
    </div>
  );

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="container max-w-6xl mx-auto px-4 py-6 md:py-10">
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">My Account</h1>
        <p className="text-slate-500 mt-1 text-sm">Hi {profile.name || 'there'}, manage your orders, addresses & prescriptions.</p>

        <div className="grid lg:grid-cols-[260px_1fr] gap-6 mt-6">
          <aside>
            <div className="bg-white rounded-2xl border border-slate-200 p-2 lg:sticky lg:top-32">
              {TABS.map(t => {
                const active = tab === t.id;
                return (
                  <button key={t.id} onClick={() => { setTab(t.id); router.replace(`/account?tab=${t.id}`); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium ${active ? 'bg-teal-50 text-teal-800' : 'hover:bg-slate-50 text-slate-700'}`}>
                    <t.icon className={`w-4 h-4 ${active ? 'text-teal-700' : 'text-slate-500'}`} />
                    <span className="flex-1 text-left">{t.label}</span>
                    {active && <ChevronRight className="w-4 h-4 text-teal-700" />}
                  </button>
                );
              })}
              <button onClick={() => { logout(); toast.success('Signed out'); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-rose-50 text-rose-600">
                <LogOut className="w-4 h-4" />
                <span className="flex-1 text-left">Sign Out</span>
              </button>
            </div>
          </aside>

          <div>
            {tab === 'orders' && <OrdersTab userId={userId} />}
            {tab === 'profile' && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5 md:p-6">
                <h3 className="font-bold text-slate-900">Profile Information</h3>
                <div className="grid md:grid-cols-2 gap-3 mt-4">
                  <Field label="Full Name" value={profile.name} onChange={v => setProfile({ ...profile, name: v })} />
                  <Field label="Email" value={profile.email} onChange={v => setProfile({ ...profile, email: v })} />
                  <Field label="Phone" value={profile.phone} onChange={v => setProfile({ ...profile, phone: v.replace(/\D/g, '').slice(0, 10) })} />
                </div>
                <Button onClick={saveProfile} className="mt-5 bg-teal-600 hover:bg-teal-700 rounded-full font-semibold">Save Changes</Button>
              </div>
            )}
            {tab === 'addresses' && <AddressesTab userId={userId} />}
            {tab === 'prescriptions' && <PrescriptionsTab userId={userId} />}
            {tab === 'wishlist' && (
              <Empty icon={Heart} title="Your wishlist is empty" sub="Save items you love for later." cta="Start browsing" href="/products" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const OrdersTab = ({ userId }) => {
  const [orders, setOrders] = useState(null);
  useEffect(() => {
    if (!userId) return;
    fetch(`/api/orders?userId=${userId}`).then(r => r.json()).then(d => setOrders(d.orders || []));
  }, [userId]);
  if (orders === null) return <div className="bg-white rounded-2xl border border-slate-200 p-6">Loading orders…</div>;
  if (orders.length === 0) return <Empty icon={Package} title="No orders yet" sub="Your orders will appear here." cta="Start shopping" href="/products" />;
  return (
    <div className="space-y-3">
      {orders.map(o => (
        <div key={o.id} className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-start justify-between flex-wrap gap-2">
            <div>
              <div className="text-xs text-slate-500">Order ID</div>
              <div className="font-bold text-slate-900">{o.id}</div>
              <div className="text-xs text-slate-500 mt-1">Placed {new Date(o.createdAt).toDateString()}</div>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-bold bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full"><CheckCircle2 className="w-3 h-3" /> {o.status}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            {o.items?.slice(0, 4).map(i => (
              <div key={i.id} className="flex items-center gap-2 bg-slate-50 rounded-lg p-2 pr-3">
                <div className="w-10 h-10 bg-white rounded overflow-hidden"><img src={i.image} alt="" className="w-full h-full object-cover" /></div>
                <div className="text-xs"><div className="font-semibold text-slate-800 line-clamp-1 max-w-[160px]">{i.name}</div><div className="text-slate-500">Qty {i.qty}</div></div>
              </div>
            ))}
            {o.items?.length > 4 && <div className="flex items-center text-xs text-slate-500">+{o.items.length - 4} more</div>}
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
            <div className="text-sm"><span className="text-slate-500">Total</span> <span className="font-black text-slate-900 ml-1">₹{o.total}</span></div>
            <Link href={`/order-confirmed?id=${o.id}`}><Button variant="outline" className="rounded-full text-sm h-9">Track Order <ChevronRight className="w-3 h-3 ml-1" /></Button></Link>
          </div>
        </div>
      ))}
    </div>
  );
};

const AddressesTab = ({ userId }) => {
  const [list, setList] = useState(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', line1: '', city: '', state: '', pincode: '', type: 'Home' });
  const load = () => fetch(`/api/addresses?userId=${userId}`).then(r => r.json()).then(d => setList(d.addresses || []));
  useEffect(() => { if (userId) load(); }, [userId]);

  const save = async () => {
    if (!form.name || !form.phone || !form.line1 || !form.pincode) { toast.error('Fill all required fields'); return; }
    await fetch('/api/addresses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, userId }) });
    toast.success('Address saved');
    setAdding(false);
    setForm({ name: '', phone: '', line1: '', city: '', state: '', pincode: '', type: 'Home' });
    load();
  };
  const del = async (id) => { await fetch(`/api/addresses/${id}`, { method: 'DELETE' }); load(); };

  if (list === null) return <div className="bg-white rounded-2xl border border-slate-200 p-6">Loading…</div>;
  return (
    <div className="space-y-3">
      {list.map(a => (
        <div key={a.id} className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col sm:flex-row items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><span className="text-xs font-bold bg-teal-100 text-teal-800 px-2 py-0.5 rounded">{a.type}</span><span className="font-bold text-slate-900">{a.name}</span></div>
            <div className="text-sm text-slate-600 mt-1">{a.line1}, {a.city}, {a.state} - {a.pincode}</div>
            <div className="text-sm text-slate-500 mt-0.5">📞 {a.phone}</div>
          </div>
          <button onClick={() => del(a.id)} className="text-slate-400 hover:text-rose-600 p-2 self-start sm:self-center"><Trash2 className="w-4 h-4" /></button>
        </div>
      ))}
      {adding ? (
        <div className="bg-white rounded-2xl border-2 border-teal-300 p-5">
          <h3 className="font-bold text-slate-900 mb-3">New Address</h3>
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Full Name *" value={form.name} onChange={v => setForm({ ...form, name: v })} />
            <Field label="Phone *" value={form.phone} onChange={v => setForm({ ...form, phone: v.replace(/\D/g, '').slice(0, 10) })} />
            <AddressAutocomplete
              className="md:col-span-2"
              label="Address *"
              value={form.line1}
              onChange={v => setForm({ ...form, line1: v })}
              onPick={(p) => setForm(prev => ({
                ...prev,
                line1: p.line1 || prev.line1,
                city: p.city || prev.city,
                state: p.state || prev.state,
                pincode: p.pincode || prev.pincode,
              }))}
            />
            <Field label="City *" value={form.city} onChange={v => setForm({ ...form, city: v })} />
            <Field label="State *" value={form.state} onChange={v => setForm({ ...form, state: v })} />
            <Field label="Pincode *" value={form.pincode} onChange={v => setForm({ ...form, pincode: v.replace(/\D/g, '').slice(0, 6) })} />
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={save} className="bg-teal-600 hover:bg-teal-700 rounded-full">Save Address</Button>
            <Button onClick={() => setAdding(false)} variant="outline" className="rounded-full">Cancel</Button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="w-full border-2 border-dashed border-slate-300 hover:border-teal-400 hover:bg-teal-50/40 rounded-2xl p-6 text-slate-700 font-semibold flex items-center justify-center gap-2 transition-colors"><Plus className="w-5 h-5" /> Add New Address</button>
      )}
    </div>
  );
};

const PrescriptionsTab = ({ userId }) => {
  const [list, setList] = useState(null);
  useEffect(() => { if (userId) fetch(`/api/prescriptions?userId=${userId}`).then(r => r.json()).then(d => setList(d.prescriptions || [])); }, [userId]);
  if (list === null) return <div className="bg-white rounded-2xl border border-slate-200 p-6">Loading…</div>;
  if (list.length === 0) return <Empty icon={FileText} title="No prescriptions yet" sub="Upload your prescription and we'll deliver authentic medicines." cta="Upload now" href="/prescription" />;
  return (
    <div className="space-y-3">
      {list.map(p => (
        <div key={p.id} className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-start justify-between flex-wrap gap-2">
            <div>
              <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-teal-700" /><div className="font-bold text-slate-900">{p.id}</div></div>
              <div className="text-sm text-slate-600 mt-1">Patient: {p.patientName} · {p.phone}</div>
              <div className="text-xs text-slate-500 mt-1">Uploaded {new Date(p.createdAt).toLocaleString()}</div>
              {p.notes && <div className="text-xs text-slate-500 mt-1">Notes: {p.notes}</div>}
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-bold bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full"><Clock className="w-3 h-3" /> {p.status}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

const Empty = ({ icon: Icon, title, sub, cta, href }) => (
  <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
    <div className="w-20 h-20 mx-auto bg-teal-50 rounded-full flex items-center justify-center mb-3"><Icon className="w-9 h-9 text-teal-600" /></div>
    <h3 className="font-black text-slate-900 text-lg">{title}</h3>
    <p className="text-sm text-slate-500 mt-1">{sub}</p>
    <Link href={href}><Button className="mt-5 bg-teal-600 hover:bg-teal-700 rounded-full font-semibold">{cta}</Button></Link>
  </div>
);

const Field = ({ label, value, onChange, className = '' }) => (
  <div className={className}>
    <Label className="text-xs font-semibold text-slate-700">{label}</Label>
    <Input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1.5 h-11 rounded-xl bg-white" />
  </div>
);

const AccountPage = () => <Suspense fallback={<div className="p-10 text-center">Loading…</div>}><AccountInner /></Suspense>;
export default AccountPage;

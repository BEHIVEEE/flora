'use client';
import { useEffect, useState } from 'react';
import { Plus, Save, X, Trash2, Bike, Phone, Search, Copy, RefreshCw, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

const adminFetch = (url, opts = {}) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('cs_token') : '';
  return fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: 'Bearer ' + (token || '') } });
};

const Riders = () => {
  const [riders, setRiders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', vehicleNumber: '' });
  const [newCode, setNewCode] = useState(null); // for showing code after creation

  const load = () => {
    adminFetch('/api/riders').then(r => r.json()).then(d => {
      setRiders(d.riders || []);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error('Name and phone are required'); return;
    }
    const res = await adminFetch('/api/riders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const d = await res.json();
    if (d.ok) {
      toast.success('Rider created');
      setShowForm(false);
      setForm({ name: '', phone: '', vehicleNumber: '' });
      setNewCode({ name: d.rider.name, code: d.rider.loginCode });
      load();
    } else {
      toast.error(d.error || 'Failed to create');
    }
  };

  const regenCode = async (rider) => {
    if (!confirm(`Generate a new login code for ${rider.name}? The old code will stop working.`)) return;
    const res = await adminFetch(`/api/riders/${rider.id}/regenerate-code`, { method: 'POST' });
    const d = await res.json();
    if (d.ok) {
      toast.success('New code generated');
      setNewCode({ name: rider.name, code: d.loginCode });
      load();
    } else {
      toast.error(d.error || 'Failed');
    }
  };

  const copyCode = (code) => {
    navigator.clipboard?.writeText(code);
    toast.success('Code copied');
  };

  const toggleStatus = async (rider) => {
    const newStatus = rider.status === 'active' ? 'inactive' : 'active';
    const res = await adminFetch(`/api/riders/${rider.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    const d = await res.json();
    if (d.ok) { toast.success(`Rider ${newStatus}`); load(); }
    else toast.error(d.error || 'Failed');
  };

  const del = async (rider) => {
    if (!confirm(`Delete rider "${rider.name}"?`)) return;
    const res = await adminFetch(`/api/riders/${rider.id}`, { method: 'DELETE' });
    const d = await res.json();
    if (d.ok) { toast.success('Deleted'); load(); }
    else toast.error(d.error || 'Failed to delete');
  };

  const filtered = riders.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    (r.phone || '').includes(search) ||
    (r.loginCode || '').includes(search)
  );

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Delivery Riders</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage your delivery personnel. Each rider gets a unique 6-digit login code.</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="bg-teal-600 hover:bg-teal-700 rounded-full font-semibold">
          {showForm ? <X className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
          {showForm ? 'Cancel' : 'Add Rider'}
        </Button>
      </div>

      {/* New code modal */}
      {newCode && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setNewCode(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <div className="text-center">
              <div className="w-14 h-14 mx-auto bg-teal-100 text-teal-700 rounded-2xl flex items-center justify-center mb-3"><KeyRound className="w-7 h-7" /></div>
              <h3 className="font-black text-lg text-slate-900">Login Code for {newCode.name}</h3>
              <p className="text-xs text-slate-500 mt-1">Share this code with the rider. They'll use it to sign in at /rider/login.</p>
              <div className="my-5 flex justify-center gap-2">
                {newCode.code.split('').map((d, i) => (
                  <div key={i} className="w-10 h-14 bg-slate-50 border-2 border-slate-200 rounded-xl flex items-center justify-center text-2xl font-black text-slate-900">{d}</div>
                ))}
              </div>
              <Button onClick={() => { copyCode(newCode.code); }} variant="outline" className="rounded-full mr-2"><Copy className="w-4 h-4 mr-1" /> Copy</Button>
              <Button onClick={() => setNewCode(null)} className="bg-teal-600 hover:bg-teal-700 rounded-full">Done</Button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <h3 className="font-bold text-slate-900">New Rider</h3>
          <p className="text-xs text-slate-500">A 6-digit login code will be auto-generated.</p>
          <div className="grid md:grid-cols-3 gap-3">
            <Field label="Full Name *" value={form.name} onChange={v => setForm({ ...form, name: v })} />
            <Field label="Phone *" value={form.phone} onChange={v => setForm({ ...form, phone: v.replace(/\D/g, '').slice(0, 10) })} />
            <Field label="Vehicle Number" value={form.vehicleNumber} onChange={v => setForm({ ...form, vehicleNumber: v })} />
          </div>
          <Button onClick={save} className="bg-teal-600 hover:bg-teal-700 rounded-full font-semibold"><Save className="w-4 h-4 mr-1" /> Create Rider</Button>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <Search className="w-4 h-4 text-slate-400" />
          <Input placeholder="Search by name, phone, or code…" value={search} onChange={e => setSearch(e.target.value)} className="h-9 rounded-full bg-slate-50 max-w-sm" />
        </div>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="h-16 skeleton rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">No riders found. Click "Add Rider" to create one.</div>
        ) : (
          <div className="space-y-2">
            {filtered.map(r => (
              <div key={r.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-white hover:border hover:border-slate-200 transition-all flex-wrap">
                <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold shrink-0">
                  <Bike className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-900 text-sm truncate">{r.name}</div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                    {r.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {r.phone}</span>}
                    {r.vehicleNumber && <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold">{r.vehicleNumber}</span>}
                  </div>
                </div>
                {/* Login Code */}
                <div className="flex items-center gap-1.5 shrink-0 bg-white border border-slate-200 rounded-lg px-2 py-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-teal-600" />
                  <span className="font-mono font-black text-slate-900 tracking-wider">{r.loginCode || '------'}</span>
                  <button onClick={() => copyCode(r.loginCode)} className="text-slate-400 hover:text-teal-700 p-0.5" title="Copy"><Copy className="w-3.5 h-3.5" /></button>
                  <button onClick={() => regenCode(r)} className="text-slate-400 hover:text-teal-700 p-0.5" title="Regenerate"><RefreshCw className="w-3.5 h-3.5" /></button>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-2 text-xs">
                    <span className={r.status === 'active' ? 'text-emerald-600 font-bold' : 'text-slate-400 font-bold'}>{r.status === 'active' ? 'Active' : 'Inactive'}</span>
                    <Switch checked={r.status === 'active'} onCheckedChange={() => toggleStatus(r)} />
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => del(r)} className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-full"><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const Field = ({ label, value, onChange, type = 'text' }) => (
  <div>
    <Label className="text-xs font-semibold text-slate-700">{label}</Label>
    <Input type={type} value={value || ''} onChange={e => onChange(e.target.value)} className="mt-1.5 h-10 rounded-xl bg-white" />
  </div>
);

export default Riders;

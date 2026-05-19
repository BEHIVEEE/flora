'use client';
import { useEffect, useState } from 'react';
import { Plus, Clock, Trash2, Save, Edit3, Power } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

const Slots = () => {
  const [slots, setSlots] = useState(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ label: '', startTime: '09:00', endTime: '11:00', capacity: 10, active: true });
  const [editing, setEditing] = useState(null);

  const load = () => fetch('/api/slots').then(r => r.json()).then(d => setSlots(d.slots || []));
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.startTime || !form.endTime) { toast.error('Set start & end time'); return; }
    await fetch('/api/slots', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    toast.success('Slot created');
    setAdding(false); setForm({ label: '', startTime: '09:00', endTime: '11:00', capacity: 10, active: true });
    load();
  };

  const save = async (slot) => {
    await fetch(`/api/slots/${slot.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(slot) });
    toast.success('Slot updated');
    setEditing(null);
    load();
  };

  const toggle = async (slot) => {
    await fetch(`/api/slots/${slot.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !slot.active }) });
    load();
  };

  const del = async (slot) => {
    if (!confirm(`Delete slot "${slot.label}"?`)) return;
    await fetch(`/api/slots/${slot.id}`, { method: 'DELETE' });
    toast.success('Slot deleted');
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Delivery Slots</h1>
          <p className="text-slate-500 text-sm mt-0.5">Define time windows when orders can be delivered. Limit orders per slot.</p>
        </div>
        <Button onClick={() => setAdding(true)} className="bg-teal-600 hover:bg-teal-700 rounded-full font-semibold"><Plus className="w-4 h-4 mr-1" /> Add Slot</Button>
      </div>

      {adding && (
        <div className="bg-white border-2 border-teal-300 rounded-2xl p-5">
          <h3 className="font-bold text-slate-900 mb-4">New Delivery Slot</h3>
          <div className="grid md:grid-cols-5 gap-3">
            <div className="md:col-span-2"><Label className="text-xs font-semibold text-slate-700">Label</Label><Input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="e.g. Morning" className="mt-1.5 h-11 rounded-xl" /></div>
            <div><Label className="text-xs font-semibold text-slate-700">Start Time</Label><Input type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} className="mt-1.5 h-11 rounded-xl" /></div>
            <div><Label className="text-xs font-semibold text-slate-700">End Time</Label><Input type="time" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} className="mt-1.5 h-11 rounded-xl" /></div>
            <div><Label className="text-xs font-semibold text-slate-700">Capacity</Label><Input type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} className="mt-1.5 h-11 rounded-xl" /></div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={create} className="bg-teal-600 hover:bg-teal-700 rounded-full"><Save className="w-4 h-4 mr-1" /> Create Slot</Button>
            <Button variant="outline" onClick={() => setAdding(false)} className="rounded-full">Cancel</Button>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-3">
        {!slots && Array(4).fill(0).map((_, i) => <div key={i} className="h-32 skeleton rounded-2xl" />)}
        {slots?.length === 0 && !adding && (
          <div className="md:col-span-2 bg-white border border-slate-200 rounded-2xl p-12 text-center">
            <Clock className="w-10 h-10 mx-auto text-slate-300" />
            <div className="mt-2 font-semibold text-slate-700">No delivery slots yet</div>
            <div className="text-xs text-slate-500">Click “Add Slot” to create your first time window.</div>
          </div>
        )}
        {slots?.map(s => (
          editing === s.id ? (
            <div key={s.id} className="bg-white border-2 border-teal-300 rounded-2xl p-5">
              <h3 className="font-bold text-slate-900 mb-3">Edit Slot</h3>
              <SlotEditor slot={s} onSave={save} onCancel={() => setEditing(null)} />
            </div>
          ) : (
            <div key={s.id} className={`bg-white border rounded-2xl p-5 transition-all ${s.active ? 'border-slate-200' : 'border-slate-200 opacity-60'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${s.active ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-500'}`}><Clock className="w-5 h-5" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-900">{s.label}</div>
                    <div className="text-sm text-slate-600">{s.startTime} – {s.endTime}</div>
                    <div className="text-xs text-slate-500 mt-1">Capacity: <span className="font-bold text-slate-700">{s.capacity}</span> orders / day</div>
                  </div>
                </div>
                <Switch checked={s.active} onCheckedChange={() => toggle(s)} />
              </div>
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(s.id)} className="rounded-full"><Edit3 className="w-3.5 h-3.5 mr-1" /> Edit</Button>
                <Button size="sm" variant="outline" onClick={() => del(s)} className="rounded-full text-rose-600 hover:bg-rose-50 hover:text-rose-700"><Trash2 className="w-3.5 h-3.5 mr-1" /> Delete</Button>
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  );
};

const SlotEditor = ({ slot, onSave, onCancel }) => {
  const [f, setF] = useState({ ...slot });
  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="col-span-2 md:col-span-1"><Label className="text-xs font-semibold text-slate-700">Label</Label><Input value={f.label} onChange={e => setF({ ...f, label: e.target.value })} className="mt-1.5 h-10 rounded-xl" /></div>
        <div><Label className="text-xs font-semibold text-slate-700">Start</Label><Input type="time" value={f.startTime} onChange={e => setF({ ...f, startTime: e.target.value })} className="mt-1.5 h-10 rounded-xl" /></div>
        <div><Label className="text-xs font-semibold text-slate-700">End</Label><Input type="time" value={f.endTime} onChange={e => setF({ ...f, endTime: e.target.value })} className="mt-1.5 h-10 rounded-xl" /></div>
        <div><Label className="text-xs font-semibold text-slate-700">Capacity</Label><Input type="number" value={f.capacity} onChange={e => setF({ ...f, capacity: Number(e.target.value) })} className="mt-1.5 h-10 rounded-xl" /></div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button onClick={() => onSave(f)} className="bg-teal-600 hover:bg-teal-700 rounded-full"><Save className="w-4 h-4 mr-1" /> Save</Button>
        <Button variant="outline" onClick={onCancel} className="rounded-full">Cancel</Button>
      </div>
    </div>
  );
};

export default Slots;

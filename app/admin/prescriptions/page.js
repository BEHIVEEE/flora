'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText, Search, Filter, Clock, CheckCircle2, XCircle, Phone } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const statusColors = {
  'Under Review': 'bg-amber-100 text-amber-800',
  'Confirmed': 'bg-blue-100 text-blue-800',
  'Delivered': 'bg-emerald-100 text-emerald-800',
  'Rejected': 'bg-rose-100 text-rose-700',
};

const Prescriptions = () => {
  const [list, setList] = useState(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');

  const load = () => {
    setList(null);
    const params = new URLSearchParams();
    if (status !== 'all') params.set('status', status);
    if (q) params.set('search', q);
    fetch(`/api/admin/prescriptions?${params.toString()}`).then(r => r.json()).then(d => setList(d.prescriptions || []));
  };
  useEffect(() => { load(); }, [status]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [q]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Prescriptions</h1>
        <p className="text-slate-500 text-sm mt-0.5">Review uploaded prescriptions and confirm with customers over chat or WhatsApp.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by RX id, patient name or phone…" className="pl-9 h-10 rounded-xl" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[180px] h-10 rounded-xl"><Filter className="w-4 h-4 mr-1.5 text-slate-500" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="Under Review">Under Review</SelectItem>
            <SelectItem value="Confirmed">Confirmed</SelectItem>
            <SelectItem value="Delivered">Delivered</SelectItem>
            <SelectItem value="Rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-5 py-3 font-semibold">RX ID</th>
                <th className="text-left px-5 py-3 font-semibold">Patient</th>
                <th className="text-left px-5 py-3 font-semibold">Phone</th>
                <th className="text-left px-5 py-3 font-semibold">Notes</th>
                <th className="text-left px-5 py-3 font-semibold">Uploaded</th>
                <th className="text-left px-5 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!list && Array(5).fill(0).map((_, i) => <tr key={i}><td colSpan={6} className="px-5 py-4"><div className="h-8 skeleton rounded" /></td></tr>)}
              {list?.length === 0 && <tr><td colSpan={6} className="px-5 py-16 text-center text-slate-500"><FileText className="w-10 h-10 mx-auto text-slate-300" /><div className="mt-2 font-semibold text-slate-700">No prescriptions yet</div><div className="text-xs">Customer uploads will appear here.</div></td></tr>}
              {list?.map(p => (
                <tr key={p.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => window.location.assign(`/admin/prescriptions/${p.id}`)}>
                  <td className="px-5 py-3 font-bold text-slate-900 text-xs">{p.id}</td>
                  <td className="px-5 py-3 font-semibold text-slate-900">{p.patientName || 'Unknown'}</td>
                  <td className="px-5 py-3 text-slate-700 text-xs">{p.phone}</td>
                  <td className="px-5 py-3 text-slate-600 text-xs line-clamp-1 max-w-[280px]">{p.notes || '—'}</td>
                  <td className="px-5 py-3 text-xs text-slate-700">{new Date(p.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="px-5 py-3"><span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${statusColors[p.status] || 'bg-slate-100'}`}>{p.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Prescriptions;

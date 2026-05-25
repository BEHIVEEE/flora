'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Send, Phone, MessageCircle, FileText, Check, X, Download, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const statusColors = {
  'Under Review': 'bg-amber-100 text-amber-800',
  'Approved': 'bg-emerald-100 text-emerald-800',
  'Confirmed': 'bg-blue-100 text-blue-800',
  'Delivered': 'bg-emerald-100 text-emerald-800',
  'Rejected': 'bg-rose-100 text-rose-700',
};

const RxDetail = () => {
  const { id } = useParams();
  const [rx, setRx] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const [fileUrl, setFileUrl] = useState(null);
  const tokenHeader = () => {
    const t = typeof window !== 'undefined' ? localStorage.getItem('cs_token') : null;
    return t ? { Authorization: 'Bearer ' + t } : {};
  };
  const loadRx = () => fetch(`/api/prescriptions/${id}`, { headers: tokenHeader() }).then(r => r.json()).then(d => setRx(d.prescription));
  const loadMsgs = () => fetch(`/api/prescriptions/${id}/messages`).then(r => r.json()).then(d => setMessages(d.messages || []));
  const loadFile = async () => {
    try {
      const res = await fetch(`/api/prescriptions/${id}/file`, { headers: tokenHeader() });
      if (!res.ok) return;
      const blob = await res.blob();
      setFileUrl(URL.createObjectURL(blob));
    } catch {}
  };
  useEffect(() => { loadRx(); loadMsgs(); loadFile(); const t = setInterval(loadMsgs, 4000); return () => clearInterval(t); }, [id]);
  useEffect(() => () => { if (fileUrl) URL.revokeObjectURL(fileUrl); }, [fileUrl]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    await fetch(`/api/prescriptions/${id}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sender: 'admin', authorName: 'Pharmacist', text: text.trim() }) });
    setText('');
    await loadMsgs();
    setSending(false);
  };

  const setStatus = async (status) => {
    const res = await fetch(`/api/prescriptions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...tokenHeader() },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      toast.success(`Marked ${status}`);
      loadRx();
    } else {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error || 'Failed to update status');
    }
  };

  if (!rx) return <div className="space-y-3"><div className="h-8 w-1/3 skeleton rounded" /><div className="h-96 skeleton rounded-2xl" /></div>;

  const cleanPhone = (rx.phone || '').replace(/\D/g, '');
  const waNumber = cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone;
  const waText = encodeURIComponent(`Hi ${rx.patientName || 'there'}, this is the ChemistShop pharmacist regarding your prescription ${rx.id}. We've reviewed it and would like to confirm a few details before dispatching your medicines.`);
  const waUrl = `https://wa.me/${waNumber}?text=${waText}`;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/admin/prescriptions"><Button variant="ghost" size="icon" className="rounded-full"><ChevronLeft className="w-5 h-5" /></Button></Link>
        <div className="flex-1">
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Prescription {rx.id}</h1>
          <p className="text-slate-500 text-sm">{rx.patientName} · Uploaded {new Date(rx.createdAt).toLocaleString('en-IN')}</p>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-md ${statusColors[rx.status] || 'bg-slate-100'}`}>{rx.status}</span>
      </div>

      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-5">
        {/* Left: image + actions */}
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-900">Prescription File</h3>
              {fileUrl && <a href={`/api/prescriptions/${id}/file?download=1`}><Button size="sm" variant="outline" className="rounded-full"><Download className="w-3.5 h-3.5 mr-1" /> Download</Button></a>}
            </div>
            {fileUrl ? (
              rx.mimeType === 'application/pdf' ? (
                <embed src={fileUrl} type="application/pdf" className="w-full h-[480px] rounded-xl border border-slate-200" />
              ) : (
                <img src={fileUrl} alt="Prescription" className="w-full max-h-[600px] object-contain rounded-xl border border-slate-200 bg-slate-50" />
              )
            ) : (
              <div className="text-sm text-slate-500 p-6 bg-slate-50 rounded-xl text-center">No file attached</div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h3 className="font-bold text-slate-900">Quick Actions</h3>
            <div className="mt-3 grid sm:grid-cols-2 gap-2">
              <a href={waUrl} target="_blank" rel="noopener noreferrer">
                <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold"><MessageCircle className="w-4 h-4 mr-2" /> Open WhatsApp <ExternalLink className="w-3 h-3 ml-1" /></Button>
              </a>
              <a href={`tel:+${waNumber}`}><Button variant="outline" className="w-full rounded-xl font-semibold"><Phone className="w-4 h-4 mr-2" /> Call Customer</Button></a>
              <Button onClick={() => setStatus('Approved')} variant="outline" className="w-full rounded-xl font-semibold text-emerald-700 hover:bg-emerald-50"><Check className="w-4 h-4 mr-2" /> Approve Rx</Button>
              <Button onClick={() => setStatus('Confirmed')} variant="outline" className="w-full rounded-xl font-semibold text-blue-700 hover:bg-blue-50"><Check className="w-4 h-4 mr-2" /> Mark Confirmed</Button>
              <Button onClick={() => setStatus('Delivered')} variant="outline" className="w-full rounded-xl font-semibold text-emerald-700 hover:bg-emerald-50"><Check className="w-4 h-4 mr-2" /> Mark Delivered</Button>
              <Button onClick={() => setStatus('Rejected')} variant="outline" className="w-full rounded-xl font-semibold text-rose-700 hover:bg-rose-50 sm:col-span-2"><X className="w-4 h-4 mr-2" /> Reject Prescription</Button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <Info k="Patient Name" v={rx.patientName || '—'} />
              <Info k="Phone" v={rx.phone || '—'} />
              {rx.notes && <Info k="Customer Notes" v={rx.notes} full />}
            </div>
          </div>
        </div>

        {/* Right: chat */}
        <div className="bg-white border border-slate-200 rounded-2xl flex flex-col h-[600px] lg:h-[680px]">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900">Conversation</h3>
              <p className="text-xs text-slate-500">Internal chat log · also share via WhatsApp</p>
            </div>
            <a href={waUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" /> WhatsApp</a>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
            {messages.length === 0 && (
              <div className="text-center text-sm text-slate-500 py-8">
                <MessageCircle className="w-10 h-10 mx-auto text-slate-300" />
                <div className="mt-2 font-semibold text-slate-700">No messages yet</div>
                <div className="text-xs">Start the conversation — send a quick note or open WhatsApp.</div>
              </div>
            )}
            {messages.map(m => {
              const isAdmin = m.sender === 'admin';
              return (
                <div key={m.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${isAdmin ? 'bg-teal-600 text-white rounded-br-md' : 'bg-white border border-slate-200 text-slate-900 rounded-bl-md'}`}>
                    <div className="text-sm whitespace-pre-wrap">{m.text}</div>
                    <div className={`text-[10px] mt-0.5 ${isAdmin ? 'text-teal-100' : 'text-slate-400'}`}>{m.authorName || (isAdmin ? 'Pharmacist' : 'Customer')} · {new Date(m.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
          <div className="p-3 border-t border-slate-100 flex gap-2 items-end">
            <Textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} rows={1} placeholder="Type a message… (Enter to send)" className="resize-none min-h-[44px] max-h-32 rounded-xl bg-white" />
            <Button onClick={send} disabled={sending || !text.trim()} className="bg-teal-600 hover:bg-teal-700 rounded-xl h-11 px-4"><Send className="w-4 h-4" /></Button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Info = ({ k, v, full }) => (
  <div className={`p-3 bg-slate-50 rounded-xl ${full ? 'col-span-2' : ''}`}>
    <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">{k}</div>
    <div className="text-sm font-semibold text-slate-900 mt-0.5">{v}</div>
  </div>
);

export default RxDetail;

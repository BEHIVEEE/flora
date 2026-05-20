'use client';
import { useEffect, useState } from 'react';
import { MessageCircle, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

const AdminChats = () => {
  const [threads, setThreads] = useState(null);
  const [q, setQ] = useState('');

  const load = () => {
    const token = localStorage.getItem('cs_token');
    fetch('/api/admin/chats', { headers: token ? { Authorization: 'Bearer ' + token } : {} })
      .then(r => r.json())
      .then(d => setThreads(d.threads || []));
  };
  useEffect(() => { load(); const t = setInterval(load, 6000); return () => clearInterval(t); }, []);

  const filtered = (threads || []).filter(t => {
    if (!q) return true;
    const term = q.toLowerCase();
    return (t.userName || '').toLowerCase().includes(term) || (t.userEmail || '').toLowerCase().includes(term) || (t.lastMessageText || '').toLowerCase().includes(term);
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Pharmacist Chat</h1>
        <p className="text-slate-500 text-sm mt-0.5">Customer conversations. Polls every 6 seconds.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by customer name, email, or message…" className="pl-9 h-10 rounded-xl" />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {!threads && <div className="p-6 space-y-2">{Array(5).fill(0).map((_, i) => <div key={i} className="h-14 skeleton rounded" />)}</div>}
        {threads && filtered.length === 0 && (
          <div className="p-12 text-center text-slate-500">
            <MessageCircle className="w-12 h-12 mx-auto text-slate-300" />
            <div className="mt-2 font-bold text-slate-700">No conversations yet</div>
            <div className="text-xs">When customers chat, they'll appear here.</div>
          </div>
        )}
        <div className="divide-y divide-slate-100">
          {filtered.map(t => (
            <a key={t.id} href={`/admin/chat/${t.id}`} className="flex items-start gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-emerald-500 text-white font-bold flex items-center justify-center text-sm shrink-0">{(t.userName || 'C')[0].toUpperCase()}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-bold text-slate-900 truncate">{t.userName || 'Customer'} {t.unreadAdmin && <span className="ml-1.5 inline-block w-2 h-2 bg-teal-500 rounded-full" />}</div>
                  <div className="text-[11px] text-slate-500 shrink-0">{new Date(t.lastMessageAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                </div>
                <div className="text-xs text-slate-500 truncate">{t.userEmail}</div>
                <div className="text-sm text-slate-600 truncate mt-0.5">{t.lastMessageText || '(no messages yet)'}</div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminChats;

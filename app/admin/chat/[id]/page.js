'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Send, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const AdminChatThread = () => {
  const { id } = useParams();
  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const load = useCallback(() => {
    const token = localStorage.getItem('cs_token');
    fetch(`/api/admin/chats/${id}`, { headers: token ? { Authorization: 'Bearer ' + token } : {} })
      .then(r => r.json())
      .then(d => { setThread(d.thread); setMessages(d.messages || []); });
  }, [id]);

  useEffect(() => { load(); const t = setInterval(load, 4000); return () => clearInterval(t); }, [load]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    await fetch('/api/chat/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId: id, sender: 'admin', authorName: 'Pharmacist', text: text.trim() }),
    });
    setText('');
    await load();
    setSending(false);
  };

  if (!thread) return <div className="space-y-3"><div className="h-8 w-1/3 skeleton rounded" /><div className="h-96 skeleton rounded-2xl" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/admin/chat"><Button variant="ghost" size="icon" className="rounded-full"><ChevronLeft className="w-5 h-5" /></Button></Link>
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-emerald-500 text-white font-bold flex items-center justify-center">{(thread.userName || 'C')[0].toUpperCase()}</div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg md:text-xl font-black text-slate-900 truncate">{thread.userName || 'Customer'}</h1>
          <p className="text-xs text-slate-500 flex items-center gap-1 truncate"><Mail className="w-3 h-3" /> {thread.userEmail}</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl flex flex-col h-[70vh]">
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
          {messages.length === 0 && <div className="text-center text-sm text-slate-500 py-12">No messages yet.</div>}
          {messages.map(m => {
            const isAdmin = m.sender === 'admin';
            return (
              <div key={m.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${isAdmin ? 'bg-teal-600 text-white rounded-br-md' : 'bg-white border border-slate-200 text-slate-900 rounded-bl-md'}`}>
                  <div className="text-sm whitespace-pre-wrap">{m.text}</div>
                  <div className={`text-[10px] mt-0.5 ${isAdmin ? 'text-teal-100' : 'text-slate-400'}`}>{m.authorName} · {new Date(m.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
        <div className="p-3 border-t border-slate-100 flex gap-2 items-end">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} rows={1} placeholder="Reply as Pharmacist… (Enter to send)" className="resize-none min-h-[44px] max-h-32 rounded-xl bg-white" />
          <Button onClick={send} disabled={sending || !text.trim()} className="bg-teal-600 hover:bg-teal-700 rounded-xl h-11 px-4"><Send className="w-4 h-4" /></Button>
        </div>
      </div>
    </div>
  );
};

export default AdminChatThread;

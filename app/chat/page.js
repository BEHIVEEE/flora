'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Send, MessageCircle, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';

const ChatPage = () => {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth() || {};
  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const bottomRef = useRef(null);

  // Redirect to login if not signed in
  useEffect(() => {
    if (!authLoading && !user) router.replace('/login?next=/chat');
  }, [authLoading, user, router]);

  // Start or fetch thread
  useEffect(() => {
    if (!user) return;
    fetch('/api/chat/thread', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, userName: user.name, userEmail: user.email }),
    })
      .then(r => r.json())
      .then(d => { setThread(d.thread); setBootstrapping(false); })
      .catch(() => setBootstrapping(false));
  }, [user]);

  const loadMsgs = useCallback(() => {
    if (!thread?.id) return;
    fetch(`/api/chat/messages?threadId=${thread.id}`)
      .then(r => r.json())
      .then(d => setMessages(d.messages || []));
  }, [thread?.id]);

  useEffect(() => {
    if (!thread?.id) return;
    loadMsgs();
    const t = setInterval(loadMsgs, 4000);
    return () => clearInterval(t);
  }, [thread?.id, loadMsgs]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  const send = async () => {
    if (!text.trim() || !thread?.id) return;
    setSending(true);
    try {
      await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: thread.id, sender: 'user', authorName: user?.name || 'Customer', text: text.trim() }),
      });
      setText('');
      await loadMsgs();
    } catch { toast.error('Failed to send'); }
    finally { setSending(false); }
  };

  if (authLoading || bootstrapping) {
    return <div className="container max-w-3xl mx-auto px-4 py-10"><div className="h-96 skeleton rounded-2xl" /></div>;
  }

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="container max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/"><Button variant="ghost" size="icon" className="rounded-full"><ChevronLeft className="w-5 h-5" /></Button></Link>
          <div className="flex-1">
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Chat with Pharmacist</h1>
            <p className="text-xs text-slate-500 flex items-center gap-1"><ShieldCheck className="w-3 h-3 text-emerald-600" /> Your conversation is private and reviewed by a licensed pharmacist.</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl flex flex-col h-[70vh]">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-sm text-slate-500 py-12">
                <MessageCircle className="w-12 h-12 mx-auto text-slate-300" />
                <div className="mt-2 font-bold text-slate-700">Start the conversation</div>
                <div className="text-xs">Ask about medicines, dosage, alternatives, or upload a prescription.</div>
              </div>
            )}
            {messages.map(m => {
              const isUser = m.sender === 'user';
              return (
                <div key={m.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${isUser ? 'bg-teal-600 text-white rounded-br-md' : 'bg-slate-100 text-slate-900 rounded-bl-md'}`}>
                    <div className="text-sm whitespace-pre-wrap">{m.text}</div>
                    <div className={`text-[10px] mt-0.5 ${isUser ? 'text-teal-100' : 'text-slate-500'}`}>{m.authorName} · {new Date(m.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
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

export default ChatPage;

'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ImageOff, Search, Filter, ExternalLink, CheckCircle2, XCircle, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { cdn } from '@/lib/cdn-image';

const statusColors = {
  pending: 'bg-amber-100 text-amber-800',
  resolved: 'bg-emerald-100 text-emerald-800',
  dismissed: 'bg-slate-100 text-slate-600',
};

const authHeaders = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('cs_token') : null;
  return token ? { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
};

const ImageReports = () => {
  const [list, setList] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('pending');
  const [acting, setActing] = useState(null);

  const load = () => {
    setList(null);
    const params = new URLSearchParams();
    if (status !== 'all') params.set('status', status);
    if (q) params.set('search', q);
    fetch(`/api/admin/image-reports?${params.toString()}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => {
        setList(d.reports || []);
        setPendingCount(d.pendingCount ?? 0);
      });
  };

  useEffect(() => { load(); }, [status]);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [q]);

  const updateReport = async (id, { status: nextStatus, clearImage = false }) => {
    setActing(id);
    try {
      const res = await fetch(`/api/admin/image-reports/${id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status: nextStatus, clearImage }),
      });
      const d = await res.json();
      if (!res.ok || d?.ok === false) throw new Error(d?.error || 'Update failed');
      toast.success(
        nextStatus === 'resolved'
          ? clearImage
            ? 'Resolved and image cleared'
            : 'Marked as resolved'
          : 'Report dismissed'
      );
      load();
    } catch (err) {
      toast.error(err?.message || 'Could not update report');
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Wrong Image Reports</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Customer and staff flags for mismatched product photos.
          {pendingCount > 0 && (
            <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
              {pendingCount} pending
            </span>
          )}
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by product name or brand…"
            className="pl-9 h-10 rounded-xl"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[180px] h-10 rounded-xl">
            <Filter className="w-4 h-4 mr-1.5 text-slate-500" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-5 py-3 font-semibold">Product</th>
                <th className="text-left px-5 py-3 font-semibold">Reported image</th>
                <th className="text-left px-5 py-3 font-semibold">Reporter</th>
                <th className="text-left px-5 py-3 font-semibold">Note</th>
                <th className="text-left px-5 py-3 font-semibold">When</th>
                <th className="text-left px-5 py-3 font-semibold">Status</th>
                <th className="text-right px-5 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!list && Array(5).fill(0).map((_, i) => (
                <tr key={i}><td colSpan={7} className="px-5 py-4"><div className="h-8 skeleton rounded" /></td></tr>
              ))}
              {list?.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center text-slate-500">
                    <ImageOff className="w-10 h-10 mx-auto text-slate-300" />
                    <div className="mt-2 font-semibold text-slate-700">No reports</div>
                    <div className="text-xs">Flags from the storefront or product editor will appear here.</div>
                  </td>
                </tr>
              )}
              {list?.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 align-top">
                  <td className="px-5 py-3">
                    <div className="font-semibold text-slate-900 line-clamp-2 max-w-[220px]">{r.productName}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{r.productBrand || '—'}</div>
                    <Link
                      href={`/admin/products/${r.productId}`}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 hover:underline mt-1"
                    >
                      Edit product <ExternalLink className="w-3 h-3" />
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    {r.imageUrl ? (
                      <a href={r.imageUrl} target="_blank" rel="noopener noreferrer" className="block w-16 h-16 rounded-lg border border-slate-200 overflow-hidden bg-slate-50">
                        <img src={cdn(r.imageUrl, { w: 128, h: 128 })} alt="" className="w-full h-full object-cover" />
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400">No image</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-700">
                    <span className={`font-bold capitalize ${r.reporterType === 'admin' ? 'text-violet-700' : 'text-slate-700'}`}>
                      {r.reporterType || 'customer'}
                    </span>
                    {r.reporterName && <div className="mt-0.5">{r.reporterName}</div>}
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-600 max-w-[200px] line-clamp-3">{r.note || '—'}</td>
                  <td className="px-5 py-3 text-xs text-slate-700 whitespace-nowrap">
                    {new Date(r.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md capitalize ${statusColors[r.status] || statusColors.pending}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {r.status === 'pending' ? (
                      <div className="flex flex-col items-end gap-1.5">
                        <Button
                          size="sm"
                          disabled={acting === r.id}
                          onClick={() => updateReport(r.id, { status: 'resolved', clearImage: true })}
                          className="h-8 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Clear image
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={acting === r.id}
                          onClick={() => updateReport(r.id, { status: 'resolved' })}
                          className="h-8 rounded-full text-xs"
                        >
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Resolved
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={acting === r.id}
                          onClick={() => updateReport(r.id, { status: 'dismissed' })}
                          className="h-8 rounded-full text-xs text-slate-500"
                        >
                          <XCircle className="w-3 h-3 mr-1" />
                          Dismiss
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ImageReports;

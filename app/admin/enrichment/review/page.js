'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Check, 
  X, 
  ImageIcon, 
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

export default function ManualReview() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [processingId, setProcessingId] = useState(null);
  
  const limit = 10;

  // Fetch reviews based on pagination
  const fetchReviews = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('cs_token');
      const headers = token ? { Authorization: 'Bearer ' + token } : {};
      
      const offset = (page - 1) * limit;
      const res = await fetch(`/api/admin/enrichment/review?limit=${limit}&offset=${offset}`, { headers });
      const data = await res.json();
      
      if (data.ok) {
        setItems(data.items);
        setTotal(data.total);
      } else {
        toast.error(data.error || 'Failed to fetch review records');
      }
    } catch (err) {
      toast.error('Network error loading reviews');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [page]);

  // Handle Approve or Reject action
  const handleReviewAction = async (matchId, action) => {
    setProcessingId(matchId);
    try {
      const token = localStorage.getItem('cs_token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {})
      };
      
      const res = await fetch('/api/admin/enrichment/review', {
        method: 'POST',
        headers,
        body: JSON.stringify({ matchId, action })
      });
      const data = await res.json();
      
      if (data.ok) {
        toast.success(data.message || `Match successfully ${action}d`);
        // Remove item from UI or fetch again
        setItems(items.filter(item => item.id !== matchId));
        setTotal(prev => prev - 1);
        
        // If list is empty after removing and we aren't on page 1, go to previous page
        if (items.length <= 1 && page > 1) {
          setPage(prev => prev - 1);
        } else if (items.length <= 1) {
          fetchReviews();
        }
      } else {
        toast.error(data.error || `Failed to ${action} match`);
      }
    } catch (err) {
      toast.error(`Network error performing ${action}`);
    } finally {
      setProcessingId(null);
    }
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center gap-4">
        <Link href="/admin/enrichment">
          <button className="p-2 border border-slate-200 hover:bg-slate-100 rounded-xl transition-all">
            <ArrowLeft className="w-4 h-4 text-slate-700" />
          </button>
        </Link>
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Manual Match Review</h1>
          <p className="text-slate-500 text-xs mt-0.5">Approve or reject matched catalog recommendations falling in the 80% to 90% confidence zone.</p>
        </div>
      </div>

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-20 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-10 h-10 text-teal-600 animate-spin" />
          <span className="text-sm text-slate-500 font-semibold">Loading matching candidates...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-20 text-center">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">✓</div>
          <h3 className="font-bold text-slate-900 text-lg">All caught up!</h3>
          <p className="text-sm text-slate-500 mt-1">There are no products currently pending manual review.</p>
          <Link href="/admin/enrichment">
            <button className="mt-4 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-full shadow-lg hover:shadow-teal-600/25 transition-all text-sm">
              Back to Dashboard
            </button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Candidates list */}
          <div className="space-y-4">
            {items.map(item => {
              const rawImageUrls = item.matched_image_urls ? item.matched_image_urls.split('|').map(u => u.trim()).filter(Boolean) : [];
              const imageUrl = rawImageUrls[0];
              const score = parseFloat(item.confidence_score);

              // Colors based on score
              let badgeColor = 'bg-amber-100 text-amber-800 border-amber-200';
              if (score >= 88.0) {
                badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-200';
              }

              return (
                <div key={item.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col md:flex-row">
                  {/* Left Column: Image Preview */}
                  <div className="w-full md:w-48 bg-slate-50 border-r border-slate-200 p-4 flex flex-col items-center justify-center shrink-0 min-h-[160px]">
                    {imageUrl ? (
                      <div className="relative group w-28 h-28 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex items-center justify-center">
                        <img 
                          src={imageUrl} 
                          alt={item.matched_name} 
                          className="w-full h-full object-contain p-1"
                        />
                        <a 
                          href={imageUrl} 
                          target="_blank" 
                          rel="noreferrer"
                          className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-semibold rounded-xl"
                        >
                          <ExternalLink className="w-4 h-4 mr-1" /> View Full
                        </a>
                      </div>
                    ) : (
                      <div className="w-20 h-20 bg-slate-100 border border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-400">
                        <ImageIcon className="w-6 h-6 mb-1" />
                        <span className="text-[10px]">No image</span>
                      </div>
                    )}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border mt-3 ${badgeColor}`}>
                      {score}% Match
                    </span>
                  </div>

                  {/* Middle Column: Details Comparison */}
                  <div className="flex-1 p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Source Product (RMS) */}
                    <div className="space-y-2.5">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">RMS Product (Dataset A)</div>
                      <div>
                        <h4 className="font-bold text-slate-900 line-clamp-2 leading-tight">{item.source_name}</h4>
                        <div className="text-xs text-slate-500 mt-1">ID: <span className="font-mono">{item.source_product_id}</span></div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs pt-1 border-t border-slate-100">
                        <span className="text-slate-400">Company:</span>
                        <span className="text-slate-700 font-semibold line-clamp-1">{item.source_manufacturer || 'N/A'}</span>
                        <span className="text-slate-400">Packing:</span>
                        <span className="text-slate-700 font-semibold">{item.source_pack_size || 'N/A'}</span>
                        <span className="text-slate-400">MRP:</span>
                        <span className="text-slate-700 font-semibold">₹{item.source_mrp || '0.00'}</span>
                        {item.source_barcode && (
                          <>
                            <span className="text-slate-400">Barcode:</span>
                            <span className="text-slate-700 font-semibold font-mono">{item.source_barcode}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Target Product (Catalog) */}
                    <div className="space-y-2.5 border-t md:border-t-0 md:border-l border-slate-100 md:pl-4">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Suggested Catalog Product (Dataset B)</div>
                      <div>
                        <h4 className="font-bold text-teal-800 line-clamp-2 leading-tight">{item.matched_name || 'N/A'}</h4>
                        <div className="text-xs text-slate-500 mt-1">ID: <span className="font-mono">{item.matched_catalog_id || 'N/A'}</span></div>
                      </div>

                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs pt-1 border-t border-slate-100">
                        <span className="text-slate-400">Marketer:</span>
                        <span className="text-slate-700 font-semibold line-clamp-1">{item.matched_manufacturer || 'N/A'}</span>
                        <span className="text-slate-400">Packaging:</span>
                        <span className="text-slate-700 font-semibold line-clamp-1">{item.matched_pack_size || 'N/A'}</span>
                        <span className="text-slate-400">Category:</span>
                        <span className="text-slate-700 font-semibold uppercase">{item.matched_category || 'N/A'}</span>
                      </div>
                      
                      {item.matched_composition && (
                        <div className="text-[11px] bg-slate-50 border border-slate-200 rounded-lg p-2 mt-2 leading-snug">
                          <strong className="text-slate-600 block text-[9px] uppercase tracking-wider">Composition:</strong>
                          <span className="text-slate-700 font-medium">{item.matched_composition}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Actions */}
                  <div className="bg-slate-50 md:bg-white border-t md:border-t-0 md:border-l border-slate-200 p-4 md:w-32 flex md:flex-col justify-end md:justify-center gap-2 shrink-0">
                    <button 
                      onClick={() => handleReviewAction(item.id, 'approve')}
                      disabled={processingId !== null}
                      className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-600/10 hover:shadow-emerald-600/25 transition-all disabled:opacity-50"
                    >
                      {processingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Approve
                    </button>
                    <button 
                      onClick={() => handleReviewAction(item.id, 'reject')}
                      disabled={processingId !== null}
                      className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold rounded-xl text-xs transition-all disabled:opacity-50"
                    >
                      <X className="w-3.5 h-3.5 text-rose-500" /> Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200 pt-4 px-1">
              <span className="text-xs text-slate-500">Showing {(page - 1) * limit + 1}-{Math.min(page * limit, total)} of {total} items</span>
              
              <div className="flex items-center gap-1.5">
                <button 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                  <button 
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-7.5 h-7.5 text-xs font-bold rounded-lg border transition-all ${page === pageNum ? 'bg-teal-600 text-white border-teal-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  >
                    {pageNum}
                  </button>
                ))}
                <button 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

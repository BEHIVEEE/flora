'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
  Play, 
  Square, 
  Download, 
  Image as ImageIcon, 
  CheckCircle, 
  AlertTriangle, 
  HelpCircle, 
  FileSpreadsheet, 
  Terminal,
  Activity,
  ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';

export default function EnrichmentDashboard() {
  const [stats, setStats] = useState({
    totalProducts: 0,
    matchedProducts: 0,
    unmatchedProducts: 0,
    pendingReview: 0,
    imagesDownloaded: 0,
    imagesFailed: 0,
    lastJobStatus: 'idle',
    lastJobId: null
  });

  const [job, setJob] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState([]);
  const [autoScroll, setAutoScroll] = useState(true);
  
  const logContainerRef = useRef(null);
  const pollIntervalRef = useRef(null);

  // 1. Fetch initial statistics and job status
  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('cs_token');
      const headers = token ? { Authorization: 'Bearer ' + token } : {};
      
      const res = await fetch('/api/admin/enrichment/stats', { headers });
      const data = await res.json();
      
      if (data.ok) {
        setStats(data.stats);
        setIsProcessing(data.stats.lastJobStatus === 'processing');
        
        // If there's an active job, start polling it
        if (data.stats.lastJobStatus === 'processing' && data.stats.lastJobId) {
          startPolling(data.stats.lastJobId);
        }
      }
    } catch (err) {
      console.error('Failed to fetch stats', err);
    }
  };

  // 2. Poll job progress
  const startPolling = (jobId) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    
    pollIntervalRef.current = setInterval(async () => {
      try {
        const token = localStorage.getItem('cs_token');
        const headers = token ? { Authorization: 'Bearer ' + token } : {};
        
        const res = await fetch(`/api/admin/enrichment/jobs?id=${jobId}`, { headers });
        const data = await res.json();
        
        if (data.ok && data.job) {
          setJob(data.job);
          setLogs(data.job.logs || []);
          setIsProcessing(data.job.status === 'processing');
          
          if (data.job.status !== 'processing') {
            clearInterval(pollIntervalRef.current);
            fetchStats(); // refresh final counts
            if (data.job.status === 'completed') {
              toast.success('Product enrichment completed successfully!');
            } else if (data.job.status === 'failed') {
              toast.error(`Job failed: ${data.job.error || 'Unknown error'}`);
            }
          }
        }
      } catch (err) {
        console.error('Error polling job', err);
      }
    }, 1500);
  };

  useEffect(() => {
    fetchStats();
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // 3. Auto-scroll logs window
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // 4. Start Matching Job
  const handleStartJob = async () => {
    try {
      const token = localStorage.getItem('cs_token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {})
      };
      
      const res = await fetch('/api/admin/enrichment/jobs', {
        method: 'POST',
        headers
      });
      const data = await res.json();
      
      if (data.ok) {
        toast.success('Background enrichment job started!');
        setIsProcessing(true);
        setLogs([]);
        startPolling(data.jobId);
      } else {
        toast.error(data.error || 'Failed to start job');
      }
    } catch (err) {
      toast.error('Network error starting job');
    }
  };

  // 5. Stop Matching Job
  const handleStopJob = async () => {
    if (!confirm('Are you sure you want to stop the current matching process? Staged matches will be kept, but image downloads will stop.')) {
      return;
    }
    
    try {
      const token = localStorage.getItem('cs_token');
      const headers = token ? { Authorization: 'Bearer ' + token } : {};
      
      const res = await fetch('/api/admin/enrichment/jobs', {
        method: 'DELETE',
        headers
      });
      const data = await res.json();
      
      if (data.ok) {
        toast.success('Enrichment job stopped.');
        setIsProcessing(false);
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        fetchStats();
      } else {
        toast.error(data.error || 'Failed to stop job');
      }
    } catch (err) {
      toast.error('Network error stopping job');
    }
  };

  const progressPercentage = job && job.totalProducts > 0 
    ? Math.round((job.processedProducts / job.totalProducts) * 100) 
    : isProcessing ? 0 : 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isProcessing ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isProcessing ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
            </span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Pipeline Service</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight mt-1">Product Enrichment</h1>
          <p className="text-slate-500 text-sm mt-0.5">Enrich your product catalog with descriptions, compositions, categories, and Cloudinary image URLs.</p>
        </div>
        
        <div className="flex items-center gap-2">
          {isProcessing ? (
            <button 
              onClick={handleStopJob} 
              className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-full shadow-lg hover:shadow-rose-600/25 transition-all text-sm"
            >
              <Square className="w-4 h-4 fill-white" /> Stop Matching
            </button>
          ) : (
            <button 
              onClick={handleStartJob} 
              className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-full shadow-lg hover:shadow-teal-600/25 transition-all text-sm"
            >
              <Play className="w-4 h-4 fill-white" /> Start Matching
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar (Only visible when processing) */}
      {isProcessing && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-500 animate-pulse" /> Matching Progress
            </span>
            <span className="text-sm font-black text-teal-600">{progressPercentage}%</span>
          </div>
          <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
            <div 
              className="bg-gradient-to-r from-teal-500 to-emerald-500 h-full rounded-full transition-all duration-500 ease-out" 
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-xs text-slate-500 mt-2">
            <span>Processed: {job ? job.processedProducts.toLocaleString() : 0} / {job ? job.totalProducts.toLocaleString() : 0} products</span>
            <span>Images: {job ? job.imagesDownloaded.toLocaleString() : 0} enriched ({job ? job.imagesFailed.toLocaleString() : 0} failed)</span>
          </div>
        </div>
      )}

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Products */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm relative overflow-hidden group hover:border-slate-300 transition-all">
          <div className="absolute right-0 bottom-0 translate-x-2 translate-y-2 opacity-[0.03] group-hover:scale-110 transition-transform">
            <FileSpreadsheet className="w-24 h-24 text-slate-900" />
          </div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Products</div>
          <div className="text-2xl md:text-3xl font-black text-slate-900 mt-1">{(stats.totalProducts || 0).toLocaleString()}</div>
          <p className="text-xs text-slate-400 mt-2">RMS active inventory</p>
        </div>

        {/* Auto Accepted */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm relative overflow-hidden group hover:border-slate-300 transition-all">
          <div className="absolute right-0 bottom-0 translate-x-2 translate-y-2 opacity-[0.03] group-hover:scale-110 transition-transform">
            <CheckCircle className="w-24 h-24 text-slate-900" />
          </div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Matched (Auto)</div>
          <div className="text-2xl md:text-3xl font-black text-emerald-600 mt-1">{(stats.matchedProducts || 0).toLocaleString()}</div>
          <p className="text-xs text-slate-400 mt-2">Confidence &ge; 90%</p>
        </div>

        {/* Pending Review */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm relative overflow-hidden group hover:border-slate-300 transition-all">
          <div className="absolute right-0 bottom-0 translate-x-2 translate-y-2 opacity-[0.03] group-hover:scale-110 transition-transform">
            <AlertTriangle className="w-24 h-24 text-slate-900" />
          </div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Review</div>
          <div className="text-2xl md:text-3xl font-black text-amber-500 mt-1">{(stats.pendingReview || 0).toLocaleString()}</div>
          
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-slate-400">80% - 90% match</span>
            {stats.pendingReview > 0 && (
              <Link href="/admin/enrichment/review" className="text-xs text-teal-600 hover:text-teal-700 font-bold flex items-center gap-0.5">
                Review <ArrowRight className="w-3 h-3" />
              </Link>
            )}
          </div>
        </div>

        {/* Cloudinary Images */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm relative overflow-hidden group hover:border-slate-300 transition-all">
          <div className="absolute right-0 bottom-0 translate-x-2 translate-y-2 opacity-[0.03] group-hover:scale-110 transition-transform">
            <ImageIcon className="w-24 h-24 text-slate-900" />
          </div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Images Enriched</div>
          <div className="text-2xl md:text-3xl font-black text-teal-600 mt-1">{(stats.imagesDownloaded || 0).toLocaleString()}</div>
          <p className="text-xs text-slate-400 mt-2">{stats.imagesFailed || 0} failed downloads</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Logs Console */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl shadow-lg p-5 flex flex-col h-[400px]">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3 shrink-0">
            <div className="flex items-center gap-2 text-slate-200 font-bold text-sm">
              <Terminal className="w-4 h-4 text-teal-400" /> Process Log Console
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
              <input 
                type="checkbox" 
                checked={autoScroll} 
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="rounded border-slate-700 text-teal-500 focus:ring-0 focus:ring-offset-0 bg-slate-800 w-3.5 h-3.5"
              />
              Auto-scroll
            </label>
          </div>
          
          <div 
            ref={logContainerRef}
            className="flex-1 overflow-y-auto space-y-1.5 font-mono text-xs text-slate-300 pr-2 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent"
          >
            {logs.length === 0 && (
              <div className="text-slate-500 italic text-center py-20">Console is idle. Start matching to view live logs.</div>
            )}
            {logs.map((l, index) => {
              let color = 'text-slate-300';
              if (l.level === 'SUCCESS') color = 'text-emerald-400';
              if (l.level === 'WARN') color = 'text-amber-400';
              if (l.level === 'ERROR') color = 'text-rose-400';
              
              return (
                <div key={index} className="flex gap-2.5 items-start leading-normal">
                  <span className="text-slate-600 shrink-0">[{l.time || '00:00:00'}]</span>
                  <span className={`${color} break-all`}>{l.message}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions & Reports Download */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-900 mb-1">Reports & Exports</h3>
            <p className="text-xs text-slate-500 mb-4">Export the results of your product matching pipeline as CSV files.</p>
            
            <div className="space-y-3">
              {/* Matched Products */}
              <a 
                href="/reports/matched_products.csv" 
                download
                className="flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-xl group transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-lg"><CheckCircle className="w-5 h-5" /></div>
                  <div className="text-left">
                    <div className="text-sm font-semibold text-slate-800">Matched Products</div>
                    <div className="text-[11px] text-slate-400">Auto-approved matches (&ge; 90%)</div>
                  </div>
                </div>
                <Download className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
              </a>

              {/* Review Required */}
              <a 
                href="/reports/review_required.csv" 
                download
                className="flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-xl group transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-lg"><AlertTriangle className="w-5 h-5" /></div>
                  <div className="text-left">
                    <div className="text-sm font-semibold text-slate-800">Review Required</div>
                    <div className="text-[11px] text-slate-400">Manual verification needed (80-90%)</div>
                  </div>
                </div>
                <Download className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
              </a>

              {/* Unmatched Products */}
              <a 
                href="/reports/unmatched_products.csv" 
                download
                className="flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-xl group transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-lg"><HelpCircle className="w-5 h-5" /></div>
                  <div className="text-left">
                    <div className="text-sm font-semibold text-slate-800">Unmatched Products</div>
                    <div className="text-[11px] text-slate-400">Rejected candidates (&lt; 80%)</div>
                  </div>
                </div>
                <Download className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
              </a>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 mt-6">
            <h4 className="text-xs font-bold text-slate-800 mb-1">Configuration Overview:</h4>
            <div className="grid grid-cols-2 gap-y-1 text-[11px] text-slate-500">
              <div>Auto-accept limit:</div><div className="text-slate-700 font-semibold">&ge; 90% confidence</div>
              <div>Manual review band:</div><div className="text-slate-700 font-semibold">80% - 90% confidence</div>
              <div>Rejection limit:</div><div className="text-slate-700 font-semibold">&lt; 80% confidence</div>
              <div>Brand mapping:</div><div className="text-slate-700 font-semibold">mml/me/him active</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

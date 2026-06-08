'use client';

import Link from 'next/link';
import { Loader2, Upload } from 'lucide-react';
import { useImportJobContext } from '@/components/admin/ImportJobProvider';

const ImportJobBanner = () => {
  const { importing, progress, result, uploadInterrupted } = useImportJobContext();

  if (result || !importing || !progress) return null;

  const isUploading = progress.status === 'uploading' && !uploadInterrupted;
  const pct = isUploading
    ? (progress.totalBatches ? Math.min(100, (progress.currentBatch / progress.totalBatches) * 100) : 0)
    : (progress.total ? Math.min(100, (progress.current / progress.total) * 100) : 0);

  const label = uploadInterrupted
    ? `Upload paused at batch ${progress.currentBatch} / ${progress.totalBatches} — tap to resume`
    : isUploading
      ? `Uploading batch ${progress.currentBatch} / ${progress.totalBatches}`
      : `Importing ${progress.current.toLocaleString()} / ${progress.total.toLocaleString()} products`;

  return (
    <div className="sticky top-0 z-40 mb-4 -mt-2">
      <Link
        href="/admin/products/import"
        className="flex items-center gap-3 bg-teal-700 text-white rounded-xl px-4 py-3 shadow-md hover:bg-teal-800 transition-colors"
      >
        <div className="shrink-0 w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center">
          {isUploading ? <Upload className="w-4 h-4" /> : <Loader2 className="w-4 h-4 animate-spin" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold truncate">
            {uploadInterrupted ? 'Product import paused — action needed' : 'Product import running in background'}
          </div>
          <div className="text-xs text-teal-100 mt-0.5">{label} · tap for details</div>
          <div className="mt-2 h-1.5 bg-white/20 rounded-full overflow-hidden">
            <div className="h-full bg-white transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <span className="text-xs font-bold bg-white/15 px-2.5 py-1 rounded-full shrink-0">
          {Math.round(pct)}%
        </span>
      </Link>
    </div>
  );
};

export default ImportJobBanner;

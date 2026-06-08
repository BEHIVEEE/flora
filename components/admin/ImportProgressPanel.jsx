'use client';

import { Loader2 } from 'lucide-react';

const ImportProgressPanel = ({ progress, compact = false }) => {
  if (!progress) return null;

  const isUploading = progress.status === 'uploading';
  const pct = isUploading
    ? (progress.totalBatches ? Math.min(100, (progress.currentBatch / progress.totalBatches) * 100) : 0)
    : (progress.total ? Math.min(100, (progress.current / progress.total) * 100) : 0);

  const statusLabel = isUploading
    ? 'Uploading file…'
    : progress.status === 'queued'
      ? 'Queued…'
      : progress.status === 'processing'
        ? 'Processing in background…'
        : progress.status || 'processing';

  const countLabel = isUploading
    ? `Batch ${progress.currentBatch} / ${progress.totalBatches}`
    : `${(progress.current || 0).toLocaleString()} / ${(progress.total || 0).toLocaleString()} products`;

  const remaining = isUploading
    ? progress.remainingUploadChunks
    : progress.pendingProcessingChunks;

  return (
    <div className={compact ? 'space-y-2' : 'mt-3 space-y-2'}>
      <div className="flex justify-between text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          {!isUploading && progress.status === 'processing' && (
            <Loader2 className="w-3 h-3 animate-spin text-teal-600" />
          )}
          {isUploading && <Loader2 className="w-3 h-3 animate-spin text-teal-600" />}
          Status: {statusLabel}
        </span>
        <span>{countLabel}</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-teal-600 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      {typeof remaining === 'number' && remaining > 0 && (
        <div className="text-[11px] text-slate-500">
          {isUploading ? 'Batches left to upload' : 'Batches left to process'}: {remaining}
        </div>
      )}
      {!compact && !isUploading && (
        <p className="text-[11px] text-slate-500">
          You can reload or leave this page — processing continues on the server.
        </p>
      )}
      {!compact && isUploading && (
        <p className="text-[11px] text-slate-500">
          Keep this tab open while uploading. If interrupted, re-select the same file to resume.
        </p>
      )}
    </div>
  );
};

export default ImportProgressPanel;

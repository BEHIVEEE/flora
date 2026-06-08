'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

const JOB_KEY = 'flora-import-job';
const META_KEY = 'flora-import-job-meta';
const ROWS_KEY = 'flora-import-rows';
const BULK_IMPORT_LIMIT = 200;

function readMeta() {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(window.localStorage.getItem(META_KEY) || 'null');
  } catch {
    return null;
  }
}

function saveMeta(job) {
  if (typeof window === 'undefined' || !job?.id) return;
  window.localStorage.setItem(JOB_KEY, job.id);
  window.localStorage.setItem(
    META_KEY,
    JSON.stringify({
      jobId: job.id,
      total: job.total || 0,
      processed: job.processed || 0,
      status: job.status,
      created: job.created || 0,
      updated: job.updated || 0,
      failed: job.failed || 0,
      expectedChunks: job.expectedChunks || 0,
      uploadedChunks: job.uploadedChunks || 0,
      pendingChunks: job.pendingChunks ?? null,
    })
  );
}

function clearStoredJob() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(JOB_KEY);
  window.localStorage.removeItem(META_KEY);
  try {
    window.sessionStorage.removeItem(ROWS_KEY);
  } catch {
    /* ignore */
  }
}

function cacheRows(rows) {
  if (typeof window === 'undefined' || !rows?.length) return false;
  try {
    window.sessionStorage.setItem(ROWS_KEY, JSON.stringify(rows));
    return true;
  } catch {
    return false;
  }
}

function readCachedRows() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(ROWS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function useImportJob({ onComplete, pollInterval = 3500 } = {}) {
  const [job, setJob] = useState(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const pollRef = useRef(null);
  const resumeRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const applyJob = useCallback((j) => {
    if (!j) return;
    const normalized = { ...j, id: j.id || j.jobId };
    setJob(normalized);
    saveMeta(normalized);
  }, []);

  const finishJob = useCallback((j) => {
    stopPolling();
    setImporting(false);
    setJob(null);
    clearStoredJob();
    const outcome = {
      created: j.created || 0,
      updated: j.updated || 0,
      failed: j.failed || 0,
      errors: j.errors || [],
      status: j.status,
      errorMessage: j.errorMessage,
    };
    setResult(outcome);
    onComplete?.(outcome);
    toast[j.status === 'completed' ? 'success' : 'error'](
      j.status === 'completed' ? 'Import completed' : 'Import failed'
    );
  }, [onComplete, stopPolling]);

  const pollStatus = useCallback(async (id) => {
    if (!id) return null;
    try {
      const res = await fetch(`/api/admin/import/status?id=${encodeURIComponent(id)}`);
      if (res.status === 404) {
        stopPolling();
        setImporting(false);
        setJob(null);
        clearStoredJob();
        return null;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const j = data?.job;
      if (!j) return null;

      applyJob(j);

      if (j.status === 'completed' || j.status === 'failed') {
        finishJob(j);
      }
      return j;
    } catch (err) {
      console.error('[IMPORT] Poll failed', err);
      return null;
    }
  }, [applyJob, finishJob, stopPolling]);

  const startPolling = useCallback((id) => {
    if (!id) return;
    setImporting(true);
    setResult(null);
    stopPolling();
    pollStatus(id);
    pollRef.current = setInterval(() => pollStatus(id), pollInterval);
  }, [pollInterval, pollStatus, stopPolling]);

  const postJson = useCallback(async (url, payload) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `Import failed (${res.status})`);
    return data;
  }, []);

  const uploadChunks = useCallback(async (jobId, rows, fromIndex = 0) => {
    const totalBatches = Math.ceil(rows.length / BULK_IMPORT_LIMIT);
    for (let i = fromIndex; i < totalBatches; i++) {
      const slice = rows.slice(i * BULK_IMPORT_LIMIT, (i + 1) * BULK_IMPORT_LIMIT);
      await postJson('/api/admin/import/chunk', { jobId, index: i, rows: slice });
      applyJob({
        id: jobId,
        total: rows.length,
        processed: 0,
        status: 'uploading',
        expectedChunks: totalBatches,
        uploadedChunks: i + 1,
        pendingChunks: totalBatches - i - 1,
      });
    }
    await postJson('/api/admin/import/finalize', { jobId });
    try {
      window.sessionStorage.removeItem(ROWS_KEY);
    } catch {
      /* ignore */
    }
  }, [applyJob, postJson]);

  const resumeUploadIfNeeded = useCallback(async (activeJob) => {
    if (!activeJob || activeJob.status !== 'uploading' || resumeRef.current) return;
    const rows = readCachedRows();
    if (!rows?.length) return;

    const uploaded = activeJob.uploadedChunks || 0;
    const expected = activeJob.expectedChunks || Math.ceil(rows.length / BULK_IMPORT_LIMIT);
    if (uploaded >= expected) {
      try {
        await postJson('/api/admin/import/finalize', { jobId: activeJob.id });
        startPolling(activeJob.id);
      } catch (err) {
        console.error('[IMPORT] Finalize on resume failed', err);
      }
      return;
    }

    resumeRef.current = true;
    setImporting(true);
    toast.info('Resuming interrupted upload…');
    try {
      await uploadChunks(activeJob.id, rows, uploaded);
      startPolling(activeJob.id);
      toast.success('Upload complete — import processing in background.');
    } catch (err) {
      console.error('[IMPORT] Resume upload failed', err);
      toast.error(err?.message || 'Upload resume failed');
      setImporting(false);
    } finally {
      resumeRef.current = false;
    }
  }, [postJson, startPolling, uploadChunks]);

  const discoverActiveJob = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/import/active');
      if (!res.ok) return null;
      const data = await res.json();
      return data?.job || null;
    } catch {
      return null;
    }
  }, []);

  const bootstrap = useCallback(async () => {
    const storedId = typeof window !== 'undefined' ? window.localStorage.getItem(JOB_KEY) : null;
    const storedMeta = readMeta();

    if (storedMeta) {
      setJob(storedMeta);
      setImporting(true);
    }

    let active = null;
    if (storedId) {
      active = await pollStatus(storedId);
    }
    if (!active) {
      active = await discoverActiveJob();
      if (active) {
        applyJob(active);
        saveMeta(active);
        setImporting(true);
      }
    }

    if (active && (active.status === 'queued' || active.status === 'processing')) {
      startPolling(active.id);
      return;
    }

    if (active?.status === 'uploading') {
      await resumeUploadIfNeeded(active);
      if (active.uploadedChunks >= (active.expectedChunks || 0)) {
        startPolling(active.id);
      }
      return;
    }

    if (active && (active.status === 'completed' || active.status === 'failed')) {
      finishJob(active);
    }
  }, [applyJob, discoverActiveJob, finishJob, pollStatus, resumeUploadIfNeeded, startPolling]);

  useEffect(() => {
    bootstrap();
    return () => stopPolling();
    // Run once on mount to restore any in-progress import from storage/server
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startImport = useCallback(async (rows) => {
    if (!rows?.length) throw new Error('No rows to import');
    cacheRows(rows);
    setImporting(true);
    setResult(null);

    const initData = await postJson('/api/admin/import/init', { total: rows.length });
    const jobId = initData.jobId;
    applyJob({
      id: jobId,
      total: rows.length,
      processed: 0,
      status: 'uploading',
      expectedChunks: initData.expectedChunks,
      uploadedChunks: 0,
      pendingChunks: initData.expectedChunks,
    });

    await uploadChunks(jobId, rows, 0);
    startPolling(jobId);
    toast.success(`Import started (${rows.length} products). Safe to reload or leave this page.`);
    return jobId;
  }, [applyJob, postJson, startPolling, uploadChunks]);

  const progress = job
    ? {
        current: job.processed || 0,
        total: job.total || 0,
        status: job.status || 'processing',
        pendingChunks: job.pendingChunks ?? null,
        totalBatches: Math.max(1, Math.ceil((job.total || 0) / BULK_IMPORT_LIMIT)),
        currentBatch:
          job.status === 'uploading'
            ? job.uploadedChunks || 0
            : job.status === 'completed'
              ? Math.max(1, Math.ceil((job.total || 0) / BULK_IMPORT_LIMIT))
              : Math.min(
                  Math.max(1, Math.ceil((job.total || 0) / BULK_IMPORT_LIMIT)),
                  Math.floor((job.processed || 0) / BULK_IMPORT_LIMIT) + 1
                ),
      }
    : null;

  const resetResult = useCallback(() => {
    setResult(null);
  }, []);

  return {
    job,
    importing,
    result,
    progress,
    startImport,
    startPolling,
    resetResult,
    clearStoredJob,
  };
}

export default useImportJob;

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  cacheImportRows,
  clearCachedImportRows,
  readCachedImportRows,
} from '@/lib/import-row-cache';

const JOB_KEY = 'flora-import-job';
const META_KEY = 'flora-import-job-meta';
const DEFAULT_UPLOAD_CHUNK_SIZE = 100; // smaller batches = reliable uploads for large XLS files
const PROCESS_BATCH_SIZE = 200;

function getUploadChunkSize(jobLike) {
  return jobLike?.uploadChunkSize || jobLike?.chunkSize || DEFAULT_UPLOAD_CHUNK_SIZE;
}

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
      remainingUploadChunks: job.remainingUploadChunks ?? null,
      pendingProcessingChunks: job.pendingProcessingChunks ?? null,
    })
  );
}

function clearStoredJob() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(JOB_KEY);
  window.localStorage.removeItem(META_KEY);
  clearCachedImportRows();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function useImportJob({ onComplete, pollInterval = 3500 } = {}) {
  const [job, setJob] = useState(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [uploadInterrupted, setUploadInterrupted] = useState(false);
  const [isUploadingActive, setIsUploadingActive] = useState(false);
  const pollRef = useRef(null);
  const resumeRef = useRef(false);
  const uploadRef = useRef(false);

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
    setIsUploadingActive(false);
    setUploadInterrupted(false);
    setJob(null);
    uploadRef.current = false;
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
    if (!id || uploadRef.current) return null;
    try {
      const res = await fetch(`/api/admin/import/status?id=${encodeURIComponent(id)}`);
      if (res.status === 404) {
        stopPolling();
        setImporting(false);
        setJob(null);
        setUploadInterrupted(false);
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
    setUploadInterrupted(false);
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

  const postChunkWithRetry = useCallback(async (jobId, index, rows) => {
    let attempt = 0;
    while (attempt < 4) {
      try {
        await postJson('/api/admin/import/chunk', { jobId, index, rows });
        return;
      } catch (err) {
        attempt += 1;
        if (attempt >= 4) throw err;
        await sleep(800 * attempt);
      }
    }
  }, [postJson]);

  const uploadChunks = useCallback(async (jobId, rows, fromIndex = 0, chunkSize = DEFAULT_UPLOAD_CHUNK_SIZE) => {
    const totalBatches = Math.ceil(rows.length / chunkSize);
    uploadRef.current = true;
    setIsUploadingActive(true);
    setUploadInterrupted(false);

    try {
      for (let i = fromIndex; i < totalBatches; i++) {
        const slice = rows.slice(i * chunkSize, (i + 1) * chunkSize);
        await postChunkWithRetry(jobId, i, slice);
        applyJob({
          id: jobId,
          total: rows.length,
          processed: 0,
          status: 'uploading',
          expectedChunks: totalBatches,
          uploadedChunks: i + 1,
          remainingUploadChunks: totalBatches - i - 1,
          pendingProcessingChunks: 0,
        });
      }
      await postJson('/api/admin/import/finalize', { jobId });
      await clearCachedImportRows();
    } finally {
      uploadRef.current = false;
      setIsUploadingActive(false);
    }
  }, [applyJob, postChunkWithRetry, postJson]);

  const resumeUploadIfNeeded = useCallback(async (activeJob) => {
    if (!activeJob || activeJob.status !== 'uploading' || resumeRef.current || uploadRef.current) {
      return false;
    }

    const rows = await readCachedImportRows();
    const uploaded = activeJob.uploadedChunks || 0;
    const chunkSize = getUploadChunkSize(activeJob);
    const expected = activeJob.expectedChunks || (rows ? Math.ceil(rows.length / chunkSize) : 0);

    if (!rows?.length) {
      if (uploaded < expected) {
        setUploadInterrupted(true);
        setImporting(true);
      }
      return false;
    }

    if (uploaded >= expected) {
      try {
        await postJson('/api/admin/import/finalize', { jobId: activeJob.id });
        startPolling(activeJob.id);
      } catch (err) {
        console.error('[IMPORT] Finalize on resume failed', err);
        setUploadInterrupted(true);
      }
      return true;
    }

    resumeRef.current = true;
    setImporting(true);
    setUploadInterrupted(false);
    toast.info(`Resuming upload from batch ${uploaded + 1} of ${expected}…`);
    try {
      await uploadChunks(activeJob.id, rows, uploaded, chunkSize);
      startPolling(activeJob.id);
      toast.success('Upload complete — import processing in background.');
      return true;
    } catch (err) {
      console.error('[IMPORT] Resume upload failed', err);
      toast.error(err?.message || 'Upload resume failed');
      setUploadInterrupted(true);
      return false;
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
        setImporting(true);
      }
    }

    if (!active) return;

    if (active.status === 'queued' || active.status === 'processing') {
      startPolling(active.id);
      return;
    }

    if (active.status === 'uploading') {
      const resumed = await resumeUploadIfNeeded(active);
      if (!resumed && (active.uploadedChunks || 0) >= (active.expectedChunks || 0)) {
        startPolling(active.id);
      }
      return;
    }

    if (active.status === 'completed' || active.status === 'failed') {
      finishJob(active);
    }
  }, [applyJob, discoverActiveJob, finishJob, pollStatus, resumeUploadIfNeeded, startPolling]);

  useEffect(() => {
    bootstrap();
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startImport = useCallback(async (rows, existingJobId = null) => {
    if (!rows?.length) throw new Error('No rows to import');
    await cacheImportRows(rows);
    setImporting(true);
    setResult(null);
    setUploadInterrupted(false);

    let jobId = existingJobId;
    let fromIndex = 0;
    let chunkSize = DEFAULT_UPLOAD_CHUNK_SIZE;
    let expectedChunks = Math.ceil(rows.length / chunkSize);

    if (existingJobId && job?.status === 'uploading') {
      fromIndex = job.uploadedChunks || 0;
      chunkSize = getUploadChunkSize(job);
      expectedChunks = job.expectedChunks || Math.ceil(rows.length / chunkSize);
    } else {
      const initData = await postJson('/api/admin/import/init', {
        total: rows.length,
        chunkSize: DEFAULT_UPLOAD_CHUNK_SIZE,
      });
      jobId = initData.jobId;
      chunkSize = initData.uploadChunkSize || DEFAULT_UPLOAD_CHUNK_SIZE;
      expectedChunks = initData.expectedChunks;
      fromIndex = 0;
    }

    applyJob({
      id: jobId,
      total: rows.length,
      processed: 0,
      status: 'uploading',
      expectedChunks,
      uploadChunkSize: chunkSize,
      uploadedChunks: fromIndex,
      remainingUploadChunks: expectedChunks - fromIndex,
      pendingProcessingChunks: 0,
    });

    await uploadChunks(jobId, rows, fromIndex, chunkSize);
    startPolling(jobId);
    toast.success(`Import started (${rows.length} products). Safe to reload or leave this page.`);
    return jobId;
  }, [applyJob, job, postJson, startPolling, uploadChunks]);

  const resumeImport = useCallback(async (rows) => {
    if (!job?.id) throw new Error('No interrupted import to resume');
    await cacheImportRows(rows);
    setUploadInterrupted(false);
    const chunkSize = getUploadChunkSize(job);
    await uploadChunks(job.id, rows, job.uploadedChunks || 0, chunkSize);
    startPolling(job.id);
    toast.success('Upload resumed — processing will continue in background.');
  }, [job, startPolling, uploadChunks]);

  const cancelImport = useCallback(async () => {
    if (!job?.id) return;
    try {
      await postJson('/api/admin/import/cancel', { jobId: job.id });
    } catch (err) {
      console.error('[IMPORT] Cancel failed', err);
    }
    stopPolling();
    setImporting(false);
    setJob(null);
    setUploadInterrupted(false);
    uploadRef.current = false;
    clearStoredJob();
    toast.info('Import cancelled');
  }, [job, postJson, stopPolling]);

  const progress = job
    ? {
        current: job.processed || 0,
        total: job.total || 0,
        status: isUploadingActive ? 'uploading' : (job.status || 'processing'),
        remainingUploadChunks: job.remainingUploadChunks ?? null,
        pendingProcessingChunks: job.pendingProcessingChunks ?? null,
        totalBatches: Math.max(
          1,
          job.status === 'uploading' || isUploadingActive
            ? (job.expectedChunks || Math.ceil((job.total || 0) / getUploadChunkSize(job)))
            : Math.ceil((job.total || 0) / PROCESS_BATCH_SIZE)
        ),
        currentBatch:
          job.status === 'uploading' || isUploadingActive
            ? (job.uploadedChunks || 0)
            : job.status === 'completed'
              ? Math.max(1, Math.ceil((job.total || 0) / PROCESS_BATCH_SIZE))
              : Math.min(
                  Math.max(1, Math.ceil((job.total || 0) / PROCESS_BATCH_SIZE)),
                  Math.floor((job.processed || 0) / PROCESS_BATCH_SIZE) + 1
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
    uploadInterrupted,
    isUploadingActive,
    startImport,
    resumeImport,
    cancelImport,
    startPolling,
    resetResult,
    clearStoredJob,
  };
}

export default useImportJob;

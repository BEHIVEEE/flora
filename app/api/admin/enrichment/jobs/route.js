import { NextResponse } from 'next/server';
import { verifyToken, getBearer } from '@/lib/auth.js';
import { query } from '@/lib/mysql.js';
import { EnrichmentWorker } from '@/lib/enrichment/worker.js';
import { v4 as uuidv4 } from 'uuid';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function getResponse(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: CORS_HEADERS
  });
}

function checkAdmin(req) {
  try {
    const token = getBearer(req);
    const data = verifyToken(token);
    return data && data.role === 'admin';
  } catch {
    return false;
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/admin/enrichment/jobs - Poll status of current job or get last job
export async function GET(req) {
  if (!checkAdmin(req)) {
    return getResponse({ ok: false, error: 'Admin access required' }, 403);
  }

  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get('id');

  const active = EnrichmentWorker.getActiveJob();
  
  if (active && (!jobId || active.id === jobId)) {
    // Get live logs from worker
    return getResponse({ ok: true, job: active });
  }

  // Fallback to database
  try {
    let jobs = [];
    if (jobId) {
      jobs = await query('SELECT * FROM enrichment_jobs WHERE id = ?', [jobId]);
    } else {
      jobs = await query('SELECT * FROM enrichment_jobs ORDER BY created_at DESC LIMIT 1');
    }

    if (jobs.length === 0) {
      return getResponse({ ok: true, job: null });
    }

    const job = jobs[0];
    // Fetch logs for this job
    const logs = await query(
      'SELECT level, message, DATE_FORMAT(created_at, "%H:%i:%s") as time FROM enrichment_logs WHERE job_id = ? ORDER BY id ASC',
      [job.id]
    );

    return getResponse({
      ok: true,
      job: {
        id: job.id,
        status: job.status,
        totalProducts: job.total_products,
        processedProducts: job.processed_products,
        matchedCount: job.matched_count,
        reviewCount: job.review_count,
        unmatchedCount: job.unmatched_count,
        imagesDownloaded: job.images_downloaded,
        imagesFailed: job.images_failed,
        error: job.error_message,
        logs
      }
    });
  } catch (error) {
    return getResponse({ ok: false, error: error.message }, 500);
  }
}

// POST /api/admin/enrichment/jobs - Start a new enrichment job
export async function POST(req) {
  if (!checkAdmin(req)) {
    return getResponse({ ok: false, error: 'Admin access required' }, 403);
  }

  const active = EnrichmentWorker.getActiveJob();
  if (active && active.status === 'processing') {
    return getResponse({ ok: false, error: 'An enrichment job is already running' }, 400);
  }

  try {
    const jobId = uuidv4();
    const jobState = await EnrichmentWorker.start(jobId);
    return getResponse({ ok: true, message: 'Enrichment job started', jobId, status: jobState.status });
  } catch (error) {
    return getResponse({ ok: false, error: error.message }, 500);
  }
}

// DELETE /api/admin/enrichment/jobs - Stop a running enrichment job
export async function DELETE(req) {
  if (!checkAdmin(req)) {
    return getResponse({ ok: false, error: 'Admin access required' }, 403);
  }

  const active = EnrichmentWorker.getActiveJob();
  if (!active || active.status !== 'processing') {
    return getResponse({ ok: false, error: 'No active job is running' }, 400);
  }

  try {
    const stopped = await EnrichmentWorker.stop(active.id);
    return getResponse({ ok: true, stopped });
  } catch (error) {
    return getResponse({ ok: false, error: error.message }, 500);
  }
}

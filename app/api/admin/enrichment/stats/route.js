import { NextResponse } from 'next/server';
import { verifyToken, getBearer } from '@/lib/auth.js';
import { query } from '@/lib/mysql.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

export async function GET(req) {
  if (!checkAdmin(req)) {
    return getResponse({ ok: false, error: 'Admin access required' }, 403);
  }

  try {
    // 1. Total products in MySQL products table
    const [{ count: totalProducts }] = await query('SELECT COUNT(*) as count FROM products');

    // 2. Count of matched records by status
    const statusCounts = await query(
      `SELECT review_status, COUNT(*) as count 
       FROM enrichment_matches 
       GROUP BY review_status`
    );

    const counts = {
      auto_accept: 0,
      manual_review: 0,
      rejected: 0,
      approved: 0
    };

    statusCounts.forEach(row => {
      if (counts[row.review_status] !== undefined) {
        counts[row.review_status] = row.count;
      }
    });

    // 3. Last job statistics (download counts, etc.)
    const lastJobs = await query('SELECT * FROM enrichment_jobs ORDER BY created_at DESC LIMIT 1');
    const lastJob = lastJobs.length > 0 ? lastJobs[0] : null;

    const matchedProducts = counts.auto_accept + counts.approved;
    const unmatchedProducts = counts.rejected;
    const pendingReview = counts.manual_review;

    return getResponse({
      ok: true,
      stats: {
        totalProducts,
        matchedProducts,
        unmatchedProducts,
        pendingReview,
        imagesDownloaded: lastJob ? lastJob.images_downloaded : 0,
        imagesFailed: lastJob ? lastJob.images_failed : 0,
        lastJobStatus: lastJob ? lastJob.status : 'idle',
        lastJobId: lastJob ? lastJob.id : null,
      }
    });
  } catch (error) {
    return getResponse({ ok: false, error: error.message }, 500);
  }
}

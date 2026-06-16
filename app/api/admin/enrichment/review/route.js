import { NextResponse } from 'next/server';
import { verifyToken, getBearer } from '@/lib/auth.js';
import { query } from '@/lib/mysql.js';
import { uploadLocalImage } from '@/lib/enrichment/cloudinary.js';
import fs from 'fs';
import path from 'path';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

// GET /api/admin/enrichment/review - Fetch pending manual reviews
export async function GET(req) {
  if (!checkAdmin(req)) {
    return getResponse({ ok: false, error: 'Admin access required' }, 403);
  }

  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get('limit') || '20', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  try {
    const items = await query(
      `SELECT * FROM enrichment_matches 
       WHERE review_status = 'manual_review' 
       ORDER BY confidence_score DESC 
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const [{ total }] = await query(
      "SELECT COUNT(*) as total FROM enrichment_matches WHERE review_status = 'manual_review'"
    );

    return getResponse({ ok: true, items, total, limit, offset });
  } catch (error) {
    return getResponse({ ok: false, error: error.message }, 500);
  }
}

// POST /api/admin/enrichment/review - Approve or Reject a candidate match
export async function POST(req) {
  if (!checkAdmin(req)) {
    return getResponse({ ok: false, error: 'Admin access required' }, 403);
  }

  try {
    const body = await req.json();
    const { matchId, action } = body; // action is 'approve' or 'reject'

    if (!matchId || !['approve', 'reject'].includes(action)) {
      return getResponse({ ok: false, error: 'Invalid parameters. Need matchId and action ("approve" or "reject")' }, 400);
    }

    const matches = await query('SELECT * FROM enrichment_matches WHERE id = ?', [matchId]);
    if (matches.length === 0) {
      return getResponse({ ok: false, error: 'Match record not found' }, 404);
    }

    const match = matches[0];

    if (action === 'reject') {
      await query(
        "UPDATE enrichment_matches SET review_status = 'rejected', updated_at = NOW() WHERE id = ?",
        [matchId]
      );
      return getResponse({ ok: true, message: 'Match successfully rejected' });
    }

    // Approve matching logic: Download image, upload to Cloudinary, update products table
    let cloudinaryUrl = null;
    const rawUrls = match.matched_image_urls ? match.matched_image_urls.split('|').map(u => u.trim()).filter(Boolean) : [];
    const imageUrl = rawUrls[0]; // primary image

    if (imageUrl) {
      const basePath = process.cwd();
      const tempFolder = path.join(basePath, 'public', 'images', 'pending_enrichment');
      if (!fs.existsSync(tempFolder)) {
        fs.mkdirSync(tempFolder, { recursive: true });
      }

      const fileExt = path.extname(new URL(imageUrl).pathname) || '.jpg';
      const fileName = `approved_${match.source_product_id}${fileExt}`;
      const localPath = path.join(tempFolder, fileName);

      try {
        // 1. Download
        const response = await fetch(imageUrl);
        if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        fs.writeFileSync(localPath, Buffer.from(arrayBuffer));

        // 2. Upload to Cloudinary
        cloudinaryUrl = await uploadLocalImage(localPath);

        // 3. Clean local file
        if (fs.existsSync(localPath)) {
          fs.unlinkSync(localPath);
        }
      } catch (err) {
        console.error('[MANUAL REVIEW IMAGE ERROR]', err);
        // We will still allow approval, but without image url
      }
    }

    // 4. Update the products database table
    await query(
      `UPDATE products 
       SET description = ?, composition = ?, category = ?, manufacturer = ? ${cloudinaryUrl ? ', image_url = ?' : ''} 
       WHERE id = ?`,
      cloudinaryUrl 
        ? [match.matched_description, match.matched_composition, match.matched_category, match.matched_manufacturer, cloudinaryUrl, match.source_product_id]
        : [match.matched_description, match.matched_composition, match.matched_category, match.matched_manufacturer, match.source_product_id]
    );

    // 5. Mark match as approved in matches table
    await query(
      "UPDATE enrichment_matches SET review_status = 'approved', updated_at = NOW() WHERE id = ?",
      [matchId]
    );

    return getResponse({ ok: true, message: 'Match successfully approved and database updated', imageUrl: cloudinaryUrl });
  } catch (error) {
    return getResponse({ ok: false, error: error.message }, 500);
  }
}

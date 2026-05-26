import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';

export async function GET(req) {
  try {
    // API key auth — set EXPORT_API_KEY in .env.local
    const expectedKey = process.env.EXPORT_API_KEY;
    if (!expectedKey) {
      return NextResponse.json({ error: 'Export not configured. Set EXPORT_API_KEY in environment.' }, { status: 503 });
    }

    const { searchParams } = new URL(req.url);
    const apiKey = req.headers.get('x-api-key') || searchParams.get('apiKey');
    if (apiKey !== expectedKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDb();
    const products = await db
      .collection('products')
      .find({}, {
        projection: {
          _id: 0,
          id: 1,
          name: 1,
          brand: 1,
          category: 1,
          subcategory: 1,
          price: 1,
          mrp: 1,
          stock: 1,
          packSize: 1,
          prescription: 1,
          variants: 1,
          updatedAt: 1,
        },
      })
      .sort({ name: 1 })
      .toArray();

    const exportedAt = new Date().toISOString();
    const format = searchParams.get('format');

    // CSV format
    if (format === 'csv') {
      const rows = [];
      for (const p of products) {
        if (p.variants?.length) {
          for (const v of p.variants) {
            rows.push([
              p.id, p.name, p.brand, p.category, p.subcategory ?? '',
              v.packSize || p.packSize, v.price ?? p.price, v.mrp ?? p.mrp,
              v.stock ?? p.stock, p.prescription ? 'yes' : 'no', exportedAt,
            ]);
          }
        } else {
          rows.push([
            p.id, p.name, p.brand, p.category, p.subcategory ?? '',
            p.packSize, p.price, p.mrp, p.stock,
            p.prescription ? 'yes' : 'no', exportedAt,
          ]);
        }
      }

      const header = 'id,name,brand,category,subcategory,packSize,price,mrp,stock,prescription,exportedAt';
      const csv = [header, ...rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="stock-${exportedAt.slice(0, 10)}.csv"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    // Default: JSON
    return NextResponse.json({
      ok: true,
      exportedAt,
      count: products.length,
      products,
    }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

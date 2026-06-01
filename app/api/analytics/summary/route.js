import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';
import { verifyToken, getBearer } from '@/lib/auth';

export async function GET(req) {
  try {
    // Verify admin access
    const token = getBearer(req);
    const data = verifyToken(token);
    if (!data) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = await getDb();
    const user = await db.collection('users').findOne({ id: data.uid });
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const collection = db.collection('analytics_out_of_range');

    // Total out-of-range views
    const totalOutOfRange = await collection.countDocuments();

    // Last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const last7Days = await collection.countDocuments({ timestamp: { $gte: sevenDaysAgo } });

    // Last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const last30Days = await collection.countDocuments({ timestamp: { $gte: thirtyDaysAgo } });

    // Distance distribution (how far are they)
    const distanceStats = await collection.aggregate([
      {
        $group: {
          _id: null,
          avgDistance: { $avg: '$distance' },
          maxDistance: { $max: '$distance' },
          minDistance: { $min: '$distance' },
          count: { $sum: 1 },
        },
      },
    ]).toArray();

    const stats = distanceStats[0] || { avgDistance: 0, maxDistance: 0, minDistance: 0, count: 0 };

    // Distance buckets (10-20km, 20-30km, 30+km)
    const buckets = await collection.aggregate([
      {
        $bucket: {
          groupBy: '$distance',
          boundaries: [10, 20, 30, 50, 100],
          default: '100+',
          count: { $sum: 1 },
        },
      },
    ]).toArray();

    // Top cities (approximate based on lat/lng)
    const topLocations = await collection.aggregate([
      {
        $group: {
          _id: {
            lat: { $round: ['$lat', 1] },
            lng: { $round: ['$lng', 1] },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]).toArray();

    return NextResponse.json({
      totalOutOfRange,
      last7Days,
      last30Days,
      avgDistance: Math.round(stats.avgDistance * 10) / 10,
      maxDistance: Math.round(stats.maxDistance * 10) / 10,
      minDistance: Math.round(stats.minDistance * 10) / 10,
      distanceBuckets: buckets.map(b => ({
        range: b._id === '100+' ? '100+ km' : `${b._id}-${b._id + 10} km`,
        count: b.count,
      })),
      topLocations: topLocations.map(loc => ({
        lat: loc._id.lat,
        lng: loc._id.lng,
        count: loc.count,
      })),
    });
  } catch (error) {
    console.error('Analytics summary error:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}

'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { BarChart3, TrendingUp, MapPin, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

const AnalyticsPage = () => {
  const router = useRouter();
  const { user } = useAuth() || {};
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    const fetchAnalytics = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const res = await fetch('/api/analytics/summary', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok) setAnalytics(data);
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [user, router]);

  if (loading) {
    return (
      <div className="container max-w-7xl mx-auto px-4 py-10">
        <div className="text-center text-slate-500">Loading analytics...</div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="container max-w-7xl mx-auto px-4 py-10">
        <div className="text-center text-slate-500">No analytics data available</div>
      </div>
    );
  }

  return (
    <div className="container max-w-7xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900">Out-of-Range Analytics</h1>
        <p className="text-slate-600 mt-2">Customers viewing from beyond 10 km delivery range</p>
      </div>

      {/* Key Metrics */}
      <div className="grid md:grid-cols-4 gap-4 mb-8">
        <MetricCard
          icon={Users}
          label="Total Out-of-Range Views"
          value={analytics.totalOutOfRange}
          color="blue"
        />
        <MetricCard
          icon={TrendingUp}
          label="Last 7 Days"
          value={analytics.last7Days}
          color="emerald"
        />
        <MetricCard
          icon={TrendingUp}
          label="Last 30 Days"
          value={analytics.last30Days}
          color="teal"
        />
        <MetricCard
          icon={MapPin}
          label="Avg Distance"
          value={`${analytics.avgDistance} km`}
          color="amber"
        />
      </div>

      {/* Distance Stats */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-teal-600" />
            Distance Distribution
          </h3>
          <div className="space-y-3">
            {analytics.distanceBuckets.map((bucket, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-slate-700">{bucket.range}</span>
                  <span className="text-sm font-bold text-slate-900">{bucket.count}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-teal-500 to-emerald-500 h-2 rounded-full"
                    style={{
                      width: `${(bucket.count / Math.max(...analytics.distanceBuckets.map(b => b.count))) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-teal-600" />
            Distance Range
          </h3>
          <div className="space-y-3">
            <StatRow label="Minimum Distance" value={`${analytics.minDistance} km`} />
            <StatRow label="Average Distance" value={`${analytics.avgDistance} km`} />
            <StatRow label="Maximum Distance" value={`${analytics.maxDistance} km`} />
            <div className="border-t border-slate-100 pt-3 mt-3">
              <StatRow label="Delivery Radius" value="10 km" highlight />
            </div>
          </div>
        </div>
      </div>

      {/* Top Locations */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-teal-600" />
          Top Out-of-Range Locations
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 font-semibold text-slate-700">Latitude</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">Longitude</th>
                <th className="text-right py-3 px-4 font-semibold text-slate-700">Views</th>
                <th className="text-right py-3 px-4 font-semibold text-slate-700">% of Total</th>
              </tr>
            </thead>
            <tbody>
              {analytics.topLocations.map((loc, i) => (
                <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 px-4 text-slate-900 font-medium">{loc.lat}</td>
                  <td className="py-3 px-4 text-slate-900 font-medium">{loc.lng}</td>
                  <td className="py-3 px-4 text-right text-slate-900 font-bold">{loc.count}</td>
                  <td className="py-3 px-4 text-right text-slate-600">
                    {((loc.count / analytics.totalOutOfRange) * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Insights */}
      <div className="mt-8 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl border border-blue-200 p-6">
        <h3 className="font-bold text-slate-900 mb-3">📊 Insights</h3>
        <ul className="space-y-2 text-sm text-slate-700">
          <li>✅ <strong>{analytics.totalOutOfRange}</strong> customers have checked delivery from outside your 10 km range</li>
          <li>✅ Average distance: <strong>{analytics.avgDistance} km</strong> (max: <strong>{analytics.maxDistance} km</strong>)</li>
          <li>✅ <strong>{analytics.last30Days}</strong> out-of-range views in the last 30 days</li>
          <li>✅ Consider expanding delivery radius or opening new pickup locations in high-demand areas</li>
        </ul>
      </div>
    </div>
  );
};

const MetricCard = ({ icon: Icon, label, value, color }) => {
  const colorMap = {
    blue: 'from-blue-500 to-cyan-500',
    emerald: 'from-emerald-500 to-teal-500',
    teal: 'from-teal-500 to-emerald-500',
    amber: 'from-amber-500 to-orange-500',
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colorMap[color]} text-white flex items-center justify-center mb-3`}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="text-xs text-slate-600 font-semibold mb-1">{label}</div>
      <div className="text-2xl font-black text-slate-900">{value}</div>
    </div>
  );
};

const StatRow = ({ label, value, highlight }) => (
  <div className="flex items-center justify-between">
    <span className={`text-sm ${highlight ? 'font-bold text-slate-900' : 'text-slate-600'}`}>{label}</span>
    <span className={`text-sm font-bold ${highlight ? 'text-teal-700' : 'text-slate-900'}`}>{value}</span>
  </div>
);

export default AnalyticsPage;

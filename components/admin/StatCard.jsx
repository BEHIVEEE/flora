import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

const StatCard = ({ icon: Icon, label, value, sub, accent = 'teal', delta }) => {
  const accents = {
    teal: 'bg-teal-50 text-teal-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-600',
    blue: 'bg-blue-50 text-blue-700',
    violet: 'bg-violet-50 text-violet-700',
  };
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-lift transition-shadow">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</div>
          <div className="text-2xl md:text-3xl font-black text-slate-900 mt-2 leading-none tracking-tight">{value}</div>
          {sub && <div className="text-xs text-slate-500 mt-1.5">{sub}</div>}
          {delta !== undefined && (
            <div className={`mt-2 inline-flex items-center gap-0.5 text-xs font-bold ${delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {delta >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {Math.abs(delta)}%
            </div>
          )}
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${accents[accent]}`}><Icon className="w-5 h-5" /></div>
      </div>
    </div>
  );
};

export default StatCard;

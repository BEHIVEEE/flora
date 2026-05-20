import { ProductGridSkeleton } from '@/components/skeletons';

const Loading = () => (
  <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">
    <div className="h-8 w-1/3 skeleton rounded" />
    <div className="h-4 w-1/2 skeleton rounded" />
    <div className="grid lg:grid-cols-[260px_1fr] gap-5">
      <div className="hidden lg:block bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-4 w-full skeleton rounded" />)}
      </div>
      <ProductGridSkeleton count={16} />
    </div>
  </div>
);

export default Loading;

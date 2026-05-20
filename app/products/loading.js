import { ProductGridSkeleton } from '@/components/skeletons';

const Loading = () => (
  <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
    <div className="h-7 w-48 skeleton rounded" />
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-8 w-24 skeleton rounded-full" />)}
    </div>
    <ProductGridSkeleton count={16} />
  </div>
);

export default Loading;

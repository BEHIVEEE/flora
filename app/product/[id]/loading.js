import { ProductGridSkeleton } from '@/components/skeletons';

const Loading = () => (
  <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
    <div className="grid md:grid-cols-2 gap-6 lg:gap-10">
      <div className="aspect-square rounded-2xl skeleton" />
      <div className="space-y-3">
        <div className="h-4 w-24 skeleton rounded" />
        <div className="h-7 w-3/4 skeleton rounded" />
        <div className="h-4 w-1/3 skeleton rounded" />
        <div className="h-10 w-1/2 skeleton rounded mt-4" />
        <div className="h-20 w-full skeleton rounded mt-4" />
        <div className="flex gap-2 mt-4">
          <div className="h-12 w-32 skeleton rounded-full" />
          <div className="h-12 flex-1 skeleton rounded-full" />
        </div>
      </div>
    </div>
    <div>
      <div className="h-6 w-40 skeleton rounded mb-3" />
      <ProductGridSkeleton count={5} />
    </div>
  </div>
);

export default Loading;

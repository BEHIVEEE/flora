import { ProductGridSkeleton, CategoryRowSkeleton } from '@/components/skeletons';

const Loading = () => (
  <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">
    <div className="rounded-3xl skeleton h-48 md:h-64 w-full" />
    <div>
      <div className="h-6 w-40 skeleton rounded mb-3" />
      <CategoryRowSkeleton />
    </div>
    <div>
      <div className="h-6 w-48 skeleton rounded mb-3" />
      <ProductGridSkeleton count={10} />
    </div>
  </div>
);

export default Loading;

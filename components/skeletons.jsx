// Reusable skeleton building blocks. Uses .skeleton class from globals.css.

export const SkeletonBox = ({ className = '' }) => (
  <div className={`skeleton rounded-lg ${className}`} />
);

export const ProductCardSkeleton = () => (
  <div className="bg-white border border-slate-200 rounded-2xl p-3 flex flex-col">
    <div className="aspect-square rounded-xl skeleton mb-3" />
    <div className="h-3 w-1/3 skeleton rounded mb-2" />
    <div className="h-4 w-4/5 skeleton rounded mb-1.5" />
    <div className="h-3 w-1/2 skeleton rounded mb-3" />
    <div className="flex items-center justify-between mt-auto">
      <div className="h-5 w-16 skeleton rounded" />
      <div className="h-8 w-16 skeleton rounded-full" />
    </div>
  </div>
);

export const ProductGridSkeleton = ({ count = 12 }) => (
  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
    {Array.from({ length: count }).map((_, i) => <ProductCardSkeleton key={i} />)}
  </div>
);

export const CategoryRowSkeleton = () => (
  <div className="flex gap-3 overflow-hidden">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="shrink-0 w-24 flex flex-col items-center gap-2">
        <div className="w-16 h-16 rounded-2xl skeleton" />
        <div className="h-3 w-16 skeleton rounded" />
      </div>
    ))}
  </div>
);

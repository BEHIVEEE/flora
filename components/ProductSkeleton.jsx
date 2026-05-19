const ProductSkeleton = () => (
  <div className="bg-white border border-slate-200 rounded-2xl p-3">
    <div className="aspect-square rounded-xl skeleton mb-3" />
    <div className="h-3 w-1/3 skeleton rounded mb-2" />
    <div className="h-4 w-full skeleton rounded mb-1.5" />
    <div className="h-4 w-2/3 skeleton rounded mb-3" />
    <div className="flex justify-between"><div className="h-5 w-16 skeleton rounded" /><div className="h-9 w-9 skeleton rounded-full" /></div>
  </div>
);

export default ProductSkeleton;

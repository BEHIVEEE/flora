const Loading = () => (
  <div className="space-y-5">
    <div className="h-8 w-48 skeleton rounded" />
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 skeleton rounded-2xl" />)}
    </div>
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="h-72 skeleton rounded-2xl" />
      <div className="h-72 skeleton rounded-2xl" />
    </div>
  </div>
);

export default Loading;

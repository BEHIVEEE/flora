const Loading = () => (
  <div className="max-w-5xl mx-auto px-4 py-6 grid lg:grid-cols-[1fr_360px] gap-5">
    <div className="space-y-3">
      <div className="h-7 w-32 skeleton rounded" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-white border border-slate-200 rounded-2xl p-4 flex gap-3">
          <div className="w-20 h-20 skeleton rounded-xl shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 skeleton rounded" />
            <div className="h-3 w-1/3 skeleton rounded" />
            <div className="h-8 w-32 skeleton rounded-full" />
          </div>
        </div>
      ))}
    </div>
    <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 h-fit">
      <div className="h-5 w-32 skeleton rounded" />
      {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-4 w-full skeleton rounded" />)}
      <div className="h-12 w-full skeleton rounded-full mt-3" />
    </div>
  </div>
);

export default Loading;

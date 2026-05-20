const Loading = () => (
  <div className="max-w-5xl mx-auto px-4 py-6 grid lg:grid-cols-[1fr_360px] gap-5">
    <div className="space-y-3">
      <div className="h-7 w-40 skeleton rounded" />
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-11 w-full skeleton rounded-xl" />)}
      </div>
    </div>
    <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 h-fit">
      <div className="h-5 w-32 skeleton rounded" />
      {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-4 w-full skeleton rounded" />)}
      <div className="h-12 w-full skeleton rounded-full mt-3" />
    </div>
  </div>
);

export default Loading;

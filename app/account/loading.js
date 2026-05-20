const Loading = () => (
  <div className="max-w-6xl mx-auto px-4 py-6 grid md:grid-cols-[240px_1fr] gap-5">
    <div className="bg-white border border-slate-200 rounded-2xl p-3 space-y-2 h-fit">
      {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 w-full skeleton rounded-xl" />)}
    </div>
    <div className="space-y-3">
      <div className="h-7 w-40 skeleton rounded" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
          <div className="h-4 w-1/2 skeleton rounded" />
          <div className="h-3 w-3/4 skeleton rounded" />
        </div>
      ))}
    </div>
  </div>
);

export default Loading;

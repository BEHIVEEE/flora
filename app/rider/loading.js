const Loading = () => (
  <div className="min-h-screen bg-slate-50">
    <div className="bg-gradient-to-br from-teal-600 to-emerald-600 h-32" />
    <div className="max-w-3xl mx-auto px-4 py-4 space-y-3">
      <div className="h-9 w-60 skeleton rounded-full" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
          <div className="h-4 w-1/3 skeleton rounded" />
          <div className="h-3 w-3/4 skeleton rounded" />
          <div className="h-3 w-1/2 skeleton rounded" />
        </div>
      ))}
    </div>
  </div>
);

export default Loading;

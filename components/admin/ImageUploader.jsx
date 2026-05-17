'use client';
import { useRef, useState } from 'react';
import { Upload, X, Star } from 'lucide-react';
import { toast } from 'sonner';

const ImageUploader = ({ images = [], onChange, max = 6 }) => {
  const fileRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const readFiles = (files) => {
    const remaining = max - images.length;
    const toRead = Array.from(files).slice(0, remaining);
    if (toRead.length === 0) { toast.error(`Max ${max} images allowed`); return; }
    const promises = toRead.map(f => new Promise((resolve, reject) => {
      if (f.size > 4 * 1024 * 1024) { toast.error(`${f.name}: too large (max 4MB)`); return reject(); }
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(f);
    }));
    Promise.allSettled(promises).then(results => {
      const next = [...images];
      results.forEach(r => { if (r.status === 'fulfilled') next.push(r.value); });
      onChange(next);
    });
  };

  const remove = (i) => onChange(images.filter((_, idx) => idx !== i));
  const makePrimary = (i) => {
    const next = [...images]; const [item] = next.splice(i, 1); next.unshift(item);
    onChange(next);
  };

  const onDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    if (e.dataTransfer.files?.length) readFiles(e.dataTransfer.files);
  };

  return (
    <div>
      <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
        {images.map((src, i) => (
          <div key={i} className="group relative aspect-square rounded-xl border-2 border-slate-200 bg-slate-50 overflow-hidden">
            <img src={src} alt={`upload-${i}`} className="w-full h-full object-cover" />
            {i === 0 && <span className="absolute top-1.5 left-1.5 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded inline-flex items-center gap-0.5"><Star className="w-2.5 h-2.5 fill-white" /> Main</span>}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center gap-2 transition-colors">
              {i !== 0 && <button type="button" onClick={() => makePrimary(i)} title="Make main" className="opacity-0 group-hover:opacity-100 bg-white text-slate-800 text-[10px] font-bold px-2 py-1 rounded-md shadow">Set Main</button>}
              <button type="button" onClick={() => remove(i)} title="Remove" className="opacity-0 group-hover:opacity-100 bg-rose-500 text-white text-[10px] font-bold p-1.5 rounded-md shadow"><X className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
        {images.length < max && (
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${dragOver ? 'border-teal-500 bg-teal-50' : 'border-slate-300 hover:border-teal-400 hover:bg-teal-50/30'}`}
          >
            <Upload className="w-6 h-6 text-slate-400 mb-1.5" />
            <div className="text-xs font-semibold text-slate-700">Upload</div>
            <div className="text-[10px] text-slate-500">Drag or click</div>
          </div>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => readFiles(e.target.files)} />
      <div className="mt-2 text-xs text-slate-500">{images.length} / {max} images · JPG, PNG, WEBP · max 4MB each. The first image is shown as the product cover.</div>
    </div>
  );
};

export default ImageUploader;

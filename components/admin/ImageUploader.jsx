'use client';
import { useRef, useState, useCallback } from 'react';
import { Upload, X, Star, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

const ImageUploader = ({ images = [], onChange, max = 6, folder = 'chemistshop/products' }) => {
  const fileRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState({}); // { [previewUrl]: true }

  const getAuthHeader = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('cs_token') : '';
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const readFileAsDataURL = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const uploadToCloudinary = async (dataUrl, fileName) => {
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ image: dataUrl, fileName, folder }),
    });
    const d = await res.json();
    if (!d.ok) throw new Error(d.error || 'Upload failed');
    return d.url;
  };

  const processFiles = async (files) => {
    const remaining = max - images.length;
    const toProcess = Array.from(files).slice(0, remaining);
    if (toProcess.length === 0) { toast.error(`Max ${max} images allowed`); return; }

    for (const file of toProcess) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error(`${file.name}: Only JPG, PNG, WEBP allowed`); continue;
      }
      if (file.size > MAX_SIZE) {
        toast.error(`${file.name}: Max 2MB`); continue;
      }

      const previewUrl = URL.createObjectURL(file);
      setUploading(prev => ({ ...prev, [previewUrl]: true }));

      try {
        const dataUrl = await readFileAsDataURL(file);
        const cloudinaryUrl = await uploadToCloudinary(dataUrl, file.name);
        onChange(prev => [...prev, cloudinaryUrl]);
      } catch (e) {
        toast.error(e.message || `Failed to upload ${file.name}`);
      } finally {
        URL.revokeObjectURL(previewUrl);
        setUploading(prev => { const next = { ...prev }; delete next[previewUrl]; return next; });
      }
    }
  };

  const remove = (i) => onChange(images.filter((_, idx) => idx !== i));
  const makePrimary = (i) => {
    const next = [...images]; const [item] = next.splice(i, 1); next.unshift(item);
    onChange(next);
  };

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragOver(false);
    if (e.dataTransfer.files?.length) processFiles(e.dataTransfer.files);
  }, [images]);

  // Combine real URLs with temporary preview URLs for display
  const displayItems = [
    ...images.map(url => ({ type: 'url', value: url })),
    ...Object.keys(uploading).map(preview => ({ type: 'uploading', value: preview })),
  ];

  return (
    <div>
      <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
        {displayItems.map((item, i) => (
          <div key={item.value + i} className="group relative aspect-square rounded-xl border-2 border-slate-200 bg-slate-50 overflow-hidden">
            <img src={item.value} alt={`img-${i}`} className="w-full h-full object-cover" />
            {item.type === 'uploading' && (
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              </div>
            )}
            {item.type === 'url' && i === 0 && (
              <span className="absolute top-1.5 left-1.5 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded inline-flex items-center gap-0.5">
                <Star className="w-2.5 h-2.5 fill-white" /> Main
              </span>
            )}
            {item.type === 'url' && (
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center gap-2 transition-colors">
                {i !== 0 && (
                  <button type="button" onClick={() => makePrimary(i)} title="Make main"
                    className="opacity-0 group-hover:opacity-100 bg-white text-slate-800 text-[10px] font-bold px-2 py-1 rounded-md shadow">
                    Set Main
                  </button>
                )}
                <button type="button" onClick={() => remove(i)} title="Remove"
                  className="opacity-0 group-hover:opacity-100 bg-rose-500 text-white text-[10px] font-bold p-1.5 rounded-md shadow">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
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
            <div className="text-[10px] text-slate-500">JPG, PNG, WEBP</div>
          </div>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={e => { processFiles(e.target.files); e.target.value = ''; }} />
      <div className="mt-2 text-xs text-slate-500">{images.length} / {max} images · Max 2MB each · First image is the product cover</div>
    </div>
  );
};

export default ImageUploader;

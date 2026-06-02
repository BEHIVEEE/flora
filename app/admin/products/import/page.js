'use client';
import { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Upload, FileText, Check, X, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const BATCH_SIZE = 200; // Smaller batches to avoid serverless timeouts, especially on slow networks

const CSV_HEADERS = ['name', 'brand', 'category', 'subcategory', 'price', 'mrp', 'stock', 'packSize', 'description', 'prescription', 'imageUrl'];
const SAMPLE = `name,brand,category,subcategory,price,mrp,stock,packSize,description,prescription,imageUrl
Paracetamol 500mg,Generic,allopathic-medicines,,18,22,200,Strip of 10 tablets,Fever and pain relief,false,https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=600
Tynor Knee Cap,Tynor,orthopedic-products,,450,599,30,Pair,Knee support brace,false,https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=600
Pedigree Adult Dog Food,Pedigree,pet-food,,899,999,50,3kg pack,Complete nutrition for adult dogs,false,https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=600
Walker Chair Folding,Vissco,mobility-aids,walker-chair,3499,4500,15,1 unit,Folding walker chair with seat,false,https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=600`;

function parseCSVRow(line) {
  const out = []; let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; continue; }
    if (c === ',' && !inQ) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  out.push(cur);
  return out.map(s => s.trim());
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = parseCSVRow(lines[0]).map(h => h.replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map(line => {
    const vals = parseCSVRow(line);
    const obj = {};
    headers.forEach((h, i) => obj[h] = (vals[i] || '').replace(/^"|"$/g, ''));
    return obj;
  });
  return { headers, rows };
}

// Auto-detect and remap distributor invoice CSVs (Marg ERP, KMA, Logic ERP, etc.)
// to our product schema. Returns { format, rows } with rows in our standard shape.
function detectAndNormalize(parsed) {
  if (!parsed?.rows?.length) return { format: 'standard', rows: [] };
  const headers = parsed.headers.map(h => h.toLowerCase());
  const has = (h) => headers.includes(h.toLowerCase());

  // Distributor invoice format detection (KMA / Marg-style)
  const isDistributor = has('ProductDesc') || has('MRP') && has('PTR') && (has('Manufacturer') || has('MfgrNick'));

  if (!isDistributor) return { format: 'standard', rows: parsed.rows };

  const rows = parsed.rows
    .filter(r => (r.ProductDesc || '').trim()) // skip blank / footer rows
    .map(r => {
      // Aggregate stock = Qty + Free
      const qty = Number(r.Qty) || 0;
      const free = Number(r.Free) || 0;
      const stock = qty + free;
      // PTR (price to retailer / per-unit purchase) is per-strip, not per-unit. Use MRP as customer price.
      const mrp = Number(r.MRP) || 0;
      // Default selling price = MRP minus 10% discount (rounded)
      const price = mrp ? Math.max(1, Math.round(mrp * 0.9)) : Number(r.PTR) || 0;
      return {
        name: (r.ProductDesc || '').trim(),
        brand: (r.Manufacturer || r.MfgrNick || 'Generic').trim(),
        manufacturer: (r.Manufacturer || '').trim(),
        category: 'allopathic-medicines', // distributor pharma assumed allopathic
        subcategory: '',
        price,
        mrp,
        stock,
        packSize: (r.PPack || '').trim(),
        description: `Batch ${r.BatchNo || '-'} · Expiry ${r.ExpDate || '-'} · HSN ${r.HSNCode || '-'}`,
        prescription: 'true',
        imageUrl: '',
        // Extras (preserved on product)
        batchNo: r.BatchNo || '',
        expDate: r.ExpDate || '',
        hsnCode: r.HSNCode || '',
        barcode: r.Barcode || '',
      };
    });

  return { format: 'distributor', rows };
}

// Map many common header variants to our canonical field names
const HEADER_ALIASES = {
  // name
  'name': 'name', 'product': 'name', 'product name': 'name', 'productname': 'name', 'item': 'name', 'item name': 'name', 'title': 'name',
  // brand / manufacturer
  'brand': 'brand', 'brand name': 'brand', 'mfg': 'brand', 'mfr': 'brand', 'manufacturer': 'manufacturer', 'company': 'brand',
  // categories
  'category': 'category', 'cat': 'category', 'maincategory': 'category', 'main category': 'category',
  'subcategory': 'subcategory', 'sub category': 'subcategory', 'sub_category': 'subcategory', 'sub cat': 'subcategory',
  // pricing
  'price': 'price', 'sellingprice': 'price', 'selling price': 'price', 'sp': 'price',
  'mrp': 'mrp', 'max retail price': 'mrp', 'mrp (rs)': 'mrp',
  // stock
  'stock': 'stock', 'qty': 'stock', 'quantity': 'stock', 'available': 'stock', 'inventory': 'stock', 'closing stock': 'stock',
  // packaging
  'packsize': 'packSize', 'pack size': 'packSize', 'pack_size': 'packSize', 'pack': 'packSize', 'ppack': 'packSize', 'packaging': 'packSize',
  // description
  'description': 'description', 'desc': 'description', 'details': 'description',
  // prescription flag
  'prescription': 'prescription', 'rx': 'prescription', 'requires prescription': 'prescription', 'isrx': 'prescription',
  // image url
  'image': 'imageUrl', 'imageurl': 'imageUrl', 'image url': 'imageUrl', 'img': 'imageUrl', 'photo': 'imageUrl', 'picture': 'imageUrl', 'image link': 'imageUrl',
};

function canonicalizeStandardRows(raw) {
  if (!raw?.rows?.length) return [];
  return raw.rows.map((row) => {
    const out = {};
    // Map keys case-insensitively using aliases
    Object.entries(row).forEach(([k, v]) => {
      const lk = String(k || '').trim().toLowerCase();
      const dest = HEADER_ALIASES[lk] || lk;
      if (dest) out[dest] = v;
    });
    // Fallbacks
    if (!out.price && out.mrp) out.price = out.mrp; // if price missing, use mrp
    if (typeof out.prescription !== 'undefined') {
      const pv = String(out.prescription).trim().toLowerCase();
      out.prescription = pv === 'true' || pv === 'yes' || pv === '1';
    }
    // Trim strings
    CSV_HEADERS.forEach((h) => { if (out[h] && typeof out[h] === 'string') out[h] = out[h].trim(); });
    return out;
  });
}

const Import = () => {
  const router = useRouter();
  const fileRef = useRef(null);
  const [parsed, setParsed] = useState(null); // {headers, rows, format}
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [categories, setCategories] = useState([]);
  const [progress, setProgress] = useState(null); // { current, total, currentBatch }

  useEffect(() => {
    fetch('/api/categories').then(r => r.json()).then(d => setCategories(d.categories || []));
  }, []);

  const handleFile = async (f) => {
    if (!f) return;
    const isExcel = /\.(xlsx|xls)$/i.test(f.name);
    if (isExcel) {
      try {
        const data = await f.arrayBuffer();
        const XLSXLib = await import('xlsx');
        const XLSX = XLSXLib?.default || XLSXLib;
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rowsA = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        const headers = (rowsA[0] || []).map(h => String(h || '').trim());
        const rows = rowsA.slice(1).map((arr) => {
          const obj = {};
          headers.forEach((h, i) => { obj[h] = arr[i]; });
          return obj;
        });
        const raw = { headers, rows };
        const { format, rows: normRows } = detectAndNormalize(raw);
        const finalRows = format === 'distributor' ? normRows : canonicalizeStandardRows(raw);
        setParsed({ headers: CSV_HEADERS, rows: finalRows, format });
        if (format === 'distributor') {
          toast.success(`Detected distributor invoice format · ${finalRows.length} products mapped`);
        } else {
          toast.success(`Excel parsed · ${finalRows.length} rows`);
        }
      } catch (err) {
        console.error('Excel parse error', err);
        toast.error('Failed to read Excel file. Please upload CSV or a simpler Excel file.');
      }
      return;
    }

    // Fallback: CSV
    const reader = new FileReader();
    reader.onload = (e) => {
      const raw = parseCSV(e.target.result);
      const { format, rows } = detectAndNormalize(raw);
      const finalRows = format === 'distributor' ? rows : canonicalizeStandardRows(raw);
      setParsed({ headers: CSV_HEADERS, rows: finalRows, format });
      if (format === 'distributor') {
        toast.success(`Detected distributor invoice format · ${finalRows.length} products mapped`);
      }
    };
    reader.readAsText(f);
  };

  const findCat = (val) => {
    if (!val) return null;
    const v = String(val).trim().toLowerCase();
    return categories.find(c =>
      c.id === val ||
      c.slug?.toLowerCase() === v ||
      c.name?.toLowerCase() === v
    );
  };

  const validate = (row) => {
    const errors = [];
    if (!row.name) errors.push('Missing name');
    // Category is optional; server will fall back to existing IDs or default
    if (!row.price && !row.mrp) errors.push('Missing price/MRP');
    if (row.price && isNaN(Number(row.price))) errors.push('Invalid price');
    if (row.mrp && isNaN(Number(row.mrp))) errors.push('Invalid MRP');
    if (row.stock !== '' && row.stock != null && isNaN(Number(row.stock))) errors.push('Invalid stock');
    return errors;
  };

  const downloadSample = () => {
    const blob = new Blob([SAMPLE], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'chemistshop-products-sample.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const submit = async () => {
    if (!parsed?.rows?.length) return;
    const valid = parsed.rows.filter(r => validate(r).length === 0);
    if (valid.length === 0) { toast.error('No valid rows to import'); return; }
    
    const totalBatches = Math.ceil(valid.length / BATCH_SIZE);
    const totalProducts = valid.length;
    let allResults = { created: 0, failed: 0, errors: [] };
    
    setImporting(true);
    setProgress({ current: 0, total: totalProducts, currentBatch: 1, totalBatches });
    
    // Process in batches
    for (let i = 0; i < valid.length; i += BATCH_SIZE) {
      const batch = valid.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      
      setProgress({ 
        current: Math.min(i + batch.length, totalProducts), 
        total: totalProducts, 
        currentBatch: batchNum,
        totalBatches 
      });
      
      try {
        const res = await fetch('/api/products/bulk', { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ products: batch }) 
        });
        const d = await res.json();
        allResults.created += d.created || 0;
        allResults.failed += d.failed || 0;
        if (d.errors?.length) allResults.errors.push(...d.errors);
      } catch (err) {
        allResults.failed += batch.length;
        allResults.errors.push(`Batch ${batchNum} failed: ${err.message}`);
      }
      
      // Small delay between batches to avoid overwhelming the server
      if (i + BATCH_SIZE < valid.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }
    
    setResult(allResults);
    setProgress(null);
    setImporting(false);
    toast.success(`${allResults.created} products imported`);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/admin/products"><Button variant="ghost" size="icon" className="rounded-full"><ChevronLeft className="w-5 h-5" /></Button></Link>
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Bulk Import Products</h1>
          <p className="text-slate-500 text-sm mt-0.5">Upload a CSV file to add products. Supports up to 100,000+ products with batch processing.</p>
        </div>
        <Button variant="outline" onClick={downloadSample} className="rounded-full"><Download className="w-4 h-4 mr-1" /> Download Sample CSV</Button>
      </div>

      {!parsed && !result && (
        <div onClick={() => fileRef.current?.click()} className="bg-white border-2 border-dashed border-teal-300 hover:bg-teal-50/40 hover:border-teal-400 rounded-2xl p-12 text-center cursor-pointer transition-colors">
          <div className="w-16 h-16 mx-auto bg-teal-100 text-teal-700 rounded-2xl flex items-center justify-center mb-3"><Upload className="w-7 h-7" /></div>
          <div className="font-bold text-slate-900 text-lg">Click to upload a CSV or Excel</div>
          <div className="text-sm text-slate-500 mt-1">Columns: <code className="text-xs">{CSV_HEADERS.join(', ')}</code> (case-insensitive)</div>
          <Button type="button" className="mt-4 bg-teal-600 hover:bg-teal-700 rounded-full font-semibold"><Upload className="w-4 h-4 mr-1" /> Choose File</Button>
          <input ref={fileRef} type="file" accept=".csv,.xls,.xlsx" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
        </div>
      )}

      {parsed && !result && (
        <div className="space-y-3">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="font-bold text-slate-900">Preview · {parsed.rows.length} rows</div>
              <div className="text-xs text-slate-500">Review the data below. Invalid rows will be skipped.</div>
              {parsed.format === 'distributor' && (
                <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">
                  <Check className="w-3 h-3" /> Distributor invoice format auto-detected · Mapped to Allopathic Medicines
                </div>
              )}
              {progress && (
                <div className="mt-3 space-y-2">
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Batch {progress.currentBatch} of {progress.totalBatches}</span>
                    <span>{progress.current} / {progress.total} products</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-teal-600 transition-all duration-300" 
                      style={{ width: `${(progress.current / progress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setParsed(null); }} className="rounded-full">Reset</Button>
              <Button onClick={submit} disabled={importing} className="bg-teal-600 hover:bg-teal-700 rounded-full font-semibold">
                {importing ? (
                  <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Importing...</>
                ) : (
                  <><Check className="w-4 h-4 mr-1" /> Import {parsed.rows.filter(r => validate(r).length === 0).length} products</>
                )}
              </Button>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">#</th>
                    {CSV_HEADERS.map(h => <th key={h} className="text-left px-4 py-3 font-semibold">{h}</th>)}
                    <th className="text-left px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsed.rows.slice(0, 100).map((r, idx) => {
                    const errs = validate(r);
                    return (
                      <tr key={idx} className={errs.length ? 'bg-rose-50/30' : ''}>
                        <td className="px-4 py-2 text-xs text-slate-500">{idx + 1}</td>
                        {CSV_HEADERS.map(h => <td key={h} className="px-4 py-2 text-xs text-slate-800 max-w-[180px] truncate">{r[h]}</td>)}
                        <td className="px-4 py-2">
                          {errs.length ? (
                            <span className="text-[11px] font-bold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-md inline-flex items-center gap-1" title={errs.join(', ')}><X className="w-3 h-3" /> {errs.length} error{errs.length>1?'s':''}</span>
                          ) : (
                            <span className="text-[11px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md inline-flex items-center gap-1"><Check className="w-3 h-3" /> Valid</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {parsed.rows.length > 100 && (
                    <tr><td colSpan={CSV_HEADERS.length + 2} className="px-4 py-3 text-center text-xs text-slate-500">Showing first 100 of {parsed.rows.length} rows · Import will process all rows</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 mx-auto bg-emerald-100 rounded-full flex items-center justify-center mb-3"><Check className="w-8 h-8 text-emerald-600" /></div>
          <h2 className="text-2xl font-black text-slate-900">Import Complete</h2>
          <p className="text-slate-600 mt-1">
            <span className="font-bold text-emerald-600">{result.created}</span> created · 
            <span className="font-bold text-blue-600"> {result.updated}</span> updated · 
            <span className="font-bold text-rose-600"> {result.failed}</span> failed
          </p>
          {result.errors?.length > 0 && <div className="mt-3 text-xs text-rose-700 bg-rose-50 rounded-xl p-3 max-w-md mx-auto text-left"><div className="font-bold mb-1">Errors</div><ul className="list-disc list-inside space-y-0.5">{result.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}</ul></div>}
          <div className="mt-6 flex gap-2 justify-center">
            <Link href="/admin/products"><Button className="bg-teal-600 hover:bg-teal-700 rounded-full font-semibold">Back to Products</Button></Link>
            <Button variant="outline" onClick={() => { setParsed(null); setResult(null); }} className="rounded-full">Import Another</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Import;

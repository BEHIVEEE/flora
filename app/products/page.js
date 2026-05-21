'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, SlidersHorizontal, X } from 'lucide-react';
import ProductCard from '@/components/ProductCard';
import ProductSkeleton from '@/components/ProductSkeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

const ProductsInner = () => {
  const sp = useSearchParams();
  const router = useRouter();
  const category = sp.get('category') || 'all';
  const search = sp.get('search') || '';
  const [sort, setSort] = useState('popular');
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/categories?tree=true').then(r => r.json()).then(d => setCategories(d.categories || []));
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (category !== 'all') params.set('categoryId', category);
    if (search) params.set('search', search);
    params.set('sort', sort);
    params.set('limit', '60');
    fetch(`/api/products?${params.toString()}`)
      .then(r => r.json())
      .then(d => { setProducts(d.products || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [category, search, sort]);

  const flatCats = (cats, depth = 0) => cats.reduce((acc, c) => {
    acc.push({ ...c, depth });
    if (c.children?.length) acc.push(...flatCats(c.children, depth + 1));
    return acc;
  }, []);
  const allCats = flatCats(categories);
  const activeCat = allCats.find(c => c.id === category);
  const title = search ? `Results for "${search}"` : activeCat ? activeCat.name : 'All Products';

  const setCat = (id) => {
    const params = new URLSearchParams();
    if (id !== 'all') params.set('category', id);
    if (search) params.set('search', search);
    router.push(`/products${params.toString() ? '?' + params.toString() : ''}`);
  };

  return (
    <div className="bg-slate-50 min-h-screen overflow-x-hidden">
      <div className="bg-white border-b border-slate-200">
        <div className="container max-w-7xl mx-auto px-4 py-4">
          <div className="text-xs text-slate-500 flex items-center gap-1 mb-2">
            <Link href="/" className="hover:text-teal-700">Home</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-slate-900 font-medium">{title}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">{title}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{loading ? 'Loading…' : `${products.length} products`}</p>
        </div>
      </div>

      <div className="container max-w-7xl mx-auto px-3 md:px-4 py-4 md:py-6">
        <div className="grid lg:grid-cols-[240px_1fr] gap-6">
          {/* Sidebar (desktop) */}
          <aside className="hidden lg:block">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 sticky top-32">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Categories</div>
              <button onClick={() => setCat('all')} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium mb-1 ${category === 'all' ? 'bg-teal-50 text-teal-800' : 'hover:bg-slate-50 text-slate-700'}`}>All Products</button>
              {allCats.map(c => (
                <button key={c.id} onClick={() => setCat(c.id)} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium mb-1 ${category === c.id ? 'bg-teal-50 text-teal-800' : 'hover:bg-slate-50 text-slate-700'}`} style={{ paddingLeft: `${12 + (c.depth || 0) * 12}px` }}>{c.name}</button>
              ))}
            </div>
          </aside>

          <div>
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" className="lg:hidden rounded-full"><SlidersHorizontal className="w-4 h-4 mr-2" /> Filter</Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72">
                  <h3 className="font-bold text-lg mb-3">Categories</h3>
                  <button onClick={() => setCat('all')} className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium mb-1 ${category === 'all' ? 'bg-teal-50 text-teal-800' : 'hover:bg-slate-50'}`}>All Products</button>
                  {allCats.map(c => (
                    <button key={c.id} onClick={() => setCat(c.id)} className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium mb-1 ${category === c.id ? 'bg-teal-50 text-teal-800' : 'hover:bg-slate-50'}`} style={{ paddingLeft: `${12 + (c.depth || 0) * 12}px` }}>{c.name}</button>
                  ))}
                </SheetContent>
              </Sheet>
              <div className="flex-1" />
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger className="w-full sm:w-[180px] rounded-full bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="popular">Most Popular</SelectItem>
                  <SelectItem value="rating">Best Rated</SelectItem>
                  <SelectItem value="price_asc">Price: Low to High</SelectItem>
                  <SelectItem value="price_desc">Price: High to Low</SelectItem>
                  <SelectItem value="discount">Highest Discount</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Active category indicator (mobile) */}
            {category !== 'all' && activeCat && (
              <div className="lg:hidden mb-3 inline-flex items-center gap-2 bg-teal-50 border border-teal-200 text-teal-800 px-3 py-1.5 rounded-full text-xs font-semibold">
                {activeCat.name}
                <button onClick={() => setCat('all')} className="hover:text-teal-900" aria-label="Clear category"><X className="w-3 h-3" /></button>
              </div>
            )}

            {loading ? (
              <div className="grid gap-2 md:gap-4 pb-16" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(160px, 100%), 1fr))' }}>{Array(12).fill(0).map((_, i) => <ProductSkeleton key={i} />)}</div>
            ) : products.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                <div className="text-5xl mb-3">🔍</div>
                <h3 className="font-bold text-lg text-slate-900">No products found</h3>
                <p className="text-sm text-slate-500 mt-1">Try a different category or search term.</p>
                <Link href="/products"><Button className="mt-4 bg-teal-600 hover:bg-teal-700 rounded-full">Browse all</Button></Link>
              </div>
            ) : (
              <div className="grid gap-2 md:gap-4 pb-16" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(160px, 100%), 1fr))' }}>
                {products.map(p => <ProductCard key={p.id} product={p} />)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const ProductsPage = () => (
  <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading…</div>}>
    <ProductsInner />
  </Suspense>
);

export default ProductsPage;

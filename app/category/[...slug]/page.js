'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, SlidersHorizontal } from 'lucide-react';
import ProductCard from '@/components/ProductCard';
import ProductSkeleton from '@/components/ProductSkeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

const CategoryPage = () => {
  const params = useParams();
  const router = useRouter();
  const slugPath = params?.slug || [];
  const leafSlug = Array.isArray(slugPath) ? slugPath[slugPath.length - 1] : slugPath;

  const [category, setCategory] = useState(null);
  const [children, setChildren] = useState([]);
  const [products, setProducts] = useState([]);
  const [sort, setSort] = useState('popular');
  const [loading, setLoading] = useState(true);
  const [breadcrumbs, setBreadcrumbs] = useState([]);

  useEffect(() => {
    if (!leafSlug) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/categories/${leafSlug}`).then(r => r.json()),
      fetch('/api/categories?tree=true').then(r => r.json()),
    ]).then(([catRes, treeRes]) => {
      if (catRes.category) {
        setCategory(catRes.category);
        setChildren(catRes.children || []);
        // Build breadcrumbs from tree
        const flat = [];
        const flatten = (nodes, parentTrail = []) => {
          nodes.forEach(node => {
            const trail = [...parentTrail, node];
            flat.push({ ...node, trail });
            if (node.children?.length) flatten(node.children, trail);
          });
        };
        flatten(treeRes.categories || []);
        const match = flat.find(c => c.slug === leafSlug);
        setBreadcrumbs(match?.trail || [catRes.category]);

        // Fetch products: filter depends on category type
        const pParams = new URLSearchParams();
        const cat = catRes.category;
        if (cat.type === 'brand') {
          pParams.set('brandId', cat.id);
          // Optionally scope to parent main category too
          if (cat.parentCategoryId) pParams.set('categoryId', cat.parentCategoryId);
        } else if (cat.type === 'sub') {
          pParams.set('subcategoryId', cat.id);
        } else {
          pParams.set('categoryId', cat.id);
        }
        pParams.set('sort', sort);
        pParams.set('limit', '60');
        fetch(`/api/products?${pParams.toString()}`)
          .then(r => r.json())
          .then(d => { setProducts(d.products || []); setLoading(false); })
          .catch(() => setLoading(false));
      } else {
        setLoading(false);
      }
    }).catch(() => setLoading(false));
  }, [leafSlug, sort]);

  if (!category && !loading) {
    return (
      <div className="container max-w-7xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-black text-slate-900">Category not found</h1>
        <p className="text-slate-500 mt-2">The category you are looking for does not exist.</p>
        <Link href="/products"><Button className="mt-6 bg-teal-600 hover:bg-teal-700 rounded-full">Browse All Products</Button></Link>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="bg-white border-b border-slate-200">
        <div className="container max-w-7xl mx-auto px-4 py-4">
          {/* Breadcrumbs */}
          <div className="text-xs text-slate-500 flex items-center gap-1 mb-2 flex-wrap">
            <Link href="/" className="hover:text-teal-700">Home</Link>
            {breadcrumbs.map((bc, i) => (
              <span key={bc.id} className="flex items-center gap-1">
                <ChevronRight className="w-3 h-3" />
                <Link href={`/category/${bc.slug}`} className={i === breadcrumbs.length - 1 ? 'text-slate-900 font-medium' : 'hover:text-teal-700'}>
                  {bc.name}
                </Link>
              </span>
            ))}
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">{category?.name || 'Loading…'}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{category?.description || ''}</p>
          <p className="text-sm text-slate-500 mt-0.5">{loading ? 'Loading…' : `${products.length} products`}</p>
        </div>
      </div>

      <div className="container max-w-7xl mx-auto px-4 py-6">
        {/* Subcategories */}
        {children.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Subcategories</h3>
            <div className="flex flex-wrap gap-2">
              {children.map(child => (
                <Link key={child.id} href={`/category/${child.slug}`}>
                  <Button variant="outline" className="rounded-full text-sm">{child.name}</Button>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div className="flex-1" />
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-full sm:w-[180px] rounded-full bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="popular">Most Popular</SelectItem>
              <SelectItem value="rating">Best Rated</SelectItem>
              <SelectItem value="price_asc">Price: Low to High</SelectItem>
              <SelectItem value="price_desc">Price: High to Low</SelectItem>
              <SelectItem value="discount">Biggest Discount</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="grid gap-2 md:gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(160px, 100%), 1fr))' }}>
            {Array(8).fill(0).map((_, i) => <ProductSkeleton key={i} />)}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16">
            <h2 className="text-xl font-bold text-slate-900">No products yet</h2>
            <p className="text-slate-500 mt-2">Products will appear here once they are added to this category.</p>
          </div>
        ) : (
          <div className="grid gap-2 md:gap-4 pb-16" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(160px, 100%), 1fr))' }}>
            {products.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoryPage;

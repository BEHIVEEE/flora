'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ProductForm from '@/components/admin/ProductForm';
import { toast } from 'sonner';

const EditProduct = () => {
  const { id } = useParams();
  const router = useRouter();
  const [initial, setInitial] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/products/${id}`).then(r => r.json()).then(d => setInitial(d.product));
  }, [id]);

  const save = async (data) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/products/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const d = await res.json();
      if (d.product) { toast.success('Product updated'); router.push('/admin/products'); }
      else toast.error(d.error || 'Failed to update');
    } finally { setSaving(false); }
  };

  if (!initial) return <div className="space-y-3"><div className="h-8 w-1/3 skeleton rounded" /><div className="h-96 skeleton rounded-2xl" /></div>;
  return <ProductForm title="Edit Product" initial={initial} onSave={save} saving={saving} />;
};

export default EditProduct;

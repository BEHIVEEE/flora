'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ProductForm from '@/components/admin/ProductForm';
import { toast } from 'sonner';

const NewProduct = () => {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const save = async (data) => {
    setSaving(true);
    try {
      const res = await fetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const d = await res.json();
      if (d.product) { toast.success('Product created'); router.push('/admin/products'); }
      else toast.error(d.error || 'Failed to create');
    } finally { setSaving(false); }
  };

  return <ProductForm title="Add New Product" onSave={save} saving={saving} />;
};

export default NewProduct;

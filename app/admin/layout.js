'use client';
import { useAuth } from '@/components/AuthProvider';
import Sidebar from '@/components/admin/Sidebar';
import ImportJobProvider from '@/components/admin/ImportJobProvider';
import ImportJobBanner from '@/components/admin/ImportJobBanner';

const AdminLayout = ({ children }) => {
  const { user, loading } = useAuth() || { user: null, loading: true };

  // AuthProvider handles redirects; here we just gate rendering.
  if (loading || !user || user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-500">
          <div className="w-5 h-5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
          {loading ? 'Loading…' : 'Redirecting…'}
        </div>
      </div>
    );
  }

  return (
    <ImportJobProvider>
      <div className="min-h-screen bg-slate-50">
        <Sidebar />
        <div className="lg:pl-64">
          <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">
            <ImportJobBanner />
            {children}
          </div>
        </div>
      </div>
    </ImportJobProvider>
  );
};

export default AdminLayout;

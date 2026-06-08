'use client';

import { createContext, useContext } from 'react';
import useImportJob from '@/hooks/useImportJob';

const ImportJobContext = createContext(null);

export function ImportJobProvider({ children }) {
  const value = useImportJob();
  return (
    <ImportJobContext.Provider value={value}>
      {children}
    </ImportJobContext.Provider>
  );
}

export function useImportJobContext() {
  const ctx = useContext(ImportJobContext);
  if (!ctx) {
    throw new Error('useImportJobContext must be used within ImportJobProvider');
  }
  return ctx;
}

export default ImportJobProvider;

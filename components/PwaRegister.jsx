'use client';
import { useEffect } from 'react';

const PwaRegister = () => {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
  }, []);

  return null;
};

export default PwaRegister;

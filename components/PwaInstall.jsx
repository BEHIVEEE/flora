'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Download, Share, X, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DISMISS_KEY = 'pwa_install_dismissed';
const DISMISS_DAYS = 14;

function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

function isIos() {
  if (typeof window === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function wasDismissedRecently() {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const dismissedAt = Number(raw);
    if (!Number.isFinite(dismissedAt)) return false;
    return Date.now() - dismissedAt < DISMISS_DAYS * 86400000;
  } catch {
    return false;
  }
}

const PwaInstall = () => {
  const pathname = usePathname();
  const deferredRef = useRef(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (pathname?.startsWith('/admin')) return;
    if (isStandalone()) {
      setInstalled(true);
      return;
    }
    if (wasDismissedRecently()) return;

    const runInstall = async () => {
      if (isIos()) {
        setShowBanner(true);
        setShowIosHelp(true);
        return;
      }
      const prompt = deferredRef.current;
      if (!prompt) {
        setShowBanner(true);
        return;
      }
      prompt.prompt();
      try {
        await prompt.userChoice;
      } catch { /* ignore */ }
      deferredRef.current = null;
      setShowBanner(false);
    };

    const onBeforeInstall = (e) => {
      e.preventDefault();
      deferredRef.current = e;
      setShowBanner(true);
    };

    const onInstalled = () => {
      setInstalled(true);
      setShowBanner(false);
      deferredRef.current = null;
    };

    const onManualInstall = () => {
      if (isStandalone()) return;
      runInstall();
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    window.addEventListener('pwa:install', onManualInstall);

    if (isIos() && !isStandalone()) {
      const t = setTimeout(() => setShowBanner(true), 2500);
      return () => {
        clearTimeout(t);
        window.removeEventListener('beforeinstallprompt', onBeforeInstall);
        window.removeEventListener('appinstalled', onInstalled);
        window.removeEventListener('pwa:install', onManualInstall);
      };
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
      window.removeEventListener('pwa:install', onManualInstall);
    };
  }, [pathname]);

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
    setShowBanner(false);
    setShowIosHelp(false);
  };

  const install = async () => {
    if (isIos()) {
      setShowIosHelp(true);
      return;
    }
    const prompt = deferredRef.current;
    if (!prompt) return;
    prompt.prompt();
    try {
      await prompt.userChoice;
    } catch { /* ignore */ }
    deferredRef.current = null;
    setShowBanner(false);
  };

  if (installed || pathname?.startsWith('/admin') || !showBanner) return null;

  return (
    <>
      <div className="fixed bottom-20 md:bottom-6 left-3 right-3 md:left-auto md:right-6 md:max-w-sm z-40 animate-in slide-in-from-bottom-4 duration-300">
        <div className="rounded-2xl border border-teal-200 bg-white shadow-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-600 to-emerald-600 text-white flex items-center justify-center font-black text-xl shrink-0">
              +
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-slate-900 text-sm">Install FloraChemist app</div>
              <div className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                Add to your home screen for faster checkout and easy reordering.
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <Button
                  size="sm"
                  onClick={install}
                  className="rounded-full h-8 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold"
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  {isIos() ? 'How to install' : 'Install'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={dismiss}
                  className="rounded-full h-8 text-xs text-slate-500"
                >
                  Not now
                </Button>
              </div>
            </div>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss install prompt"
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {showIosHelp && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4 bg-slate-900/40">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-center gap-2 mb-3">
              <Smartphone className="w-5 h-5 text-teal-700" />
              <h3 className="font-bold text-slate-900">Install on iPhone / iPad</h3>
            </div>
            <ol className="text-sm text-slate-600 space-y-2 list-decimal list-inside">
              <li className="flex items-start gap-2">
                <Share className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                <span>Tap <strong>Share</strong> in Safari&apos;s toolbar</span>
              </li>
              <li>Choose <strong>Add to Home Screen</strong></li>
              <li>Tap <strong>Add</strong></li>
            </ol>
            <Button onClick={() => setShowIosHelp(false)} className="w-full mt-4 rounded-full bg-teal-600 hover:bg-teal-700">
              Got it
            </Button>
          </div>
        </div>
      )}
    </>
  );
};

export function triggerPwaInstall() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('pwa:install'));
  }
}

export default PwaInstall;

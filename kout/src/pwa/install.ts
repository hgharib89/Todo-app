import { useEffect, useState } from 'react';
import { isIOS, isStandalone } from './register';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// keep the browser's install prompt from the moment the page loads
let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}

/** 'prompt' = the browser can install now; 'ios' = show the Share → Add to Home Screen hint; null = nothing to show. */
export function useInstall(): { mode: 'prompt' | 'ios' | null; install: () => void } {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  if (isStandalone()) return { mode: null, install: () => {} };
  if (deferred) {
    return {
      mode: 'prompt',
      install: () => {
        const e = deferred;
        deferred = null;
        e?.prompt();
        listeners.forEach((l) => l());
      },
    };
  }
  return { mode: isIOS() ? 'ios' : null, install: () => {} };
}

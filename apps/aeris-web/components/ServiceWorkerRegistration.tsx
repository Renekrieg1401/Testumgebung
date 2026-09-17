'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistration(): null {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* Offline-Cache ist ein Zusatznutzen — ohne ihn funktioniert die App weiterhin online. */
      });
    }
  }, []);
  return null;
}

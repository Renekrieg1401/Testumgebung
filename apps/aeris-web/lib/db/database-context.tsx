'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getBrowserDatabase, type AerisDatabase } from './database';

const DatabaseContext = createContext<AerisDatabase | null>(null);

/** Öffnet die IndexedDB-Verbindung einmalig und reicht sie per DI an die Komponenten weiter. */
export function DatabaseProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [db, setDb] = useState<AerisDatabase | null>(null);

  useEffect(() => {
    let disposed = false;
    getBrowserDatabase()
      .then((instance) => {
        if (!disposed) setDb(instance);
      })
      .catch(() => {
        if (!disposed) setDb(null);
      });
    return () => {
      disposed = true;
    };
  }, []);

  return <DatabaseContext.Provider value={db}>{children}</DatabaseContext.Provider>;
}

export function useDatabase(): AerisDatabase | null {
  return useContext(DatabaseContext);
}

'use client';

import type { JSX, ReactNode } from 'react';
import { DatabaseProvider } from '../lib/db/database-context';
import { VaultSessionProvider } from '../lib/crypto/session-context';

export function Providers({ children }: { children: ReactNode }): JSX.Element {
  return (
    <DatabaseProvider>
      <VaultSessionProvider>{children}</VaultSessionProvider>
    </DatabaseProvider>
  );
}

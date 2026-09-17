'use client';

import type { JSX } from 'react';
import { useVaultSession } from '../lib/crypto/session-context';
import { OnboardingScreen } from '../components/OnboardingScreen';
import { UnlockScreen } from '../components/UnlockScreen';
import { Dashboard } from '../components/Dashboard';

export default function HomePage(): JSX.Element {
  const { session, vaultExists } = useVaultSession();

  if (session) return <Dashboard />;
  if (vaultExists === null) return <p className="hint">Wird geladen …</p>;
  if (vaultExists) return <UnlockScreen />;
  return <OnboardingScreen />;
}

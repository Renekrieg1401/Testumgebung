'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createVault, unlockVault } from '@aeris/crypto-core';
import { VaultEnvelopeSchema, type VaultEnvelope } from '@aeris/shared-schemas';
import { useDatabase } from '../db/database-context';
import type { AerisDatabase } from '../db/database';
import { pushVaultEnvelope } from '../api/client';

export interface VaultSessionState {
  readonly accountId: string;
  readonly dek: CryptoKey;
}

interface StoredVault {
  readonly accountId: string;
  readonly envelope: VaultEnvelope;
}

interface VaultSessionContextValue {
  readonly session: VaultSessionState | null;
  readonly vaultExists: boolean | null;
  readonly error: string | null;
  readonly createNewVault: (passphrase: string) => Promise<void>;
  readonly unlock: (passphrase: string) => Promise<void>;
  readonly lock: () => void;
}

const VaultSessionContext = createContext<VaultSessionContextValue | null>(null);
const DB_NOT_READY_MESSAGE = 'Datenbank wird noch initialisiert. Bitte kurz erneut versuchen.';

async function loadStoredVault(db: AerisDatabase): Promise<StoredVault | null> {
  const doc = await db.vault.findOne().exec();
  if (!doc) return null;
  return { accountId: doc.accountId, envelope: VaultEnvelopeSchema.parse(JSON.parse(doc.envelopeJson)) };
}

async function performCreateVault(db: AerisDatabase, passphrase: string): Promise<VaultSessionState> {
  const { envelope, dek } = await createVault(passphrase);
  const accountId = crypto.randomUUID();
  await db.vault.insert({ accountId, envelopeJson: JSON.stringify(envelope) });
  void pushVaultEnvelope(accountId, envelope).catch(() => {
    /* Offline-First: Sync erfolgt beim nächsten Onlinegang erneut. */
  });
  return { accountId, dek };
}

async function performUnlock(db: AerisDatabase, passphrase: string): Promise<VaultSessionState | null> {
  const stored = await loadStoredVault(db);
  if (!stored) return null;
  const dek = await unlockVault(passphrase, stored.envelope);
  return { accountId: stored.accountId, dek };
}

function useVaultExistenceCheck(db: AerisDatabase | null, setVaultExists: (value: boolean) => void): void {
  useEffect(() => {
    if (!db) return;
    loadStoredVault(db)
      .then((stored) => {
        setVaultExists(stored !== null);
      })
      .catch(() => {
        setVaultExists(false);
      });
  }, [db, setVaultExists]);
}

function useCreateVaultAction(
  db: AerisDatabase | null,
  setSession: (session: VaultSessionState | null) => void,
  setError: (error: string | null) => void,
  setVaultExists: (value: boolean) => void,
): (passphrase: string) => Promise<void> {
  return useCallback(
    async (passphrase: string): Promise<void> => {
      if (!db) {
        setError(DB_NOT_READY_MESSAGE);
        return;
      }
      setError(null);
      try {
        setSession(await performCreateVault(db, passphrase));
        setVaultExists(true);
      } catch {
        setError('Vault konnte nicht erstellt werden.');
      }
    },
    [db, setSession, setError, setVaultExists],
  );
}

function useUnlockAction(
  db: AerisDatabase | null,
  setSession: (session: VaultSessionState | null) => void,
  setError: (error: string | null) => void,
): (passphrase: string) => Promise<void> {
  return useCallback(
    async (passphrase: string): Promise<void> => {
      if (!db) {
        setError(DB_NOT_READY_MESSAGE);
        return;
      }
      setError(null);
      try {
        const result = await performUnlock(db, passphrase);
        if (!result) {
          setError('Kein Vault auf diesem Gerät gefunden.');
          return;
        }
        setSession(result);
      } catch {
        setError('Passphrase falsch.');
      }
    },
    [db, setSession, setError],
  );
}

export function VaultSessionProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const db = useDatabase();
  const [session, setSession] = useState<VaultSessionState | null>(null);
  const [vaultExists, setVaultExists] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useVaultExistenceCheck(db, setVaultExists);
  const createNewVault = useCreateVaultAction(db, setSession, setError, setVaultExists);
  const unlock = useUnlockAction(db, setSession, setError);
  const lock = useCallback((): void => {
    setSession(null);
  }, []);

  const value = useMemo<VaultSessionContextValue>(
    () => ({ session, vaultExists, error, createNewVault, unlock, lock }),
    [session, vaultExists, error, createNewVault, unlock, lock],
  );

  return <VaultSessionContext.Provider value={value}>{children}</VaultSessionContext.Provider>;
}

export function useVaultSession(): VaultSessionContextValue {
  const context = useContext(VaultSessionContext);
  if (!context) {
    throw new Error('useVaultSession muss innerhalb von VaultSessionProvider verwendet werden.');
  }
  return context;
}

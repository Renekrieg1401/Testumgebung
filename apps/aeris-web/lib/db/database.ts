import { createRxDatabase, type RxCollection, type RxDatabase, type RxStorage } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { assessmentSchema, vaultSchema, type AssessmentDocType, type VaultDocType } from './schema';

export interface AerisCollections {
  vault: RxCollection<VaultDocType>;
  assessments: RxCollection<AssessmentDocType>;
}

export type AerisDatabase = RxDatabase<AerisCollections>;

export async function createAerisDatabase<Internals, InstanceCreationOptions>(
  name: string,
  storage: RxStorage<Internals, InstanceCreationOptions>,
): Promise<AerisDatabase> {
  const db = await createRxDatabase<AerisCollections>({ name, storage });
  await db.addCollections({
    vault: { schema: vaultSchema },
    assessments: { schema: assessmentSchema },
  });
  return db;
}

let browserDatabasePromise: Promise<AerisDatabase> | null = null;

/** Singleton für den Browser — IndexedDB via Dexie-Storage, offline-fähig. */
export function getBrowserDatabase(): Promise<AerisDatabase> {
  if (typeof window === 'undefined') {
    throw new Error('AERIS-Datenbank ist ausschließlich clientseitig verfügbar.');
  }
  browserDatabasePromise ??= createAerisDatabase('aeris', getRxStorageDexie());
  return browserDatabasePromise;
}

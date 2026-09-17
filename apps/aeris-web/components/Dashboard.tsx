'use client';

import { useCallback, useEffect, useState, type JSX } from 'react';
import { useDatabase } from '../lib/db/database-context';
import { useVaultSession, type VaultSessionState } from '../lib/crypto/session-context';
import { getOrCreateDeviceId } from '../lib/device/device-id';
import type { AerisDatabase } from '../lib/db/database';
import {
  createAssessment,
  exportAssessmentAsFhir,
  listAssessments,
  syncPending,
  type AssessmentSummary,
} from '../lib/assessments/service';
import type { AssessmentAnswers } from '../lib/assessments/model';
import { AssessmentForm } from './AssessmentForm';
import { AssessmentList } from './AssessmentList';

function useAssessmentSummaries(
  db: AerisDatabase | null,
  session: VaultSessionState | null,
): { summaries: AssessmentSummary[]; reload: () => Promise<void> } {
  const [summaries, setSummaries] = useState<AssessmentSummary[]>([]);

  const reload = useCallback(async (): Promise<void> => {
    if (!db || !session) return;
    setSummaries(await listAssessments(db, session.dek, session.accountId));
  }, [db, session]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!db || !session) return;
    void syncPending(db, session.accountId).then(reload);
  }, [db, session, reload]);

  return { summaries, reload };
}

interface DashboardViewProps {
  readonly statusMessage: string | null;
  readonly summaries: AssessmentSummary[];
  readonly onLock: () => void;
  readonly onCreate: (answers: AssessmentAnswers) => Promise<void>;
  readonly onExport: (id: string) => void;
}

function DashboardView({
  statusMessage,
  summaries,
  onLock,
  onCreate,
  onExport,
}: DashboardViewProps): JSX.Element {
  return (
    <main className="screen" aria-labelledby="dashboard-heading">
      <div className="dashboard-header">
        <h1 id="dashboard-heading" className="page-title">
          Ihr Verlauf
        </h1>
        <button type="button" className="btn btn-ghost" onClick={onLock}>
          Sperren
        </button>
      </div>
      {statusMessage !== null && (
        <p className="alert alert-ok" role="status">
          {statusMessage}
        </p>
      )}
      <AssessmentForm onSubmit={onCreate} />
      <h2 className="section-title">Bisherige Einträge</h2>
      <AssessmentList items={summaries} onExport={onExport} />
    </main>
  );
}

export function Dashboard(): JSX.Element {
  const db = useDatabase();
  const { session, lock } = useVaultSession();
  const { summaries, reload } = useAssessmentSummaries(db, session);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!db || !session) {
    return <p className="hint">Wird geladen …</p>;
  }
  const activeDb = db;
  const activeSession = session;

  async function handleCreate(answers: AssessmentAnswers): Promise<void> {
    const deviceId = getOrCreateDeviceId();
    await createAssessment(activeDb, activeSession.dek, activeSession.accountId, deviceId, answers);
    setStatusMessage('Eintrag verschlüsselt gespeichert.');
    await reload();
  }

  function handleExport(id: string): void {
    void exportAssessmentAsFhir(activeDb, activeSession.dek, activeSession.accountId, id);
  }

  return (
    <DashboardView
      statusMessage={statusMessage}
      summaries={summaries}
      onLock={lock}
      onCreate={handleCreate}
      onExport={handleExport}
    />
  );
}

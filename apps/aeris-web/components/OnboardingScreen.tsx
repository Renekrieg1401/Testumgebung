'use client';

import { useState, type SyntheticEvent, type JSX } from 'react';
import { useVaultSession } from '../lib/crypto/session-context';
import { PasswordField } from './PasswordField';

const MIN_PASSPHRASE_LENGTH = 12;

function validatePassphrases(passphrase: string, confirmation: string): string | null {
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
    return `Die Passphrase muss mindestens ${String(MIN_PASSPHRASE_LENGTH)} Zeichen haben.`;
  }
  if (passphrase !== confirmation) {
    return 'Die beiden Eingaben stimmen nicht überein.';
  }
  return null;
}

interface OnboardingFormProps {
  readonly passphrase: string;
  readonly confirmation: string;
  readonly error: string | null;
  readonly isSubmitting: boolean;
  readonly onPassphraseChange: (value: string) => void;
  readonly onConfirmationChange: (value: string) => void;
  readonly onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
}

function OnboardingForm({
  passphrase,
  confirmation,
  error,
  isSubmitting,
  onPassphraseChange,
  onConfirmationChange,
  onSubmit,
}: OnboardingFormProps): JSX.Element {
  return (
    <form onSubmit={onSubmit} noValidate className="card">
      <PasswordField
        id="passphrase"
        label="Neue Passphrase"
        value={passphrase}
        onChange={onPassphraseChange}
        minLength={MIN_PASSPHRASE_LENGTH}
      />
      <PasswordField
        id="passphrase-confirm"
        label="Passphrase bestätigen"
        value={confirmation}
        onChange={onConfirmationChange}
      />
      {error !== null && (
        <p className="alert alert-err" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
        {isSubmitting ? 'Wird erstellt …' : 'Vault erstellen'}
      </button>
    </form>
  );
}

export function OnboardingScreen(): JSX.Element {
  const { createNewVault, error } = useVaultSession();
  const [passphrase, setPassphrase] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleSubmit(event: SyntheticEvent<HTMLFormElement>): void {
    event.preventDefault();
    const validationError = validatePassphrases(passphrase, confirmation);
    setLocalError(validationError);
    if (validationError) return;
    setIsSubmitting(true);
    void createNewVault(passphrase).finally(() => {
      setIsSubmitting(false);
    });
  }

  return (
    <main className="screen" aria-labelledby="onboarding-heading">
      <h1 id="onboarding-heading" className="page-title">Willkommen bei AERIS</h1>
      <p className="lede">
        Legen Sie eine Passphrase fest. Sie verschlüsselt alle Ihre Angaben direkt auf diesem Gerät —
        niemand außer Ihnen kann sie lesen, auch AERIS nicht.
      </p>
      <OnboardingForm
        passphrase={passphrase}
        confirmation={confirmation}
        error={localError ?? error}
        isSubmitting={isSubmitting}
        onPassphraseChange={setPassphrase}
        onConfirmationChange={setConfirmation}
        onSubmit={handleSubmit}
      />
      <p className="hint">
        Wichtig: Es gibt keine Möglichkeit, die Passphrase zurückzusetzen. Notieren Sie sie an einem
        sicheren Ort.
      </p>
    </main>
  );
}

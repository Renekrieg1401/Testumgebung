'use client';

import { useState, type SyntheticEvent, type JSX } from 'react';
import { useVaultSession } from '../lib/crypto/session-context';
import { PasswordField } from './PasswordField';

export function UnlockScreen(): JSX.Element {
  const { unlock, error } = useVaultSession();
  const [passphrase, setPassphrase] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleSubmit(event: SyntheticEvent<HTMLFormElement>): void {
    event.preventDefault();
    setIsSubmitting(true);
    void unlock(passphrase).finally(() => {
      setIsSubmitting(false);
    });
  }

  return (
    <main className="screen" aria-labelledby="unlock-heading">
      <h1 id="unlock-heading" className="page-title">
        Vault entsperren
      </h1>
      <p className="lede">Geben Sie Ihre Passphrase ein, um Ihre verschlüsselten Daten zu sehen.</p>
      <form onSubmit={handleSubmit} noValidate className="card">
        <PasswordField
          id="unlock-passphrase"
          label="Passphrase"
          value={passphrase}
          onChange={setPassphrase}
          autoComplete="current-password"
        />
        {error !== null && (
          <p className="alert alert-err" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Wird entsperrt …' : 'Entsperren'}
        </button>
      </form>
    </main>
  );
}

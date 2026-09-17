import type { JSX } from 'react';

interface PasswordFieldProps {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly autoComplete?: 'new-password' | 'current-password';
  readonly minLength?: number;
}

export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete = 'new-password',
  minLength,
}: PasswordFieldProps): JSX.Element {
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="password"
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        required
        {...(minLength !== undefined ? { minLength } : {})}
      />
    </>
  );
}

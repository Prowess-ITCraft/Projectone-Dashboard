import { useState } from 'react';
import { EyeIcon, EyeSlashIcon } from '@phosphor-icons/react';

/* A password field with the eye button that shows and hides what was typed. `control` is FormField's control props. */
export function PasswordInput({ control, value, onChange, autoComplete = 'current-password' }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="login-password">
      <input
        {...control}
        type={shown ? 'text' : 'password'}
        className="input"
        autoComplete={autoComplete}
        value={value}
        onChange={onChange}
      />
      <button
        type="button"
        className="login-eye"
        aria-label={shown ? 'Hide password' : 'Show password'}
        aria-pressed={shown}
        onClick={() => setShown(!shown)}
      >
        {shown ? <EyeSlashIcon size={18} /> : <EyeIcon size={18} />}
      </button>
    </div>
  );
}

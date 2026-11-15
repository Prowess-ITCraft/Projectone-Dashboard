import { WarningCircleIcon } from '@phosphor-icons/react';

/* Shown when something failed. Says what went wrong and, when it can, offers a retry. */
export function ErrorState({ title = 'Something went wrong', message, onRetry, retryLabel = 'Try again' }) {
  return (
    <div className="state state-error" role="alert">
      <WarningCircleIcon size={26} className="state-icon" aria-hidden="true" />
      <h2 className="state-title">{title}</h2>
      {message && <p>{message}</p>}
      {onRetry && (
        <button type="button" className="btn ghost sm" onClick={onRetry}>
          {retryLabel}
        </button>
      )}
    </div>
  );
}

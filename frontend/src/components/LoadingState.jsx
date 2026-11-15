/* Shown while data loads. Screen readers hear the label once, politely. */
export function LoadingState({ label = 'Loading' }) {
  return (
    <div className="state" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

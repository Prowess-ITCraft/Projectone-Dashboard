import { useState } from 'react';
import { Dialog, FormField, Notice } from '@/components';

/*
  Asks for a reason before a change that must be explained (reopening a review, changing a classification).
  The text is required and is stored with the change. Mounted only while open, so each use starts empty.
*/
export function ReasonDialog({ open, title, description, confirmLabel = 'Confirm', busy = false, error = '', onConfirm, onClose }) {
  return open ? (
    <ReasonPanel
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      busy={busy}
      error={error}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  ) : null;
}

function ReasonPanel({ title, description, confirmLabel, busy, error, onConfirm, onClose }) {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const missing = touched && !reason.trim();
  const submit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (reason.trim()) onConfirm(reason.trim());
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title={title}
      description={description}
      actions={
        <>
          <button type="button" className="btn ghost sm" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="reason-form" className="btn sm" disabled={busy}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <form id="reason-form" onSubmit={submit} className="stack">
        <FormField label="Reason" error={missing ? 'A reason is required.' : undefined}>
          {(f) => (
            <textarea
              {...f.control}
              className="input textarea"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              data-autofocus
            />
          )}
        </FormField>
        {error && <Notice tone="error">{error}</Notice>}
      </form>
    </Dialog>
  );
}

import { useId } from 'react';
import { createPortal } from 'react-dom';
import { XIcon } from '@phosphor-icons/react';
import { useModal } from './useModal';

/*
  A modal dialog: a title, a body and a row of actions. Mounted only while `open`, so each opening starts fresh.
  Escape, the close button and a click on the backdrop all call onClose. Pass `role="alertdialog"` for a
  confirmation that needs an answer.
*/
export function Dialog({ open, ...props }) {
  return open ? createPortal(<DialogPanel {...props} />, document.body) : null;
}

function DialogPanel({ title, description, actions, onClose, role = 'dialog', children }) {
  const ref = useModal(onClose);
  const id = useId();
  return (
    <div className="dialog-backdrop">
      <button type="button" tabIndex={-1} aria-hidden="true" className="absolute inset-0 cursor-default" onClick={onClose} />
      <div
        ref={ref}
        role={role}
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={description ? `${id}-desc` : undefined}
        tabIndex={-1}
        className="dialog relative"
      >
        <div className="dialog-h">
          <h2 id={`${id}-title`}>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <XIcon size={18} />
          </button>
        </div>
        <div className="dialog-body">
          {description && <p id={`${id}-desc`}>{description}</p>}
          {children}
        </div>
        {actions && <div className="dialog-actions">{actions}</div>}
      </div>
    </div>
  );
}

import { Dialog, LoadingState, Notice } from '@/components';
import { useActor } from '@/app/actor';
import { useApi, useApiQuery } from '@/data/api';
import { DOCUMENT_TYPES } from '@/domain/documents';
import { can } from '@/domain/permissions';
import { formatINR } from '@/domain/money';
import { useAction } from '@/lib/useAction';
import { formatDate } from './labels';

const norm = (t) => t.toLowerCase().replace(/\s+/g, ' ').trim();

/* How the new document's lines differ from the earlier one's, matched by description */
function compareLines(earlier, later) {
  const before = new Map(earlier.map((l) => [norm(l.title), l]));
  const after = new Map(later.map((l) => [norm(l.title), l]));
  const mark = (l, other) => {
    const o = other.get(norm(l.title));
    if (!o) return 'only';
    return o.qty !== l.qty || o.ratePaise !== l.ratePaise ? 'changed' : 'same';
  };
  return { earlier: earlier.map((l) => ({ ...l, mark: mark(l, after) })), later: later.map((l) => ({ ...l, mark: mark(l, before) })) };
}

function Side({ title, doc, lines, showMoney }) {
  return (
    <section className="compare-side" aria-label={title}>
      <h3>{title}</h3>
      <dl className="facts">
        <dt>Number</dt>
        <dd>{doc.number || 'Not entered'}</dd>
        <dt>Date</dt>
        <dd>{formatDate(doc.date) || 'Not entered'}</dd>
        <dt>File</dt>
        <dd>{doc.fileName}</dd>
        {showMoney && doc.totals?.grandPaise != null && (
          <>
            <dt>Grand total</dt>
            <dd>{formatINR(doc.totals.grandPaise)}</dd>
          </>
        )}
      </dl>
      <ul className="compare-lines">
        {lines.map((l) => (
          <li key={l.id} className={`mark-${l.mark}`}>
            <span>
              {l.no}. {l.title}
            </span>
            <small className="num">
              {l.qty}
              {showMoney && l.ratePaise != null ? ` x ${formatINR(l.ratePaise)}` : ''}
              {l.mark === 'only' ? ' (not in the other)' : l.mark === 'changed' ? ' (changed)' : ''}
            </small>
          </li>
        ))}
        {!lines.length && <li className="muted">No lines.</li>}
      </ul>
    </section>
  );
}

/*
  Two documents with the same number (or the same file) side by side. The user chooses to replace the earlier one,
  which is kept as history, or to cancel the new upload. A number already used in another project can only be cancelled.
*/
export function DuplicateDialog({ candidate, existing, projectId, onClose }) {
  const api = useApi();
  const { actor } = useActor();
  const [run, { busy, error }] = useAction();
  const earlier = useApiQuery((a) => a.getDocumentLines(existing.id), [existing.id]);
  const later = useApiQuery((a) => a.getDocumentLines(candidate.id), [candidate.id]);
  const sameProject = existing.projectId === projectId;
  const showMoney = can(actor, 'view_financials');

  const decide = async (decision) => {
    const ok = await run(async () => {
      await api.resolveDuplicate(candidate.id, decision, { actor });
      return true;
    });
    if (ok) onClose();
  };

  const ready = earlier.data && later.data;
  const diff = ready ? compareLines(earlier.data, later.data) : null;

  return (
    <Dialog
      open
      wide
      role="alertdialog"
      onClose={onClose}
      title={`${DOCUMENT_TYPES[candidate.type]} ${candidate.number || ''} is already stored`.replace('  ', ' ')}
      description="Decide which one to keep. Nothing changes until you choose; closing this window leaves the new file waiting."
      actions={
        <>
          <button type="button" className="btn ghost sm" disabled={busy} onClick={() => decide('cancel')}>
            Cancel the new upload
          </button>
          <button type="button" className="btn sm" disabled={busy || !sameProject} onClick={() => decide('replace')} data-autofocus>
            Replace the earlier one
          </button>
        </>
      }
    >
      {!sameProject && (
        <Notice tone="warning">
          The earlier document belongs to another project, so it cannot be replaced from here. Cancel this upload or remove it there first.
        </Notice>
      )}
      {sameProject && (
        <Notice tone="info">
          Replacing keeps the earlier document as history. If the lines were confirmed, the confirmations are reset.
        </Notice>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      {!ready ? (
        <LoadingState label="Loading the lines" />
      ) : (
        <div className="compare">
          <Side title="Already stored" doc={existing} lines={diff.earlier} showMoney={showMoney} />
          <Side title="New upload" doc={candidate} lines={diff.later} showMoney={showMoney} />
        </div>
      )}
    </Dialog>
  );
}

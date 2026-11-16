import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, EmptyState, Icon, Notice } from '@/components';
import { useActor } from '@/app/actor';
import { useApi } from '@/data/api';
import { DOCUMENT_TYPES } from '@/domain/documents';
import { can } from '@/domain/permissions';
import { ORDER_DOCUMENT_TYPES } from '@/domain/stages';
import { validateDocument } from '@/domain/validation';
import { useAction } from '@/lib/useAction';
import { DocumentViewer } from './DocumentViewer';
import { LineTable } from './LineTable';
import { ReasonDialog } from './ReasonDialog';
import { StageActions } from './StageActions';
import { formatDate } from './labels';

function OrderSection({ doc, lines, snapshot, onField, onClassify, onAccept, onDelete, onError, onAdd }) {
  const { actor } = useActor();
  const [showOriginal, setShowOriginal] = useState(false);
  const { project } = snapshot;
  const issues = validateDocument(doc, lines);
  const products = lines.filter((l) => l.kind === 'product' || l.kind === 'subscription');

  return (
    <Card
      title={`${DOCUMENT_TYPES[doc.type]} ${doc.number}`}
      hint={formatDate(doc.date)}
      actions={
        doc.fileId ? (
          <button type="button" className="btn ghost sm" aria-pressed={showOriginal} onClick={() => setShowOriginal(!showOriginal)}>
            {showOriginal ? 'Hide original' : 'Show original'}
          </button>
        ) : null
      }
    >
      {doc.poType === 'call_confirmation' && (
        <Notice tone="info">This order was a call confirmation: there is no customer PO number.</Notice>
      )}
      {doc.referencePi && <Notice tone="info">This order refers to proforma invoice {doc.referencePi}.</Notice>}
      {issues.map((i) => (
        <Notice key={i.id} tone="warning">
          {i.message}
        </Notice>
      ))}

      <div className={`review${showOriginal ? ' with-original' : ''}`}>
        {showOriginal && <DocumentViewer fileId={doc.fileId} title={`Original ${doc.fileName}`} className="viewer-tall" />}
        <div className="review-lines">
          <LineTable
            lines={lines}
            products={products}
            textLocked={Boolean(project.intake)}
            classLocked={Boolean(project.classify)}
            canEdit={can(actor, 'edit_lines')}
            canClassify={can(actor, 'classify')}
            onField={onField}
            onClassify={onClassify}
            onAccept={onAccept}
            onDelete={onDelete}
            onError={onError}
          />
          {!project.intake && can(actor, 'edit_lines') && (
            <button type="button" className="btn ghost sm" onClick={() => onAdd(doc)}>
              <Icon name="Plus" size={15} />
              Add a line
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function LinesTab({ snapshot }) {
  const api = useApi();
  const { actor } = useActor();
  const [run, { busy, error, clear }] = useAction();
  const [problem, setProblem] = useState('');
  const [pending, setPending] = useState(null);
  const { project, documents, lines } = snapshot;
  const orders = documents.filter((d) => d.active && ORDER_DOCUMENT_TYPES.includes(d.type));
  const needDetails = orders.filter((d) => d.status === 'needs_manual');

  if (!orders.length) {
    return (
      <EmptyState>
        There are no order lines yet. <Link to="../documents">Add a proforma invoice or purchase order</Link> first.
      </EmptyState>
    );
  }

  const field = (line, patch) => {
    setProblem('');
    return run(() => api.updateLine(line.id, patch, { actor }));
  };
  const classify = (line, patch) => {
    clear();
    setProblem('');
    setPending({ line, patch });
  };
  const applyReason = async (reason) => {
    const { line, patch } = pending;
    const ok = await run(async () => {
      await api.updateLine(line.id, patch, { actor, reason });
      return true;
    });
    if (ok) setPending(null);
  };

  return (
    <div className="stack">
      {(error || problem) && !pending && (
        <Notice
          tone="error"
          actions={
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => {
                clear();
                setProblem('');
              }}
            >
              Dismiss
            </button>
          }
        >
          {problem || error}
        </Notice>
      )}
      {needDetails.map((d) => (
        <Notice key={d.id} tone="warning" title="Details needed">
          {d.fileName} has no lines yet. <Link to="../documents">Enter its details</Link> in the documents tab.
        </Notice>
      ))}

      {orders
        .filter((d) => d.status !== 'needs_manual')
        .map((doc) => (
          <OrderSection
            key={doc.id}
            doc={doc}
            lines={lines.filter((l) => l.documentId === doc.id)}
            snapshot={snapshot}
            onField={field}
            onClassify={classify}
            onAccept={(line) => classify(line, { moduleType: line.suggestion.moduleType, pairedToLineId: line.suggestion.pairedToLineId })}
            onDelete={(line) => run(() => api.deleteLine(line.id, { actor }))}
            onError={setProblem}
            onAdd={(d) => run(() => api.addLine(d.id, { title: 'New line', qty: 1 }, { actor }))}
          />
        ))}

      <Card title="Next step">
        <StageActions snapshot={snapshot} />
        {!project.classify && can(actor, 'classify') && (
          <div className="action-row">
            <button type="button" className="btn ghost sm" disabled={busy} onClick={() => run(() => api.rerunRules(project.id, { actor }))}>
              Run the rules again
            </button>
            <small>Lines a person has changed are left as they are.</small>
          </div>
        )}
      </Card>

      <ReasonDialog
        open={Boolean(pending)}
        title="Change the classification"
        description={pending ? `Line ${pending.line.no}: ${pending.line.title}. The reason is recorded with your name.` : ''}
        confirmLabel="Save change"
        busy={busy}
        error={error}
        onConfirm={applyReason}
        onClose={() => {
          clear();
          setPending(null);
        }}
      />
    </div>
  );
}

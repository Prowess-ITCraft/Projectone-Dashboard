import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Card, DataTable, Dialog, Notice, StatusBadge } from '@/components';
import { useActor } from '@/app/actor';
import { useApi } from '@/data/api';
import { DOCUMENT_TYPES } from '@/domain/documents';
import { can } from '@/domain/permissions';
import { useAction } from '@/lib/useAction';
import { DocumentViewer } from './DocumentViewer';
import { DuplicateDialog } from './DuplicateDialog';
import { ManualEntryDialog } from './ManualEntryDialog';
import { UploadCard } from './UploadCard';
import { DOCUMENT_STATUS, formatDate } from './labels';

const COLUMNS = ['Type', 'Number', 'Date', 'File', 'Status', 'Lines', ''];
const ORDER_TYPES = [
  ['pi', 'Proforma invoice'],
  ['po', 'Purchase order'],
];

export default function DocumentsTab({ snapshot }) {
  const api = useApi();
  const { actor } = useActor();
  const [run, { busy, error, clear }] = useAction();
  // a new project hands over what went wrong with a file it could not add
  const [message, setMessage] = useState(useLocation().state?.notice ?? '');
  const [viewing, setViewing] = useState(null);
  const [editing, setEditing] = useState(null);
  const [comparing, setComparing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const { project, customer, documents, lines } = snapshot;
  const locked = Boolean(project.intake);
  const allowed = can(actor, 'upload');

  const upload = async (file, type) => {
    setMessage('');
    const result = await run(() => api.addDocument({ projectId: project.id, type, file, actor }));
    if (!result) return;
    const { document, duplicateOf, recognised } = result;
    if (duplicateOf) return setComparing({ document, existing: duplicateOf });
    if (document.status === 'needs_manual') {
      setMessage(`${file.name} is not a known sample, so its lines need to be entered by hand.`);
      return setEditing(document);
    }
    const count = lines.filter((l) => l.documentId === document.id).length;
    setMessage(
      recognised
        ? `${file.name} was recognised. ${document.type === 'prismsuite' ? `${document.recommendations.length} recommendations were read.` : 'The lines were read and classified; review them before confirming.'}`
        : `${file.name} was added.${count ? '' : ' It is attached for reference.'}`,
    );
  };

  const doRemove = async () => {
    const ok = await run(async () => {
      await api.removeDocument(removing.id, { actor });
      return true;
    });
    if (ok) setRemoving(null);
  };

  const rows = [...documents].sort((a, b) => Number(b.active) - Number(a.active) || a.createdAt - b.createdAt);
  const statusOf = (d) =>
    d.pendingDuplicate
      ? { label: 'Waiting for your decision', tone: 'warning' }
      : !d.active
        ? { label: 'Replaced, kept as history', tone: 'muted' }
        : (DOCUMENT_STATUS[d.status] ?? { label: d.status, tone: 'neutral' });

  const billToMismatch = documents.find(
    (d) => d.active && d.billTo?.gstin && customer?.gstin && d.billTo.gstin.toUpperCase() !== customer.gstin.toUpperCase(),
  );

  return (
    <div className="stack">
      {locked && (
        <Notice tone="info">
          The intake review is confirmed, so order documents are locked. Reopen the review from the overview to change them.
        </Notice>
      )}
      {!allowed && <Notice tone="warning">Your role cannot upload documents.</Notice>}
      {error && (
        <Notice
          tone="error"
          actions={
            <button type="button" className="btn ghost sm" onClick={clear}>
              Dismiss
            </button>
          }
        >
          {error}
        </Notice>
      )}
      {message && <Notice tone="info">{message}</Notice>}
      {billToMismatch && (
        <Notice tone="warning" title="The bill-to GSTIN differs from this project's customer">
          {DOCUMENT_TYPES[billToMismatch.type]} {billToMismatch.number} is billed to GSTIN {billToMismatch.billTo.gstin}, the customer has{' '}
          {customer.gstin}. Check that the document belongs to this project.
        </Notice>
      )}

      <div className="upload-grid">
        <UploadCard title="Order document" hint="Required" types={ORDER_TYPES} disabled={locked || !allowed} busy={busy} onFile={upload} />
        <UploadCard
          title="PrismSuite report"
          hint="Optional"
          types={[['prismsuite', 'PrismSuite report']]}
          disabled={!allowed}
          busy={busy}
          onFile={upload}
        />
      </div>

      <Card flush title="Documents" hint={<span className="num">{documents.filter((d) => d.active).length}</span>}>
        <DataTable
          columns={COLUMNS}
          isEmpty={!rows.length}
          empty="No documents yet. Add the proforma invoice or purchase order above."
          className="documents"
        >
          {rows.map((d) => {
            const status = statusOf(d);
            const count = lines.filter((l) => l.documentId === d.id).length;
            return (
              <tr key={d.id} className={d.active ? '' : 'muted-row'}>
                <td>{DOCUMENT_TYPES[d.type]}</td>
                <td className="strong">{d.number || 'Not entered'}</td>
                <td>{formatDate(d.date)}</td>
                <td className="file-name">{d.fileName}</td>
                <td>
                  <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                </td>
                <td className="num">{d.type === 'prismsuite' ? `${d.recommendations?.length ?? 0} recommendations` : count}</td>
                <td className="row-actions">
                  {d.pendingDuplicate ? (
                    <button
                      type="button"
                      className="btn sm"
                      onClick={() => setComparing({ document: d, existing: documents.find((x) => x.id === d.duplicateOfId) })}
                    >
                      Compare
                    </button>
                  ) : (
                    <>
                      {d.fileId && (
                        <button type="button" className="btn ghost sm" onClick={() => setViewing(d)}>
                          View original
                        </button>
                      )}
                      {d.active && allowed && !(locked && d.type !== 'prismsuite') && (
                        <button type="button" className="btn ghost sm" onClick={() => setEditing(d)}>
                          {d.status === 'needs_manual' ? 'Enter details' : 'Details'}
                        </button>
                      )}
                      {d.active && allowed && !(locked && d.type !== 'prismsuite') && (
                        <button
                          type="button"
                          className="btn ghost sm"
                          onClick={() => {
                            clear();
                            setRemoving(d);
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </DataTable>
      </Card>

      <Dialog open={Boolean(viewing)} wide onClose={() => setViewing(null)} title={viewing?.fileName ?? ''}>
        {viewing && <DocumentViewer fileId={viewing.fileId} title={viewing.fileName} className="viewer-tall" />}
      </Dialog>

      {editing && (
        <ManualEntryDialog
          document={editing}
          lines={lines.filter((l) => l.documentId === editing.id)}
          onClose={() => setEditing(null)}
          onDuplicate={(document, existing) => {
            setEditing(null);
            setComparing({ document, existing });
          }}
        />
      )}

      {comparing && (
        <DuplicateDialog
          candidate={comparing.document}
          existing={comparing.existing}
          projectId={project.id}
          onClose={() => setComparing(null)}
        />
      )}

      <Dialog
        open={Boolean(removing)}
        role="alertdialog"
        onClose={() => setRemoving(null)}
        title="Remove this document?"
        description={removing ? `${removing.fileName} and the lines read from it are deleted. This cannot be undone.` : ''}
        actions={
          <>
            <button type="button" className="btn ghost sm" onClick={() => setRemoving(null)} data-autofocus>
              Cancel
            </button>
            <button type="button" className="btn sm" disabled={busy} onClick={doRemove}>
              Remove
            </button>
          </>
        }
      >
        {error && removing && <Notice tone="error">{error}</Notice>}
      </Dialog>
    </div>
  );
}

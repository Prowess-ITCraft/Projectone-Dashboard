import { useState } from 'react';
import { DownloadSimpleIcon } from '@phosphor-icons/react';
import { Notice } from '@/components';
import { fileProblem } from '@/domain/files';
import { UploadCard } from './UploadCard';

const ORDER_TYPES = [
  ['pi', 'Proforma invoice'],
  ['po', 'Purchase order'],
];

/*
  How a new project gets its documents. What is offered depends on the entry path: a post-audit project can import from
  PrismSuite (not connected yet, so the button only says so), upload the PO/PI and upload the PrismSuite report; new
  infrastructure and restructuring offer the PO/PI and the PrismSuite report only. Nothing is shown until an entry path
  is chosen. The chosen files are only held here and are added once the project is created.
  `value` is { order: File|null, orderType: 'pi'|'po', report: File|null }.
*/
export function StartingDocuments({ entryPath, value, onChange, disabled = false }) {
  const [problem, setProblem] = useState('');
  const [prismNote, setPrismNote] = useState(false);

  if (!entryPath) return <p className="muted">Choose an entry path to add the documents.</p>;

  const take = (key) => (file, extra) => {
    const why = fileProblem(file);
    setProblem(why ? `${file.name}: ${why}` : '');
    if (!why) onChange({ ...value, [key]: file, ...extra });
  };

  return (
    <div className="start-docs" role="group" aria-label="Documents">
      {entryPath === 'post_audit' && (
        <div className="action-row">
          <button type="button" className="btn ghost sm" disabled={disabled} onClick={() => setPrismNote(true)}>
            <DownloadSimpleIcon size={15} aria-hidden="true" />
            Import from PrismSuite
          </button>
          <small>or upload the documents below</small>
        </div>
      )}
      {prismNote && (
        <Notice
          tone="info"
          actions={
            <button type="button" className="btn ghost sm" onClick={() => setPrismNote(false)}>
              Dismiss
            </button>
          }
        >
          PrismSuite is not integrated yet.
        </Notice>
      )}
      {problem && <Notice tone="error">{problem}</Notice>}
      <div className="upload-grid">
        <UploadCard
          title="Order document"
          hint="PO/PI"
          types={ORDER_TYPES}
          disabled={disabled}
          value={value.order}
          onFile={(file, type) => take('order')(file, { orderType: type })}
          onTypeChange={(orderType) => onChange({ ...value, orderType })}
          onClear={() => onChange({ ...value, order: null })}
        />
        <UploadCard
          title="PrismSuite report"
          hint="Optional"
          types={[['prismsuite', 'PrismSuite report']]}
          disabled={disabled}
          value={value.report}
          onFile={(file) => take('report')(file)}
          onClear={() => onChange({ ...value, report: null })}
        />
      </div>
    </div>
  );
}

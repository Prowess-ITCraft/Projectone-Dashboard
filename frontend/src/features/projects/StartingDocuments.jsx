import { useId, useRef, useState } from 'react';
import { DownloadSimpleIcon, UploadSimpleIcon } from '@phosphor-icons/react';
import { FormField, Icon, Notice, SegmentedControl } from '@/components';
import { ACCEPT_ATTRIBUTE, fileProblem } from '@/domain/files';

const ORDER_TYPES = [
  ['pi', 'Proforma invoice'],
  ['po', 'Purchase order'],
];

/*
  How a new project gets its first document: an import from PrismSuite, or an uploaded purchase order or proforma
  invoice, and optionally an uploaded PrismSuite report. PrismSuite is not connected yet, so its import button only
  says so; when the integration exists it opens the import here instead. The chosen files are only held here and are
  added once the project is created.
  `value` is { order: File|null, orderType: 'pi'|'po', report: File|null }.
*/
export function StartingDocuments({ value, onChange, disabled = false }) {
  const id = useId();
  const orderInput = useRef(null);
  const reportInput = useRef(null);
  const [problem, setProblem] = useState('');
  const [prismNote, setPrismNote] = useState(false);

  const take = (key) => (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const why = fileProblem(file);
    setProblem(why ? `${file.name}: ${why}` : '');
    if (!why) onChange({ ...value, [key]: file });
  };

  return (
    <div className="start-docs" role="group" aria-label="First document">
      <div className="action-row">
        <button type="button" className="btn ghost sm" disabled={disabled} onClick={() => setPrismNote(true)}>
          <DownloadSimpleIcon size={15} aria-hidden="true" />
          Import from PrismSuite
        </button>
        <small>or</small>
        <button type="button" className="btn ghost sm" disabled={disabled} onClick={() => orderInput.current?.click()}>
          <UploadSimpleIcon size={15} aria-hidden="true" />
          Upload PO/PI
        </button>
        <input ref={orderInput} type="file" hidden accept={ACCEPT_ATTRIBUTE} aria-label="PO or PI file" onChange={take('order')} />
        <span className="upload-option">
          <button type="button" className="btn ghost sm" disabled={disabled} onClick={() => reportInput.current?.click()}>
            <UploadSimpleIcon size={15} aria-hidden="true" />
            Upload PrismSuite report
          </button>
          <small>Optional, if a report exists</small>
        </span>
        <input
          ref={reportInput}
          type="file"
          hidden
          accept={ACCEPT_ATTRIBUTE}
          aria-label="PrismSuite report file"
          onChange={take('report')}
        />
      </div>
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
      {value.report && (
        <ul className="site-list">
          <li className="site-item">
            <div>
              <b>PrismSuite report</b>
              <small>{value.report.name}</small>
            </div>
            <button type="button" className="btn ghost sm" onClick={() => onChange({ ...value, report: null })}>
              <Icon name="Trash" size={15} />
              Remove PrismSuite report
            </button>
          </li>
        </ul>
      )}
      {value.order && (
        <>
          <ul className="site-list">
            <li className="site-item">
              <div>
                <b>Order document</b>
                <small>{value.order.name}</small>
              </div>
              <button type="button" className="btn ghost sm" onClick={() => onChange({ ...value, order: null })}>
                <Icon name="Trash" size={15} />
                Remove order document
              </button>
            </li>
          </ul>
          <FormField label="The order document is a" group>
            {(f) => (
              <SegmentedControl
                {...f.control}
                id={`${id}-order-type`}
                value={value.orderType}
                options={ORDER_TYPES}
                onChange={(orderType) => onChange({ ...value, orderType })}
              />
            )}
          </FormField>
        </>
      )}
    </div>
  );
}

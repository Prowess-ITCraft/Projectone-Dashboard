import { useState } from 'react';
import { Dialog, FormField, Notice, SegmentedControl } from '@/components';
import { useActor } from '@/app/actor';
import { useApi } from '@/data/api';
import { DOCUMENT_TYPES } from '@/domain/documents';
import { useAction } from '@/lib/useAction';
import { LineRowsEditor, newRow } from './LineRowsEditor';

/*
  Type in what a document says, for a file the app does not recognise or to correct what was read. It writes the same
  fields a parser would, so the review and classification that follow cannot tell the difference.
  A PrismSuite report only needs its customer, date and recommendations (one per line) for the coverage check.
*/
export function ManualEntryDialog({ document: doc, lines, onClose, onDuplicate }) {
  const api = useApi();
  const { actor } = useActor();
  const [run, { busy, error }] = useAction();
  const isReport = doc.type === 'prismsuite';
  const isPi = doc.type === 'pi';

  const [h, setH] = useState({
    number: doc.number ?? '',
    date: doc.date ?? '',
    poType: doc.poType || (isPi ? 'po' : ''),
    poNumber: doc.poNumber ?? '',
    quoteRef: doc.quoteRef ?? '',
    referencePi: doc.referencePi ?? '',
    billTo: { name: '', address: '', gstin: '', contact: '', email: '', ...doc.billTo },
    recommendations: (doc.recommendations ?? []).join('\n'),
  });
  const [rows, setRows] = useState(() => (lines.length ? lines.map((l) => newRow(l)) : [newRow()]));
  const [problem, setProblem] = useState('');

  const set = (key) => (e) => setH({ ...h, [key]: e.target.value });
  const setBill = (key) => (e) => setH({ ...h, billTo: { ...h.billTo, [key]: e.target.value } });

  const submit = async (e) => {
    e.preventDefault();
    setProblem('');
    let header;
    let outLines = [];
    if (isReport) {
      header = {
        date: h.date,
        billTo: { ...h.billTo },
        recommendations: h.recommendations
          .split('\n')
          .map((t) => t.trim())
          .filter(Boolean),
      };
    } else {
      header = {
        number: h.number,
        date: h.date,
        poType: isPi ? h.poType : '',
        poNumber: isPi && h.poType === 'po' ? h.poNumber : '',
        quoteRef: h.quoteRef,
        referencePi: h.referencePi,
        billTo: { ...h.billTo },
      };
      outLines = rows.map((r, i) => ({
        no: i + 1,
        title: r.title.trim(),
        qty: Number(r.qty),
        scopeItems: r.scope
          .split('\n')
          .map((t) => t.trim())
          .filter(Boolean),
        supportScope: r.keep.supportScope,
        perEndpoint: r.keep.perEndpoint,
      }));
    }
    const result = await run(() => api.saveDocumentDetails(doc.id, { header, lines: outLines, actor }));
    if (!result) return;
    if (result.duplicateOf) onDuplicate(result.document, result.duplicateOf);
    else onClose();
  };

  return (
    <Dialog
      open
      wide
      onClose={onClose}
      title={`${DOCUMENT_TYPES[doc.type]} details`}
      description={`Type in what ${doc.fileName} says. Open the original from the documents list to read it.`}
      actions={
        <>
          <button type="button" className="btn ghost sm" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="manual-entry" className="btn sm" disabled={busy}>
            Save details
          </button>
        </>
      }
    >
      <form id="manual-entry" onSubmit={submit} noValidate className="stack">
        {(problem || error) && <Notice tone="error">{problem || error}</Notice>}
        <div className="form-grid">
          {!isReport && (
            <FormField label="Document number">
              {(f) => <input {...f.control} className="input" value={h.number} onChange={set('number')} data-autofocus />}
            </FormField>
          )}
          <FormField label="Document date">
            {(f) => <input {...f.control} type="date" className="input" value={h.date} onChange={set('date')} />}
          </FormField>
          {isPi && (
            <>
              <FormField label="Customer order" group>
                {(f) => (
                  <SegmentedControl
                    {...f.control}
                    id="po-type"
                    value={h.poType}
                    options={[
                      ['po', 'Has a PO number'],
                      ['call_confirmation', 'Call confirmation'],
                    ]}
                    onChange={(poType) => setH({ ...h, poType })}
                  />
                )}
              </FormField>
              {h.poType === 'po' && (
                <FormField label="PO number">
                  {(f) => <input {...f.control} className="input" value={h.poNumber} onChange={set('poNumber')} />}
                </FormField>
              )}
              <FormField label="Quote reference">
                {(f) => <input {...f.control} className="input" value={h.quoteRef} onChange={set('quoteRef')} />}
              </FormField>
            </>
          )}
          {doc.type === 'po' && (
            <FormField label="Refers to proforma invoice" hint="Optional. The PI number printed on the order.">
              {(f) => <input {...f.control} className="input" value={h.referencePi} onChange={set('referencePi')} />}
            </FormField>
          )}
        </div>

        <fieldset className="plain-set">
          <legend>{isReport ? 'Customer' : 'Bill to'}</legend>
          <div className="form-grid">
            <FormField label={isReport ? 'Customer name' : 'Name'}>
              {(f) => <input {...f.control} className="input" value={h.billTo.name} onChange={setBill('name')} />}
            </FormField>
            <FormField label={isReport ? 'Location printed on the report' : 'Address'}>
              {(f) => <input {...f.control} className="input" value={h.billTo.address} onChange={setBill('address')} />}
            </FormField>
            {!isReport && (
              <>
                <FormField label="GSTIN">
                  {(f) => <input {...f.control} className="input" value={h.billTo.gstin} onChange={setBill('gstin')} />}
                </FormField>
                <FormField label="Contact person">
                  {(f) => <input {...f.control} className="input" value={h.billTo.contact} onChange={setBill('contact')} />}
                </FormField>
              </>
            )}
          </div>
        </fieldset>

        {isReport ? (
          <FormField
            label="Recommendations"
            hint="One per line, as the report words them. They are compared with the order in the coverage tab."
          >
            {(f) => (
              <textarea {...f.control} className="input textarea" rows={8} value={h.recommendations} onChange={set('recommendations')} />
            )}
          </FormField>
        ) : (
          <fieldset className="plain-set">
            <legend>Order lines</legend>
            <LineRowsEditor rows={rows} onChange={setRows} />
          </fieldset>
        )}
      </form>
    </Dialog>
  );
}

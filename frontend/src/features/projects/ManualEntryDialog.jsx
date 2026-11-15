import { useState } from 'react';
import { Dialog, FormField, Notice, SegmentedControl } from '@/components';
import { useActor } from '@/app/actor';
import { useApi } from '@/data/api';
import { DOCUMENT_TYPES } from '@/domain/documents';
import { gstOf, paiseToInput, sumPaise, toPaise } from '@/domain/money';
import { can } from '@/domain/permissions';
import { useAction } from '@/lib/useAction';
import { LineRowsEditor, newRow } from './LineRowsEditor';

const money = (v) => paiseToInput(v);

/*
  Type in what a document says, for a file the app does not recognise or to correct what was read. It writes the same
  fields a parser would, so the review and classification that follow cannot tell the difference.
  A PrismSuite report only needs its customer, date and recommendations (one per line) for the coverage check.
*/
export function ManualEntryDialog({ document: doc, lines, onClose, onDuplicate }) {
  const api = useApi();
  const { actor } = useActor();
  const [run, { busy, error }] = useAction();
  const showMoney = can(actor, 'view_financials');
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
  const [totals, setTotals] = useState({
    subtotal: money(doc.totals?.subtotalPaise),
    gst: money(doc.totals?.gstPaise),
    roundOff: money(doc.totals?.roundOffPaise ?? 0),
    grand: money(doc.totals?.grandPaise),
  });
  const [rows, setRows] = useState(() => (lines.length ? lines.map((l) => newRow(l)) : [newRow()]));
  const [problem, setProblem] = useState('');

  const set = (key) => (e) => setH({ ...h, [key]: e.target.value });
  const setBill = (key) => (e) => setH({ ...h, billTo: { ...h.billTo, [key]: e.target.value } });
  const setTotal = (key) => (e) => setTotals({ ...totals, [key]: e.target.value });

  const fillTotals = () => {
    const subtotal = sumPaise(rows.map((r) => toPaise(r.amount)));
    const gst = gstOf(subtotal);
    const roundOff = toPaise(totals.roundOff) ?? 0;
    setTotals({ ...totals, subtotal: money(subtotal), gst: money(gst), grand: money(subtotal + gst + roundOff) });
  };

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
      for (const [i, r] of rows.entries()) {
        if (showMoney && r.rate.trim() && toPaise(r.rate) === null) return setProblem(`Line ${i + 1}: the rate is not a valid amount.`);
        if (showMoney && r.amount.trim() && toPaise(r.amount) === null)
          return setProblem(`Line ${i + 1}: the amount is not a valid amount.`);
      }
      const parsed = showMoney
        ? { subtotal: toPaise(totals.subtotal), gst: toPaise(totals.gst), roundOff: toPaise(totals.roundOff), grand: toPaise(totals.grand) }
        : null;
      if (showMoney && Object.entries(totals).some(([k, v]) => v.trim() && parsed[k] === null))
        return setProblem('A total is not a valid amount.');
      header = {
        number: h.number,
        date: h.date,
        poType: isPi ? h.poType : '',
        poNumber: isPi && h.poType === 'po' ? h.poNumber : '',
        quoteRef: h.quoteRef,
        referencePi: h.referencePi,
        billTo: { ...h.billTo },
        totals: showMoney
          ? { subtotalPaise: parsed.subtotal, gstPaise: parsed.gst, roundOffPaise: parsed.roundOff ?? 0, grandPaise: parsed.grand }
          : (doc.totals ?? null),
      };
      outLines = rows.map((r, i) => ({
        no: i + 1,
        title: r.title.trim(),
        qty: Number(r.qty),
        ratePaise: showMoney ? toPaise(r.rate) : r.keep.ratePaise,
        amountPaise: showMoney ? toPaise(r.amount) : r.keep.amountPaise,
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
        {!showMoney && !isReport && (
          <Notice tone="info">Rates and totals are entered by the project lead. Quantities and descriptions are yours.</Notice>
        )}

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
          <>
            <fieldset className="plain-set">
              <legend>Order lines</legend>
              <LineRowsEditor rows={rows} onChange={setRows} showMoney={showMoney} />
            </fieldset>
            {showMoney && (
              <fieldset className="plain-set">
                <legend>Totals</legend>
                <div className="form-grid four">
                  <FormField label="Subtotal">
                    {(f) => (
                      <input {...f.control} className="input" inputMode="decimal" value={totals.subtotal} onChange={setTotal('subtotal')} />
                    )}
                  </FormField>
                  <FormField label="GST (18 percent)">
                    {(f) => <input {...f.control} className="input" inputMode="decimal" value={totals.gst} onChange={setTotal('gst')} />}
                  </FormField>
                  <FormField label="Round off">
                    {(f) => (
                      <input {...f.control} className="input" inputMode="decimal" value={totals.roundOff} onChange={setTotal('roundOff')} />
                    )}
                  </FormField>
                  <FormField label="Grand total">
                    {(f) => (
                      <input {...f.control} className="input" inputMode="decimal" value={totals.grand} onChange={setTotal('grand')} />
                    )}
                  </FormField>
                </div>
                <button type="button" className="btn ghost sm" onClick={fillTotals}>
                  Work out the totals from the lines
                </button>
              </fieldset>
            )}
          </>
        )}
      </form>
    </Dialog>
  );
}

import { toPaise } from './money';

export const DOCUMENT_TYPES = { pi: 'Proforma invoice', po: 'Purchase order', prismsuite: 'PrismSuite report' };

const paise = (v) => (v === undefined || v === null ? null : toPaise(v));

/*
  Turns the JSON a parser produced (the shape of the sample extractions) into a document record plus raw lines.
  The extraction's own kind, module and pairing fields are ignored: classification is done by the rules, and the
  extraction's values are what the tests compare the rules against.
*/
export function extractionToDocument(json) {
  if (json.document_type === 'prismsuite') {
    return {
      document: {
        type: 'prismsuite',
        number: '',
        date: json.date ?? '',
        issuer: 'PrismSuite',
        billTo: { name: json.customer ?? '', address: json.location_printed ?? '', gstin: '', contact: '', email: '' },
        recommendations: [...(json.recommendations ?? [])],
        totals: null,
        terms: [],
      },
      lines: [],
    };
  }
  const isPi = json.document_type === 'pi';
  const t = json.totals ?? {};
  const callConfirmation = /call confirmation/i.test(json.po_number ?? '');
  return {
    document: {
      type: json.document_type,
      number: json.number ?? '',
      date: json.date ?? '',
      issuer: json.issuer ?? '',
      poNumber: callConfirmation ? '' : (json.po_number ?? ''),
      poType: callConfirmation ? 'call_confirmation' : json.po_number ? 'po' : '',
      poDate: json.po_date ?? '',
      quoteRef: json.quote_ref ?? '',
      referencePi: json.reference_pi ?? '',
      referencePiDate: json.reference_pi_date ?? '',
      billTo: isPi
        ? {
            name: json.customer?.name ?? '',
            address: json.customer?.address ?? '',
            gstin: json.customer?.gstin ?? '',
            contact: json.customer?.contact ?? '',
            email: json.customer?.email ?? '',
          }
        : { name: json.issuer ?? '', address: '', gstin: '', contact: '', email: '' },
      totals: {
        subtotalPaise: paise(t.subtotal),
        gstPaise: paise(t.gst_18),
        roundOffPaise: paise(t.round_off ?? 0),
        grandPaise: paise(t.grand_total),
      },
      terms: [...(json.terms ?? [])],
      recommendations: [],
    },
    lines: (json.lines ?? []).map((l) => ({
      no: l.no,
      title: l.title,
      qty: l.qty,
      ratePaise: paise(l.rate),
      amountPaise: paise(l.amount),
      scopeItems: [...(l.scope_items ?? [])],
      supportScope: l.support_scope === true,
      perEndpoint: l.per_endpoint === true,
    })),
  };
}

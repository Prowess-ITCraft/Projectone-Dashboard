import { isValidGstin } from './gstin';
import { gstOf, lineAmount, sumPaise } from './money';

const TOLERANCE = 100; // one rupee, for rounding on printed documents
const DAY = 864e5;

/* How long a proforma invoice stays valid, from its terms ("Prices valid 5 days") */
export const PI_VALID_DAYS = 5;

/*
  Checks a parsed or typed document against the rules in context pack 06, section 2. Every finding is a warning:
  nothing here blocks the flow, a person decides. `financial` findings quote amounts, so only roles that may see
  money are shown their text.
*/
export function validateDocument(doc, lines, today = new Date()) {
  const issues = [];
  const add = (id, message, financial = false) => issues.push({ id, message, financial, severity: 'warning' });
  const t = doc.totals ?? {};

  if (!lines.length) add('no-lines', 'No order lines yet.');

  lines.forEach((l) => {
    if (l.ratePaise !== null && l.ratePaise !== undefined && l.amountPaise !== null && l.amountPaise !== undefined) {
      if (Math.abs(lineAmount(l.qty, l.ratePaise) - l.amountPaise) > 1)
        add(`line-${l.no}`, `Line ${l.no}: quantity times rate does not equal the amount.`, true);
    }
  });

  if (t.subtotalPaise !== null && t.subtotalPaise !== undefined) {
    const sum = sumPaise(lines.map((l) => l.amountPaise));
    if (Math.abs(sum - t.subtotalPaise) > TOLERANCE) add('subtotal', 'The line amounts do not add up to the subtotal.', true);
    if (t.gstPaise !== null && t.gstPaise !== undefined && Math.abs(gstOf(t.subtotalPaise) - t.gstPaise) > TOLERANCE) {
      add('gst', 'GST is not 18 percent of the subtotal.', true);
    }
    if (t.grandPaise !== null && t.grandPaise !== undefined) {
      const expected = t.subtotalPaise + (t.gstPaise ?? 0) + (t.roundOffPaise ?? 0);
      if (Math.abs(expected - t.grandPaise) > TOLERANCE) add('grand', 'The grand total is not the subtotal plus GST and round off.', true);
    }
  }

  if (doc.type === 'pi' && doc.date) {
    const age = Math.floor((today.getTime() - new Date(`${doc.date}T00:00:00Z`).getTime()) / DAY);
    if (age > PI_VALID_DAYS)
      add('expired', `This proforma invoice was valid for ${PI_VALID_DAYS} days and is ${age - PI_VALID_DAYS} days past that.`);
  }

  if (doc.billTo?.gstin && !isValidGstin(doc.billTo.gstin)) add('gstin', 'The bill-to GSTIN is not in a valid format.');
  return issues;
}

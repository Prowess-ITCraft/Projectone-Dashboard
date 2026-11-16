import { isValidGstin } from './gstin';

const DAY = 864e5;

/* How long a proforma invoice stays valid, from its terms ("Prices valid 5 days") */
export const PI_VALID_DAYS = 5;

/*
  Checks a parsed or typed document against the intake rules (context pack 06, section 2). Every finding is a warning:
  nothing here blocks the flow, a person decides. Only non-financial facts are checked, because Project One holds
  no amounts, totals or taxes.
*/
export function validateDocument(doc, lines, today = new Date()) {
  const issues = [];
  const add = (id, message) => issues.push({ id, message, severity: 'warning' });

  if (!lines.length) add('no-lines', 'No order lines yet.');

  if (doc.type === 'pi' && doc.date) {
    const age = Math.floor((today.getTime() - new Date(`${doc.date}T00:00:00Z`).getTime()) / DAY);
    if (age > PI_VALID_DAYS)
      add('expired', `This proforma invoice was valid for ${PI_VALID_DAYS} days and is ${age - PI_VALID_DAYS} days past that.`);
  }

  if (doc.billTo?.gstin && !isValidGstin(doc.billTo.gstin)) add('gstin', 'The bill-to GSTIN is not in a valid format.');
  return issues;
}

import { normaliseGstin } from './gstin';

const NOISE = /\b(m\/s|messrs|pvt|private|ltd|limited|llp|inc|co|the)\b/g;

/* "M/S Sample Industries Pvt. Ltd." and "sample industries" compare equal */
export const normaliseName = (name) =>
  String(name ?? '')
    .toLowerCase()
    .replace(NOISE, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/* A plain format check for a contact email (something@domain.tld); it does not prove the address exists */
export const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? '').trim());

/* A customer counts as audited once a PrismSuite report is attached to any of its projects; nothing else sets it */
export const isAudited = (documents) => documents.some((d) => d.type === 'prismsuite' && d.active && !d.pendingDuplicate);

/*
  Existing customers that may be the same as the one being entered: same GSTIN first, then the same or a contained
  name. A match is only a suggestion; the user always confirms, and records are never merged silently.
*/
export function matchCustomers(customers, { gstin, name }) {
  const g = normaliseGstin(gstin);
  const n = normaliseName(name);
  const found = [];
  customers.forEach((c) => {
    if (g && normaliseGstin(c.gstin) === g) return found.push({ customer: c, reason: 'gstin' });
    const other = normaliseName(c.name);
    if (n.length >= 3 && other && (other === n || other.includes(n) || n.includes(other))) found.push({ customer: c, reason: 'name' });
  });
  return found.sort((a, b) => (a.reason === b.reason ? 0 : a.reason === 'gstin' ? -1 : 1));
}

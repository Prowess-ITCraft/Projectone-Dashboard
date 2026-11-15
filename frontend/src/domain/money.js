/* Money is whole paise (integers), never floating point. Rs 1,75,893.00 is 17589300. */

const NUMBER = /^-?\d+(\.\d{1,2})?$/;

/* Rupees as a number or text ("1,75,893.00", "Rs 500") to paise. Returns null when it is not a valid amount. */
export function toPaise(value) {
  if (value === null || value === undefined || value === '') return null;
  const text = String(value).replace(/[₹,\s]|rs\.?/gi, '');
  if (!NUMBER.test(text)) return null;
  const negative = text.startsWith('-');
  const [whole, frac = ''] = text.replace('-', '').split('.');
  const paise = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  return negative ? -paise : paise;
}

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });

/* Paise to "₹1,75,893.00" in Indian digit grouping */
export function formatINR(paise) {
  if (paise === null || paise === undefined) return '';
  return inr.format(paise / 100);
}

/* Paise to plain editable text such as "175893.00" */
export function paiseToInput(paise) {
  if (paise === null || paise === undefined) return '';
  const abs = Math.abs(paise);
  return `${paise < 0 ? '-' : ''}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/* Quantity times rate. Quantities may be fractional, so the result is rounded to a whole paisa. */
export const lineAmount = (qty, ratePaise) => Math.round(Number(qty) * ratePaise);

export const sumPaise = (values) => values.reduce((total, v) => total + (v ?? 0), 0);

/* GST at a percentage of a subtotal, rounded to a whole paisa */
export const gstOf = (subtotalPaise, percent = 18) => Math.round((subtotalPaise * percent) / 100);

export const newId = () => crypto.randomUUID();

/* Indian financial year (April to March) as the four digits used in numbers: 2026-11-16 gives "2627" */
export function financialYear(date = new Date()) {
  const ist = new Date(date.getTime() + 5.5 * 36e5);
  const year = ist.getUTCMonth() >= 3 ? ist.getUTCFullYear() : ist.getUTCFullYear() - 1;
  return `${String(year).slice(-2)}${String(year + 1).slice(-2)}`;
}

export const projectNumber = (fy, n) => `PRJ-${fy}-${String(n).padStart(4, '0')}`;
export const customerNumber = (n) => `CUS-${String(n).padStart(4, '0')}`;

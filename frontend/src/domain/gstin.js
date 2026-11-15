const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export const normaliseGstin = (value) =>
  String(value ?? '')
    .replace(/\s/g, '')
    .toUpperCase();

/* Format check only (15 characters: state code, PAN, entity, Z, check digit). It does not prove the number exists. */
export const isValidGstin = (value) => GSTIN.test(normaliseGstin(value));

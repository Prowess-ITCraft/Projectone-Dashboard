/*
  The file types a document may be uploaded as. Only PDFs can match a known sample; Word files are stored as
  the original and opened in manual entry. Their contents are never read. Excel is not accepted.
  The list is one place so the upload control and the adapter agree.
*/
export const FILE_KINDS = {
  pdf: { label: 'PDF', mime: 'application/pdf' },
  docx: { label: 'Word', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
};

export const ACCEPT_ATTRIBUTE = Object.entries(FILE_KINDS)
  .map(([ext, k]) => `.${ext},${k.mime}`)
  .join(',');

export const ACCEPTED_TEXT = 'PDF or Word (.docx)';

export const MAX_FILE_BYTES = 25 * 1024 * 1024;

/* Why a file cannot be uploaded, or undefined when it can. The same wording wherever a file is picked. */
export function fileProblem(file) {
  if (!fileKind(file)) return `Only ${ACCEPTED_TEXT} files can be uploaded.`;
  if (file.size > MAX_FILE_BYTES) return 'This file is larger than 25 MB.';
  return undefined;
}

/* "pdf" or "docx" for an accepted file, else null. The extension decides; the browser's type is a fallback. */
export function fileKind(file) {
  const ext = /\.([a-z0-9]+)$/i.exec(file?.name ?? '')?.[1]?.toLowerCase();
  if (ext && FILE_KINDS[ext]) return ext;
  return Object.keys(FILE_KINDS).find((k) => FILE_KINDS[k].mime === file?.type) ?? null;
}

/*
  Lookup tables are the customer's filled-in policy sheets. They are stored as supplied and never read into lines:
  a CSV is shown as a table in the page, a PDF opens in the browser's viewer, and a spreadsheet is opened in its program.
*/
export const LOOKUP_KINDS = {
  pdf: { label: 'PDF', mime: 'application/pdf' },
  csv: { label: 'CSV', mime: 'text/csv' },
  xlsx: { label: 'Excel', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  xls: { label: 'Excel', mime: 'application/vnd.ms-excel' },
};

export const LOOKUP_ACCEPT_ATTRIBUTE = Object.entries(LOOKUP_KINDS)
  .map(([ext, k]) => `.${ext},${k.mime}`)
  .join(',');

export const LOOKUP_ACCEPTED_TEXT = 'PDF, Excel or CSV';

/* "pdf", "csv", "xlsx" or "xls" for an accepted lookup table, else null */
export function lookupKind(file) {
  const ext = /\.([a-z0-9]+)$/i.exec(file?.name ?? '')?.[1]?.toLowerCase();
  return ext && LOOKUP_KINDS[ext] ? ext : null;
}

export function lookupProblem(file) {
  if (!lookupKind(file)) return `Only ${LOOKUP_ACCEPTED_TEXT} files can be uploaded.`;
  if (file.size > MAX_FILE_BYTES) return 'This file is larger than 25 MB.';
  return undefined;
}

/* Reads CSV text into rows of cells; quoted cells may hold commas, quotes ("") and line breaks */
export function parseCsv(input) {
  const text = String(input);
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : String(text);
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}

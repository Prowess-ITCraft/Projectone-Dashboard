/*
  The file types a document may be uploaded as. Only PDFs can match a known sample; Word and Excel files are stored as
  the original and opened in manual entry. Their contents are never read, so a spreadsheet that happens to hold prices
  adds no financial data to Project One. The list is one place so the upload control and the adapter agree.
*/
export const FILE_KINDS = {
  pdf: { label: 'PDF', mime: 'application/pdf' },
  docx: { label: 'Word', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  xlsx: { label: 'Excel', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
};

export const ACCEPT_ATTRIBUTE = Object.entries(FILE_KINDS)
  .map(([ext, k]) => `.${ext},${k.mime}`)
  .join(',');

export const ACCEPTED_TEXT = 'PDF, Word (.docx) or Excel (.xlsx)';

/* "pdf", "docx" or "xlsx" for an accepted file, else null. The extension decides; the browser's type is a fallback. */
export function fileKind(file) {
  const ext = /\.([a-z0-9]+)$/i.exec(file?.name ?? '')?.[1]?.toLowerCase();
  if (ext && FILE_KINDS[ext]) return ext;
  return Object.keys(FILE_KINDS).find((k) => FILE_KINDS[k].mime === file?.type) ?? null;
}

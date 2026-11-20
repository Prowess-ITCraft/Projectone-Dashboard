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

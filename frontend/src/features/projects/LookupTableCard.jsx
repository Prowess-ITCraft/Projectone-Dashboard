import { useEffect, useId, useState } from 'react';
import { ArrowSquareOutIcon, TrashIcon, UploadSimpleIcon } from '@phosphor-icons/react';
import { Card, DataTable, Notice } from '@/components';
import { useActor } from '@/app/actor';
import { useApi } from '@/data/api';
import { can } from '@/domain/permissions';
import { LOOKUP_ACCEPT_ATTRIBUTE, LOOKUP_ACCEPTED_TEXT, lookupProblem, parseCsv } from '@/domain/files';
import { lockedByStatus } from '@/domain/projects';
import { useAction } from '@/lib/useAction';
import { formatTimestamp } from './labels';

/* A CSV is read and drawn as a table; any other kind of file opens through a button */
function useStoredFile(fileId) {
  const api = useApi();
  const [file, setFile] = useState(null);
  useEffect(() => {
    let current = true;
    api.getFile(fileId).then((f) => current && setFile({ fileId, f: f ?? false }));
    return () => {
      current = false;
    };
  }, [api, fileId]);
  return file && file.fileId === fileId ? file.f : null;
}

function CsvTable({ blob }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    let current = true;
    blob.text().then((t) => current && setRows(parseCsv(t)));
    return () => {
      current = false;
    };
  }, [blob]);
  if (!rows) return <p className="muted">Reading the table.</p>;
  if (!rows.length) return <p className="muted">The file has no rows.</p>;
  const [head, ...body] = rows;
  return (
    <div className="lookup-table">
      <DataTable columns={head.map((h, i) => h || `Column ${i + 1}`)} isEmpty={!body.length} empty="The table has a header and no rows.">
        {body.map((r, i) => (
          <tr key={i}>
            {head.map((_, c) => (
              <td key={c}>{r[c] ?? ''}</td>
            ))}
          </tr>
        ))}
      </DataTable>
    </div>
  );
}

export function LookupTableCard({ project }) {
  const api = useApi();
  const { actor } = useActor();
  const id = useId();
  const [run, { busy, error, clear }] = useAction();
  const [problem, setProblem] = useState('');
  const [dragging, setDragging] = useState(false);
  const table = project.lookupTable;
  const stored = useStoredFile(table?.fileId);
  const allowed = can(actor, 'upload') && !lockedByStatus(project);

  const take = (files) => {
    const file = files?.[0];
    if (!file || !allowed) return;
    const why = lookupProblem(file);
    setProblem(why ? `${file.name}: ${why}` : '');
    if (!why) {
      clear();
      run(() => api.setLookupTable({ projectId: project.id, file, actor }));
    }
  };

  const open = () => {
    if (!stored) return;
    const url = URL.createObjectURL(stored.blob);
    if (table.kind === 'pdf') window.open(url, '_blank', 'noopener');
    else {
      const a = document.createElement('a');
      a.href = url;
      a.download = table.name;
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  return (
    <Card title="Lookup table" hint={table ? undefined : 'Optional'} className="upload-card">
      {(error || problem) && <Notice tone="error">{error || problem}</Notice>}
      {table ? (
        <>
          <div className="lookup-file">
            <div>
              <b>{table.name}</b>
              <small>
                Added by {table.uploadedBy}, {formatTimestamp(table.uploadedAt)}
              </small>
            </div>
            <div className="action-row">
              <button type="button" className="btn ghost sm" onClick={open} disabled={!stored}>
                <ArrowSquareOutIcon size={15} aria-hidden="true" />
                {table.kind === 'pdf' ? 'Open the PDF' : 'Open the file'}
              </button>
              {allowed && (
                <>
                  <label className="btn ghost sm" htmlFor={`${id}-file`}>
                    <UploadSimpleIcon size={15} aria-hidden="true" />
                    Replace
                  </label>
                  <button
                    type="button"
                    className="btn ghost sm"
                    disabled={busy}
                    onClick={() => run(() => api.removeLookupTable(project.id, { actor }))}
                  >
                    <TrashIcon size={15} aria-hidden="true" />
                    Remove
                  </button>
                </>
              )}
            </div>
          </div>
          {table.kind === 'csv' && stored && <CsvTable blob={stored.blob} />}
          {table.kind !== 'csv' && table.kind !== 'pdf' && (
            <small className="muted">Excel files open in their own program, so use the button to read the table.</small>
          )}
          <input
            id={`${id}-file`}
            type="file"
            accept={LOOKUP_ACCEPT_ATTRIBUTE}
            className="sr-only"
            aria-label="Replace the lookup table"
            disabled={!allowed || busy}
            onChange={(e) => {
              take(e.target.files);
              e.target.value = '';
            }}
          />
        </>
      ) : (
        <label
          htmlFor={`${id}-file`}
          className={`dropzone${dragging ? ' dragging' : ''}${!allowed ? ' disabled' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            if (allowed) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            take(e.dataTransfer.files);
          }}
        >
          <UploadSimpleIcon size={22} aria-hidden="true" />
          <span className="strong">{busy ? 'Adding the file' : 'Choose a file or drop it here'}</span>
          <small>{LOOKUP_ACCEPTED_TEXT}, up to 25 MB</small>
          <input
            id={`${id}-file`}
            aria-label="Choose a file or drop it here, Lookup table"
            type="file"
            accept={LOOKUP_ACCEPT_ATTRIBUTE}
            className="sr-only"
            disabled={!allowed || busy}
            onChange={(e) => {
              take(e.target.files);
              e.target.value = '';
            }}
          />
        </label>
      )}
    </Card>
  );
}

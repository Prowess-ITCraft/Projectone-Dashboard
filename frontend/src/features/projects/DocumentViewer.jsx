import { useEffect, useState } from 'react';
import { useApi } from '@/data/api';

/*
  The original file, shown beside or under the parsed data so a person can check one against the other. The file is
  read from storage on demand and shown through a temporary object URL that is released when the viewer goes away.
*/
export function DocumentViewer({ fileId, title, className = '' }) {
  const api = useApi();
  const [state, setState] = useState({ url: null, missing: false, name: '', pdf: true });

  useEffect(() => {
    let revoked = false;
    let created = null;
    api.getFile(fileId).then((file) => {
      if (revoked) return;
      if (!file || typeof URL.createObjectURL !== 'function') return setState({ url: null, missing: true, name: '', pdf: true });
      created = URL.createObjectURL(file.blob);
      setState({ url: created, missing: false, name: file.name, pdf: file.type === 'application/pdf' });
    });
    return () => {
      revoked = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [api, fileId]);

  if (!fileId || state.missing) {
    return <p className="viewer-empty">The original file is not stored for this document, so there is nothing to show beside the lines.</p>;
  }
  if (!state.url) return <p className="viewer-empty">Opening the file.</p>;
  if (!state.pdf) {
    // Word and Excel files cannot be drawn in the page, so they open in their own program
    return (
      <p className="viewer-empty">
        {state.name} is not a PDF and cannot be shown here.{' '}
        <a href={state.url} download={state.name}>
          Download it
        </a>{' '}
        to read it.
      </p>
    );
  }
  return (
    <object className={`viewer ${className}`} data={state.url} type="application/pdf" aria-label={title}>
      <p className="viewer-empty">
        This browser cannot show the file here.{' '}
        <a href={state.url} download>
          Download it
        </a>{' '}
        instead.
      </p>
    </object>
  );
}

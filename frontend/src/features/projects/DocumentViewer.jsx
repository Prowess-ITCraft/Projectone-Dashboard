import { useEffect, useState } from 'react';
import { useApi } from '@/data/api';

/*
  The original file, shown beside or under the parsed data so a person can check one against the other. The file is
  read from storage on demand and shown through a temporary object URL that is released when the viewer goes away.
*/
export function DocumentViewer({ fileId, title, className = '' }) {
  const api = useApi();
  const [state, setState] = useState({ url: null, missing: false });

  useEffect(() => {
    let revoked = false;
    let created = null;
    api.getFile(fileId).then((file) => {
      if (revoked) return;
      if (!file || typeof URL.createObjectURL !== 'function') return setState({ url: null, missing: true });
      created = URL.createObjectURL(file.blob);
      setState({ url: created, missing: false });
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

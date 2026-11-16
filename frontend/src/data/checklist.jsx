import { useCallback, useEffect, useRef, useState } from 'react';
import { applyAddRow, applyDeleteRow, applyPatchRow, applyTask } from '@/domain/checklist';
import { newId } from '@/domain/ids';
import { useApi, useApiQuery } from './api';

/*
  What the component pages read and write: the catalogue, checklist progress and questionnaire responses, all through
  the ProjectOneApi. A change shows at once (the same pure rules the adapter uses are applied to the screen's copy) and
  the stored copy replaces it when the write finishes, so typing and ticking never wait for storage.
  Returns null until the first load completes.
*/
export function useChecklist() {
  const api = useApi();
  const catalog = useApiQuery((a) => a.getCatalog());
  const [state, setState] = useState(null);
  const [error, setError] = useState('');
  const pending = useRef(0);

  const reload = useCallback(() => {
    api.getChecklistState().then(
      (s) => pending.current === 0 && setState(s),
      (e) => setError(e.message),
    );
  }, [api]);

  useEffect(() => {
    reload();
    return api.subscribe(reload);
  }, [api, reload]);

  const mutate = useCallback(
    (apply, call) => {
      setError('');
      setState((s) => (s ? apply(s) : s));
      pending.current += 1;
      call()
        .catch((e) => setError(e.message))
        .finally(() => {
          pending.current -= 1;
          reload();
        });
    },
    [reload],
  );

  const actions = {
    setTask: (key, patch, label) =>
      mutate(
        (s) => applyTask(s, key, patch, label, Date.now()),
        () => api.setTaskProgress(key, patch, label),
      ),
    addRow: (kind, row) =>
      mutate(
        (s) => applyAddRow(s, kind, row, newId(), catalog.data.questionnaires[kind].title, Date.now()),
        () => api.addResponse(kind, row),
      ),
    patchRow: (kind, id, patch) =>
      mutate(
        (s) => applyPatchRow(s, kind, id, patch),
        () => api.patchResponse(kind, id, patch),
      ),
    delRow: (kind, id) =>
      mutate(
        (s) => applyDeleteRow(s, kind, id),
        () => api.deleteResponse(kind, id),
      ),
  };

  if (!catalog.data || !state) return { ready: false, error: error || catalog.error?.message || '' };
  const { items, productList, questionnaires } = catalog.data;
  return { ready: true, error, state, items, productList, questionnaires, ...actions };
}

/* Just the catalogue, for places that only need names (menu, search, titles) */
export function useCatalog() {
  const { data } = useApiQuery((a) => a.getCatalog());
  return data;
}

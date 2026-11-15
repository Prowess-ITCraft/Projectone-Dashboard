import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

/*
  Screens get data only through this module. `api` is the ProjectOneApi object (today the local adapter in
  data/local/localApi.js; later a client for the backend with the same methods). useApiQuery re-runs its loader
  whenever the api reports a write, so every screen stays current without passing refresh callbacks around.
*/
const ApiContext = createContext(null);

export function ApiProvider({ api, children }) {
  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>;
}

export function useApi() {
  const api = useContext(ApiContext);
  if (!api) throw new Error('useApi needs an ApiProvider above it.');
  return api;
}

/* Runs load(api) on mount, when `deps` change and after any write. Returns { data, error, loading, reload }. */
export function useApiQuery(load, deps = []) {
  const api = useApi();
  const loader = useRef(load);
  useEffect(() => {
    loader.current = load;
  });
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const token = useRef(0);

  const run = useCallback(() => {
    const mine = ++token.current;
    loader.current(api).then(
      (data) => mine === token.current && setState({ data, error: null, loading: false }),
      (error) => mine === token.current && setState((s) => ({ ...s, error, loading: false })),
    );
  }, [api]);

  useEffect(() => {
    run();
    return api.subscribe(run);
    // the loader is read through a ref, so only the caller's dependencies restart it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, run, ...deps]);

  return { ...state, reload: run };
}

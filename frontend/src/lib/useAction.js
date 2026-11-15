import { useCallback, useState } from 'react';

/*
  Runs one user action (an api write) and keeps its state: `busy` while it runs and `error` text if it failed, so a
  screen can show the message in a Notice. `run` resolves to the action's result, or undefined when it failed.
*/
export function useAction() {
  const [state, setState] = useState({ busy: false, error: '' });
  const run = useCallback(async (fn) => {
    setState({ busy: true, error: '' });
    try {
      const result = await fn();
      setState({ busy: false, error: '' });
      return result;
    } catch (e) {
      setState({ busy: false, error: e instanceof Error ? e.message : 'Something went wrong.' });
      return undefined;
    }
  }, []);
  const clear = useCallback(() => setState((s) => ({ ...s, error: '' })), []);
  return [run, { ...state, clear }];
}

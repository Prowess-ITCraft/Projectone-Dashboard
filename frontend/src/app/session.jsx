import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useApi } from '@/data/api';

/*
  Who is signed in. The session itself is an httpOnly cookie set by the API, so nothing secret is kept in the browser's
  storage; on start the screen asks the API who the cookie belongs to. The API ends a session after a period without
  activity: the next request then reports it, the person returns to the sign-in page, and `ended` says why.
  A person given a temporary password has `mustChangePassword` until they choose their own.

  The demo account below is shown on the sign-in page in local development only, and only when its email and password
  are set in the frontend's local env file (never committed). A production build never contains it.
*/
export function demoAccount(env = import.meta.env) {
  if (!env.DEV || !env.VITE_DEMO_EMAIL || !env.VITE_DEMO_PASSWORD) return null;
  return { email: env.VITE_DEMO_EMAIL, password: env.VITE_DEMO_PASSWORD };
}

const ENDED = {
  session_expired: 'Your session ended after a period without activity. Sign in again.',
  not_signed_in: 'Sign in to continue.',
};

const SessionContext = createContext(null);

export function SessionProvider({ children, initial }) {
  const api = useApi();
  const [session, setSession] = useState(initial === undefined ? null : initial);
  const [loading, setLoading] = useState(initial === undefined);
  const [ended, setEnded] = useState('');

  useEffect(() => {
    if (initial !== undefined) return undefined;
    let current = true;
    api.getMe().then(
      (me) => {
        if (!current) return;
        setSession(me);
        setLoading(false);
      },
      () => {
        if (!current) return;
        setSession(null);
        setLoading(false);
      },
    );
    return () => {
      current = false;
    };
    // only on start: later changes arrive through sign-in, sign-out and onAuthProblem
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  useEffect(
    () =>
      api.onAuthProblem?.((error) => {
        if (error.code === 'password_change_required') {
          setSession((s) => s && { ...s, mustChangePassword: true });
          return;
        }
        setSession(null);
        setEnded(ENDED[error.code] ?? ENDED.not_signed_in);
      }),
    [api],
  );

  const value = useMemo(
    () => ({
      session,
      loading,
      ended,
      signIn: async (email, password) => {
        const me = await api.signIn(email.trim(), password);
        setEnded('');
        setSession(me);
        return me;
      },
      signOut: async () => {
        try {
          await api.signOut();
        } finally {
          setEnded('');
          setSession(null);
        }
      },
      changePassword: async (current, next) => {
        const me = await api.changePassword(current, next);
        setSession(me);
        return me;
      },
    }),
    [api, session, loading, ended],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession needs a SessionProvider above it.');
  return value;
}

import { createContext, useContext, useMemo, useState } from 'react';
import { useActor } from './actor';

/*
  Demo sign-in until real accounts exist (backend stage B10). The one demo account is checked in the browser, so this
  is a gate for trying the app, not security: anything shipped to a browser can be read. It signs in as an Admin and
  stays signed in until Sign out. The acting-as switch in the top bar remains a development tool.
*/
export const DEMO_ACCOUNT = { email: 'adi@test.com', password: 'test1234', name: 'Adi', role: 'admin' };

const KEY = 'projectone.session';

/* The signed-in person for a matching email and password, else null. Email ignores case and spaces. */
export function checkDemoCredentials(email, password) {
  const sameEmail =
    String(email ?? '')
      .trim()
      .toLowerCase() === DEMO_ACCOUNT.email;
  if (!sameEmail || password !== DEMO_ACCOUNT.password) return null;
  return { email: DEMO_ACCOUNT.email, name: DEMO_ACCOUNT.name, role: DEMO_ACCOUNT.role };
}

function load() {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY));
    if (stored?.email === DEMO_ACCOUNT.email) return stored;
  } catch {
    // unreadable or blocked storage means signed out
  }
  return null;
}

const SessionContext = createContext(null);

export function SessionProvider({ children, initial }) {
  const { setActor } = useActor();
  const [session, setSession] = useState(initial === undefined ? load : initial);

  const value = useMemo(
    () => ({
      session,
      signIn: (email, password) => {
        const person = checkDemoCredentials(email, password);
        if (!person) return false;
        const next = { ...person, signedInAt: Date.now() };
        setSession(next);
        setActor({ role: person.role, name: person.name });
        try {
          localStorage.setItem(KEY, JSON.stringify(next));
        } catch {
          // the sign-in still holds for this visit
        }
        return true;
      },
      signOut: () => {
        setSession(null);
        try {
          localStorage.removeItem(KEY);
        } catch {
          // nothing stored to remove
        }
      },
    }),
    [session, setActor],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession needs a SessionProvider above it.');
  return value;
}

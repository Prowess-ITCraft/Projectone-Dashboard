import { createContext, useContext, useMemo } from 'react';
import { useSession } from './session';

/*
  The person acting: the signed-in user, with the role the API reported. Screens pass it to the data layer, which
  checks permissions with can() to decide what to offer; the API checks them again and records who acted from the
  session, never from what the screen sends. `initial` lets tests act as a given role.
*/
const ActorContext = createContext(null);

export function ActorProvider({ children, initial }) {
  const { session } = useSession();
  const id = session?.id;
  const role = session?.role;
  const name = session?.name;
  const actor = useMemo(() => initial ?? (role ? { id, role, name } : null), [initial, id, role, name]);
  const value = useMemo(() => ({ actor }), [actor]);
  return <ActorContext.Provider value={value}>{children}</ActorContext.Provider>;
}

export function useActor() {
  const value = useContext(ActorContext);
  if (!value) throw new Error('useActor needs an ActorProvider above it.');
  return value;
}

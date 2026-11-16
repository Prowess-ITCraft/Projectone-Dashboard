import { createContext, useContext, useMemo, useState } from 'react';
import { UserCircleIcon } from '@phosphor-icons/react';
import { Dialog, FormField, SegmentedControl } from '@/components';
import { actorLabel, ROLES } from '@/domain/permissions';

/*
  Temporary "acting as" role until real sign-in exists (development only). It decides who may confirm, reopen and decide
  duplicates, and it is recorded with every confirmation and change. Kept in this browser only.
*/
const KEY = 'projectone.actor';
const DEFAULT_ACTOR = { role: 'admin', name: '' };

function load() {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY));
    if (stored && ROLES[stored.role]) return { role: stored.role, name: String(stored.name ?? '') };
  } catch {
    // unreadable or blocked storage falls back to the default role
  }
  return DEFAULT_ACTOR;
}

const ActorContext = createContext(null);

export function ActorProvider({ children, initial }) {
  const [actor, setActorState] = useState(initial ?? load);
  const value = useMemo(
    () => ({
      actor,
      setActor: (next) => {
        setActorState(next);
        try {
          localStorage.setItem(KEY, JSON.stringify(next));
        } catch {
          // the choice still applies for this visit
        }
      },
    }),
    [actor],
  );
  return <ActorContext.Provider value={value}>{children}</ActorContext.Provider>;
}

export function useActor() {
  const value = useContext(ActorContext);
  if (!value) throw new Error('useActor needs an ActorProvider above it.');
  return value;
}

export function ActorPicker() {
  const { actor, setActor } = useActor();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(actor);

  const show = () => {
    setDraft(actor);
    setOpen(true);
  };
  const save = (e) => {
    e.preventDefault();
    setActor({ role: draft.role, name: draft.name.trim() });
    setOpen(false);
  };

  return (
    <>
      <button type="button" className="actor-trigger" onClick={show} aria-label={`Acting as ${actorLabel(actor)}. Change`}>
        <UserCircleIcon size={18} aria-hidden="true" />
        <span>{ROLES[actor.role]}</span>
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Acting as"
        description="A temporary stand-in for signing in. It decides what you can see and do, and is recorded with each confirmation."
        actions={
          <>
            <button type="button" className="btn ghost sm" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="actor-form" className="btn sm">
              Save
            </button>
          </>
        }
      >
        <form id="actor-form" onSubmit={save} className="stack">
          <FormField label="Role" group>
            {(f) => (
              <SegmentedControl
                {...f.control}
                id="actor-role"
                value={draft.role}
                options={Object.entries(ROLES)}
                onChange={(role) => setDraft({ ...draft, role })}
              />
            )}
          </FormField>
          <FormField label="Your name">
            {(f) => (
              <input
                {...f.control}
                className="input"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                data-autofocus
              />
            )}
          </FormField>
        </form>
      </Dialog>
    </>
  );
}

import { useState } from 'react';
import { Dialog, Icon, Notice } from '@/components';
import { useActor } from '@/app/actor';
import { useApi } from '@/data/api';
import { can } from '@/domain/permissions';
import { useAction } from '@/lib/useAction';

/*
  The engineers on one project. Everyone sees their names; an Admin also gets a remove button on each and the
  "Assign engineer" button, which opens a dialog listing every active engineer with a tick box so several can be
  chosen at once. Saving makes the project's engineers exactly the ticked ones; each engineer added or removed gets an
  alert from the server. The same component serves the projects list and the project page.
*/
export function ProjectEngineers({ project, customerName = '', assigned = [], engineers = [], compact = false }) {
  const api = useApi();
  const { actor } = useActor();
  const [run, { busy, error, clear }] = useAction();
  const [saved, setSaved] = useState('');
  const allowed = can(actor, 'assign_engineers');

  const remove = (a) => run(() => api.removeProjectEngineer(project.id, a.engineerId));

  return (
    <div className={`engineers${compact ? ' compact' : ''}`}>
      {assigned.length ? (
        <ul className="engineer-chips" aria-label={`Engineers on ${project.number}`}>
          {assigned.map((a) => (
            <li key={a.engineerId} className="engineer-chip">
              <span>{a.name}</span>
              {allowed && (
                <button
                  type="button"
                  className="engineer-remove"
                  disabled={busy}
                  aria-label={`Remove ${a.name} from ${project.number}`}
                  title={`Remove ${a.name}`}
                  onClick={() => {
                    setSaved('');
                    remove(a);
                  }}
                >
                  <Icon name="X" size={12} />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <span className="muted">No engineer assigned</span>
      )}
      {allowed && (
        <AssignEngineers project={project} customerName={customerName} assigned={assigned} engineers={engineers} onSaved={setSaved} />
      )}
      {saved && (
        <Notice
          actions={
            <button type="button" className="btn ghost sm" onClick={() => setSaved('')}>
              Dismiss
            </button>
          }
        >
          {saved}
        </Notice>
      )}
      {error && (
        <Notice
          tone="error"
          actions={
            <button type="button" className="btn ghost sm" onClick={clear}>
              Dismiss
            </button>
          }
        >
          {error}
        </Notice>
      )}
    </div>
  );
}

function AssignEngineers({ project, customerName, assigned, engineers, onSaved }) {
  const api = useApi();
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState([]);
  const [query, setQuery] = useState('');
  const [run, { busy, error, clear }] = useAction();

  // an engineer who has since been deactivated is not offered, so saving drops them from the project
  const current = assigned.map((a) => a.engineerId).filter((id) => engineers.some((e) => e.id === id));
  const changed = chosen.length !== current.length || chosen.some((id) => !current.includes(id));
  const needle = query.trim().toLowerCase();
  const shown = needle ? engineers.filter((e) => `${e.name} ${e.email}`.toLowerCase().includes(needle)) : engineers;

  const show = () => {
    setChosen(current);
    setQuery('');
    clear();
    setOpen(true);
  };
  const toggle = (engineerId) => setChosen((c) => (c.includes(engineerId) ? c.filter((x) => x !== engineerId) : [...c, engineerId]));
  const save = async () => {
    const done = await run(() => api.setProjectEngineers(project.id, chosen));
    if (!done) return;
    const added = chosen.filter((id) => !current.includes(id)).length;
    const removed = current.filter((id) => !chosen.includes(id)).length;
    const parts = [added && `${added} added`, removed && `${removed} removed`].filter(Boolean);
    onSaved(`Engineers updated on ${project.number} (${parts.join(', ')}). Each engineer affected has been notified.`);
    setOpen(false);
  };

  return (
    <>
      <button type="button" className="btn ghost sm" aria-label={`Assign engineer to ${project.number}`} onClick={show}>
        <Icon name="Plus" size={14} />
        Assign engineer
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Assign engineers to ${project.number}${customerName ? `, ${customerName}` : ''}`}
        actions={
          <>
            <button type="button" className="btn ghost sm" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn sm" disabled={busy || !changed} onClick={save}>
              Save
            </button>
          </>
        }
      >
        {engineers.length ? (
          <div className="assign-dialog">
            <input
              type="search"
              className="input"
              placeholder="Search by name or email"
              aria-label="Search engineers"
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              data-autofocus
            />
            <fieldset className="plain-set">
              <legend className="sr-only">Engineers on {project.number}</legend>
              {shown.length ? (
                <ul className="assign-list">
                  {shown.map((e) => (
                    <li key={e.id}>
                      <label className="site-choice">
                        <input type="checkbox" checked={chosen.includes(e.id)} onChange={() => toggle(e.id)} />
                        <span className="strong">
                          {e.name}
                          <small>{e.email}</small>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">No engineer matches that search.</p>
              )}
            </fieldset>
          </div>
        ) : (
          <p className="muted">No active engineers. Add one on the Users page.</p>
        )}
        {error && <Notice tone="error">{error}</Notice>}
      </Dialog>
    </>
  );
}

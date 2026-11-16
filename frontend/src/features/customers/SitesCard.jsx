import { useState } from 'react';
import { Card, FormField, Notice } from '@/components';
import { useActor } from '@/app/actor';
import { useApi } from '@/data/api';
import { can } from '@/domain/permissions';
import { useAction } from '@/lib/useAction';

const BLANK = { name: '', address: '', contact: '' };

function SiteForm({ initial, submitLabel, busy, onSubmit, onCancel }) {
  const [site, setSite] = useState(initial);
  const [touched, setTouched] = useState(false);
  const missing = touched && !site.name.trim();
  const set = (key) => (e) => setSite({ ...site, [key]: e.target.value });
  return (
    <form
      noValidate
      className="site-form"
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (site.name.trim()) onSubmit(site);
      }}
    >
      <div className="form-grid">
        <FormField label="Site name" error={missing ? 'Give the site a name.' : undefined}>
          {(f) => <input {...f.control} className="input" value={site.name} onChange={set('name')} />}
        </FormField>
        <FormField label="Address">
          {(f) => <input {...f.control} className="input" value={site.address} onChange={set('address')} />}
        </FormField>
        <FormField label="Contact at the site" hint="Optional.">
          {(f) => <input {...f.control} className="input" value={site.contact} onChange={set('contact')} />}
        </FormField>
      </div>
      <div className="action-row">
        <button type="submit" className="btn sm" disabled={busy}>
          {submitLabel}
        </button>
        <button type="button" className="btn ghost sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/*
  The customer's sites. A project covers one or more of them. Sites can be added and corrected but not deleted,
  because a project may use them.
*/
export function SitesCard({ customerId, sites }) {
  const api = useApi();
  const { actor } = useActor();
  const [run, { busy, error, clear }] = useAction();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const editable = can(actor, 'create_project');

  const add = async (site) => {
    const ok = await run(async () => {
      await api.addSite(customerId, site, { actor });
      return true;
    });
    if (ok) setAdding(false);
  };
  const save = async (site) => {
    const ok = await run(async () => {
      await api.updateSite(editing, site, { actor });
      return true;
    });
    if (ok) setEditing(null);
  };

  return (
    <Card
      title="Sites"
      actions={
        editable && !adding ? (
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => {
              clear();
              setEditing(null);
              setAdding(true);
            }}
          >
            Add a site
          </button>
        ) : null
      }
    >
      {error && <Notice tone="error">{error}</Notice>}
      {adding && <SiteForm initial={BLANK} submitLabel="Add site" busy={busy} onSubmit={add} onCancel={() => setAdding(false)} />}
      {sites.length ? (
        <ul className="site-list">
          {sites.map((site) =>
            editing === site.id ? (
              <li key={site.id}>
                <SiteForm
                  initial={{ name: site.name, address: site.address ?? '', contact: site.contact ?? '' }}
                  submitLabel="Save site"
                  busy={busy}
                  onSubmit={save}
                  onCancel={() => setEditing(null)}
                />
              </li>
            ) : (
              <li key={site.id} className="site-item">
                <div>
                  <b>{site.name}</b>
                  {site.address && <small>{site.address}</small>}
                  {site.contact && <small>Contact: {site.contact}</small>}
                </div>
                {editable && (
                  <button
                    type="button"
                    className="btn ghost sm"
                    aria-label={`Edit site ${site.name}`}
                    onClick={() => {
                      clear();
                      setAdding(false);
                      setEditing(site.id);
                    }}
                  >
                    Edit
                  </button>
                )}
              </li>
            ),
          )}
        </ul>
      ) : (
        !adding && <p className="muted">No sites yet. Add the places where the work happens.</p>
      )}
    </Card>
  );
}

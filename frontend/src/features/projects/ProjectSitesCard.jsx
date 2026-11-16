import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Notice } from '@/components';
import { useActor } from '@/app/actor';
import { useApi, useApiQuery } from '@/data/api';
import { can } from '@/domain/permissions';
import { lockedByStatus } from '@/domain/projects';
import { useAction } from '@/lib/useAction';
import { SitePicker } from './SitePicker';

/* The sites this project covers, changed by ticking the customer's sites or adding new ones */
export function ProjectSitesCard({ project, sites }) {
  const api = useApi();
  const { actor } = useActor();
  const [run, { busy, error, clear }] = useAction();
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const customerSites = useApiQuery((a) => a.listSites(project.customerId), [project.customerId]);
  const editable = can(actor, 'create_project') && !lockedByStatus(project);

  const start = () => {
    clear();
    setSelected(project.siteIds);
    setDrafts([]);
    setEditing(true);
  };

  const save = async (e) => {
    e.preventDefault();
    const ok = await run(async () => {
      const added = [];
      for (const d of drafts.filter((x) => x.name.trim())) added.push((await api.addSite(project.customerId, d, { actor })).id);
      await api.updateProject(project.id, { siteIds: [...selected, ...added] }, { actor });
      return true;
    });
    if (ok) setEditing(false);
  };

  return (
    <Card
      title="Sites"
      actions={
        editable && !editing ? (
          <button type="button" className="btn ghost sm" onClick={start}>
            Change sites
          </button>
        ) : null
      }
    >
      {editing ? (
        <form onSubmit={save} className="stack">
          {error && <Notice tone="error">{error}</Notice>}
          <SitePicker
            legend="Sites this project covers"
            sites={customerSites.data ?? []}
            selected={selected}
            onSelected={setSelected}
            drafts={drafts}
            onDrafts={setDrafts}
          />
          <div className="action-row">
            <button type="submit" className="btn sm" disabled={busy}>
              Save sites
            </button>
            <button type="button" className="btn ghost sm" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : sites.length ? (
        <ul className="site-list">
          {sites.map((site) => (
            <li key={site.id} className="site-item">
              <div>
                <b>{site.name}</b>
                {site.address && <small>{site.address}</small>}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">
          No site chosen.{' '}
          {editable && (
            <button type="button" className="link-btn" onClick={start}>
              Choose the sites
            </button>
          )}
        </p>
      )}
      <small className="muted">
        Sites belong to the customer. <Link to={`/customers/${project.customerId}`}>Open the customer</Link>
      </small>
    </Card>
  );
}

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, DataTable, Dialog, ErrorState, Icon, LoadingState, Notice, PageHead, StatusBadge } from '@/components';
import { useActor } from '@/app/actor';
import { useApi, useApiQuery } from '@/data/api';
import { ENTRY_PATHS, entryPathLabel } from '@/domain/projects';
import { currentStage } from '@/domain/stages';
import { can } from '@/domain/permissions';
import { useAction } from '@/lib/useAction';
import { formatDate } from './labels';

const COLUMNS = ['Project', 'Customer', 'Entry path', 'Stage', 'Documents', 'Created'];

export default function ProjectsPage() {
  const api = useApi();
  const { actor } = useActor();
  const { data, error, loading, reload } = useApiQuery((a) => a.listProjects());
  const [query, setQuery] = useState('');
  const [path, setPath] = useState('all');
  const [confirmReset, setConfirmReset] = useState(false);
  const [run, action] = useAction();

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? []).filter(
      (s) =>
        (path === 'all' || s.project.entryPath === path) &&
        (!q || `${s.project.number} ${s.customer?.name ?? ''}`.toLowerCase().includes(q)),
    );
  }, [data, query, path]);

  if (loading) return <LoadingState label="Loading projects" />;
  if (error) return <ErrorState title="Projects could not be loaded" message={error.message} onRetry={reload} />;

  const doReset = async () => {
    const ok = await run(async () => {
      await api.resetAll({ actor });
      return true;
    });
    if (ok) setConfirmReset(false);
  };

  return (
    <>
      <PageHead title="Projects" sub="Each project starts from a customer's order and moves through the stages in order.">
        <Link to="/projects/new" className="btn">
          <Icon name="Plus" size={16} />
          New project
        </Link>
      </PageHead>

      {!api.isPersistent() && (
        <Notice tone="warning" title="Saved for this visit only">
          This browser is not letting the app keep data, so projects disappear when you close the tab.
        </Notice>
      )}

      <div className="filters">
        <label className="search">
          <Icon name="MagnifyingGlass" size={16} />
          <input
            placeholder="Search by number or customer"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search projects"
          />
        </label>
        <div className="sel">
          <select value={path} onChange={(e) => setPath(e.target.value)} aria-label="Filter by entry path">
            <option value="all">All entry paths</option>
            {Object.entries(ENTRY_PATHS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
          <Icon name="CaretDown" size={14} />
        </div>
      </div>

      <Card flush title="All projects" hint={<span className="num">{rows.length}</span>}>
        <DataTable
          columns={COLUMNS}
          isEmpty={!rows.length}
          empty={data.length ? 'No project matches the search.' : 'No projects yet. Create one to start with a customer order.'}
          className="projects"
        >
          {rows.map(({ project, customer, documents, tracker }) => {
            const stage = currentStage(tracker);
            return (
              <tr key={project.id}>
                <td className="strong">
                  <Link to={`/projects/${project.id}`}>{project.number}</Link>
                </td>
                <td>{customer?.name}</td>
                <td>{project.entryPath ? entryPathLabel(project.entryPath) : <StatusBadge tone="warning">Needed</StatusBadge>}</td>
                <td>
                  {stage.name}
                  {stage.state === 'blocked' && (
                    <StatusBadge tone="warning" className="inline">
                      Blocked
                    </StatusBadge>
                  )}
                  {tracker.every((s) => s.state === 'done') && (
                    <StatusBadge tone="positive" className="inline">
                      Done
                    </StatusBadge>
                  )}
                </td>
                <td className="num">{documents.filter((d) => d.active).length}</td>
                <td>{formatDate(new Date(project.createdAt).toISOString())}</td>
              </tr>
            );
          })}
        </DataTable>
      </Card>

      <Card title="Development tools" hint="Temporary, for trying the flow" className="dev-tools">
        <p className="muted">
          Sample projects use anonymised copies of the three sample documents. Resetting removes every customer, project, document and file
          stored in this browser.
        </p>
        {action.error && !confirmReset && <Notice tone="error">{action.error}</Notice>}
        <div className="action-row">
          <button
            type="button"
            className="btn ghost sm"
            disabled={action.busy || !can(actor, 'create_project')}
            onClick={() => run(() => api.loadSampleProjects({ actor }))}
          >
            Load sample projects
          </button>
          <button type="button" className="btn ghost sm" disabled={!can(actor, 'reset_data')} onClick={() => setConfirmReset(true)}>
            Reset project data
          </button>
          {!can(actor, 'reset_data') && <small>Only an Admin can reset.</small>}
        </div>
      </Card>

      <Dialog
        open={confirmReset}
        role="alertdialog"
        onClose={() => setConfirmReset(false)}
        title="Reset all project data?"
        description="Every customer, project, document and uploaded file in this browser is deleted. This cannot be undone."
        actions={
          <>
            <button type="button" className="btn ghost sm" onClick={() => setConfirmReset(false)} data-autofocus>
              Cancel
            </button>
            <button type="button" className="btn sm" disabled={action.busy} onClick={doReset}>
              Reset
            </button>
          </>
        }
      >
        {action.error && <Notice tone="error">{action.error}</Notice>}
      </Dialog>
    </>
  );
}

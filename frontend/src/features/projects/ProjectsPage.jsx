import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Dialog, ErrorState, Icon, LoadingState, Notice, PageHead } from '@/components';
import { useActor } from '@/app/actor';
import { useApi, useApiQuery } from '@/data/api';
import { ALL, filterProjects, SORTS, sortProjects } from '@/domain/projectList';
import { ENTRY_PATHS, PROJECT_STATUS } from '@/domain/projects';
import { STAGES } from '@/domain/stages';
import { can } from '@/domain/permissions';
import { useAction } from '@/lib/useAction';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { NARROW_QUERY } from '@/app/navigation';
import { ProjectList } from './ProjectList';
import { useEngineers } from './useEngineers';

function Select({ label, value, onChange, children }) {
  return (
    <div className="sel">
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        {children}
      </select>
      <Icon name="CaretDown" size={14} />
    </div>
  );
}

export default function ProjectsPage() {
  const api = useApi();
  const { actor } = useActor();
  const { data, error, loading, reload } = useApiQuery((a) => a.listProjects());
  const team = useEngineers();
  const [filters, setFilters] = useState({ query: '', entryPath: ALL, stage: ALL, status: ALL, customerId: ALL });
  const [sort, setSort] = useState('activity');
  const [confirmReset, setConfirmReset] = useState(false);
  const [run, action] = useAction();
  const set = (key) => (value) => setFilters((f) => ({ ...f, [key]: value }));
  const narrow = useMediaQuery(NARROW_QUERY);

  const rows = useMemo(() => sortProjects(filterProjects(data ?? [], filters), sort), [data, filters, sort]);
  const customers = useMemo(() => {
    const seen = new Map();
    (data ?? []).forEach((s) => s.customer && seen.set(s.customer.id, s.customer.name));
    return [...seen].sort((a, b) => a[1].localeCompare(b[1]));
  }, [data]);

  const controls = (
    <>
      <Select label="Filter by entry path" value={filters.entryPath} onChange={set('entryPath')}>
        <option value={ALL}>All entry paths</option>
        {Object.entries(ENTRY_PATHS).map(([k, l]) => (
          <option key={k} value={k}>
            {l}
          </option>
        ))}
      </Select>
      <Select label="Filter by stage" value={filters.stage} onChange={set('stage')}>
        <option value={ALL}>All stages</option>
        {STAGES.map((st) => (
          <option key={st.id} value={st.id}>
            {st.name}
          </option>
        ))}
      </Select>
      <Select label="Filter by status" value={filters.status} onChange={set('status')}>
        <option value={ALL}>All statuses</option>
        {Object.entries(PROJECT_STATUS).map(([k, v]) => (
          <option key={k} value={k}>
            {v.label}
          </option>
        ))}
      </Select>
      <Select label="Filter by customer" value={filters.customerId} onChange={set('customerId')}>
        <option value={ALL}>All customers</option>
        {customers.map(([id, name]) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </Select>
      <Select label="Sort by" value={sort} onChange={setSort}>
        {Object.entries(SORTS).map(([k, l]) => (
          <option key={k} value={k}>
            {`Sort: ${l}`}
          </option>
        ))}
      </Select>
    </>
  );

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
            placeholder="Search by number, customer or site"
            value={filters.query}
            onChange={(e) => set('query')(e.target.value)}
            aria-label="Search projects"
          />
        </label>
        {narrow ? (
          <details className="filters-more">
            <summary>Filters and sort</summary>
            <div className="filters">{controls}</div>
          </details>
        ) : (
          controls
        )}
      </div>

      <Card flush title="All projects" hint={<span className="num">{rows.length}</span>}>
        <ProjectList
          team={team}
          rows={rows}
          empty={data.length ? 'No project matches the filters.' : 'No projects yet. Create one to start with a customer order.'}
        />
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

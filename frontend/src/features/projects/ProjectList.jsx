import { Link } from 'react-router-dom';
import { DataTable, StatusBadge } from '@/components';
import { entryPathLabel, PROJECT_STATUS, statusOf } from '@/domain/projects';
import { currentStage } from '@/domain/stages';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { NARROW_QUERY } from '@/app/navigation';
import { PrismSuiteBadge } from '@/features/customers/PrismSuiteBadge';
import { ProjectEngineers } from './AssignEngineers';
import { formatTimestamp } from './labels';

const COLUMNS = ['Project', 'Customer', 'Sites', 'Entry path', 'Stage', 'Status', 'Engineers', 'Last activity'];

export function StageCell({ tracker }) {
  const stage = currentStage(tracker);
  const done = tracker.every((s) => s.state === 'done');
  return (
    <>
      {stage.name}
      {stage.state === 'blocked' && (
        <StatusBadge tone="warning" className="inline">
          Blocked
        </StatusBadge>
      )}
      {done && (
        <StatusBadge tone="positive" className="inline">
          Done
        </StatusBadge>
      )}
    </>
  );
}

function StatusCell({ project }) {
  const status = PROJECT_STATUS[statusOf(project)];
  return <StatusBadge tone={status.tone}>{status.label}</StatusBadge>;
}

const siteNames = (sites) => sites.map((s) => s.name).join(', ');

/*
  The projects as a table on wide screens and as stacked cards on phones, with the same fields. `team` (from
  useEngineers) gives each project's engineers and, for an Admin, the engineers to assign.
*/
export function ProjectList({ rows, empty, team }) {
  const engineersOf = (project, customer) => (
    <ProjectEngineers
      project={project}
      customerName={customer?.name}
      assigned={team?.byProject.get(project.id) ?? []}
      engineers={team?.engineers ?? []}
      compact
    />
  );
  const narrow = useMediaQuery(NARROW_QUERY);

  if (narrow) {
    return (
      <ul className="row-cards" aria-label="Projects">
        {rows.map(({ project, customer, sites, tracker, audited, lastActivityAt }) => (
          <li key={project.id} className="row-card">
            <div className="row-card-head">
              <Link to={`/projects/${project.id}`} className="strong">
                {project.number}
              </Link>
              <StatusCell project={project} />
            </div>
            <p className="row-card-sub">
              <Link to={`/customers/${project.customerId}`}>{customer?.name}</Link>
              {audited && <PrismSuiteBadge className="inline" />}
            </p>
            <dl className="row-card-facts">
              <dt>Sites</dt>
              <dd>{siteNames(sites) || 'No site chosen'}</dd>
              <dt>Entry path</dt>
              <dd>{project.entryPath ? entryPathLabel(project.entryPath) : 'Needed'}</dd>
              <dt>Stage</dt>
              <dd>
                <StageCell tracker={tracker} />
              </dd>
              <dt>Engineers</dt>
              <dd>{engineersOf(project, customer)}</dd>
              <dt>Last activity</dt>
              <dd>{formatTimestamp(lastActivityAt)}</dd>
            </dl>
          </li>
        ))}
        {!rows.length && <li className="row-card empty">{empty}</li>}
      </ul>
    );
  }

  return (
    <DataTable columns={COLUMNS} isEmpty={!rows.length} empty={empty} className="projects">
      {rows.map(({ project, customer, sites, tracker, audited, lastActivityAt }) => (
        <tr key={project.id}>
          <td className="strong">
            <Link to={`/projects/${project.id}`}>{project.number}</Link>
          </td>
          <td>
            <Link to={`/customers/${project.customerId}`}>{customer?.name}</Link>
            {audited && <PrismSuiteBadge className="inline" />}
          </td>
          <td>{siteNames(sites) || <span className="muted">No site chosen</span>}</td>
          <td>{project.entryPath ? entryPathLabel(project.entryPath) : <StatusBadge tone="warning">Needed</StatusBadge>}</td>
          <td>
            <StageCell tracker={tracker} />
          </td>
          <td>
            <StatusCell project={project} />
          </td>
          <td>{engineersOf(project, customer)}</td>
          <td>{formatTimestamp(lastActivityAt)}</td>
        </tr>
      ))}
    </DataTable>
  );
}

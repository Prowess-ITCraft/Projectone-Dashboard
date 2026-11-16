import { Link, useParams } from 'react-router-dom';
import { Card, DataTable, ErrorState, Icon, LoadingState, PageHead, StatusBadge } from '@/components';
import { useApiQuery } from '@/data/api';
import { DOCUMENT_TYPES } from '@/domain/documents';
import { entryPathLabel, PROJECT_STATUS, statusOf } from '@/domain/projects';
import { actorLabel } from '@/domain/permissions';
import { currentStage } from '@/domain/stages';
import { formatDate, formatTimestamp } from '@/features/projects/labels';
import { CustomerDetailsCard } from './CustomerDetailsCard';
import { PrismSuiteBadge } from './PrismSuiteBadge';
import { SitesCard } from './SitesCard';

const ACTIONS = {
  customer_updated: 'Details changed',
  site_added: 'Site added',
  site_updated: 'Site changed',
};

/* One customer with everything that belongs to them: details, sites, projects, documents and activity */
export default function CustomerPage() {
  const { id } = useParams();
  const { data, error, loading, reload } = useApiQuery((api) => api.getCustomer(id), [id]);

  if (loading) return <LoadingState label="Opening the customer" />;
  if (error) return <ErrorState title="This customer could not be opened" message={error.message} onRetry={reload} />;

  const { customer, sites, projects, documents, audited, activity } = data;
  const siteName = Object.fromEntries(sites.map((s) => [s.id, s.name]));

  return (
    <>
      <Link to="/customers" className="back">
        <Icon name="ArrowLeft" size={14} />
        All customers
      </Link>
      <PageHead title={customer.name} sub={`${customer.number}${customer.gstin ? `, GSTIN ${customer.gstin}` : ''}`}>
        {audited && <PrismSuiteBadge className="badge-lg" />}
      </PageHead>

      <div className="overview">
        <div className="overview-main">
          <Card flush title="Projects" hint={<span className="num">{projects.length}</span>}>
            <DataTable
              columns={['Project', 'Sites', 'Entry path', 'Stage', 'Status']}
              isEmpty={!projects.length}
              empty="No projects yet."
              className="customer-projects"
            >
              {projects.map(({ project, tracker }) => (
                <tr key={project.id}>
                  <td className="strong">
                    <Link to={`/projects/${project.id}`}>{project.number}</Link>
                  </td>
                  <td>
                    {project.siteIds
                      .map((sid) => siteName[sid])
                      .filter(Boolean)
                      .join(', ') || <span className="muted">No site chosen</span>}
                  </td>
                  <td>{entryPathLabel(project.entryPath)}</td>
                  <td>{currentStage(tracker).name}</td>
                  <td>
                    <StatusBadge tone={PROJECT_STATUS[statusOf(project)].tone}>{PROJECT_STATUS[statusOf(project)].label}</StatusBadge>
                  </td>
                </tr>
              ))}
            </DataTable>
          </Card>

          <Card flush title="Orders and reports" hint={<span className="num">{documents.length}</span>}>
            <DataTable
              columns={['Type', 'Number', 'Date', 'Project', 'Version']}
              isEmpty={!documents.length}
              empty="No documents yet."
              className="customer-documents"
            >
              {documents.map((d) => (
                <tr key={d.id} className={d.active ? '' : 'muted-row'}>
                  <td>{DOCUMENT_TYPES[d.type]}</td>
                  <td className="strong">{d.number || d.fileName}</td>
                  <td>{formatDate(d.date)}</td>
                  <td>
                    <Link to={`/projects/${d.projectId}/documents`}>{d.projectNumber}</Link>
                  </td>
                  <td>{d.active ? 'Active' : 'Kept as history'}</td>
                </tr>
              ))}
            </DataTable>
          </Card>

          <Card title="Activity">
            {activity.length ? (
              <ul className="feed">
                {activity.slice(0, 10).map((a) => (
                  <li key={a.id}>
                    <span>
                      <b>{ACTIONS[a.action] ?? a.action}</b>
                      {a.subject ? `: ${a.subject}` : ''}
                      <small className="by">{a.actor ? actorLabel(a.actor) : ''}</small>
                    </span>
                    <small>{formatTimestamp(a.at)}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No changes to the customer or its sites yet.</p>
            )}
          </Card>
        </div>

        <div className="overview-side">
          <CustomerDetailsCard customer={customer} />
          <SitesCard customerId={customer.id} sites={sites} />
        </div>
      </div>
    </>
  );
}

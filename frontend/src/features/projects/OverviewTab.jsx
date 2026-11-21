import { Link } from 'react-router-dom';
import { Card } from '@/components';
import { PrismSuiteBadge } from '@/features/customers/PrismSuiteBadge';
import { LookupTableCard } from './LookupTableCard';
import { ProjectSitesCard } from './ProjectSitesCard';
import { ProjectStatusCard } from './ProjectStatusCard';
import { StageActions } from './StageActions';
import { StageTracker } from './StageTracker';

export default function OverviewTab({ snapshot }) {
  const { project, customer, tracker, audited } = snapshot;

  return (
    <div className="overview">
      <div className="overview-main">
        <LookupTableCard project={project} />

        <Card title="Stages" hint="In strict order">
          <StageTracker tracker={tracker} />
          <StageActions snapshot={snapshot} />
        </Card>
      </div>

      <div className="overview-side">
        <ProjectStatusCard project={project} tracker={tracker} />

        <Card title="Customer" actions={audited ? <PrismSuiteBadge /> : null}>
          <dl className="facts">
            <dt>Name</dt>
            <dd>
              <Link to={`/customers/${project.customerId}`}>{customer?.name}</Link>
            </dd>
            <dt>Number</dt>
            <dd>{customer?.number}</dd>
            {customer?.gstin && (
              <>
                <dt>GSTIN</dt>
                <dd>{customer.gstin}</dd>
              </>
            )}
            {customer?.address && (
              <>
                <dt>Address</dt>
                <dd>{customer.address}</dd>
              </>
            )}
            {customer?.contact && (
              <>
                <dt>Contact</dt>
                <dd>{customer.contact}</dd>
              </>
            )}
          </dl>
        </Card>

        <ProjectSitesCard project={project} />
      </div>
    </div>
  );
}

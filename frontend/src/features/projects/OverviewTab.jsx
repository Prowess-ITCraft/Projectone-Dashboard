import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, FormField, Notice, SegmentedControl } from '@/components';
import { useActor } from '@/app/actor';
import { useApi, useApiQuery } from '@/data/api';
import { ENTRY_PATHS, lockedByStatus } from '@/domain/projects';
import { PrismSuiteBadge } from '@/features/customers/PrismSuiteBadge';
import { actorLabel, can } from '@/domain/permissions';
import { useAction } from '@/lib/useAction';
import { ProjectSitesCard } from './ProjectSitesCard';
import { ProjectStatusCard } from './ProjectStatusCard';
import { StageActions } from './StageActions';
import { StageTracker } from './StageTracker';
import { formatTimestamp } from './labels';

const ACTIONS = {
  project_created: 'Project created',
  project_updated: 'Project details changed',
  document_added: 'Document added',
  document_details_saved: 'Document details saved',
  document_replaced: 'Document replaced',
  document_removed: 'Document removed',
  duplicate_cancelled: 'Duplicate upload cancelled',
  line_classified: 'Classification changed',
  line_edited: 'Line edited',
  line_added: 'Line added',
  line_deleted: 'Line deleted',
  rules_rerun: 'Rules run again',
  intake_confirmed: 'Intake confirmed',
  intake_reopened: 'Intake reopened',
  classification_confirmed: 'Classification confirmed',
  classification_reopened: 'Classification reopened',
  delivery_recorded: 'Delivery recorded',
  service_assigned: 'Service assigned',
  sample_project_created: 'Sample project created',
  status_changed: 'Status changed',
};

export default function OverviewTab({ snapshot }) {
  const api = useApi();
  const { actor } = useActor();
  const [run, { error }] = useAction();
  const { project, customer, sites, tracker, audited } = snapshot;
  const [purpose, setPurpose] = useState(null);
  const audit = useApiQuery((a) => a.listAudit(project.id), [project.id]);
  const editable = can(actor, 'create_project') && !lockedByStatus(project);

  const savePurpose = () =>
    purpose !== null && purpose !== project.purpose && run(() => api.updateProject(project.id, { purpose }, { actor }));

  return (
    <div className="overview">
      <div className="overview-main">
        <Card title="Stages" hint="In strict order">
          <StageTracker tracker={tracker} />
          <StageActions snapshot={snapshot} />
        </Card>

        <Card title="Recent activity">
          {audit.data?.length ? (
            <ul className="feed">
              {audit.data.slice(0, 8).map((a) => (
                <li key={a.id}>
                  <span>
                    <b>{ACTIONS[a.action] ?? a.action}</b>
                    {a.subject ? `: ${a.subject}` : ''}
                    {a.reason ? <em className="reason">{`Reason: ${a.reason}`}</em> : null}
                    <small className="by">{a.actor ? actorLabel(a.actor) : ''}</small>
                  </span>
                  <small>{formatTimestamp(a.at)}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Nothing recorded yet.</p>
          )}
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

        <ProjectSitesCard project={project} sites={sites} />

        <Card title="Project">
          {!project.entryPath && <Notice tone="warning">Choose an entry path to unlock the first stage.</Notice>}
          <FormField label="Entry path" group>
            {(f) => (
              <SegmentedControl
                {...f.control}
                id="project-entry"
                value={project.entryPath ?? ''}
                options={Object.entries(ENTRY_PATHS)}
                onChange={(entryPath) => editable && !project.intake && run(() => api.updateProject(project.id, { entryPath }, { actor }))}
              />
            )}
          </FormField>
          {project.intake && <small className="muted">The entry path is fixed while the intake review is confirmed.</small>}
          <FormField label="Purpose">
            {(f) => (
              <textarea
                {...f.control}
                className="input textarea"
                rows={3}
                disabled={!editable}
                value={purpose ?? project.purpose}
                onChange={(e) => setPurpose(e.target.value)}
                onBlur={savePurpose}
              />
            )}
          </FormField>
          {error && <Notice tone="error">{error}</Notice>}
          <p className="muted">
            Next: <Link to="documents">add the order documents</Link>.
          </p>
        </Card>
      </div>
    </div>
  );
}

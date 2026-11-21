import { Link } from 'react-router-dom';
import { Card, FormField, Notice } from '@/components';
import { useActor } from '@/app/actor';
import { useApi, useApiQuery } from '@/data/api';
import { can } from '@/domain/permissions';
import { lockedByStatus } from '@/domain/projects';
import { useAction } from '@/lib/useAction';

/* Switches the site this project works on, for a customer with implementation work at several sites */
export function ProjectSitesCard({ project }) {
  const api = useApi();
  const { actor } = useActor();
  const [run, { busy, error }] = useAction();
  const customerSites = useApiQuery((a) => a.listSites(project.customerId), [project.customerId]);
  const editable = can(actor, 'create_project') && !lockedByStatus(project);
  const options = customerSites.data ?? [];

  return (
    <Card title="Site">
      {error && <Notice tone="error">{error}</Notice>}
      {options.length ? (
        <FormField label="Change site">
          {(f) => (
            <select
              {...f.control}
              className="input"
              disabled={!editable || busy}
              value={project.siteIds[0] ?? ''}
              onChange={(e) => e.target.value && run(() => api.updateProject(project.id, { siteIds: [e.target.value] }, { actor }))}
            >
              {!project.siteIds.length && <option value="">Choose a site</option>}
              {options.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </FormField>
      ) : (
        <p className="muted">
          This customer has no sites yet. <Link to={`/customers/${project.customerId}`}>Add one on the customer page</Link>.
        </p>
      )}
    </Card>
  );
}

import { Link } from 'react-router-dom';
import { Card, EmptyState, FormField, Notice, SegmentedControl, StatusBadge } from '@/components';
import { useActor } from '@/app/actor';
import { useApi } from '@/data/api';
import { MODULE_TYPES, moduleLabel } from '@/domain/modules';
import { can } from '@/domain/permissions';
import { useAction } from '@/lib/useAction';
import { DELIVERY_OPTIONS, formatDate } from './labels';

function ModuleCard({ module, lines, onDelivery, disabled }) {
  const product = lines.find((l) => l.id === module.productLineId);
  const services = module.serviceLineIds.map((id) => lines.find((l) => l.id === id)).filter(Boolean);
  const hasProcedure = MODULE_TYPES[module.moduleType]?.procedure;
  return (
    <Card
      title={moduleLabel(module.moduleType)}
      className="module-card"
      actions={
        <StatusBadge tone={hasProcedure ? 'positive' : 'warning'}>{hasProcedure ? 'Procedure available' : 'Procedure pending'}</StatusBadge>
      }
    >
      <p className="strong">{product?.title}</p>
      {services.length > 0 && (
        <>
          <h4 className="mini">Services</h4>
          <ul className="plain-list">
            {services.map((s) => (
              <li key={s.id}>{s.title}</li>
            ))}
          </ul>
        </>
      )}
      {module.scopeItems.length > 0 && (
        <details className="scope">
          <summary>Scope from the order, {module.scopeItems.length} items</summary>
          <ul>
            {module.scopeItems.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </details>
      )}
      {!hasProcedure && (
        <Notice tone="info">There is no documented procedure for this product yet, so it has no checklist beyond the scope above.</Notice>
      )}
      <FormField label="Delivery" group>
        {(f) => (
          <SegmentedControl
            {...f.control}
            id={`delivery-${module.id}`}
            value={module.status}
            options={DELIVERY_OPTIONS}
            onChange={(status) =>
              !disabled && onDelivery(module, { status, deliveredOn: status === 'delivered' ? module.deliveredOn : null })
            }
          />
        )}
      </FormField>
      {module.status === 'delivered' && (
        <FormField label="Delivered on">
          {(f) => (
            <input
              {...f.control}
              type="date"
              className="input"
              disabled={disabled}
              value={module.deliveredOn ?? ''}
              onChange={(e) => e.target.value && onDelivery(module, { status: 'delivered', deliveredOn: e.target.value })}
            />
          )}
        </FormField>
      )}
      {module.status === 'delivered' && module.deliveredOn && (
        <small className="muted">Recorded as delivered on {formatDate(module.deliveredOn)}.</small>
      )}
    </Card>
  );
}

export default function ModulesTab({ snapshot }) {
  const api = useApi();
  const { actor } = useActor();
  const [run, { error }] = useAction();
  const { project, lines, modules } = snapshot;

  if (!project.classify) {
    return (
      <EmptyState>
        Modules are created when the classification is confirmed. <Link to="../lines">Review the order lines</Link> to get there.
      </EmptyState>
    );
  }

  const placed = new Set(modules.flatMap((m) => m.serviceLineIds));
  const loose = lines.filter((l) => l.kind === 'service' && !placed.has(l.id));
  const canDeliver = can(actor, 'set_delivery');

  return (
    <div className="stack">
      {error && <Notice tone="error">{error}</Notice>}
      {!canDeliver && <Notice tone="info">Only an Admin can record delivery.</Notice>}
      <div className="module-grid">
        {modules.map((m) => (
          <ModuleCard
            key={m.id}
            module={m}
            lines={lines}
            disabled={!canDeliver}
            onDelivery={(mod, value) => run(() => api.setModuleDelivery(mod.id, value, { actor }))}
          />
        ))}
      </div>

      {loose.length > 0 && (
        <Card title="Services for the project" hint={<span className="num">{loose.length}</span>}>
          <p className="muted">These services name no product, so they belong to the project until the lead assigns them to a module.</p>
          <ul className="loose">
            {loose.map((l) => (
              <li key={l.id}>
                <span>{l.title}</span>
                <div className="sel">
                  <select
                    aria-label={`Assign line ${l.no} to a module`}
                    value=""
                    disabled={!can(actor, 'confirm_classification')}
                    onChange={(e) => e.target.value && run(() => api.assignService(l.id, e.target.value, { actor }))}
                  >
                    <option value="">Assign to a module</option>
                    {modules.map((m) => (
                      <option key={m.id} value={m.id}>
                        {moduleLabel(m.moduleType)}
                      </option>
                    ))}
                  </select>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

import { useState } from 'react';
import { Card, Notice, StatusBadge } from '@/components';
import { useActor } from '@/app/actor';
import { useApi } from '@/data/api';
import { can } from '@/domain/permissions';
import { lockedByStatus, nextStatuses, PROJECT_STATUS, statusOf } from '@/domain/projects';
import { useAction } from '@/lib/useAction';
import { ReasonDialog } from './ReasonDialog';

const ACTION_LABEL = {
  on_hold: 'Put on hold',
  cancelled: 'Cancel project',
  in_progress: 'Resume',
  closed: 'Close project',
};

/*
  Whether work on the project is moving. Only an Admin changes it, always with a reason (closing needs none, but it is
  only possible once every stage is done). A project that is not in progress keeps what was done and locks the rest.
*/
export function ProjectStatusCard({ project, tracker }) {
  const api = useApi();
  const { actor } = useActor();
  const [run, { busy, error, clear }] = useAction();
  const [target, setTarget] = useState(null);
  const status = statusOf(project);
  const allowed = can(actor, 'set_project_status');
  const allDone = tracker.every((s) => s.state === 'done');
  const moves = nextStatuses(status).filter((s) => s !== 'closed' || allDone);
  const label = (to) => (to === 'in_progress' && status === 'cancelled' ? 'Reopen' : ACTION_LABEL[to]);

  const apply = async (reason) => {
    const ok = await run(async () => {
      await api.setProjectStatus(project.id, target, { actor, reason });
      return true;
    });
    if (ok) setTarget(null);
  };

  return (
    <Card title="Status" actions={<StatusBadge tone={PROJECT_STATUS[status].tone}>{PROJECT_STATUS[status].label}</StatusBadge>}>
      {lockedByStatus(project) && <Notice tone="warning">{lockedByStatus(project)}</Notice>}
      {error && !target && <Notice tone="error">{error}</Notice>}
      {allowed && moves.length > 0 && (
        <div className="action-row">
          {moves.map((to) => (
            <button
              key={to}
              type="button"
              className="btn ghost sm"
              disabled={busy}
              onClick={() => {
                clear();
                if (to === 'closed') run(() => api.setProjectStatus(project.id, 'closed', { actor }));
                else setTarget(to);
              }}
            >
              {label(to)}
            </button>
          ))}
        </div>
      )}
      {!allowed && status !== 'closed' && <small className="muted">Only an Admin can change the status.</small>}
      <ReasonDialog
        open={Boolean(target)}
        title={target ? `${label(target)}?` : ''}
        description="The reason is recorded with your name and shown on the project."
        confirmLabel={target ? label(target) : 'Confirm'}
        busy={busy}
        error={error}
        onConfirm={apply}
        onClose={() => {
          clear();
          setTarget(null);
        }}
      />
    </Card>
  );
}

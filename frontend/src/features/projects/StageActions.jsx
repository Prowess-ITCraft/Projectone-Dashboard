import { useState } from 'react';
import { Notice } from '@/components';
import { useActor } from '@/app/actor';
import { useApi } from '@/data/api';
import { can } from '@/domain/permissions';
import { useAction } from '@/lib/useAction';
import { ReasonDialog } from './ReasonDialog';

/*
  The buttons that move a project through intake and classification, with the reason a button is unavailable.
  Used on the overview and under the order lines so the next step is always at hand.
*/
export function StageActions({ snapshot }) {
  const api = useApi();
  const { actor } = useActor();
  const [run, { busy, error, clear }] = useAction();
  const [reopen, setReopen] = useState(null);
  const { project, tracker } = snapshot;
  const stage = (id) => tracker.find((s) => s.id === id);
  const intake = stage('intake');
  const classify = stage('classify');

  const confirmIntake = () => run(() => api.confirmIntake(project.id, { actor }));
  const confirmClassify = () => run(() => api.confirmClassification(project.id, { actor }));
  const doReopen = async (reason) => {
    const target = reopen;
    const ok = await run(async () => {
      await (target === 'classify'
        ? api.reopenClassification(project.id, { actor, reason })
        : api.reopenIntake(project.id, { actor, reason }));
      return true;
    });
    if (ok) setReopen(null);
  };

  return (
    <div className="stage-actions">
      {error && <Notice tone="error">{error}</Notice>}

      {intake.state !== 'done' && (
        <div className="action-row">
          <button
            type="button"
            className="btn"
            onClick={confirmIntake}
            disabled={busy || intake.state !== 'todo' || !can(actor, 'confirm_intake')}
          >
            Confirm intake lines
          </button>
          <small>
            {!can(actor, 'confirm_intake')
              ? 'Only the project lead can confirm the lines.'
              : intake.state !== 'todo'
                ? intake.reason
                : 'You are confirming that the lines match the order.'}
          </small>
        </div>
      )}

      {intake.state === 'done' && classify.state !== 'done' && (
        <div className="action-row">
          <button
            type="button"
            className="btn"
            onClick={confirmClassify}
            disabled={busy || classify.state !== 'todo' || !can(actor, 'confirm_classification')}
          >
            Confirm classification and create modules
          </button>
          <small>{classify.state !== 'todo' ? classify.reason : 'One module is created for each product or subscription.'}</small>
        </div>
      )}

      {intake.state === 'done' && (
        <div className="action-row">
          {classify.state === 'done' ? (
            <button
              type="button"
              className="btn ghost sm"
              disabled={!can(actor, 'reopen')}
              onClick={() => {
                clear();
                setReopen('classify');
              }}
            >
              Reopen classification
            </button>
          ) : (
            <button
              type="button"
              className="btn ghost sm"
              disabled={!can(actor, 'reopen')}
              onClick={() => {
                clear();
                setReopen('intake');
              }}
            >
              Reopen intake review
            </button>
          )}
          {!can(actor, 'reopen') && <small>Only the project lead can reopen a confirmed review.</small>}
        </div>
      )}

      <ReasonDialog
        open={Boolean(reopen)}
        title={reopen === 'classify' ? 'Reopen classification' : 'Reopen intake review'}
        description={
          reopen === 'classify'
            ? 'The modules created from this classification are removed. The reason is recorded.'
            : 'The lines become editable again, and the classification and its modules are removed. The reason is recorded.'
        }
        confirmLabel="Reopen"
        busy={busy}
        error={error}
        onConfirm={doReopen}
        onClose={() => setReopen(null)}
      />
    </div>
  );
}

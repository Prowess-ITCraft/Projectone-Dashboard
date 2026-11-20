import { Fragment, useState } from 'react';
import { CheckCircleIcon, LockIcon } from '@phosphor-icons/react';
import { Card, CountUp, DataTable, ErrorState, LoadingState, Notice, Ring, StatusBadge } from '@/components';
import { useActor } from '@/app/actor';
import { useApi, useApiQuery } from '@/data/api';
import { can } from '@/domain/permissions';
import { useAction } from '@/lib/useAction';
import { formatDate } from './labels';
import { StepComments } from './StepComments';
import { StepEvidence } from './StepEvidence';

export const CHECKLIST_COLUMNS = ['SN', 'Done', 'Task', 'Start date', 'End date', 'Progress', 'Comments'];
export const CHECKLIST_PHASES = [
  ['installation', 'Installation'],
  ['configuration', 'Configuration'],
];
export const NO_STEPS = 'No checklist steps yet. Steps will appear here once they are defined for this project.';

/* How each state looks: Complete is green (the app's success colour), Awaiting evidence is amber, Pending is neutral */
export const STEP_STATES = {
  pending: { label: 'Pending', tone: 'neutral' },
  awaiting_evidence: { label: 'Awaiting evidence', tone: 'warning' },
  complete: { label: 'Complete', tone: 'positive' },
};

function StepRow({ projectId, step, number, limits, open, onToggle, canComplete, canEvidence, canComment }) {
  const api = useApi();
  const [run, { busy, error, clear }] = useAction();
  const state = STEP_STATES[step.state];
  const complete = step.state === 'complete';
  const awaiting = step.state === 'awaiting_evidence';
  const interactive = !step.locked;
  const tick = () => run(() => (awaiting ? api.untickStep(projectId, step.id) : api.completeStep(projectId, step.id)));
  const finish = () => run(() => api.completeStep(projectId, step.id));
  const ticks = canComplete && !step.locked && !complete;
  const panelId = `step-${step.id}`;

  return (
    <Fragment>
      <tr className={`step step-${step.state.replace('_', '-')}${step.locked ? ' locked' : ''}`} data-state={step.state}>
        <td className="sn num">{number}</td>
        <td className="done-cell">
          {complete ? (
            <CheckCircleIcon className="step-check" weight="fill" size={20} aria-label={`Completed: ${step.title}`} role="img" />
          ) : step.locked ? (
            <LockIcon size={18} aria-label={`Locked: ${step.title}`} role="img" />
          ) : (
            <input type="checkbox" checked={awaiting} disabled={!ticks || busy} onChange={tick} aria-label={`Completed: ${step.title}`} />
          )}
        </td>
        <td className="ttl">
          {step.title}
          <StatusBadge tone={state.tone} className="inline">
            {state.label}
          </StatusBadge>
          {step.locked && <small className="lock-note">{step.lockedReason}</small>}
        </td>
        <td>{step.startDate ? formatDate(step.startDate) : ''}</td>
        <td>{step.endDate ? formatDate(step.endDate) : ''}</td>
        <td className="prog">
          <StatusBadge tone={complete ? 'positive' : step.progress ? 'warning' : 'neutral'}>{`${step.progress}%`}</StatusBadge>
        </td>
        <td>
          {interactive ? (
            <button
              type="button"
              className="btn ghost sm"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={onToggle}
              aria-label={`${open ? 'Hide' : 'Show'} evidence and comments for ${step.title}`}
            >
              {step.evidence.length} {step.evidence.length === 1 ? 'file' : 'files'}, {step.comments.length}{' '}
              {step.comments.length === 1 ? 'comment' : 'comments'}
            </button>
          ) : (
            <span className="muted">Locked</span>
          )}
        </td>
      </tr>
      {open && interactive && (
        <tr className={`step-detail step-${step.state.replace('_', '-')}`}>
          <td colSpan={CHECKLIST_COLUMNS.length} id={panelId}>
            {error && (
              <Notice
                tone="error"
                actions={
                  <button type="button" className="btn ghost sm" onClick={clear}>
                    Dismiss
                  </button>
                }
              >
                {error}
              </Notice>
            )}
            <div className="step-panels">
              <StepEvidence projectId={projectId} step={step} limits={limits} canAct={canEvidence} onFinish={finish} busy={busy} />
              <StepComments projectId={projectId} step={step} canAct={canComment} />
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  );
}

/*
  The project's checklist: its steps from the server, grouped by phase, with the same columns and counters as the
  component checklists. An engineer can mark a step done, add evidence and comment, and nothing else: every other
  field is plain text here, and the server refuses the rest anyway. An Admin sees the same screen read only, with all
  evidence and comments. Counters and the percentage count Complete steps only.
*/
export default function ChecklistTab({ snapshot, projectId = snapshot?.project.id }) {
  const { actor } = useActor();
  const { data, error, loading, reload } = useApiQuery((a) => a.getChecklist(projectId), [projectId]);
  const [opened, setOpened] = useState({});

  if (loading) return <LoadingState label="Loading the checklist" />;
  if (error) return <ErrorState title="The checklist could not be loaded" message={error.message} onRetry={reload} />;

  const { steps, limits } = data;
  const done = steps.filter((s) => s.state === 'complete').length;
  const inProgress = steps.filter((s) => s.state === 'awaiting_evidence').length;
  const pct = steps.length ? Math.round((done / steps.length) * 100) : 0;
  const canComplete = can(actor, 'complete_step');
  const canEvidence = can(actor, 'upload_evidence');
  const canComment = can(actor, 'comment_step');
  // a step that awaits evidence shows its upload panel until the person closes it
  const isOpen = (s) => opened[s.id] ?? s.state === 'awaiting_evidence';

  return (
    <div className="stack">
      <div className="dh">
        <div className="dh-m">
          <p className="note">{steps.length ? 'Steps are done in order. A step opens once the one before it is complete.' : NO_STEPS}</p>
        </div>
        <dl className="dh-s">
          <div>
            <dt>Done</dt>
            <dd className="num">
              <CountUp to={done} />
            </dd>
          </div>
          <div>
            <dt>In progress</dt>
            <dd className="num">
              <CountUp to={inProgress} />
            </dd>
          </div>
          <div>
            <dt>Pending</dt>
            <dd className="num">
              <CountUp to={steps.length - done - inProgress} />
            </dd>
          </div>
        </dl>
        <Ring pct={pct} size={92} stroke={7}>
          <span className="ring-n num">
            <CountUp to={pct} suffix="%" />
          </span>
        </Ring>
      </div>

      {CHECKLIST_PHASES.map(([phase, label]) => {
        const rows = steps.filter((s) => s.phase === phase);
        const finished = rows.filter((s) => s.state === 'complete').length;
        return (
          <Card key={phase} flush title={`${label} steps`} hint={<span className="num">{`${finished} of ${rows.length} completed`}</span>}>
            <DataTable className="check" columns={CHECKLIST_COLUMNS} isEmpty={!rows.length} empty="No steps yet.">
              {rows.map((s, i) => (
                <StepRow
                  key={s.id}
                  projectId={projectId}
                  step={s}
                  number={i + 1}
                  limits={limits}
                  open={isOpen(s)}
                  onToggle={() => setOpened((o) => ({ ...o, [s.id]: !isOpen(s) }))}
                  canComplete={canComplete}
                  canEvidence={canEvidence}
                  canComment={canComment}
                />
              ))}
            </DataTable>
          </Card>
        );
      })}
    </div>
  );
}

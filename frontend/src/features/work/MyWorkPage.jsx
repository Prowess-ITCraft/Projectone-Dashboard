import { Link } from 'react-router-dom';
import { CaretRightIcon } from '@phosphor-icons/react';
import { ErrorState, LoadingState, Notice, PageHead } from '@/components';
import { useApi, useApiQuery } from '@/data/api';
import { formatTimestamp } from '@/features/projects/labels';

const progressText = (p) => (p.stepCount ? `${p.stepsDone} of ${p.stepCount} steps complete` : 'No checklist steps yet');

/*
  An engineer's start page: the projects assigned to them, newest assignment first, each one full-width row. The whole
  row is one link to the project (so it works with Tab and Enter, has no buttons or links inside it, and shows hover
  and focus states). The server returns only their own projects, with nothing but the project, customer, checklist
  progress and when it was assigned. Unread alerts are shown on top, so a new assignment is seen at the next sign-in.
*/
export default function MyWorkPage() {
  const api = useApi();
  const { data, error, loading, reload } = useApiQuery((a) => Promise.all([a.listMyProjects(), a.listNotifications()]));

  if (loading) return <LoadingState label="Loading your work" />;
  if (error) return <ErrorState title="Your work could not be loaded" message={error.message} onRetry={reload} />;

  const [rows, alerts] = data;
  const unread = alerts.items.filter((n) => !n.read);
  const empty = 'No projects are assigned to you yet. They appear here once your Admin assigns one.';

  return (
    <>
      <PageHead title="My work" sub="The projects assigned to you." />
      {unread.length > 0 && (
        <Notice
          tone="info"
          title={unread.length === 1 ? 'You have 1 new alert' : `You have ${unread.length} new alerts`}
          actions={
            <button type="button" className="btn ghost sm" onClick={() => api.markAllNotificationsRead()}>
              Mark all as read
            </button>
          }
        >
          <ul className="plain-list">
            {unread.map((n) => (
              <li key={n.id}>
                {n.projectId && n.type !== 'project_removed' ? (
                  <Link to={`/projects/${n.projectId}`} onClick={() => api.markNotificationRead(n.id)}>
                    {n.message}
                  </Link>
                ) : (
                  n.message
                )}
              </li>
            ))}
          </ul>
        </Notice>
      )}

      {rows.length ? (
        <ul className="work-rows" aria-label="My projects">
          {rows.map((p) => (
            <li key={p.id}>
              <Link to={`/projects/${p.id}`} className="work-row">
                <span className="work-row-main">
                  <span className="strong">{p.number}</span>
                  <span className="work-row-customer">{p.customerName}</span>
                </span>
                <span className="work-row-meta">
                  <span>{progressText(p)}</span>
                  <small>Assigned {formatTimestamp(p.assignedAt)}</small>
                </span>
                <CaretRightIcon className="work-row-go" size={16} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="note work-empty">{empty}</p>
      )}
    </>
  );
}

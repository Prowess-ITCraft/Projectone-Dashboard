import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellIcon } from '@phosphor-icons/react';
import { useApi } from '@/data/api';
import { formatTimestamp } from '@/features/projects/labels';

/* How often the unread count is refreshed while someone is signed in */
export const POLL_MS = 45_000;

/*
  The alerts bell in the top bar: an unread count, and a list of alerts, newest first. Opening an alert marks it read
  and opens its project (an alert about being removed from a project opens nothing, as the project is closed to them).
  The count is refreshed every POLL_MS as background requests, which do not keep an idle session alive.
*/
export function NotificationBell() {
  const api = useApi();
  const nav = useNavigate();
  const [data, setData] = useState({ unread: 0, items: [] });
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);

  const load = useCallback(
    (background) =>
      api
        .listNotifications({ background })
        .then(setData)
        .catch(() => {}),
    [api],
  );

  useEffect(() => {
    load(false);
    const timer = setInterval(() => load(true), POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    const onClick = (e) => wrap.current && !wrap.current.contains(e.target) && setOpen(false);
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  const openAlert = async (alert) => {
    setOpen(false);
    if (!alert.read) await api.markNotificationRead(alert.id).catch(() => {});
    load(false);
    if (alert.projectId && alert.type !== 'project_removed') nav(`/projects/${alert.projectId}`);
  };

  const readAll = async () => {
    await api.markAllNotificationsRead().catch(() => {});
    load(false);
  };

  const label = data.unread ? `Alerts, ${data.unread} unread` : 'Alerts';
  return (
    <div className="bell" ref={wrap}>
      <button type="button" className="icon-btn bell-btn" aria-label={label} aria-expanded={open} onClick={() => setOpen(!open)}>
        <BellIcon size={18} aria-hidden="true" />
        {data.unread > 0 && (
          <span className="bell-count num" aria-hidden="true">
            {data.unread > 99 ? '99+' : data.unread}
          </span>
        )}
      </button>
      {open && (
        <div className="bell-panel" role="region" aria-label="Alerts">
          <div className="bell-head">
            <b>Alerts</b>
            {data.unread > 0 && (
              <button type="button" className="btn ghost sm" onClick={readAll}>
                Mark all as read
              </button>
            )}
          </div>
          {data.items.length ? (
            <ul className="bell-list">
              {data.items.map((a) => (
                <li key={a.id}>
                  <button type="button" className={`bell-item${a.read ? '' : ' unread'}`} onClick={() => openAlert(a)}>
                    <span className="bell-msg">{a.message}</span>
                    <small>
                      {formatTimestamp(a.createdAt)}
                      {a.read ? '' : ', unread'}
                    </small>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted bell-empty">No alerts yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

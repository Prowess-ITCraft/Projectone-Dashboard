import { useState } from 'react';
import { Card, DataTable, Dialog, ErrorState, FormField, LoadingState, Notice, PageHead, StatusBadge } from '@/components';
import { useActor } from '@/app/actor';
import { useApi, useApiQuery } from '@/data/api';
import { ROLES, can } from '@/domain/permissions';
import { formatTimestamp } from '@/features/projects/labels';
import { useAction } from '@/lib/useAction';

const COLUMNS = ['Name', 'Email', 'Role', 'Status', 'Last sign-in', ''];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/*
  Accounts, for the Admin only: add an engineer, reset one to the default password, copy an engineer's login details,
  deactivate or reactivate an account. A new or reset engineer holds the shared default password until they choose their
  own at first sign-in; while they do, "Copy login details" copies their email and that password for sending. Once they
  have chosen their own, nobody can see it, and the button is gone.
*/
export default function UsersPage() {
  const api = useApi();
  const { actor } = useActor();
  const { data, error, loading, reload } = useApiQuery((a) => a.listUsers());
  const [form, setForm] = useState({ name: '', email: '' });
  const [touched, setTouched] = useState(false);
  const [issued, setIssued] = useState(null);
  const [copied, setCopied] = useState('');
  const [deactivating, setDeactivating] = useState(null);
  const [run, action] = useAction();

  if (!can(actor, 'manage_users')) return <Notice tone="warning">Only an Admin can manage users.</Notice>;
  if (loading) return <LoadingState label="Loading the users" />;
  if (error) return <ErrorState title="The users could not be loaded" message={error.message} onRetry={reload} />;

  const errors = {
    name: !form.name.trim() ? "Enter the engineer's full name." : undefined,
    email: !EMAIL.test(form.email.trim()) ? 'Enter a valid email address.' : undefined,
  };

  const add = async (e) => {
    e.preventDefault();
    setTouched(true);
    if (errors.name || errors.email) return;
    const result = await run(() => api.addEngineer({ name: form.name.trim(), email: form.email.trim() }));
    if (!result) return;
    setIssued({ ...result, reason: 'created' });
    setForm({ name: '', email: '' });
    setTouched(false);
  };

  const reset = async (user) => {
    setCopied('');
    const result = await run(() => api.resetPassword(user.id));
    if (result) setIssued({ ...result, reason: 'reset' });
  };

  const copyDetails = async (user) => {
    setIssued(null);
    const text = await run(async () => {
      const { email, password } = await api.getLoginDetails(user.id);
      const text = ['ProjectOne login', `Email: ${email}`, `Password: ${password}`].join('\n');
      await navigator.clipboard.writeText(text);
      return text;
    });
    setCopied(text ? `Login details for ${user.name} are copied. Send them privately.` : '');
    if (!text) reload();
  };

  const deactivate = async () => {
    const done = await run(() => api.setUserActive(deactivating.id, false));
    if (done) setDeactivating(null);
  };

  return (
    <>
      <PageHead title="Users" sub="Everyone who can sign in. Engineers see only the projects assigned to them." />
      <div className="stack">
        {issued && (
          <Notice
            tone="info"
            title={
              issued.reason === 'created'
                ? `Account created for ${issued.user.name}`
                : `Reset to the default password for ${issued.user.name}`
            }
            actions={
              <button type="button" className="btn ghost sm" onClick={() => setIssued(null)}>
                Done
              </button>
            }
          >
            {issued.user.email} starts with the default password and must choose their own at first sign-in. Use Copy login details on their
            row to send it.
          </Notice>
        )}
        {copied && (
          <Notice
            actions={
              <button type="button" className="btn ghost sm" onClick={() => setCopied('')}>
                Done
              </button>
            }
          >
            {copied}
          </Notice>
        )}
        {action.error && !deactivating && <Notice tone="error">{action.error}</Notice>}

        <Card title="Add an engineer">
          <form onSubmit={add} noValidate>
            <div className="form-grid">
              <FormField label="Full name" error={touched ? errors.name : undefined}>
                {(f) => (
                  <input {...f.control} className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                )}
              </FormField>
              <FormField label="Email" error={touched ? errors.email : undefined}>
                {(f) => (
                  <input
                    {...f.control}
                    type="email"
                    className="input"
                    autoComplete="off"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                )}
              </FormField>
            </div>
            <button type="submit" className="btn" disabled={action.busy}>
              Add engineer
            </button>
          </form>
        </Card>

        <Card flush title="Accounts" hint={<span className="num">{data.length}</span>}>
          <DataTable columns={COLUMNS} isEmpty={!data.length} empty="No accounts yet." className="users" caption="Accounts">
            {data.map((u) => (
              <tr key={u.id} className={u.active ? '' : 'muted-row'}>
                <td className="strong">{u.name}</td>
                <td className="file-name">{u.email}</td>
                <td>{ROLES[u.role] ?? u.role}</td>
                <td>
                  <StatusBadge tone={u.active ? 'positive' : 'muted'}>{u.active ? 'Active' : 'Deactivated'}</StatusBadge>
                  {u.active && u.mustChangePassword && (
                    <StatusBadge tone="warning" className="inline">
                      New password pending
                    </StatusBadge>
                  )}
                </td>
                <td>{u.lastLoginAt ? formatTimestamp(u.lastLoginAt) : <span className="muted">Never</span>}</td>
                <td className="row-actions">
                  {u.id !== actor.id && (
                    <>
                      {u.active && u.passwordIsDefault && u.mustChangePassword && (
                        <button
                          type="button"
                          className="btn ghost sm"
                          disabled={action.busy}
                          aria-label={`Copy login details for ${u.name}`}
                          onClick={() => copyDetails(u)}
                        >
                          Copy login details
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn ghost sm"
                        disabled={action.busy}
                        aria-label={`Reset ${u.name} to the default password`}
                        onClick={() => reset(u)}
                      >
                        Reset to default password
                      </button>
                      {u.active ? (
                        <button
                          type="button"
                          className="btn ghost sm"
                          aria-label={`Deactivate ${u.name}`}
                          onClick={() => {
                            action.clear();
                            setDeactivating(u);
                          }}
                        >
                          Deactivate
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn ghost sm"
                          disabled={action.busy}
                          aria-label={`Reactivate ${u.name}`}
                          onClick={() => run(() => api.setUserActive(u.id, true))}
                        >
                          Reactivate
                        </button>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </DataTable>
        </Card>
      </div>

      <Dialog
        open={Boolean(deactivating)}
        role="alertdialog"
        onClose={() => setDeactivating(null)}
        title={deactivating ? `Deactivate ${deactivating.name}?` : ''}
        description="They are signed out at once and can no longer sign in. Their history is kept, and you can reactivate the account later."
        actions={
          <>
            <button type="button" className="btn ghost sm" onClick={() => setDeactivating(null)} data-autofocus>
              Cancel
            </button>
            <button type="button" className="btn sm" disabled={action.busy} onClick={deactivate}>
              Deactivate
            </button>
          </>
        }
      >
        {action.error && deactivating && <Notice tone="error">{action.error}</Notice>}
      </Dialog>
    </>
  );
}

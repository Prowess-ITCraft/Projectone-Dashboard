import { Fragment, useState } from 'react';
import { Card, FormField, Notice } from '@/components';
import { useActor } from '@/app/actor';
import { useApi } from '@/data/api';
import { isValidEmail } from '@/domain/customers';
import { isValidGstin } from '@/domain/gstin';
import { can } from '@/domain/permissions';
import { useAction } from '@/lib/useAction';

const FIELDS = [
  ['name', 'Name'],
  ['gstin', 'GSTIN'],
  ['address', 'Address'],
  ['contact', 'Contact person'],
  ['email', 'Contact email'],
];

/* The customer's details, read-only until Edit; every saved change is recorded with the values before and after */
export function CustomerDetailsCard({ customer }) {
  const api = useApi();
  const { actor } = useActor();
  const [run, { busy, error, clear }] = useAction();
  const [draft, setDraft] = useState(null);
  const editable = can(actor, 'create_project');

  const errors = draft
    ? {
        name: !draft.name.trim() ? 'The customer name cannot be blank.' : undefined,
        gstin: draft.gstin.trim() && !isValidGstin(draft.gstin) ? 'This GSTIN is not in a valid format (15 characters).' : undefined,
        email: draft.email.trim() && !isValidEmail(draft.email) ? 'This email address is not in a valid format.' : undefined,
      }
    : {};

  const save = async (e) => {
    e.preventDefault();
    if (errors.name || errors.gstin || errors.email) return;
    const ok = await run(async () => {
      await api.updateCustomer(customer.id, draft, { actor });
      return true;
    });
    if (ok) setDraft(null);
  };

  return (
    <Card
      title="Details"
      actions={
        editable && !draft ? (
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => {
              clear();
              setDraft(Object.fromEntries(FIELDS.map(([k]) => [k, customer[k] ?? ''])));
            }}
          >
            Edit
          </button>
        ) : null
      }
    >
      {draft ? (
        <form onSubmit={save} noValidate className="stack">
          {error && <Notice tone="error">{error}</Notice>}
          <div className="form-grid">
            {FIELDS.map(([key, label]) => (
              <FormField key={key} label={label} error={errors[key]}>
                {(f) => (
                  <input
                    {...f.control}
                    className="input"
                    type={key === 'email' ? 'email' : 'text'}
                    value={draft[key]}
                    onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                  />
                )}
              </FormField>
            ))}
          </div>
          <div className="action-row">
            <button type="submit" className="btn sm" disabled={busy}>
              Save details
            </button>
            <button type="button" className="btn ghost sm" onClick={() => setDraft(null)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <dl className="facts">
          <dt>Number</dt>
          <dd>{customer.number}</dd>
          {FIELDS.map(([key, label]) => (
            <Fragment key={key}>
              <dt>{label}</dt>
              <dd>{customer[key] || <span className="muted">Not given</span>}</dd>
            </Fragment>
          ))}
        </dl>
      )}
    </Card>
  );
}

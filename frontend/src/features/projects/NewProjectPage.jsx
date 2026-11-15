import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, FormField, Icon, Notice, PageHead, SegmentedControl } from '@/components';
import { useActor } from '@/app/actor';
import { useApi } from '@/data/api';
import { isValidGstin } from '@/domain/gstin';
import { ENTRY_PATHS } from '@/domain/projects';
import { can } from '@/domain/permissions';
import { useAction } from '@/lib/useAction';

const EMPTY = { name: '', gstin: '', address: '', contact: '', email: '' };

export default function NewProjectPage() {
  const api = useApi();
  const nav = useNavigate();
  const { actor } = useActor();
  const [run, { busy, error }] = useAction();
  const [customer, setCustomer] = useState(EMPTY);
  const [chosen, setChosen] = useState(null);
  const [matches, setMatches] = useState([]);
  const [entryPath, setEntryPath] = useState('');
  const [purpose, setPurpose] = useState('');
  const [location, setLocation] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (chosen) return undefined;
    let current = true;
    api.findCustomerMatches({ gstin: customer.gstin, name: customer.name }).then((m) => current && setMatches(m));
    return () => {
      current = false;
    };
  }, [api, chosen, customer.gstin, customer.name]);

  const set = (key) => (e) => setCustomer({ ...customer, [key]: e.target.value });
  const errors = {
    name: !chosen && !customer.name.trim() ? 'Enter the customer name.' : undefined,
    gstin:
      !chosen && customer.gstin.trim() && !isValidGstin(customer.gstin)
        ? 'This GSTIN is not in a valid format (15 characters).'
        : undefined,
    entryPath: !entryPath ? 'Choose how this work came about.' : undefined,
  };
  const invalid = Object.values(errors).some(Boolean);

  const submit = async (e) => {
    e.preventDefault();
    setTouched(true);
    if (invalid) return;
    const project = await run(() =>
      api.createProject({ customer: chosen ? { id: chosen.id } : customer, entryPath, purpose, location, actor }),
    );
    if (project) nav(`/projects/${project.id}/documents`);
  };

  if (!can(actor, 'create_project')) {
    return <Notice tone="warning">Your role cannot create projects. Change the role at the top of the page.</Notice>;
  }

  return (
    <>
      <Link to="/projects" className="back">
        <Icon name="ArrowLeft" size={14} />
        All projects
      </Link>
      <PageHead title="New project" sub="Name the customer and how the work came about. You add the order documents next." />

      <form onSubmit={submit} noValidate className="stack">
        <Card title="Customer">
          {chosen ? (
            <Notice
              tone="info"
              title={`${chosen.name} (${chosen.number})`}
              actions={
                <button type="button" className="btn ghost sm" onClick={() => setChosen(null)}>
                  Use a different customer
                </button>
              }
            >
              This project is added to the existing customer{chosen.gstin ? `, GSTIN ${chosen.gstin}` : ''}.
            </Notice>
          ) : (
            <>
              <div className="form-grid">
                <FormField label="Customer name" error={touched ? errors.name : undefined}>
                  {(f) => <input {...f.control} className="input" value={customer.name} onChange={set('name')} autoComplete="off" />}
                </FormField>
                <FormField
                  label="GSTIN"
                  hint="Optional. Used to recognise a returning customer."
                  error={touched || customer.gstin.length >= 15 ? errors.gstin : undefined}
                >
                  {(f) => <input {...f.control} className="input" value={customer.gstin} onChange={set('gstin')} autoComplete="off" />}
                </FormField>
                <FormField label="Address">
                  {(f) => <input {...f.control} className="input" value={customer.address} onChange={set('address')} />}
                </FormField>
                <FormField label="Contact person">
                  {(f) => <input {...f.control} className="input" value={customer.contact} onChange={set('contact')} />}
                </FormField>
                <FormField label="Contact email">
                  {(f) => <input {...f.control} type="email" className="input" value={customer.email} onChange={set('email')} />}
                </FormField>
              </div>
              {matches.map(({ customer: c, reason }) => (
                <Notice
                  key={c.id}
                  tone="warning"
                  title={reason === 'gstin' ? 'This GSTIN belongs to an existing customer' : 'A customer with a similar name exists'}
                  actions={
                    <button type="button" className="btn sm" onClick={() => setChosen(c)}>
                      Use {c.number}
                    </button>
                  }
                >
                  {c.name} ({c.number}). Use it to keep every order in one place, or carry on to add a new customer.
                </Notice>
              ))}
            </>
          )}
        </Card>

        <Card title="Project">
          <FormField
            label="Entry path"
            group
            error={touched ? errors.entryPath : undefined}
            hint="Post-audit has a PrismSuite report, new infrastructure is all new, restructuring changes an existing setup."
          >
            {(f) => (
              <SegmentedControl
                {...f.control}
                id="entry-path"
                value={entryPath}
                options={Object.entries(ENTRY_PATHS)}
                onChange={setEntryPath}
              />
            )}
          </FormField>
          <div className="form-grid">
            <FormField label="Purpose" hint="Why the customer ordered this, in a sentence.">
              {(f) => (
                <textarea {...f.control} className="input textarea" rows={3} value={purpose} onChange={(e) => setPurpose(e.target.value)} />
              )}
            </FormField>
            <FormField label="Site or location">
              {(f) => <input {...f.control} className="input" value={location} onChange={(e) => setLocation(e.target.value)} />}
            </FormField>
          </div>
        </Card>

        {error && <Notice tone="error">{error}</Notice>}
        <div className="action-row">
          <button type="submit" className="btn" disabled={busy}>
            Create project
          </button>
          <Link to="/projects" className="btn ghost">
            Cancel
          </Link>
        </div>
      </form>
    </>
  );
}

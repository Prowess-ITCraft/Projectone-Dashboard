import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, FormField, Icon, Notice, PageHead, SegmentedControl } from '@/components';
import { useActor } from '@/app/actor';
import { useApi, useApiQuery } from '@/data/api';
import { isValidEmail } from '@/domain/customers';
import { isValidGstin } from '@/domain/gstin';
import { ENTRY_PATHS } from '@/domain/projects';
import { can } from '@/domain/permissions';
import { useAction } from '@/lib/useAction';
import { SitePicker } from './SitePicker';
import { StartingDocuments } from './StartingDocuments';

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
  const [docs, setDocs] = useState({ order: null, orderType: 'pi', report: null });
  const [siteIds, setSiteIds] = useState([]);
  const [siteDrafts, setSiteDrafts] = useState([]);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (chosen) return undefined;
    let current = true;
    api.findCustomerMatches({ gstin: customer.gstin, name: customer.name }).then((m) => current && setMatches(m));
    return () => {
      current = false;
    };
  }, [api, chosen, customer.gstin, customer.name]);

  // an existing customer brings its sites to choose from; switching customer clears the choice
  const sitesQuery = useApiQuery((a) => (chosen ? a.listSites(chosen.id) : Promise.resolve([])), [chosen?.id]);
  const customerSites = chosen ? (sitesQuery.data ?? []) : [];
  const pickCustomer = (next) => {
    setChosen(next);
    setSiteIds([]);
  };

  const set = (key) => (e) => setCustomer({ ...customer, [key]: e.target.value });
  const errors = {
    name: !chosen && !customer.name.trim() ? 'Enter the customer name.' : undefined,
    gstin:
      !chosen && customer.gstin.trim() && !isValidGstin(customer.gstin)
        ? 'This GSTIN is not in a valid format (15 characters).'
        : undefined,
    email: !chosen && customer.email.trim() && !isValidEmail(customer.email) ? 'This email address is not in a valid format.' : undefined,
    entryPath: !entryPath ? 'Choose how this work came about.' : undefined,
  };
  const invalid = Object.values(errors).some(Boolean);

  const submit = async (e) => {
    e.preventDefault();
    setTouched(true);
    if (invalid) return;
    const result = await run(async () => {
      const project = await api.createProject({
        customer: chosen ? { id: chosen.id } : customer,
        entryPath,
        siteIds: chosen ? siteIds : [],
        newSites: siteDrafts,
        actor,
      });
      // the project exists from here on, so a file that cannot be added is reported on its documents page
      const notices = [];
      for (const [file, type] of [
        [docs.order, docs.orderType],
        [docs.report, 'prismsuite'],
      ]) {
        if (!file) continue;
        try {
          await api.addDocument({ projectId: project.id, type, file, actor });
        } catch (e) {
          notices.push(`${file.name} could not be added: ${e instanceof Error ? e.message : 'Something went wrong.'}`);
        }
      }
      return { project, notice: notices.join(' ') };
    });
    if (result) nav(`/projects/${result.project.id}/documents`, { state: result.notice ? { notice: result.notice } : undefined });
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
      <PageHead title="New project" sub="Name the customer and how the work came about. You add the documents here too." />

      <form onSubmit={submit} noValidate className="stack">
        <Card title="Customer">
          {chosen ? (
            <Notice
              tone="info"
              title={`${chosen.name} (${chosen.number})`}
              actions={
                <button type="button" className="btn ghost sm" onClick={() => pickCustomer(null)}>
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
                <FormField label="Contact email" error={touched ? errors.email : undefined}>
                  {(f) => <input {...f.control} type="email" className="input" value={customer.email} onChange={set('email')} />}
                </FormField>
              </div>
              {matches.map(({ customer: c, reason }) => (
                <Notice
                  key={c.id}
                  tone="warning"
                  title={reason === 'gstin' ? 'This GSTIN belongs to an existing customer' : 'A customer with a similar name exists'}
                  actions={
                    <button type="button" className="btn sm" onClick={() => pickCustomer(c)}>
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

        <Card title="Project" className="project-card">
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
          <StartingDocuments entryPath={entryPath} value={docs} onChange={setDocs} disabled={busy || !can(actor, 'upload')} />
          <SitePicker
            legend="Sites this project covers"
            sites={customerSites}
            selected={siteIds}
            onSelected={setSiteIds}
            drafts={siteDrafts}
            onDrafts={setSiteDrafts}
          />
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

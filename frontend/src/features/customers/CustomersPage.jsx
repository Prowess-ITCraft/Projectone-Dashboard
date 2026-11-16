import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, DataTable, ErrorState, Icon, LoadingState, PageHead } from '@/components';
import { useApiQuery } from '@/data/api';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { NARROW_QUERY } from '@/app/navigation';
import { formatTimestamp } from '@/features/projects/labels';
import { PrismSuiteBadge } from './PrismSuiteBadge';

const COLUMNS = ['Customer', 'Number', 'GSTIN', 'Sites', 'Projects', 'Last activity'];

const matches = (row, q) => !q || `${row.customer.name} ${row.customer.number} ${row.customer.gstin ?? ''}`.toLowerCase().includes(q);

/* Every customer in one place, so a returning customer is easy to find */
export default function CustomersPage() {
  const { data, error, loading, reload } = useApiQuery((a) => a.listCustomerSummaries());
  const [query, setQuery] = useState('');
  const narrow = useMediaQuery(NARROW_QUERY);
  const rows = useMemo(() => (data ?? []).filter((r) => matches(r, query.trim().toLowerCase())), [data, query]);

  if (loading) return <LoadingState label="Loading customers" />;
  if (error) return <ErrorState title="Customers could not be loaded" message={error.message} onRetry={reload} />;

  const projectsText = (r) => `${r.openProjectCount} open of ${r.projectCount}`;

  return (
    <>
      <PageHead title="Customers" sub="Every customer with their sites, orders and projects." />
      <div className="filters">
        <label className="search">
          <Icon name="MagnifyingGlass" size={16} />
          <input
            placeholder="Search by name, number or GSTIN"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search customers"
          />
        </label>
      </div>

      <Card flush title="All customers" hint={<span className="num">{rows.length}</span>}>
        {narrow ? (
          <ul className="row-cards" aria-label="Customers">
            {rows.map((r) => (
              <li key={r.customer.id} className="row-card">
                <div className="row-card-head">
                  <Link to={`/customers/${r.customer.id}`} className="strong">
                    {r.customer.name}
                  </Link>
                  {r.audited && <PrismSuiteBadge />}
                </div>
                <dl className="row-card-facts">
                  <dt>Number</dt>
                  <dd>{r.customer.number}</dd>
                  <dt>Sites</dt>
                  <dd className="num">{r.sites.length}</dd>
                  <dt>Projects</dt>
                  <dd>{projectsText(r)}</dd>
                  <dt>Last activity</dt>
                  <dd>{formatTimestamp(r.lastActivityAt)}</dd>
                </dl>
              </li>
            ))}
            {!rows.length && <li className="row-card empty">{data.length ? 'No customer matches the search.' : 'No customers yet.'}</li>}
          </ul>
        ) : (
          <DataTable
            columns={COLUMNS}
            isEmpty={!rows.length}
            empty={data.length ? 'No customer matches the search.' : 'No customers yet. They are added when a project is created.'}
            className="customers"
          >
            {rows.map((r) => (
              <tr key={r.customer.id}>
                <td className="strong">
                  <Link to={`/customers/${r.customer.id}`}>{r.customer.name}</Link>
                  {r.audited && <PrismSuiteBadge className="inline" />}
                </td>
                <td>{r.customer.number}</td>
                <td>{r.customer.gstin || <span className="muted">Not given</span>}</td>
                <td className="num">{r.sites.length}</td>
                <td>{projectsText(r)}</td>
                <td>{formatTimestamp(r.lastActivityAt)}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>
    </>
  );
}

import { Link } from 'react-router-dom';
import { Card, EmptyState, Notice, StatusBadge } from '@/components';
import { coverageCheck } from '@/domain/coverage';
import { moduleLabel } from '@/domain/modules';

function Group({ title, tone, items, empty }) {
  return (
    <Card title={title} hint={<span className="num">{items.length}</span>}>
      {items.length ? (
        <ul className="plain-list">
          {items.map((item) => (
            <li key={item.key}>
              {item.badge && <StatusBadge tone={tone}>{item.badge}</StatusBadge>} <span>{item.text}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">{empty}</p>
      )}
    </Card>
  );
}

/*
  What the PrismSuite report recommends against what the order contains. For information only: it never changes the
  order and never blocks a stage.
*/
export default function CoverageTab({ snapshot }) {
  const { documents, lines } = snapshot;
  const reports = documents.filter((d) => d.active && d.type === 'prismsuite');

  if (!reports.length) {
    return (
      <EmptyState>
        No PrismSuite report is attached. The coverage check compares its recommendations with the order.{' '}
        <Link to="../documents">Attach the report</Link> to use it.
      </EmptyState>
    );
  }

  const recommendations = reports.flatMap((r) => r.recommendations ?? []);
  const ordered = lines.filter((l) => l.kind === 'product' || l.kind === 'subscription').map((l) => l.moduleType);
  const result = coverageCheck(recommendations, ordered);

  return (
    <div className="stack">
      <Notice tone="info">For information only. This comparison never changes the order and never blocks a stage.</Notice>
      {!recommendations.length && (
        <Notice tone="warning" title="No recommendations recorded">
          The report is attached but its recommendations were not read. <Link to="../documents">Add them from its details</Link>.
        </Notice>
      )}
      {!lines.length && <Notice tone="warning">The order has no lines yet, so everything recommended shows as not ordered.</Notice>}
      <div className="coverage-grid">
        <Group
          title="Recommended but not ordered"
          tone="warning"
          empty="Everything the report recommends is in the order."
          items={result.recommendedNotOrdered.map((r) => ({ key: r.text, badge: moduleLabel(r.moduleType), text: r.text }))}
        />
        <Group
          title="Ordered but not recommended"
          tone="neutral"
          empty="Everything ordered was recommended."
          items={result.orderedNotRecommended.map((t) => ({
            key: t,
            badge: moduleLabel(t),
            text: `${moduleLabel(t)} is in the order but the report did not recommend it.`,
          }))}
        />
        <Group
          title="Recommended and ordered"
          tone="positive"
          empty="Nothing recommended is ordered yet."
          items={result.covered.map((r) => ({ key: r.text, badge: moduleLabel(r.moduleType), text: r.text }))}
        />
        <Group
          title="Other recommendations"
          tone="neutral"
          empty="The report has no recommendations that are not products."
          items={result.other.map((t) => ({ key: t, text: t }))}
        />
      </div>
    </div>
  );
}

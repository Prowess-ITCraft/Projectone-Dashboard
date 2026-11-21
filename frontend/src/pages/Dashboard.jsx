import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useChecklist } from '@/data/checklist';
import { totals, catStats, tasksFor } from '@/domain/checklist';
import { Card, CountUp, EmptyState, ErrorState, LoadingState, PageHead } from '@/components';
import { Stacked, BarList, Topology, TONE } from '@/components/charts';
import { ago } from '@/lib/time';

const rise = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };

export default function Dashboard() {
  const data = useChecklist();
  if (!data.ready) return data.error ? <ErrorState message={data.error} /> : <LoadingState label="Loading the overview" />;
  return <Overview data={data} />;
}

function Overview({ data }) {
  const { state, items: ITEMS } = data;
  const t = useMemo(() => totals(state, ITEMS), [state, ITEMS]);
  const cats = useMemo(() => catStats(state, ITEMS), [state, ITEMS]);
  const phases = ['Installation', 'Configuration'].map((ph) => {
    let done = 0,
      total = 0;
    ITEMS.forEach((it) =>
      ['new', 'existing'].forEach((m) =>
        tasksFor(it, m)
          .filter((x) => x.phase === ph)
          .forEach((x) => {
            total++;
            if (state.tasks[x.key]?.s === 2) done++;
          }),
      ),
    );
    return { label: `${ph} steps`, sub: `${done} of ${total}`, pct: total ? Math.round((done / total) * 100) : 0 };
  });
  const users = state.q.firewall.length + state.q.server.length;

  // the next thing to do: the component with work started but not finished, else the first untouched one
  const finding =
    t.done === 0 && t.prog === 0
      ? 'No task has been ticked yet. Open an implementation service to start its checklist.'
      : `${t.done} of ${t.total} tasks completed${t.prog ? `, ${t.prog} in progress` : ''}.`;

  const kpis = [
    { l: 'Services tracked', v: ITEMS.length, note: 'implementation services' },
    { l: 'Tasks completed', v: t.done, sfx: ` / ${t.total}`, note: `${t.prog} in progress` },
    { l: 'Overall progress', v: t.pct, sfx: '%', note: 'of all checklist tasks' },
    { l: 'Users in policy tables', v: users, note: `${state.q.firewall.length} firewall, ${state.q.server.length} server` },
  ];

  return (
    <>
      <PageHead title="Overview" sub={finding}>
        <Link to="/services" className="btn">
          Open services
        </Link>
      </PageHead>

      <Card as={motion.section} className="topo-card" title="Network topology" variants={rise} initial="hidden" animate="show">
        <Topology />
      </Card>

      <motion.div className="kpis" variants={stagger} initial="hidden" animate="show">
        {kpis.map((k) => (
          <motion.div key={k.l} className="kpi" variants={rise}>
            <div className="kpi-l">{k.l}</div>
            <div className="kpi-v num">
              <CountUp to={k.v} />
              {k.sfx && <small>{k.sfx}</small>}
            </div>
            <div className="kpi-n">{k.note}</div>
          </motion.div>
        ))}
      </motion.div>

      <Card as={motion.section} className="status-card" title="Task status" variants={rise} initial="hidden" animate="show">
        <div className="status-grid">
          <div>
            <div className="big-fig num">
              <CountUp to={t.pct} suffix="%" />
              <small>complete</small>
            </div>
            <Stacked
              parts={[
                { label: 'Done', value: t.done, color: TONE.done },
                { label: 'In progress', value: t.prog, color: TONE.active },
                { label: 'Pending', value: t.pending, color: TONE.pending },
              ]}
            />
            <ul className="legend">
              <li>
                <i style={{ background: TONE.done }} />
                Done<b className="num">{t.done}</b>
              </li>
              <li>
                <i style={{ background: TONE.active }} />
                In progress<b className="num">{t.prog}</b>
              </li>
              <li>
                <i style={{ background: TONE.pending }} />
                Pending<b className="num">{t.pending}</b>
              </li>
            </ul>
          </div>
          <BarList rows={phases} />
        </div>
      </Card>

      <motion.div className="row r-3" variants={stagger} initial="hidden" animate="show">
        <Card as={motion.section} title="Progress by pillar" variants={rise}>
          <BarList rows={cats.map((c) => ({ label: c.cat, pct: c.pct }))} />
        </Card>
        <Card as={motion.section} title="Recent activity" variants={rise}>
          <ul className="feed">
            {state.log.length === 0 && <EmptyState as="li">Nothing recorded yet.</EmptyState>}
            {state.log.slice(0, 6).map((l) => (
              <li key={l.t + l.text}>
                <span>{l.text}</span>
                <small>{ago(l.t)}</small>
              </li>
            ))}
          </ul>
        </Card>
      </motion.div>
    </>
  );
}

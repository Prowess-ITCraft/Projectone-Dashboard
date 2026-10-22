import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useStore, itemStats, totals, catStats, tasksFor } from '../store.jsx';
import { ITEMS } from '../data.js';
import { CountUp, PageHead, ago } from '../ui.jsx';
import { Stacked, BarList, Topology, TONE } from '../charts.jsx';

const rise = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };

export default function Dashboard() {
  const { state } = useStore();
  const t = useMemo(() => totals(state), [state]);
  const cats = useMemo(() => catStats(state), [state]);
  const infra = ITEMS.filter((i) => i.grp === 'infra');
  const progress = Object.fromEntries(infra.map((i) => [i.id, itemStats(state, i).pct]));
  const phases = ['Installation', 'Configuration'].map((ph) => {
    let done = 0, total = 0;
    ITEMS.forEach((it) => ['new', 'existing'].forEach((m) => tasksFor(it, m).filter((x) => x.phase === ph).forEach((x) => { total++; if (state.tasks[x.key]?.s === 2) done++; })));
    return { label: `${ph} steps`, sub: `${done} of ${total}`, pct: total ? Math.round((done / total) * 100) : 0 };
  });
  const users = state.q.firewall.length + state.q.server.length;

  // the next thing to do: the component with work started but not finished, else the first untouched one
  const finding = t.done === 0 && t.prog === 0
    ? 'No task has been ticked yet. Open a component to start its checklist.'
    : `${t.done} of ${t.total} tasks completed${t.prog ? `, ${t.prog} in progress` : ''}.`;

  const kpis = [
    { l: 'Components tracked', v: ITEMS.length, note: `${infra.length} network, ${ITEMS.length - infra.length} products` },
    { l: 'Tasks completed', v: t.done, sfx: ` / ${t.total}`, note: `${t.prog} in progress` },
    { l: 'Overall progress', v: t.pct, sfx: '%', note: 'of all checklist tasks' },
    { l: 'Users in policy tables', v: users, note: `${state.q.firewall.length} firewall, ${state.q.server.length} server` },
  ];

  return (
    <>
      <PageHead title="Overview" sub={finding}>
        <Link to="/components" className="btn">Open components</Link>
      </PageHead>

      <motion.div className="kpis" variants={stagger} initial="hidden" animate="show">
        {kpis.map((k) => (
          <motion.div key={k.l} className="kpi" variants={rise}>
            <div className="kpi-l">{k.l}</div>
            <div className="kpi-v num"><CountUp to={k.v} />{k.sfx && <small>{k.sfx}</small>}</div>
            <div className="kpi-n">{k.note}</div>
          </motion.div>
        ))}
      </motion.div>

      <motion.div className="row r-21" variants={stagger} initial="hidden" animate="show">
        <motion.section className="card" variants={rise}>
          <header className="card-h"><h3>Network topology</h3><span className="hint">Select a node to open its checklist</span></header>
          <Topology progress={progress} />
        </motion.section>
        <motion.section className="card" variants={rise}>
          <header className="card-h"><h3>Task status</h3></header>
          <div className="big-fig num"><CountUp to={t.pct} suffix="%" /><small>complete</small></div>
          <Stacked parts={[
            { label: 'Done', value: t.done, color: TONE.done },
            { label: 'In progress', value: t.prog, color: TONE.active },
            { label: 'Pending', value: t.pending, color: TONE.pending },
          ]} />
          <ul className="legend">
            <li><i style={{ background: TONE.done }} />Done<b className="num">{t.done}</b></li>
            <li><i style={{ background: TONE.active }} />In progress<b className="num">{t.prog}</b></li>
            <li><i style={{ background: TONE.pending }} />Pending<b className="num">{t.pending}</b></li>
          </ul>
          <BarList rows={phases} />
        </motion.section>
      </motion.div>

      <motion.div className="row r-3" variants={stagger} initial="hidden" animate="show">
        <motion.section className="card" variants={rise}>
          <header className="card-h"><h3>Network components</h3></header>
          <BarList rows={infra.map((i) => ({ label: i.name, pct: progress[i.id] }))} />
        </motion.section>
        <motion.section className="card" variants={rise}>
          <header className="card-h"><h3>Progress by pillar</h3></header>
          <BarList rows={cats.map((c) => ({ label: c.cat, pct: c.pct }))} />
        </motion.section>
        <motion.section className="card" variants={rise}>
          <header className="card-h"><h3>Recent activity</h3></header>
          <ul className="feed">
            {state.log.length === 0 && <li className="empty">Nothing recorded yet.</li>}
            {state.log.slice(0, 6).map((l) => (
              <li key={l.t + l.text}><span>{l.text}</span><small>{ago(l.t)}</small></li>
            ))}
          </ul>
        </motion.section>
      </motion.div>
    </>
  );
}

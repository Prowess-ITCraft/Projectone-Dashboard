import { motion } from 'framer-motion';
import { Link, useNavigate, useParams, Navigate } from 'react-router-dom';
import { ITEMS } from '../data.js';
import { useStore, itemStats, tasksFor, MODES } from '../store.jsx';
import { Icon, PageHead, Ring, CountUp, downloadCSV } from '../ui.jsx';

const STATUS = ['Pending', 'In progress', 'Done'];
const PHASES = ['Installation', 'Configuration'];

function Row({ t, label }) {
  const { state, setTask } = useStore();
  const v = state.tasks[t.key] || { s: 0, start: '', end: '', c: '' };
  const pct = [0, 50, 100][v.s];
  return (
    <tr className={`s${v.s}`}>
      <td className="sn num">{t.sn}</td>
      <td>
        <label className="chk" title={v.s === 2 ? 'Mark as not done' : 'Mark as completed'}>
          <input type="checkbox" checked={v.s === 2} onChange={(e) => setTask(t.key, { s: e.target.checked ? 2 : 0 }, `${label}: ${t.title}`)} aria-label={`Completed: ${t.title}`} />
          <span><svg viewBox="0 0 20 20" aria-hidden="true"><motion.path d="M4.5 10.5l3.5 3.5 7.5-8" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
            initial={false} animate={{ pathLength: v.s === 2 ? 1 : 0 }} transition={{ duration: 0.22 }} /></svg></span>
        </label>
      </td>
      <td className="ttl">{t.title}{t.demo && <em className="chip">demo</em>}</td>
      <td><input type="date" value={v.start} onChange={(e) => setTask(t.key, { start: e.target.value })} aria-label="Start date" /></td>
      <td><input type="date" value={v.end} onChange={(e) => setTask(t.key, { end: e.target.value })} aria-label="End date" /></td>
      <td className="prog">
        <button className={`pill p${v.s}`} onClick={() => setTask(t.key, { s: (v.s + 1) % 3 }, `${label}: ${t.title}`)} title="Click to change status">{STATUS[v.s]}</button>
        <div className="mbar"><motion.i initial={false} animate={{ width: `${pct}%` }} transition={{ duration: 0.3 }} /></div>
      </td>
      <td><input type="text" className="cm" placeholder="Add a comment" defaultValue={v.c} onBlur={(e) => e.target.value !== v.c && setTask(t.key, { c: e.target.value })} aria-label="Comments or suggestion" /></td>
    </tr>
  );
}

export default function Detail() {
  const { id, mode: modeParam } = useParams();
  const nav = useNavigate();
  const { state } = useStore();
  const item = ITEMS.find((i) => i.id === id);
  if (!item) return <Navigate to="/components" replace />;

  const mode = modeParam === 'existing' ? 'existing' : 'new';
  const s = itemStats(state, item, mode);
  const tasks = tasksFor(item, mode);

  const exportCsv = () => downloadCSV(`${item.name}-${mode}-checklist.csv`, [
    ['SN', 'Phase', 'Task', 'Start date', 'End date', 'Status', 'Comments'],
    ...tasks.map((t) => { const v = state.tasks[t.key] || {}; return [t.sn, t.phase, t.title, v.start || '', v.end || '', STATUS[v.s || 0], v.c || '']; }),
  ]);

  const note = {
    plan: 'Steps come from the project implementation schedule.',
    mixed: 'Steps come from the project implementation schedule; items tagged "demo" are illustrative additions.',
    demo: 'No installation file was supplied for this component. These stages are demo placeholders.',
  }[item.src];

  return (
    <>
      <Link to="/components" className="back"><Icon name="ArrowLeft" size={14} />All components</Link>
      <PageHead title={item.name} sub={item.desc}>
        <button className="btn ghost" onClick={exportCsv}><Icon name="DownloadSimple" size={16} />Export CSV</button>
      </PageHead>

      <div className="dh">
        <div className="dh-m">
          <label className="sel-l" htmlFor="worktype">Work type</label>
          <div className="sel">
            <select id="worktype" value={mode} onChange={(e) => nav(`/c/${item.id}/${e.target.value}`)}>
              {Object.entries(MODES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <Icon name="CaretDown" size={14} />
          </div>
          <p className="note">{note}</p>
        </div>
        <dl className="dh-s">
          <div><dt>Done</dt><dd className="num"><CountUp to={s.done} /></dd></div>
          <div><dt>In progress</dt><dd className="num"><CountUp to={s.prog} /></dd></div>
          <div><dt>Pending</dt><dd className="num"><CountUp to={s.pending} /></dd></div>
        </dl>
        <Ring pct={s.pct} size={92} stroke={7}><span className="ring-n num"><CountUp to={s.pct} suffix="%" /></span></Ring>
      </div>

      <motion.div key={mode} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
        {PHASES.map((ph) => {
          const rows = tasks.filter((t) => t.phase === ph);
          if (!rows.length) return null;
          const done = rows.filter((t) => state.tasks[t.key]?.s === 2).length;
          return (
            <section className="card tbl" key={ph}>
              <header className="card-h"><h3>{ph} steps</h3><span className="hint num">{done} of {rows.length} completed</span></header>
              <div className="scroll">
                <table className="check">
                  <thead><tr><th>SN</th><th>Done</th><th>Task</th><th>Start date</th><th>End date</th><th>Progress</th><th>Comments / suggestion</th></tr></thead>
                  <tbody>{rows.map((t) => <Row key={t.key} t={t} label={item.name} />)}</tbody>
                </table>
              </div>
            </section>
          );
        })}
      </motion.div>
    </>
  );
}

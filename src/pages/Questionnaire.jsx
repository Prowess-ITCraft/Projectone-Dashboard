import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QUESTIONNAIRES } from '../data.js';
import { useStore } from '../store.jsx';
import { PageHead, CountUp, Icon, downloadCSV } from '../ui.jsx';

const HML = { H: 'High', M: 'Med', L: 'Low' };
const SUMMARY = {
  firewall: [['internet', 'Internet allowed'], ['vpn', 'SSL VPN users'], ['swdl', 'Downloads allowed']],
  server: [['usb', 'USB blocked'], ['edit', 'Edit access'], ['ro', 'Read-only']],
};

function Seg({ id, value, opts, onChange }) {
  return (
    <div className="seg">
      {opts.map(([v, l]) => (
        <button type="button" key={String(v)} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>
          {value === v && <motion.i layoutId={`seg-${id}`} className="seg-bg" />}
          <span>{l}</span>
        </button>
      ))}
    </div>
  );
}

const blank = (cols) => Object.fromEntries(cols.map((c) => [c.k, c.t === 'yn' ? 0 : c.t === 'hml' ? 'M' : '']));

export default function Questionnaire({ kind, embedded }) {
  const def = QUESTIONNAIRES[kind];
  const { state, addRow, patchRow, delRow } = useStore();
  const rows = state.q[kind];
  const [f, setF] = useState(() => blank(def.cols));
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(true);

  const submit = (e) => {
    e.preventDefault();
    if (!f.user.trim()) { setErr('User name is required'); return; }
    setErr(''); addRow(kind, { ...f, user: f.user.trim() }); setF(blank(def.cols));
  };

  const exportCsv = () => downloadCSV(`${kind}-lookup-table.csv`, [
    def.cols.map((c) => c.l),
    ...rows.map((r) => def.cols.map((c) => (c.t === 'yn' ? (r[c.k] ? 'Yes' : 'No') : c.t === 'hml' ? HML[r[c.k]] : r[c.k]))),
  ]);

  const body = (
    <>
      <div className="sum">
        <div className="sum-i"><b className="num"><CountUp to={rows.length} /></b><small>Users captured</small></div>
        {SUMMARY[kind].map(([k, l]) => (
          <div className="sum-i" key={k}><b className="num"><CountUp to={rows.filter((r) => r[k]).length} /></b><small>{l}</small></div>
        ))}
      </div>

      <section className="card qf">
        <div className="card-h">
          <h3>{def.title}</h3>
          <button className="btn ghost sm" onClick={() => setOpen(!open)}>{open ? 'Collapse' : 'New response'}</button>
        </div>
        <p className="qsub">{def.sub}</p>
        <AnimatePresence initial={false}>
          {open && (
            <motion.form onSubmit={submit} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
              <div className="qgrid">
                {def.cols.map((c, i) => (
                  <div className={`q ${c.t === 'text' ? 'wide' : ''}`} key={c.k}>
                    <label><span className="qn">{i + 1}</span>{c.q}</label>
                    {c.t === 'text' && <input value={f[c.k]} placeholder={c.ph || ''} onChange={(e) => setF({ ...f, [c.k]: e.target.value })} />}
                    {c.t === 'yn' && <Seg id={`${kind}-${c.k}`} value={f[c.k]} opts={[[1, 'Yes'], [0, 'No']]} onChange={(v) => setF({ ...f, [c.k]: v })} />}
                    {c.t === 'hml' && <Seg id={`${kind}-${c.k}`} value={f[c.k]} opts={[['H', 'High'], ['M', 'Med'], ['L', 'Low']]} onChange={(v) => setF({ ...f, [c.k]: v })} />}
                  </div>
                ))}
              </div>
              <div className="qf-foot">
                {err && <span className="err">{err}</span>}
                <button className="btn" type="submit"><Icon name="Plus" size={16} />Add to look-up table</button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </section>

      <section className="card tbl">
        <div className="card-h"><h3>Look-up table</h3><span className="hint">click a Yes/No chip to change it</span>
          <button className="btn ghost sm" onClick={exportCsv} disabled={!rows.length}><Icon name="DownloadSimple" size={15} />Export CSV</button></div>
        <div className="scroll">
          <table className="lookup">
            <thead><tr>{def.cols.map((c) => <th key={c.k}>{c.l}</th>)}<th /></tr></thead>
            <tbody>
              <AnimatePresence initial={false}>
                {rows.map((r) => (
                  <motion.tr key={r.id} layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }}>
                    {def.cols.map((c) => (
                      <td key={c.k}>
                        {c.t === 'yn' ? <button className={`yn ${r[c.k] ? 'y' : 'n'}`} onClick={() => patchRow(kind, r.id, { [c.k]: r[c.k] ? 0 : 1 })}>{r[c.k] ? 'Yes' : 'No'}</button>
                          : c.t === 'hml' ? <button className={`bw b${r[c.k]}`} onClick={() => patchRow(kind, r.id, { [c.k]: { H: 'M', M: 'L', L: 'H' }[r[c.k]] })}>{HML[r[c.k]]}</button>
                          : <span className={c.k === 'user' ? 'strong' : ''}>{r[c.k] || '–'}</span>}
                      </td>
                    ))}
                    <td><button className="x" onClick={() => delRow(kind, r.id)} aria-label="Delete row"><Icon name="Trash" size={16} /></button></td>
                  </motion.tr>
                ))}
              </AnimatePresence>
              {!rows.length && <tr><td colSpan={def.cols.length + 1} className="empty">No responses yet. Fill in the questionnaire above.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );

  return embedded ? body : (<><PageHead title={def.title} sub={def.sub} />{body}</>);
}

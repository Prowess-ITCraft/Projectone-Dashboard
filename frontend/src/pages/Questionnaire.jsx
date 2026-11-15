import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QUESTIONNAIRES } from '../data.js';
import { useStore } from '../store.jsx';
import { Card, CountUp, DataTable, FormField, Icon, PageHead, SegmentedControl, StatusBadge } from '@/components';
import { downloadCSV } from '@/lib/csv';

const HML = { H: 'High', M: 'Med', L: 'Low' };
const HML_TONE = { H: 'accent', M: 'warning', L: 'muted' };
const YES_NO = [
  [1, 'Yes'],
  [0, 'No'],
];
const HIGH_MED_LOW = [
  ['H', 'High'],
  ['M', 'Med'],
  ['L', 'Low'],
];
const SUMMARY = {
  firewall: [
    ['internet', 'Internet allowed'],
    ['vpn', 'SSL VPN users'],
    ['swdl', 'Downloads allowed'],
  ],
  server: [
    ['usb', 'USB blocked'],
    ['edit', 'Edit access'],
    ['ro', 'Read-only'],
  ],
};

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
    if (!f.user.trim()) {
      setErr('User name is required');
      return;
    }
    setErr('');
    addRow(kind, { ...f, user: f.user.trim() });
    setF(blank(def.cols));
  };

  const exportCsv = () =>
    downloadCSV(`${kind}-lookup-table.csv`, [
      def.cols.map((c) => c.l),
      ...rows.map((r) => def.cols.map((c) => (c.t === 'yn' ? (r[c.k] ? 'Yes' : 'No') : c.t === 'hml' ? HML[r[c.k]] : r[c.k]))),
    ]);

  const body = (
    <>
      <div className="sum">
        <div className="sum-i">
          <b className="num">
            <CountUp to={rows.length} />
          </b>
          <small>Users captured</small>
        </div>
        {SUMMARY[kind].map(([k, l]) => (
          <div className="sum-i" key={k}>
            <b className="num">
              <CountUp to={rows.filter((r) => r[k]).length} />
            </b>
            <small>{l}</small>
          </div>
        ))}
      </div>

      <Card
        className="qf"
        title={def.title}
        actions={
          <button className="btn ghost sm" onClick={() => setOpen(!open)}>
            {open ? 'Collapse' : 'New response'}
          </button>
        }
      >
        <p className="qsub">{def.sub}</p>
        <AnimatePresence initial={false}>
          {open && (
            <motion.form
              onSubmit={submit}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              style={{ overflow: 'hidden' }}
            >
              <div className="qgrid">
                {def.cols.map((c, i) => (
                  <FormField key={c.k} label={c.q} number={i + 1} group={c.t !== 'text'}>
                    {(field) =>
                      c.t === 'text' ? (
                        <input
                          {...field.control}
                          className="input"
                          value={f[c.k]}
                          placeholder={c.ph || ''}
                          onChange={(e) => setF({ ...f, [c.k]: e.target.value })}
                        />
                      ) : (
                        <SegmentedControl
                          {...field.control}
                          id={`${kind}-${c.k}`}
                          value={f[c.k]}
                          options={c.t === 'yn' ? YES_NO : HIGH_MED_LOW}
                          onChange={(v) => setF({ ...f, [c.k]: v })}
                        />
                      )
                    }
                  </FormField>
                ))}
              </div>
              <div className="qf-foot">
                {err && <span className="err">{err}</span>}
                <button className="btn" type="submit">
                  <Icon name="Plus" size={16} />
                  Add to look-up table
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </Card>

      <Card
        flush
        title="Look-up table"
        hint="click a Yes/No chip to change it"
        actions={
          <button className="btn ghost sm" onClick={exportCsv} disabled={!rows.length}>
            <Icon name="DownloadSimple" size={15} />
            Export CSV
          </button>
        }
      >
        <DataTable
          className="lookup"
          columns={[
            ...def.cols.map((c) => c.l),
            <span key="actions" className="sr-only">
              Actions
            </span>,
          ]}
          isEmpty={!rows.length}
          empty="No responses yet. Fill in the questionnaire above."
        >
          <AnimatePresence initial={false}>
            {rows.map((r) => (
              <motion.tr key={r.id} layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }}>
                {def.cols.map((c) => (
                  <td key={c.k}>
                    {c.t === 'yn' ? (
                      <StatusBadge
                        as="button"
                        shape="toggle"
                        tone={r[c.k] ? 'positive' : 'muted'}
                        onClick={() => patchRow(kind, r.id, { [c.k]: r[c.k] ? 0 : 1 })}
                      >
                        {r[c.k] ? 'Yes' : 'No'}
                      </StatusBadge>
                    ) : c.t === 'hml' ? (
                      <StatusBadge
                        as="button"
                        shape="toggle"
                        tone={HML_TONE[r[c.k]]}
                        onClick={() => patchRow(kind, r.id, { [c.k]: { H: 'M', M: 'L', L: 'H' }[r[c.k]] })}
                      >
                        {HML[r[c.k]]}
                      </StatusBadge>
                    ) : (
                      <span className={c.k === 'user' ? 'strong' : ''}>{r[c.k] || '–'}</span>
                    )}
                  </td>
                ))}
                <td>
                  <button className="x" onClick={() => delRow(kind, r.id)} aria-label="Delete row">
                    <Icon name="Trash" size={16} />
                  </button>
                </td>
              </motion.tr>
            ))}
          </AnimatePresence>
        </DataTable>
      </Card>
    </>
  );

  return embedded ? (
    body
  ) : (
    <>
      <PageHead title={def.title} sub={def.sub} />
      {body}
    </>
  );
}

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ITEMS, PRODUCT_LIST } from '../data.js';
import { useStore, itemStats, MODES } from '../store.jsx';
import { Icon, PageHead } from '../ui.jsx';

const SRC = { plan: ['Project plan', 'ok'], mixed: ['Plan + demo', 'mix'], demo: ['Demo steps', 'demo'] };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.025 } } };
const rise = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } } };

function Tile({ item, name, mode, desc }) {
  const { state } = useStore();
  const s = itemStats(state, item);
  const [txt, cls] = SRC[item.src];
  return (
    <motion.div variants={rise}>
      <Link to={`/c/${item.id}${mode ? '/' + mode : ''}`} className="tile">
        <div className="tile-top">
          <Icon name={item.icon} size={22} className="tile-i" />
          <span className="tile-pct num">{s.pct}%</span>
        </div>
        <h4>{name}</h4>
        <p>{desc || item.desc}</p>
        <div className="tile-bar"><i style={{ width: `${s.pct}%` }} /></div>
        <div className="tile-f">
          <span className={`badge ${cls}`}>{txt}</span>
          {mode && <span className="badge mode">{MODES[mode]}</span>}
          <span className="tile-c">{s.done}/{s.total} tasks</span>
        </div>
      </Link>
    </motion.div>
  );
}

export default function Components() {
  const [q, setQ] = useState('');
  const match = (s) => s.toLowerCase().includes(q.toLowerCase());
  const infra = ITEMS.filter((i) => i.grp === 'infra' && (match(i.name) || match(i.desc)));
  const prods = PRODUCT_LIST.filter((p) => match(p.name));
  const byId = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

  return (
    <>
      <PageHead title="Components" sub="Open a component for its installation and configuration checklist.">
        <label className="search"><Icon name="MagnifyingGlass" size={16} /><input placeholder="Search components" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search components" /></label>
      </PageHead>

      <h2 className="sec">Network components <span className="num">{infra.length}</span></h2>
      <motion.div className="tiles" variants={stagger} initial="hidden" animate="show" key={'i' + q}>
        {infra.map((i) => <Tile key={i.id} item={i} name={i.name} />)}
      </motion.div>

      <h2 className="sec">Security and management products <span className="num">{prods.length}</span></h2>
      <motion.div className="tiles" variants={stagger} initial="hidden" animate="show" key={'p' + q}>
        {prods.map((p) => <Tile key={p.name} item={byId[p.id]} name={p.name} mode={p.mode} desc={byId[p.id].desc} />)}
      </motion.div>
      {!infra.length && !prods.length && <p className="empty">No components match "{q}".</p>}
    </>
  );
}

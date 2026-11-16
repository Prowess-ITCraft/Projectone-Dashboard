import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useChecklist } from '@/data/checklist';
import { itemStats, MODES } from '@/domain/checklist';
import { EmptyState, ErrorState, Icon, LoadingState, PageHead, StatusBadge } from '@/components';

// where a component's steps come from, and how that source is labelled
const SRC = { plan: ['Project plan', 'positive'], mixed: ['Plan + demo', 'accent'], demo: ['Demo steps', 'warning'] };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.025 } } };
const rise = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } } };

function Tile({ item, state, name, mode, desc }) {
  const s = itemStats(state, item);
  const [txt, tone] = SRC[item.src];
  return (
    <motion.div variants={rise}>
      <Link to={`/c/${item.id}${mode ? '/' + mode : ''}`} className="tile">
        <div className="tile-top">
          <Icon name={item.icon} size={22} className="tile-i" />
          <span className="tile-pct num">{s.pct}%</span>
        </div>
        <h4>{name}</h4>
        <p>{desc || item.desc}</p>
        <div className="tile-bar">
          <i style={{ width: `${s.pct}%` }} />
        </div>
        <div className="tile-f">
          <StatusBadge tone={tone}>{txt}</StatusBadge>
          {mode && <StatusBadge tone="neutral">{MODES[mode]}</StatusBadge>}
          <span className="tile-c">
            {s.done}/{s.total} tasks
          </span>
        </div>
      </Link>
    </motion.div>
  );
}

export default function Components() {
  const data = useChecklist();
  if (!data.ready) return data.error ? <ErrorState message={data.error} /> : <LoadingState label="Loading the components" />;
  return <ComponentList data={data} />;
}

function ComponentList({ data }) {
  const { state, items: ITEMS, productList: PRODUCT_LIST } = data;
  const [q, setQ] = useState('');
  const match = (s) => s.toLowerCase().includes(q.toLowerCase());
  const infra = ITEMS.filter((i) => i.grp === 'infra' && (match(i.name) || match(i.desc)));
  const prods = PRODUCT_LIST.filter((p) => match(p.name));
  const byId = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

  return (
    <>
      <PageHead title="Components" sub="Open a component for its installation and configuration checklist.">
        <label className="search">
          <Icon name="MagnifyingGlass" size={16} />
          <input placeholder="Search components" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search components" />
        </label>
      </PageHead>

      <h2 className="sec">
        Network components <span className="num">{infra.length}</span>
      </h2>
      <motion.div className="tiles" variants={stagger} initial="hidden" animate="show" key={'i' + q}>
        {infra.map((i) => (
          <Tile key={i.id} item={i} state={state} name={i.name} />
        ))}
      </motion.div>

      <h2 className="sec">
        Security and management products <span className="num">{prods.length}</span>
      </h2>
      <motion.div className="tiles" variants={stagger} initial="hidden" animate="show" key={'p' + q}>
        {prods.map((p) => (
          <Tile key={p.name} item={byId[p.id]} state={state} name={p.name} mode={p.mode} desc={byId[p.id].desc} />
        ))}
      </motion.div>
      {!infra.length && !prods.length && <EmptyState>No components match &quot;{q}&quot;.</EmptyState>}
    </>
  );
}

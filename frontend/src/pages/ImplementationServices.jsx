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
      <Link to={`/services/${item.id}${mode ? '/' + mode : ''}`} className="tile">
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

export default function ImplementationServices() {
  const data = useChecklist();
  if (!data.ready) return data.error ? <ErrorState message={data.error} /> : <LoadingState label="Loading the implementation services" />;
  return <ServiceList data={data} />;
}

function ServiceList({ data }) {
  const { state, items } = data;
  const [q, setQ] = useState('');
  const match = (s) => s.toLowerCase().includes(q.toLowerCase());
  const services = items.filter((i) => match(i.name) || match(i.desc));

  return (
    <>
      <PageHead
        title="Implementation services"
        sub="The services listed from a purchase order or proforma invoice. Open one for its installation and configuration checklist."
      >
        <label className="search">
          <Icon name="MagnifyingGlass" size={16} />
          <input
            placeholder="Search services"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search implementation services"
          />
        </label>
      </PageHead>

      <h2 className="sec">
        Services <span className="num">{services.length}</span>
      </h2>
      <motion.div className="tiles" variants={stagger} initial="hidden" animate="show" key={q}>
        {services.map((i) => (
          <Tile key={i.id} item={i} state={state} name={i.name} />
        ))}
      </motion.div>
      {!services.length && <EmptyState>{q ? `No services match "${q}".` : 'No implementation services yet.'}</EmptyState>}
    </>
  );
}

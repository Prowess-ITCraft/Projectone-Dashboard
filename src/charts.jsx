import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Icon } from './ui.jsx';

/* One hue for data (teal), at three intensities for a state machine; grey for nothing yet. */
export const TONE = { done: 'var(--data)', active: 'var(--data-mid)', pending: 'var(--track)' };

/* 100% stacked bar with 2px seams */
export function Stacked({ parts }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  return (
    <div className="stacked" role="img" aria-label={parts.map((p) => `${p.label} ${p.value}`).join(', ')}>
      {total === 0 ? <i className="seg-empty" /> : parts.filter((p) => p.value > 0).map((p, i) => (
        <motion.i key={p.label} style={{ background: p.color }} initial={{ flexGrow: 0 }} animate={{ flexGrow: p.value }}
          transition={{ duration: 0.8, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }} />
      ))}
    </div>
  );
}

/* Ranked list of progress – the fill is the true ratio */
export function BarList({ rows }) {
  return (
    <ul className="barlist">
      {rows.map((r, i) => (
        <li key={r.label}>
          <span className="bl-l">{r.label}{r.sub && <small>{r.sub}</small>}</span>
          <span className="bl-t"><motion.i initial={{ width: 0 }} animate={{ width: `${r.pct}%` }} transition={{ duration: 0.8, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }} /></span>
          <b className="num">{r.pct}%</b>
        </li>
      ))}
    </ul>
  );
}

/* Network topology – flat; every node opens its component */
export function Topology({ progress }) {
  const nav = useNavigate();
  const nodes = [
    { id: 'net', label: 'Internet', x: 50, y: 150, icon: 'Globe' },
    { id: 'firewall', label: 'Firewall', x: 190, y: 150, icon: 'Wall' },
    { id: 'router', label: 'Router', x: 330, y: 150, icon: 'Network' },
    { id: 'switch', label: 'Switch', x: 480, y: 150, icon: 'TreeStructure', above: true },
    { id: 'server', label: 'Server', x: 650, y: 52, icon: 'HardDrives' },
    { id: 'nas', label: 'NAS', x: 650, y: 150, icon: 'Database' },
    { id: 'san', label: 'SAN', x: 650, y: 248, icon: 'Stack' },
    { id: 'ap', label: 'Access Point', x: 480, y: 262, icon: 'WifiHigh' },
  ];
  const links = [['net', 'firewall'], ['firewall', 'router'], ['router', 'switch'], ['switch', 'server'], ['switch', 'nas'], ['switch', 'san'], ['switch', 'ap']];
  const by = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const path = ([a, b]) => { const A = by[a], B = by[b]; const mx = (A.x + B.x) / 2; return `M${A.x},${A.y} C${mx},${A.y} ${mx},${B.y} ${B.x},${B.y}`; };
  return (
    <svg viewBox="0 0 720 310" className="topo" role="group" aria-label="Network topology">
      {links.map((l, i) => (<g key={i}><path d={path(l)} className="link" /><path d={path(l)} className="link-flow" /></g>))}
      {nodes.map((n, i) => {
        const p = progress?.[n.id];
        return (
          <motion.g key={n.id} className={n.id === 'net' ? 'node static' : 'node'} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i, duration: 0.35 }} onClick={() => n.id !== 'net' && nav(`/c/${n.id}`)}
            role={n.id === 'net' ? undefined : 'link'} tabIndex={n.id === 'net' ? undefined : 0} aria-label={`${n.label} checklist`}
            onKeyDown={(e) => e.key === 'Enter' && n.id !== 'net' && nav(`/c/${n.id}`)}>
            <circle cx={n.x} cy={n.y} r="26" className="node-c" />
            <Icon name={n.icon} size={22} x={n.x - 11} y={n.y - 11} className="node-i" />
            <text x={n.x} y={n.above ? n.y - 46 : n.y + 46} textAnchor="middle" className="node-t">{n.label}</text>
            {p !== undefined && <text x={n.x} y={n.above ? n.y - 32 : n.y + 61} textAnchor="middle" className="node-p">{p}%</text>}
          </motion.g>
        );
      })}
    </svg>
  );
}

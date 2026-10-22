import { useEffect, useRef, useState } from 'react';
import { animate, motion } from 'framer-motion';
import {
  Wall, HardDrives, TreeStructure, Network, Database, Stack, WifiHigh, ShieldCheck, FileMagnifyingGlass, Broadcast,
  ChartLineUp, Eye, CloudArrowUp, Globe, Key, DeviceMobile, Lock, Package, Power, SquaresFour, ListChecks,
  Users, MagnifyingGlass, CaretDown, GridFour, ArrowLeft, DownloadSimple, Trash, Plus, Sun, Moon,
} from '@phosphor-icons/react';

const MAP = {
  Wall, HardDrives, TreeStructure, Network, Database, Stack, WifiHigh, ShieldCheck, FileMagnifyingGlass, Broadcast,
  ChartLineUp, Eye, CloudArrowUp, Globe, Key, DeviceMobile, Lock, Package, Power, SquaresFour, ListChecks,
  Users, MagnifyingGlass, CaretDown, GridFour, ArrowLeft, DownloadSimple, Trash, Plus, Sun, Moon,
};

export function Icon({ name, size = 18, weight = 'regular', className = '', ...rest }) {
  const P = MAP[name] || Package;
  return <P size={size} weight={weight} className={`ico ${className}`} aria-hidden="true" {...rest} />;
}

export function CountUp({ to, dec = 0, suffix = '', prefix = '' }) {
  const [v, setV] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const c = animate(prev.current, to, { duration: 0.9, ease: [0.16, 1, 0.3, 1], onUpdate: (x) => { prev.current = x; setV(x); } });
    return () => c.stop();
  }, [to]);
  return <>{prefix}{v.toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec })}{suffix}</>;
}

export function PageHead({ title, sub, children }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </div>
  );
}

/* Thin progress ring – the only chart colour is the single data hue */
export function Ring({ pct, size = 96, stroke = 6, children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="pring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} className="pring-bg" strokeWidth={stroke} fill="none" />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" className="pring-fg" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - pct / 100) }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <div className="pring-in">{children}</div>
    </div>
  );
}

export function downloadCSV(name, rows) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const blob = new Blob([rows.map((r) => r.map(esc).join(',')).join('\r\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export const ago = (t) => {
  const m = Math.max(1, Math.round((Date.now() - t) / 6e4));
  return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};

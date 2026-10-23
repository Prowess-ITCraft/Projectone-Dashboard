import { useEffect, useMemo, useState } from 'react';
import { Route, Routes, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  MagnifyingGlass, SquaresFour, ListChecks, GridFour, HardDrives, Wall, TreeStructure, Network, Database, Stack,
  WifiHigh, Moon, Sun, ArrowCounterClockwise, SidebarSimple, Package,
} from '@phosphor-icons/react';
import { SidebarNav, CommandSearch } from '@/components/ui/dashboard-sidebar';
import { useStore } from './store.jsx';
import { ITEMS, QUESTIONNAIRES } from './data.js';
import logo from './assets/projectone-logo.jpeg';
import Dashboard from './pages/Dashboard.jsx';
import Components from './pages/Components.jsx';
import Detail from './pages/Detail.jsx';
import Questionnaire from './pages/Questionnaire.jsx';

const INFRA_ICONS = { firewall: Wall, server: HardDrives, switch: TreeStructure, router: Network, nas: Database, san: Stack, ap: WifiHigh };

function QRoute() {
  const { kind } = useParams();
  return QUESTIONNAIRES[kind] ? <Questionnaire kind={kind} /> : <Navigate to="/dashboard" replace />;
}

// nav ids are the routes themselves, so selecting an item is just navigating to it
function activeFor(path) {
  if (path.startsWith('/c/')) return '/components';
  return path;
}

function titleFor(path) {
  if (path === '/dashboard') return 'Overview';
  if (path === '/components') return 'Components';
  if (path.startsWith('/q/')) return QUESTIONNAIRES[path.split('/')[2]]?.title ?? 'Questionnaire';
  if (path.startsWith('/c/')) return ITEMS.find((i) => i.id === path.split('/')[2])?.name ?? 'Component';
  return '';
}

export default function App() {
  const loc = useLocation();
  const nav = useNavigate();
  const { reset } = useStore();
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'dark');
  const [sideOpen, setSideOpen] = useState(() => window.innerWidth > 860);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('projectone.theme', theme); } catch {}
  }, [theme]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen((o) => !o); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const dark = theme === 'dark';
  const groups = [
    {
      items: [
        { id: '/dashboard', title: 'Dashboard', icon: SquaresFour },
      ],
    },
    {
      items: [
        { id: 'questionnaire', title: 'Questionnaire', icon: ListChecks, children: [
          { id: '/q/server', title: 'Server', icon: HardDrives },
          { id: '/q/firewall', title: 'Firewall', icon: Wall },
        ] },
        { id: '/components', title: 'Components', icon: GridFour },
      ],
    },
  ];
  const bottomItems = [
    {
      id: 'theme', title: dark ? 'Dark theme' : 'Light theme', icon: dark ? Moon : Sun,
      trailing: <span className={`theme-switch ${dark ? 'on' : ''}`} aria-hidden="true"><i /></span>,
    },
    { id: 'reset', title: 'Reset all data', icon: ArrowCounterClockwise },
  ];

  const entries = useMemo(() => [
    { id: '/dashboard', title: 'Dashboard', hint: 'Overview', icon: SquaresFour },
    { id: '/components', title: 'All components', hint: 'List', icon: GridFour },
    { id: '/q/server', title: 'Server questionnaire', hint: 'Questionnaire', icon: HardDrives },
    { id: '/q/firewall', title: 'Firewall questionnaire', hint: 'Questionnaire', icon: Wall },
    ...ITEMS.map((i) => ({ id: `/c/${i.id}`, title: i.name, hint: i.grp === 'infra' ? 'Network component' : 'Product', icon: INFRA_ICONS[i.id] || Package })),
  ], []);

  const onSelect = (id) => {
    if (id === 'theme') return setTheme(dark ? 'light' : 'dark');
    if (id === 'reset') return window.confirm('Clear all checklist progress and questionnaire responses?') && reset();
    nav(id);
    if (window.innerWidth <= 860) setSideOpen(false);
  };

  return (
    <div className={`shell ${sideOpen ? '' : 'collapsed'}`}>
      <aside className="side" aria-hidden={!sideOpen}>
        <SidebarNav
          className="side-panel w-full"
          groups={groups}
          bottomItems={bottomItems}
          activeId={activeFor(loc.pathname)}
          onSelect={onSelect}
          logo={logo}
          product="ProjectOne"
          onHome={() => onSelect('/dashboard')}
        />
      </aside>

      <main className="sheet">
        <header className="topbar">
          <button className="icon-btn" onClick={() => setSideOpen(!sideOpen)} aria-label={sideOpen ? 'Collapse sidebar' : 'Expand sidebar'}>
            <SidebarSimple size={18} />
          </button>
          <div className="crumbs"><span>ProjectOne</span><span aria-hidden="true">/</span><b>{titleFor(loc.pathname)}</b></div>
          <button className="search-trigger" onClick={() => setSearchOpen(true)}>
            <MagnifyingGlass size={15} /><span>Search</span><kbd>Ctrl K</kbd>
          </button>
        </header>

        <div className="canvas">
          <AnimatePresence mode="wait">
            <motion.div key={loc.pathname} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
              <Routes location={loc}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/components" element={<Components />} />
                <Route path="/c/:id/:mode?" element={<Detail />} />
                <Route path="/q/:kind" element={<QRoute />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <CommandSearch open={searchOpen} onClose={() => setSearchOpen(false)} entries={entries} onPick={(id) => nav(id)} />
    </div>
  );
}

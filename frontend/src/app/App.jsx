import { useEffect, useMemo, useState } from 'react';
import { Route, Routes, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowCounterClockwiseIcon,
  DatabaseIcon,
  FolderSimpleIcon,
  GridFourIcon,
  HardDrivesIcon,
  MagnifyingGlassIcon,
  MoonIcon,
  NetworkIcon,
  PackageIcon,
  SidebarSimpleIcon,
  SquaresFourIcon,
  StackIcon,
  SunIcon,
  TreeStructureIcon,
  WallIcon,
  WifiHighIcon,
} from '@phosphor-icons/react';
import { useStore } from '@/store.jsx';
import { ITEMS, QUESTIONNAIRES } from '@/data.js';
import { useMediaQuery } from '@/lib/useMediaQuery';
import logo from '@/assets/projectone-logo.png';
import Dashboard from '@/pages/Dashboard.jsx';
import Components from '@/pages/Components.jsx';
import Detail from '@/pages/Detail.jsx';
import Questionnaire from '@/pages/Questionnaire.jsx';
import ProjectsPage from '@/features/projects/ProjectsPage.jsx';
import NewProjectPage from '@/features/projects/NewProjectPage.jsx';
import ProjectPage from '@/features/projects/ProjectPage.jsx';
import { ActorPicker } from './actor';
import { SidebarNav } from './Sidebar';
import { CommandSearch } from './CommandSearch';
import { BottomBar } from './BottomBar';
import { NARROW_QUERY, activeFor, bottomBarItems, navGroups } from './navigation';

const INFRA_ICONS = {
  firewall: WallIcon,
  server: HardDrivesIcon,
  switch: TreeStructureIcon,
  router: NetworkIcon,
  nas: DatabaseIcon,
  san: StackIcon,
  ap: WifiHighIcon,
};

function QRoute() {
  const { kind } = useParams();
  return QUESTIONNAIRES[kind] ? <Questionnaire kind={kind} /> : <Navigate to="/dashboard" replace />;
}

/* Tabs inside a project share one page, so only moving between pages (not between tabs) plays the page transition */
const pageKey = (path) => path.replace(/^(\/projects\/[^/]+)\/.*$/, '$1');

function titleFor(path) {
  if (path === '/dashboard') return 'Overview';
  if (path === '/components') return 'Components';
  if (path === '/projects') return 'Projects';
  if (path === '/projects/new') return 'New project';
  if (path.startsWith('/projects/')) return 'Project';
  if (path.startsWith('/q/')) return QUESTIONNAIRES[path.split('/')[2]]?.title ?? 'Questionnaire';
  if (path.startsWith('/c/')) return ITEMS.find((i) => i.id === path.split('/')[2])?.name ?? 'Component';
  return '';
}

const groups = navGroups();
const barItems = bottomBarItems();

export default function App() {
  const loc = useLocation();
  const nav = useNavigate();
  const { reset } = useStore();
  const narrow = useMediaQuery(NARROW_QUERY);
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'dark');
  const [sideOpen, setSideOpen] = useState(() => !window.matchMedia(NARROW_QUERY).matches);
  const [searchOpen, setSearchOpen] = useState(false);
  const drawerOpen = narrow && sideOpen;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('projectone.theme', theme);
    } catch {
      // storage can be blocked (private mode); the theme still applies for this visit
    }
  }, [theme]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // the phone drawer closes on Escape, like the backdrop behind it
  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && setSideOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  const dark = theme === 'dark';
  const bottomItems = [
    {
      id: 'theme',
      title: dark ? 'Dark theme' : 'Light theme',
      icon: dark ? MoonIcon : SunIcon,
      trailing: (
        <span className={`theme-switch ${dark ? 'on' : ''}`} aria-hidden="true">
          <i />
        </span>
      ),
    },
    { id: 'reset', title: 'Reset all data', icon: ArrowCounterClockwiseIcon },
  ];

  const entries = useMemo(
    () => [
      { id: '/dashboard', title: 'Dashboard', hint: 'Overview', icon: SquaresFourIcon },
      { id: '/projects', title: 'Projects', hint: 'List', icon: FolderSimpleIcon },
      { id: '/components', title: 'All components', hint: 'List', icon: GridFourIcon },
      { id: '/q/server', title: 'Server questionnaire', hint: 'Questionnaire', icon: HardDrivesIcon },
      { id: '/q/firewall', title: 'Firewall questionnaire', hint: 'Questionnaire', icon: WallIcon },
      ...ITEMS.map((i) => ({
        id: `/c/${i.id}`,
        title: i.name,
        hint: i.grp === 'infra' ? 'Network component' : 'Product',
        icon: INFRA_ICONS[i.id] || PackageIcon,
      })),
    ],
    [],
  );

  const onSelect = (id) => {
    if (id === 'theme') return setTheme(dark ? 'light' : 'dark');
    if (id === 'reset') return window.confirm('Clear all checklist progress and questionnaire responses?') && reset();
    nav(id);
    if (narrow) setSideOpen(false);
  };

  return (
    <div className={`shell ${sideOpen ? '' : 'collapsed'}`}>
      <aside className="side" id="app-sidebar" inert={sideOpen ? undefined : ''}>
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
      {drawerOpen && <button type="button" className="scrim" aria-label="Close navigation" onClick={() => setSideOpen(false)} />}

      <main className="sheet">
        <header className="topbar">
          <button className="icon-btn" onClick={() => setSideOpen(!sideOpen)} aria-label={sideOpen ? 'Collapse sidebar' : 'Expand sidebar'}>
            <SidebarSimpleIcon size={18} />
          </button>
          <div className="crumbs">
            <span>ProjectOne</span>
            <span aria-hidden="true">/</span>
            <b>{titleFor(loc.pathname)}</b>
          </div>
          <button className="search-trigger" onClick={() => setSearchOpen(true)}>
            <MagnifyingGlassIcon size={15} />
            <span>Search</span>
            <kbd>Ctrl K</kbd>
          </button>
          <ActorPicker />
        </header>

        <div className="canvas">
          {/* A page fades in; it never waits for the old one to fade out, because a page holding a shared-layout control can stall that exit forever */}
          <motion.div
            key={pageKey(loc.pathname)}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
          >
            <Routes location={loc}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/projects/new" element={<NewProjectPage />} />
              <Route path="/projects/:id/*" element={<ProjectPage />} />
              <Route path="/components" element={<Components />} />
              <Route path="/c/:id/:mode?" element={<Detail />} />
              <Route path="/q/:kind" element={<QRoute />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </motion.div>
        </div>
      </main>

      <BottomBar
        items={barItems}
        activeId={activeFor(loc.pathname)}
        onSelect={onSelect}
        moreOpen={drawerOpen}
        onMore={() => setSideOpen(!sideOpen)}
      />
      <CommandSearch open={searchOpen} onClose={() => setSearchOpen(false)} entries={entries} onPick={(id) => nav(id)} />
    </div>
  );
}

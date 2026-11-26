import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Route, Routes, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AddressBookIcon,
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
import { useApi } from '@/data/api.jsx';
import { useCatalog } from '@/data/checklist.jsx';
import { can } from '@/domain/permissions';
import { LoadingState } from '@/components';
import { useMediaQuery } from '@/lib/useMediaQuery';
import logo from '@/assets/projectone-logo.png';

// Each page is its own file in the build, so the sign-in page and every screen load only what they need
const Dashboard = lazy(() => import('@/pages/Dashboard.jsx'));
const ImplementationServices = lazy(() => import('@/pages/ImplementationServices.jsx'));
const Detail = lazy(() => import('@/pages/Detail.jsx'));
const Questionnaire = lazy(() => import('@/pages/Questionnaire.jsx'));
const ProjectsPage = lazy(() => import('@/features/projects/ProjectsPage.jsx'));
const NewProjectPage = lazy(() => import('@/features/projects/NewProjectPage.jsx'));
const ProjectPage = lazy(() => import('@/features/projects/ProjectPage.jsx'));
const LoginPage = lazy(() => import('@/features/auth/LoginPage.jsx'));
const CustomersPage = lazy(() => import('@/features/customers/CustomersPage.jsx'));
const CustomerPage = lazy(() => import('@/features/customers/CustomerPage.jsx'));
const ChangePasswordPage = lazy(() => import('@/features/auth/ChangePasswordPage.jsx'));
const MyWorkPage = lazy(() => import('@/features/work/MyWorkPage.jsx'));
const UsersPage = lazy(() => import('@/features/users/UsersPage.jsx'));
import { useActor } from './actor';
import { NotificationBell } from './NotificationBell';
import { ProfileMenu } from './ProfileMenu';
import { useSession } from './session';
import { SidebarNav } from './Sidebar';
import { CommandSearch } from './CommandSearch';
import { BottomBar } from './BottomBar';
import { NARROW_QUERY, AREAS, activeFor, bottomBarItems, homeFor, landingFor, navGroups } from './navigation';

const INFRA_ICONS = {
  firewall: WallIcon,
  server: HardDrivesIcon,
  switch: TreeStructureIcon,
  router: NetworkIcon,
  nas: DatabaseIcon,
  san: StackIcon,
  ap: WifiHighIcon,
};

function QRoute({ catalog }) {
  const { kind } = useParams();
  if (!catalog) return <LoadingState label="Loading the questionnaire" />;
  return catalog.questionnaires[kind] ? <Questionnaire kind={kind} /> : <Navigate to="/dashboard" replace />;
}

/* Tabs inside a project share one page, so only moving between pages (not between tabs) plays the page transition */
const pageKey = (path) => path.replace(/^(\/projects\/[^/]+)\/.*$/, '$1');

function titleFor(path, catalog) {
  if (path === '/dashboard') return 'Overview';
  if (path === '/my-work') return 'My work';
  if (path === '/users') return 'Users';
  if (path === '/services') return 'Implementation services';
  if (path === '/projects') return 'Projects';
  if (path === '/projects/new') return 'New project';
  if (path.startsWith('/projects/')) return 'Project';
  if (path === '/customers') return 'Customers';
  if (path.startsWith('/customers/')) return 'Customer';
  if (path.startsWith('/q/')) return catalog?.questionnaires[path.split('/')[2]]?.title ?? 'Questionnaire';
  if (path.startsWith('/services/')) return catalog?.items.find((i) => i.id === path.split('/')[2])?.name ?? 'Implementation service';
  return '';
}

/* A page only some roles may open; anyone else is sent to their own start page */
function Allowed({ need, children }) {
  const { actor } = useActor();
  return can(actor, need) ? children : <Navigate to={homeFor(actor)} replace />;
}

/*
  Everything except the sign-in page needs a signed-in account; a signed-out visit returns to where it was headed
  after signing in. An account with a temporary password chooses its own before anything else opens.
*/
export default function App() {
  const loc = useLocation();
  const { session, loading } = useSession();
  if (loading) return <LoadingState label="Opening" />;
  if (loc.pathname === '/login') {
    return session ? (
      <Navigate to={landingFor(session, loc.state?.from)} replace />
    ) : (
      <Suspense fallback={<LoadingState label="Opening" />}>
        <LoginPage />
      </Suspense>
    );
  }
  if (!session) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (session.mustChangePassword) {
    return (
      <Suspense fallback={<LoadingState label="Opening" />}>
        <ChangePasswordPage />
      </Suspense>
    );
  }
  return <Shell />;
}

function Shell() {
  const loc = useLocation();
  const nav = useNavigate();
  const api = useApi();
  const { actor } = useActor();
  const catalog = useCatalog();
  const narrow = useMediaQuery(NARROW_QUERY);
  const groups = useMemo(() => navGroups(AREAS, actor), [actor]);
  const barItems = useMemo(() => bottomBarItems(AREAS, actor), [actor]);
  const home = homeFor(actor);
  const allProjects = can(actor, 'view_all_projects');
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'dark');
  const [sideOpen, setSideOpen] = useState(() => !window.matchMedia(NARROW_QUERY).matches);
  const [searchOpen, setSearchOpen] = useState(false);
  const drawerOpen = narrow && sideOpen;

  // Becoming narrow (a window made smaller, a tablet turned) closes the sidebar, so the drawer never covers the page
  // by itself; it then opens only from More. Becoming wide leaves the person's open or collapsed choice alone.
  const [wasNarrow, setWasNarrow] = useState(narrow);
  if (narrow !== wasNarrow) {
    setWasNarrow(narrow);
    if (narrow) setSideOpen(false);
  }

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
    ...(can(actor, 'reset_data') ? [{ id: 'reset', title: 'Reset all data', icon: ArrowCounterClockwiseIcon }] : []),
  ];

  const entries = useMemo(
    () =>
      !allProjects
        ? [{ id: '/my-work', title: 'My work', hint: 'Your projects', icon: FolderSimpleIcon }]
        : [
            { id: '/dashboard', title: 'Dashboard', hint: 'Overview', icon: SquaresFourIcon },
            { id: '/projects', title: 'Projects', hint: 'List', icon: FolderSimpleIcon },
            { id: '/customers', title: 'Customers', hint: 'List', icon: AddressBookIcon },
            { id: '/services', title: 'Implementation services', hint: 'List', icon: GridFourIcon },
            { id: '/q/server', title: 'Server questionnaire', hint: 'Questionnaire', icon: HardDrivesIcon },
            { id: '/q/firewall', title: 'Firewall questionnaire', hint: 'Questionnaire', icon: WallIcon },
            ...(catalog?.items ?? []).map((i) => ({
              id: `/services/${i.id}`,
              title: i.name,
              hint: 'Implementation service',
              icon: INFRA_ICONS[i.id] || PackageIcon,
            })),
          ],
    [catalog, allProjects],
  );

  const onSelect = (id) => {
    if (id === 'theme') return setTheme(dark ? 'light' : 'dark');
    if (id === 'reset')
      return (
        window.confirm('Delete every customer, project, document, checklist record and questionnaire response for everyone?') &&
        api.resetAll({ actor })
      );
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
          onHome={() => onSelect(home)}
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
            <b>{titleFor(loc.pathname, catalog)}</b>
          </div>
          <button className="search-trigger" onClick={() => setSearchOpen(true)}>
            <MagnifyingGlassIcon size={15} />
            <span>Search</span>
            <kbd>Ctrl K</kbd>
          </button>
          <NotificationBell />
          <ProfileMenu />
        </header>

        <div className="canvas">
          {/* A page fades in; it never waits for the old one to fade out, because a page holding a shared-layout control can stall that exit forever */}
          <motion.div
            key={pageKey(loc.pathname)}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
          >
            <Suspense fallback={<LoadingState label="Opening the page" />}>
              <Routes location={loc}>
                <Route path="/my-work" element={<MyWorkPage />} />
                <Route path="/projects/:id/*" element={<ProjectPage />} />
                <Route
                  path="/dashboard"
                  element={
                    <Allowed need="view_all_projects">
                      <Dashboard />
                    </Allowed>
                  }
                />
                <Route
                  path="/projects"
                  element={
                    <Allowed need="view_all_projects">
                      <ProjectsPage />
                    </Allowed>
                  }
                />
                <Route
                  path="/projects/new"
                  element={
                    <Allowed need="create_project">
                      <NewProjectPage />
                    </Allowed>
                  }
                />
                <Route
                  path="/customers"
                  element={
                    <Allowed need="view_all_projects">
                      <CustomersPage />
                    </Allowed>
                  }
                />
                <Route
                  path="/customers/:id"
                  element={
                    <Allowed need="view_all_projects">
                      <CustomerPage />
                    </Allowed>
                  }
                />
                <Route
                  path="/services"
                  element={
                    <Allowed need="view_all_projects">
                      <ImplementationServices />
                    </Allowed>
                  }
                />
                <Route
                  path="/services/:id/:mode?"
                  element={
                    <Allowed need="view_all_projects">
                      <Detail />
                    </Allowed>
                  }
                />
                <Route
                  path="/q/:kind"
                  element={
                    <Allowed need="view_all_projects">
                      <QRoute catalog={catalog} />
                    </Allowed>
                  }
                />
                <Route
                  path="/users"
                  element={
                    <Allowed need="manage_users">
                      <UsersPage />
                    </Allowed>
                  }
                />
                <Route path="*" element={<Navigate to={home} replace />} />
              </Routes>
            </Suspense>
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

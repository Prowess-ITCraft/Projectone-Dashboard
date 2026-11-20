import { can } from '@/domain/permissions';
import {
  AddressBookIcon,
  BriefcaseIcon,
  ChartBarIcon,
  CheckSquareOffsetIcon,
  FolderSimpleIcon,
  GearSixIcon,
  GridFourIcon,
  HardDrivesIcon,
  ListChecksIcon,
  NotebookIcon,
  SealCheckIcon,
  SquaresFourIcon,
  UsersThreeIcon,
  WallIcon,
} from '@phosphor-icons/react';

/* Below this width the sidebar becomes a drawer and the bottom bar appears. Matches the 860px media queries in src/styles. */
export const NAV_BREAKPOINT = 860;
export const NARROW_QUERY = `(max-width: ${NAV_BREAKPOINT}px)`;

/*
  Every area the product will have, in menu order. `built` decides whether the area is shown: nothing in the menu
  may lead to an empty page, so an area appears only once its screens exist. `bottomBar` marks the areas that get a
  tab on phones (Dashboard, Projects, My tasks; the fourth tab, More, opens the drawer).

  Questionnaire and Components are the current screens. They stay in the menu until Stage 4 moves them inside a project.

  `need` names the permission an area requires; `hideWith` hides it from anyone holding that permission. An engineer
  (no `view_all_projects`) sees My work and the projects assigned to them, and none of the Admin areas.
*/
export const AREAS = [
  { id: '/dashboard', title: 'Dashboard', icon: SquaresFourIcon, built: true, bottomBar: true, need: 'view_all_projects' },
  { id: '/my-work', title: 'My work', icon: BriefcaseIcon, built: true, bottomBar: true, hideWith: 'view_all_projects' },
  { id: '/projects', title: 'Projects', icon: FolderSimpleIcon, built: true, bottomBar: true, need: 'view_all_projects' },
  { id: '/customers', title: 'Customers', icon: AddressBookIcon, built: true, need: 'view_all_projects' },
  { id: '/tasks', title: 'My tasks', icon: CheckSquareOffsetIcon, built: false, bottomBar: true },
  { id: '/approvals', title: 'Approvals', icon: SealCheckIcon, built: false },
  { id: '/records', title: 'Records', icon: ChartBarIcon, built: false },
  { id: '/guides', title: 'Guides', icon: NotebookIcon, built: false },
  { id: '/users', title: 'Users', icon: UsersThreeIcon, built: true, need: 'manage_users' },
  { id: '/admin', title: 'Admin', icon: GearSixIcon, built: false },
];

/* The component pages hold the old sample checklists, so they are offered to those who see every project only */
const CURRENT_SCREENS_NEED = 'view_all_projects';

export const CURRENT_SCREENS = [
  {
    id: 'questionnaire',
    title: 'Questionnaire',
    icon: ListChecksIcon,
    children: [
      { id: '/q/server', title: 'Server', icon: HardDrivesIcon },
      { id: '/q/firewall', title: 'Firewall', icon: WallIcon },
    ],
  },
  { id: '/components', title: 'Components', icon: GridFourIcon },
];

const strip = ({ id, title, icon }) => ({ id, title, icon });

/* Whether an area is offered to this person. Without an actor (the tests of the config itself) every built area is. */
export const offeredTo = (area, actor) =>
  actor === undefined || ((!area.need || can(actor, area.need)) && (!area.hideWith || !can(actor, area.hideWith)));

/* Sidebar groups: the built areas first, then the current screens */
export function navGroups(areas = AREAS, actor) {
  const screens = offeredTo({ need: CURRENT_SCREENS_NEED }, actor) ? CURRENT_SCREENS : [];
  return [{ items: areas.filter((a) => a.built && offeredTo(a, actor)).map(strip) }, { items: screens }].filter((g) => g.items.length);
}

/* Bottom bar tabs: the built areas marked for it; More is added by the bar itself */
export function bottomBarItems(areas = AREAS, actor) {
  return areas.filter((a) => a.built && a.bottomBar && offeredTo(a, actor)).map(strip);
}

/* Where a person starts: the Admin dashboard, or My work for an engineer */
export const homeFor = (actor) => (can(actor, 'view_all_projects') ? '/dashboard' : '/my-work');

const PROJECT_LINK = /^\/projects\/(?!new$)[^/]+/;

/* Where sign-in leads: an Admin always starts on the dashboard; an engineer goes back to the project link that sent them
   here (an alert, for example), otherwise to My work */
export const landingFor = (actor, from) =>
  !can(actor, 'view_all_projects') && typeof from === 'string' && PROJECT_LINK.test(from) ? from : homeFor(actor);

/* The nav item that should look selected for a route: checklist pages belong to Components */
export function activeFor(path) {
  if (path.startsWith('/c/')) return '/components';
  if (path.startsWith('/projects')) return '/projects';
  if (path.startsWith('/customers')) return '/customers';
  if (path.startsWith('/users')) return '/users';
  return path;
}

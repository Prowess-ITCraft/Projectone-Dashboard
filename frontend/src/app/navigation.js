import {
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
*/
export const AREAS = [
  { id: '/dashboard', title: 'Dashboard', icon: SquaresFourIcon, built: true, bottomBar: true },
  { id: '/projects', title: 'Projects', icon: FolderSimpleIcon, built: false, bottomBar: true },
  { id: '/tasks', title: 'My tasks', icon: CheckSquareOffsetIcon, built: false, bottomBar: true },
  { id: '/approvals', title: 'Approvals', icon: SealCheckIcon, built: false },
  { id: '/records', title: 'Records', icon: ChartBarIcon, built: false },
  { id: '/guides', title: 'Guides', icon: NotebookIcon, built: false },
  { id: '/admin', title: 'Admin', icon: GearSixIcon, built: false },
];

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

/* Sidebar groups: the built areas first, then the current screens */
export function navGroups(areas = AREAS) {
  return [{ items: areas.filter((a) => a.built).map(strip) }, { items: CURRENT_SCREENS }].filter((g) => g.items.length);
}

/* Bottom bar tabs: the built areas marked for it; More is added by the bar itself */
export function bottomBarItems(areas = AREAS) {
  return areas.filter((a) => a.built && a.bottomBar).map(strip);
}

/* The nav item that should look selected for a route: checklist pages belong to Components */
export function activeFor(path) {
  if (path.startsWith('/c/')) return '/components';
  return path;
}

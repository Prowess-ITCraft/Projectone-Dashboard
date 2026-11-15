import { describe, expect, it } from 'vitest';
import { AREAS, activeFor, bottomBarItems, navGroups } from './navigation';

describe('navigation config', () => {
  it('lists every planned area in menu order', () => {
    expect(AREAS.map((a) => a.title)).toEqual(['Dashboard', 'Projects', 'My tasks', 'Approvals', 'Records', 'Guides', 'Admin']);
  });

  it('shows only built areas, then the current screens', () => {
    const [areas, screens] = navGroups();
    expect(areas.items.map((i) => i.title)).toEqual(['Dashboard']);
    expect(screens.items.map((i) => i.title)).toEqual(['Questionnaire', 'Components']);
  });

  it('adds an area to the menu and the bottom bar once it is built', () => {
    const built = AREAS.map((a) => (a.id === '/projects' ? { ...a, built: true } : a));
    expect(navGroups(built)[0].items.map((i) => i.title)).toEqual(['Dashboard', 'Projects']);
    expect(bottomBarItems(built).map((i) => i.title)).toEqual(['Dashboard', 'Projects']);
  });

  it('never puts an unbuilt or unmarked area in the bottom bar', () => {
    const all = AREAS.map((a) => ({ ...a, built: true }));
    expect(bottomBarItems(all).map((i) => i.title)).toEqual(['Dashboard', 'Projects', 'My tasks']);
    expect(bottomBarItems().map((i) => i.title)).toEqual(['Dashboard']);
  });

  it('highlights Components for checklist pages', () => {
    expect(activeFor('/c/firewall/existing')).toBe('/components');
    expect(activeFor('/dashboard')).toBe('/dashboard');
  });
});

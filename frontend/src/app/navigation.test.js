import { describe, expect, it } from 'vitest';
import { AREAS, activeFor, bottomBarItems, homeFor, landingFor, navGroups } from './navigation';

describe('navigation config', () => {
  it('lists every planned area in menu order', () => {
    expect(AREAS.map((a) => a.title)).toEqual([
      'Dashboard',
      'My work',
      'Projects',
      'Customers',
      'My tasks',
      'Approvals',
      'Records',
      'Guides',
      'Users',
      'Admin',
    ]);
  });

  it('shows only built areas, then the current screens', () => {
    const [areas, screens] = navGroups();
    expect(areas.items.map((i) => i.title)).toEqual(['Dashboard', 'My work', 'Projects', 'Customers', 'Users']);
    expect(screens.items.map((i) => i.title)).toEqual(['Questionnaire', 'Implementation services']);
  });

  it('adds an area to the menu and the bottom bar once it is built', () => {
    const built = AREAS.map((a) => (a.id === '/tasks' ? { ...a, built: true } : a));
    expect(navGroups(built)[0].items.map((i) => i.title)).toEqual(['Dashboard', 'My work', 'Projects', 'Customers', 'My tasks', 'Users']);
    expect(bottomBarItems(built).map((i) => i.title)).toEqual(['Dashboard', 'My work', 'Projects', 'My tasks']);
  });

  it('never puts an unbuilt or unmarked area in the bottom bar', () => {
    const all = AREAS.map((a) => ({ ...a, built: true }));
    expect(bottomBarItems(all).map((i) => i.title)).toEqual(['Dashboard', 'My work', 'Projects', 'My tasks']);
    expect(bottomBarItems().map((i) => i.title)).toEqual(['Dashboard', 'My work', 'Projects']);
  });

  it('offers an Admin the Admin areas and an engineer only My work', () => {
    const admin = { role: 'admin' };
    const engineer = { role: 'engineer' };
    expect(navGroups(AREAS, admin).map((g) => g.items.map((i) => i.title))).toEqual([
      ['Dashboard', 'Projects', 'Customers', 'Users'],
      ['Questionnaire', 'Implementation services'],
    ]);
    expect(navGroups(AREAS, engineer).map((g) => g.items.map((i) => i.title))).toEqual([['My work']]);
    expect(bottomBarItems(AREAS, engineer).map((i) => i.title)).toEqual(['My work']);
  });

  it('starts an Admin on the dashboard and an engineer on My work, or on the project link they followed', () => {
    expect(homeFor({ role: 'admin' })).toBe('/dashboard');
    expect(homeFor({ role: 'engineer' })).toBe('/my-work');
    expect(landingFor({ role: 'engineer' }, '/projects/abc/checklist')).toBe('/projects/abc/checklist');
    expect(landingFor({ role: 'engineer' }, '/users')).toBe('/my-work');
    expect(landingFor({ role: 'admin' }, '/projects/new')).toBe('/dashboard');
    expect(landingFor({ role: 'admin' }, '/projects/abc/checklist')).toBe('/dashboard');
  });

  it('highlights Implementation services for checklist pages', () => {
    expect(activeFor('/services/ad-dc/existing')).toBe('/services');
    expect(activeFor('/dashboard')).toBe('/dashboard');
    expect(activeFor('/projects/abc/lines')).toBe('/projects');
    expect(activeFor('/customers/abc')).toBe('/customers');
  });
});

/*
  End to end against a running API, through the real data layer. Skipped unless every one of these is set:
    E2E_API              the API address, e.g. http://localhost:9666
    E2E_ADMIN_EMAIL      the Admin email given to the seed script
    E2E_ADMIN_PASSWORD   the Admin password given to the seed script
    E2E_ENGINEER_PASSWORD  the DEFAULT_ENGINEER_PASSWORD given to the seed script
  For example:
    E2E_API=http://localhost:9666 E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... E2E_ENGINEER_PASSWORD=... npx vitest run src/data/http/e2e.test.js
  Needs a freshly seeded database. Engineer emails are read from the seeded user list. It changes passwords and
  deactivates engineer01 and engineer02, so run it only against a throwaway database.
*/
import { describe, expect, it } from 'vitest';
import process from 'node:process';
import { createFixtures } from '@/data/fixtures';
import { createHttpApi } from './httpApi';

const BASE = process.env.E2E_API;
const ENGINEER_PASSWORD = process.env.E2E_ENGINEER_PASSWORD;
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;
const fresh = () => `e2e-${crypto.randomUUID()}`;

/* A fetch with its own cookie jar, like one browser */
function browser() {
  const jar = new Map();
  return async (url, init = {}) => {
    const headers = { ...(init.headers ?? {}) };
    if (jar.size) headers.Cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
    const response = await fetch(url, { ...init, headers });
    for (const line of response.headers.getSetCookie?.() ?? []) {
      const [pair] = line.split(';');
      const [k, v] = pair.split('=');
      if (/Max-Age=0|expires=Thu, 01 Jan 1970/i.test(line) || v === '""' || v === '') jar.delete(k);
      else jar.set(k, v);
    }
    return response;
  };
}

const make = () => createHttpApi({ fixtures: createFixtures({ allowPrivate: false }), baseUrl: BASE, fetchImpl: browser() });

describe.skipIf(!BASE || !ADMIN_EMAIL || !ADMIN_PASSWORD || !ENGINEER_PASSWORD)('end to end against a running API', () => {
  it('runs the admin and engineer flow on the real server', async () => {
    const admin = make();
    const me = await admin.signIn(ADMIN_EMAIL, ADMIN_PASSWORD);
    expect(me.mustChangePassword).toBe(true);
    await expect(admin.listProjects()).rejects.toMatchObject({ code: 'password_change_required' });
    const changed = await admin.changePassword(ADMIN_PASSWORD, fresh());
    expect(changed.mustChangePassword).toBe(false);
    const actor = { id: changed.id, role: changed.role, name: changed.name };

    const mine = await admin.createProject({ customer: { name: 'E2E Alpha Ltd' }, entryPath: 'new_infra', actor });
    const other = await admin.createProject({ customer: { name: 'E2E Beta Ltd' }, entryPath: 'post_audit', actor });
    expect(mine.number).toMatch(/^PRJ-\d{4}-0001$/);
    expect(other.number).toMatch(/^PRJ-\d{4}-0002$/);

    const file = new File(['%PDF-1.4 e2e'], 'order.pdf', { type: 'application/pdf' });
    const { document } = await admin.addDocument({ projectId: mine.id, type: 'pi', file, actor });
    expect(document.status).toBe('needs_manual');
    await admin.saveDocumentDetails(document.id, {
      header: { number: 'PI/E2E/1', date: '2026-11-17', billTo: {} },
      lines: [{ title: 'Firewall appliance', qty: 1 }],
      actor,
    });

    const users = await admin.listUsers();
    const engineers = users.filter((u) => u.role === 'engineer').sort((a, b) => a.email.localeCompare(b.email));
    const [e1, e2] = engineers;
    await admin.setProjectEngineers(mine.id, [e1.id]);
    expect((await admin.listAssignments()).map((a) => a.engineerId)).toEqual([e1.id]);

    // the first engineer signs in with the shared default password
    const engineer = make();
    await engineer.signIn(e1.email, ENGINEER_PASSWORD);
    const engineerPassword = fresh();
    const eng = await engineer.changePassword(ENGINEER_PASSWORD, engineerPassword);
    const engActor = { id: eng.id, role: eng.role, name: eng.name };

    const projects = await engineer.listMyProjects();
    expect(projects.map((p) => p.number)).toEqual([mine.number]);
    const work = await engineer.getWork(mine.id);
    expect(work.project.customerName).toBe('E2E Alpha Ltd');
    expect(work.lines.map((l) => l.description)).toEqual(['Firewall appliance']);
    await expect(engineer.getWork(other.id)).rejects.toMatchObject({ status: 404 });
    expect((await engineer.getChecklist(mine.id)).steps).toEqual([]);

    const alerts = await engineer.listNotifications();
    expect(alerts.unread).toBe(1);
    expect(alerts.items[0].message).toBe(`New project assigned: ${mine.number}, E2E Alpha Ltd`);

    // an engineer changes checklist progress only: the record store is closed to them
    await expect(engineer.listProjects()).rejects.toMatchObject({ status: 403 });
    await expect(engineer.updateLine(work.lines[0].id, { qty: 2 }, { actor: engActor })).rejects.toThrow();
    await expect(engineer.listUsers()).rejects.toMatchObject({ status: 403 });

    // removal notifies and closes the project; a deactivated engineer cannot sign in
    await admin.removeProjectEngineer(mine.id, e1.id);
    expect((await engineer.listMyProjects()).length).toBe(0);
    expect((await engineer.listNotifications()).items[0].message).toBe(`Removed from project: ${mine.number}, E2E Alpha Ltd`);
    expect(
      (
        await make()
          .listNotifications()
          .catch((e) => e)
      ).status,
    ).toBe(401);
    await admin.setUserActive(e2.id, false);
    await admin.setUserActive(e1.id, false);
    await expect(engineer.listNotifications()).rejects.toMatchObject({ status: 401 });
    await expect(make().signIn(e1.email, engineerPassword)).rejects.toThrow('That email and password do not match.');

    await admin.signOut();
    expect(await admin.getMe()).toBeNull();
  }, 60_000);
});

/*
  End to end against a running API, through the real data layer. Skipped unless E2E_API is set:
    E2E_API=http://localhost:9666 E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=...     E2E_CREDS=../backend/engineer-credentials.local.txt npx vitest run src/data/http/e2e.test.js
  Needs a freshly seeded database (the admin values are those given to the seed script). It changes passwords and
  deactivates engineer01 and engineer02, so run it only against a throwaway database.
*/
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { createFixtures } from '@/data/fixtures';
import { createHttpApi } from './httpApi';

const BASE = process.env.E2E_API;
const CREDS = process.env.E2E_CREDS;
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

describe.skipIf(!BASE || !ADMIN_PASSWORD)('end to end against a running API', () => {
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
    const e1 = users.find((u) => u.email === 'engineer01@test.com');
    const e2 = users.find((u) => u.email === 'engineer02@test.com');
    await admin.setProjectEngineers(mine.id, [e1.id]);
    expect((await admin.listAssignments()).map((a) => a.engineerId)).toEqual([e1.id]);

    // engineer 01 signs in with the password from the seed file
    const line = readFileSync(CREDS, 'utf-8')
      .split('\n')
      .find((l) => l.includes('engineer01@test.com'));
    const temp = line.split('\t')[2].trim();
    const engineer = make();
    await engineer.signIn('engineer01@test.com', temp);
    const engineerPassword = fresh();
    const eng = await engineer.changePassword(temp, engineerPassword);
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
    await expect(make().signIn('engineer01@test.com', engineerPassword)).rejects.toThrow('That email and password do not match.');

    await admin.signOut();
    expect(await admin.getMe()).toBeNull();
  }, 60_000);
});

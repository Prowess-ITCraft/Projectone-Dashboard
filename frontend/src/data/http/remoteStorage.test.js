import { describe, expect, it, vi } from 'vitest';
import { createClient } from './client';
import { createRemoteStorage } from './remoteStorage';

/* A fetch that answers from a table of path to body and records every request */
function fakeFetch(routes = {}) {
  const calls = [];
  const fetchImpl = vi.fn(async (url, init) => {
    const path = url.replace(/^\/api/, '');
    calls.push({ method: init.method, path, body: init.body ? JSON.parse(init.body) : undefined, headers: init.headers });
    const answer = routes[`${init.method} ${path}`];
    if (typeof answer === 'number') {
      return { ok: false, status: answer, json: async () => ({ code: answer === 404 ? 'not_found' : 'forbidden', message: 'No.' }) };
    }
    return { ok: true, status: answer === undefined ? 204 : 200, json: async () => answer };
  });
  return { calls, fetchImpl };
}

describe('remote storage', () => {
  it('sends every write of one action as a single batch when the action ends', async () => {
    const { calls, fetchImpl } = fakeFetch({ 'GET /store/projects': [{ id: 'p1', number: 'PRJ-1' }] });
    const storage = createRemoteStorage(createClient({ fetchImpl }));
    await storage.transaction(async () => {
      await storage.put('documents', 'd1', { id: 'd1', projectId: 'p1' });
      await storage.put('lines', 'l1', { id: 'l1', projectId: 'p1' });
      await storage.delete('lines', 'l0');
      // the action reads its own writes before they are sent
      expect(await storage.get('documents', 'd1')).toEqual({ id: 'd1', projectId: 'p1' });
      expect((await storage.getAll('projects')).map((p) => p.id)).toEqual(['p1']);
    });
    const writes = calls.filter((c) => c.method === 'POST');
    expect(writes).toHaveLength(1);
    expect(writes[0].path).toBe('/store/batch');
    expect(writes[0].body.ops).toEqual([
      { op: 'put', store: 'documents', id: 'd1', data: { id: 'd1', projectId: 'p1' } },
      { op: 'put', store: 'lines', id: 'l1', data: { id: 'l1', projectId: 'p1' } },
      { op: 'delete', store: 'lines', id: 'l0' },
    ]);
    expect(writes[0].headers['X-Requested-With']).toBe('ProjectOne');
  });

  it('sends nothing when the action fails, so no half-done change is saved', async () => {
    const { calls, fetchImpl } = fakeFetch();
    const storage = createRemoteStorage(createClient({ fetchImpl }));
    await expect(
      storage.transaction(async () => {
        await storage.put('documents', 'd1', { id: 'd1' });
        throw new Error('Enter the document number.');
      }),
    ).rejects.toThrow('Enter the document number.');
    expect(calls.filter((c) => c.method === 'POST')).toEqual([]);
  });

  it('reads a record the server does not show as missing, and sends a file as base64', async () => {
    const { calls, fetchImpl } = fakeFetch({ 'GET /store/projects/p9': 404 });
    const storage = createRemoteStorage(createClient({ fetchImpl }));
    expect(await storage.get('projects', 'p9')).toBeUndefined();
    await storage.transaction(() => storage.put('files', 'f1', { id: 'f1', projectId: 'p1', name: 'a.pdf', blob: new Blob(['%PDF']) }));
    const [op] = calls.find((c) => c.path === '/store/batch').body.ops;
    expect(op.data).toEqual({ id: 'f1', projectId: 'p1', name: 'a.pdf', content: btoa('%PDF') });
  });

  it('tells the screens when the session has ended', async () => {
    const onAuthProblem = vi.fn();
    const fetchImpl = async () => ({
      ok: false,
      status: 401,
      json: async () => ({ code: 'session_expired', message: 'Your session has ended. Sign in again.' }),
    });
    const client = createClient({ fetchImpl, onAuthProblem });
    await expect(client.get('/store/projects')).rejects.toThrow('Your session has ended');
    expect(onAuthProblem).toHaveBeenCalledWith(expect.objectContaining({ code: 'session_expired' }));
  });
});

import { openDB } from 'idb';

/*
  Key-value storage for the local adapter. Two backends with one shape: IndexedDB in the browser, and a memory
  store used by tests and when the browser blocks IndexedDB (private windows). Business logic never touches either.
*/
export const STORES = ['customers', 'projects', 'documents', 'lines', 'modules', 'entitlements', 'files', 'rules', 'meta', 'audit'];

const copy = (value) => (value === undefined || value instanceof Blob ? value : structuredClone(value));

export function createMemoryStorage() {
  const data = Object.fromEntries(STORES.map((s) => [s, new Map()]));
  return {
    persistent: false,
    async get(store, key) {
      return copy(data[store].get(key));
    },
    async put(store, key, value) {
      data[store].set(key, copy(value));
    },
    async delete(store, key) {
      data[store].delete(key);
    },
    async getAll(store) {
      return [...data[store].values()].map(copy);
    },
    async clear() {
      STORES.forEach((s) => data[s].clear());
    },
  };
}

export function createIdbStorage(name = 'projectone') {
  const db = openDB(name, 1, {
    upgrade(database) {
      STORES.forEach((s) => database.createObjectStore(s));
    },
  });
  return {
    persistent: true,
    async get(store, key) {
      return (await db).get(store, key);
    },
    async put(store, key, value) {
      await (await db).put(store, value, key);
    },
    async delete(store, key) {
      await (await db).delete(store, key);
    },
    async getAll(store) {
      return (await db).getAll(store);
    },
    async clear() {
      const database = await db;
      await Promise.all(STORES.map((s) => database.clear(s)));
    },
  };
}

/*
  IndexedDB when it works, otherwise memory. It is returned at once so the app can draw immediately; every call waits
  for the choice. If IndexedDB is missing, errors, or does not answer within `timeoutMs` (a blocked or stalled
  database), memory is used and `persistent` turns false so the screens can say so.
*/
export function createBrowserStorage({ timeoutMs = 3000 } = {}) {
  let backend = null;
  const ready = (async () => {
    if (typeof indexedDB === 'undefined') return createMemoryStorage();
    try {
      const idb = createIdbStorage();
      let timer;
      const stalled = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('IndexedDB did not answer')), timeoutMs);
      });
      await Promise.race([idb.get('meta', 'probe'), stalled]).finally(() => clearTimeout(timer));
      return idb;
    } catch {
      return createMemoryStorage();
    }
  })().then((chosen) => (backend = chosen));
  const via =
    (method) =>
    async (...args) =>
      (await ready)[method](...args);
  return {
    get persistent() {
      return backend ? backend.persistent : true;
    },
    get: via('get'),
    put: via('put'),
    delete: via('delete'),
    getAll: via('getAll'),
    clear: via('clear'),
  };
}

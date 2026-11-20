/*
  The storage interface of the local data layer (get, put, delete, getAll, clear), kept on the server.

  One action of the data layer (create a project, add a document) makes several writes. They run inside
  `transaction(fn)`: writes are held in an overlay that the action's own reads see, and are sent together as one batch
  when the action ends. The server saves a batch completely or not at all, and refuses it as a whole if any write is
  not allowed, so a failed action never leaves half its changes behind.

  Reads are cached for a moment so one screen's burst of reads costs one request per store; any write clears the cache.
*/
const CACHE_MS = 1500;
const DELETED = Symbol('deleted');

async function blobToBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export function createRemoteStorage(client, { now = () => Date.now() } = {}) {
  const cache = new Map();
  let overlay = null;

  const cached = async (key, load) => {
    const hit = cache.get(key);
    if (hit && now() - hit.at < CACHE_MS) return hit.value;
    const value = load();
    cache.set(key, { at: now(), value });
    value.catch(() => cache.delete(key));
    return value;
  };
  const enc = encodeURIComponent;

  async function serverGet(store, key) {
    try {
      if (store === 'files') {
        const meta = await client.get(`/store/files/${enc(key)}`);
        const response = await client.raw(`/store/files/${enc(key)}/content`);
        return { ...meta, blob: await response.blob() };
      }
      return await client.get(`/store/${store}/${enc(key)}`);
    } catch (error) {
      if (error.status === 404) return undefined;
      throw error;
    }
  }

  async function getAll(store) {
    const rows = await cached(`all:${store}`, () => client.get(`/store/${store}`));
    if (!overlay?.has(store)) return rows.map((r) => structuredClone(r));
    const changes = overlay.get(store);
    const merged = rows.filter((r) => !changes.has(r.id)).map((r) => structuredClone(r));
    changes.forEach((value) => value !== DELETED && merged.push(structuredClone(value)));
    return merged;
  }

  async function get(store, key) {
    const pending = overlay?.get(store)?.get(key);
    if (pending === DELETED) return undefined;
    if (pending !== undefined) return pending.blob ? { ...pending } : structuredClone(pending);
    const value = await cached(`one:${store}:${key}`, () => serverGet(store, key));
    return value && !value.blob ? structuredClone(value) : value;
  }

  const stage = (store, key, value) => {
    if (!overlay.has(store)) overlay.set(store, new Map());
    overlay.get(store).set(key, value);
  };

  async function send(ops) {
    if (!ops.length) return;
    cache.clear();
    await client.post('/store/batch', { ops });
  }

  async function toOps(changes) {
    const ops = [];
    for (const [store, rows] of changes) {
      for (const [id, value] of rows) {
        if (value === DELETED) ops.push({ op: 'delete', store, id });
        else if (store === 'files') {
          const { blob, ...meta } = value;
          ops.push({ op: 'put', store, id, data: { ...meta, content: await blobToBase64(blob) } });
        } else ops.push({ op: 'put', store, id, data: value });
      }
    }
    return ops;
  }

  return {
    persistent: true,
    remote: true,
    get,
    getAll,
    async put(store, key, value) {
      if (overlay) return stage(store, key, value?.blob ? { ...value } : structuredClone(value));
      return send(await toOps(new Map([[store, new Map([[key, value]])]])));
    },
    async delete(store, key) {
      if (overlay) return stage(store, key, DELETED);
      return send([{ op: 'delete', store, id: key }]);
    },
    async clear() {
      cache.clear();
      await client.post('/store/reset');
    },
    async nextCounter(key) {
      const { value } = await client.post(`/store/counters/${enc(key)}`);
      return value;
    },
    /* Runs one action with its writes held back, then sends them as one batch. Actions never overlap: the data
       layer runs its writes one at a time. */
    async transaction(fn) {
      overlay = new Map();
      try {
        const result = await fn();
        const changes = overlay;
        overlay = null;
        await send(await toOps(changes));
        return result;
      } finally {
        overlay = null;
      }
    },
    forget: () => cache.clear(),
  };
}

// Local-first record storage for the song library and practice log.
//
// IndexedDB is the store. There is no server and there is not going to be one:
// this is a practice log kept on the machine you practise at, and the export
// in library.ts is how it moves.
//
// A localStorage mirror stands in when IndexedDB will not open — a private
// window, an embedded webview, a browser with site data locked down. Losing
// someone's practice history to a private tab would be a much worse failure
// than the few kilobytes the mirror costs, and the record counts here are
// small enough (a month of songs, a few hundred sessions) that the fallback is
// a real fallback rather than a token one.

export type StoreName = 'songs' | 'sessions' | 'challenges' | 'settings' | 'chords' | 'loops';

/**
 * "Something in the stores changed."
 *
 * One event for every store rather than one per module, so a screen showing a
 * song and the chords you can play subscribes once. Declared here, at the
 * layer both stores already depend on, because two modules agreeing on a
 * string literal is two modules waiting to disagree on it.
 */
export const STORE_CHANGE_EVENT = 'cadenza-library-change';

export interface Record_ { id: string }

const DB_NAME = 'cadenza-library';
// 2 added the chord book, 3 the quick-play loops. The upgrade handler creates
// whatever is missing rather than migrating, so an existing database gains the
// store and keeps everything already in it.
const DB_VERSION = 3;
const STORES: StoreName[] = ['songs', 'sessions', 'challenges', 'settings', 'chords', 'loops'];
const MIRROR_KEY = 'cadenza-library-mirror-v1';
const OPEN_TIMEOUT = 3000;

let dbPromise: Promise<IDBDatabase | null> | null = null;

// null means "use the mirror". Resolved once and reused.
function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise(resolve => {
    let settled = false;
    const done = (db: IDBDatabase | null) => {
      if (settled) return;
      settled = true;
      resolve(db);
    };
    try {
      if (typeof indexedDB === 'undefined') return done(null);
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const name of STORES) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => done(req.result);
      req.onerror = () => done(null);
      req.onblocked = () => done(null);
      // Firefox's private mode used to fire neither handler; a store that never
      // resolves would hang the whole app behind its ready promise.
      setTimeout(() => done(null), OPEN_TIMEOUT);
    } catch {
      done(null);
    }
  });
  return dbPromise;
}

// ---------------------------------------------------------------------------
// The mirror
// ---------------------------------------------------------------------------

type Mirror = Record<StoreName, Record<string, unknown>>;

const emptyMirror = (): Mirror => ({ songs: {}, sessions: {}, challenges: {}, settings: {}, chords: {}, loops: {} });

const readMirror = (): Mirror => {
  try {
    const raw = localStorage.getItem(MIRROR_KEY);
    if (!raw) return emptyMirror();
    const parsed = JSON.parse(raw);
    const out = emptyMirror();
    for (const name of STORES) {
      if (parsed && typeof parsed[name] === 'object' && parsed[name]) out[name] = parsed[name];
    }
    return out;
  } catch {
    return emptyMirror();
  }
};

const writeMirror = (mirror: Mirror): void => {
  try {
    localStorage.setItem(MIRROR_KEY, JSON.stringify(mirror));
  } catch { /* out of quota or blocked — this session stays in memory */ }
};

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

const run = <T>(db: IDBDatabase, store: StoreName, mode: IDBTransactionMode,
  body: (s: IDBObjectStore) => IDBRequest<T> | null): Promise<T | null> =>
  new Promise(resolve => {
    try {
      const tx = db.transaction(store, mode);
      const req = body(tx.objectStore(store));
      tx.onabort = () => resolve(null);
      tx.onerror = () => resolve(null);
      if (!req) {
        tx.oncomplete = () => resolve(null);
        return;
      }
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

export async function readAll<T extends Record_>(store: StoreName): Promise<T[]> {
  const db = await openDb();
  if (db) {
    const rows = await run<T[]>(db, store, 'readonly', s => s.getAll() as IDBRequest<T[]>);
    if (rows) return rows;
  }
  return Object.values(readMirror()[store]) as T[];
}

export async function putRecords<T extends Record_>(store: StoreName, records: T[]): Promise<void> {
  if (records.length === 0) return;
  const db = await openDb();
  if (db) {
    await new Promise<void>(resolve => {
      try {
        const tx = db.transaction(store, 'readwrite');
        const os = tx.objectStore(store);
        for (const r of records) os.put(r);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
        tx.onabort = () => resolve();
      } catch {
        resolve();
      }
    });
    return;
  }
  const mirror = readMirror();
  for (const r of records) mirror[store][r.id] = r;
  writeMirror(mirror);
}

export async function deleteRecord(store: StoreName, id: string): Promise<void> {
  const db = await openDb();
  if (db) {
    await run(db, store, 'readwrite', s => s.delete(id) as IDBRequest<undefined>);
    return;
  }
  const mirror = readMirror();
  delete mirror[store][id];
  writeMirror(mirror);
}

export async function clearStore(store: StoreName): Promise<void> {
  const db = await openDb();
  if (db) {
    await run(db, store, 'readwrite', s => s.clear() as IDBRequest<undefined>);
    return;
  }
  const mirror = readMirror();
  mirror[store] = {};
  writeMirror(mirror);
}

// Shown in the Songs page's data panel, so "where is my practice log actually
// kept" has an answer on screen rather than in a comment.
export async function storageKind(): Promise<'indexeddb' | 'local'> {
  return (await openDb()) ? 'indexeddb' : 'local';
}

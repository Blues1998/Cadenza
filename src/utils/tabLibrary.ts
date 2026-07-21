// Local library of imported Tab Player files (IndexedDB), so a piece doesn't
// need re-dragging every session. Metadata (title, last position, tempo,
// guitar tone) lives in its own object store so listing the library stays
// fast; the file's raw bytes live in a separate store, only fetched when a
// specific piece is actually opened.

const DB_NAME = 'cadenza-tab-library';
const DB_VERSION = 1;
const META_STORE = 'tabs';
const BLOB_STORE = 'tabBlobs';

export interface TabLibraryEntry {
  id: string;
  fileName: string;
  title: string;
  artist: string;
  sizeBytes: number;
  lastOpenedAt: number;
  lastPositionMs: number;
  durationMs: number;
  tempoPct: number;
  guitarTone: { bank: number; program: number };
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(BLOB_STORE)) db.createObjectStore(BLOB_STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function putRecord(db: IDBDatabase, store: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function getRecord<T>(db: IDBDatabase, store: string, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const request = tx.objectStore(store).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

function getAllRecords<T>(db: IDBDatabase, store: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const request = tx.objectStore(store).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

function deleteRecord(db: IDBDatabase, store: string, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Re-importing the same file name just updates its existing entry.
export function tabIdForFileName(fileName: string): string {
  return fileName.trim().toLowerCase();
}

export async function saveTabToLibrary(
  fileName: string,
  data: ArrayBuffer,
  meta: Omit<TabLibraryEntry, 'id' | 'fileName' | 'sizeBytes'>
): Promise<string> {
  const db = await openDb();
  const id = tabIdForFileName(fileName);
  const entry: TabLibraryEntry = { id, fileName, sizeBytes: data.byteLength, ...meta };
  await Promise.all([putRecord(db, META_STORE, entry), putRecord(db, BLOB_STORE, { id, data })]);
  db.close();
  return id;
}

export async function updateTabMeta(id: string, patch: Partial<TabLibraryEntry>): Promise<void> {
  const db = await openDb();
  const existing = await getRecord<TabLibraryEntry>(db, META_STORE, id);
  if (existing) await putRecord(db, META_STORE, { ...existing, ...patch });
  db.close();
}

export async function listLibraryTabs(): Promise<TabLibraryEntry[]> {
  const db = await openDb();
  const all = await getAllRecords<TabLibraryEntry>(db, META_STORE);
  db.close();
  return all.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
}

export async function loadTabBlob(id: string): Promise<ArrayBuffer | undefined> {
  const db = await openDb();
  const record = await getRecord<{ id: string; data: ArrayBuffer }>(db, BLOB_STORE, id);
  db.close();
  return record?.data;
}

export async function deleteTabFromLibrary(id: string): Promise<void> {
  const db = await openDb();
  await Promise.all([deleteRecord(db, META_STORE, id), deleteRecord(db, BLOB_STORE, id)]);
  db.close();
}

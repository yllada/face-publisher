const DB_NAME = 'face-publisher';
const DB_VERSION = 1;

const STORES = {
  IMAGES: 'images',
  DEFAULTS: 'defaults',
  PACKAGES: 'packages',
  STATE: 'state',
};

let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORES.IMAGES)) {
        db.createObjectStore(STORES.IMAGES, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(STORES.DEFAULTS)) {
        db.createObjectStore(STORES.DEFAULTS, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(STORES.PACKAGES)) {
        db.createObjectStore(STORES.PACKAGES, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(STORES.STATE)) {
        db.createObjectStore(STORES.STATE, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function txStore(db, name, mode = 'readonly') {
  return db.transaction(name, mode).objectStore(name);
}

function asPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function add(store, record) {
  const db = await openDB();
  return asPromise(txStore(db, store, 'readwrite').add(record));
}

export async function put(store, record) {
  const db = await openDB();
  return asPromise(txStore(db, store, 'readwrite').put(record));
}

export async function getAll(store) {
  const db = await openDB();
  const res = await asPromise(txStore(db, store).getAll());
  return res || [];
}

export async function getById(store, id) {
  const db = await openDB();
  return asPromise(txStore(db, store).get(id));
}

export async function clearStore(store) {
  const db = await openDB();
  return asPromise(txStore(db, store, 'readwrite').clear());
}

export async function deleteRecord(store, id) {
  const db = await openDB();
  return asPromise(txStore(db, store, 'readwrite').delete(id));
}

export async function getState(key, fallback = null) {
  const db = await openDB();
  const res = await asPromise(txStore(db, STORES.STATE).get(key));
  return res ? res.value : fallback;
}

export async function setState(key, value) {
  const db = await openDB();
  return asPromise(txStore(db, STORES.STATE, 'readwrite').put({ key, value }));
}

export { STORES };

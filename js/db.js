// Minimal promise-based IndexedDB wrapper.
const DB_NAME = 'opening-atlas';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('openings')) {
        const store = db.createObjectStore('openings', { keyPath: 'id' });
        store.createIndex('color', 'color');
      }
      if (!db.objectStoreNames.contains('studyState')) {
        db.createObjectStore('studyState', { keyPath: 'openingId' });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

class Store {
  constructor(db, name) {
    this.db = db;
    this.name = name;
  }
  _tx(mode) {
    return this.db.transaction(this.name, mode).objectStore(this.name);
  }
  get(key) {
    return new Promise((resolve, reject) => {
      const r = this._tx('readonly').get(key);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  getAll() {
    return new Promise((resolve, reject) => {
      const r = this._tx('readonly').getAll();
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  put(value) {
    return new Promise((resolve, reject) => {
      const r = this._tx('readwrite').put(value);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  delete(key) {
    return new Promise((resolve, reject) => {
      const r = this._tx('readwrite').delete(key);
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    });
  }
}

const DB = {
  _db: null,
  async init() {
    this._db = await openDB();
    this.openings = new Store(this._db, 'openings');
    this.studyState = new Store(this._db, 'studyState');
    this.settings = new Store(this._db, 'settings');
    return this;
  },
  async getSetting(key, fallback) {
    const row = await this.settings.get(key);
    return row ? row.value : fallback;
  },
  async setSetting(key, value) {
    return this.settings.put({ key, value });
  },
};

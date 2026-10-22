/* Local-first storage. IndexedDB is used for the main app data; a localStorage fallback keeps the prototype usable in restricted contexts. */
window.StudyStorage = (() => {
  const DB_NAME = "pink-study-space";
  const STORE = "state";
  const KEY = "main";
  const FALLBACK = "pink-study-space-fallback";
  function openDB() {
    return new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) return reject(new Error("IndexedDB unavailable"));
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  async function load() {
    try {
      const db = await openDB();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).get(KEY);
        req.onsuccess = () => { db.close(); resolve(req.result || null); };
        req.onerror = () => { db.close(); reject(req.error); };
      });
    } catch {
      try { return JSON.parse(localStorage.getItem(FALLBACK) || "null"); } catch { return null; }
    }
  }
  async function save(state) {
    try {
      const db = await openDB();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(state, KEY);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      db.close();
    } catch {
      localStorage.setItem(FALLBACK, JSON.stringify(state));
    }
  }
  return { load, save };
})();
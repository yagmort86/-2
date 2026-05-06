const DB_NAME = "chaika-model-admin";
const STORE_NAME = "models";
const ACTIVE_MODEL_KEY = "active-glb";

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadStoredModel() {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(ACTIVE_MODEL_KEY);

    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function saveStoredModel(file) {
  const db = await openDb();
  const record = {
    id: ACTIVE_MODEL_KEY,
    file,
    name: file.name,
    size: file.size,
    updatedAt: Date.now()
  };

  await new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const request = transaction.objectStore(STORE_NAME).put(record);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

  return record;
}

export async function clearStoredModel() {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const request = transaction.objectStore(STORE_NAME).delete(ACTIVE_MODEL_KEY);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

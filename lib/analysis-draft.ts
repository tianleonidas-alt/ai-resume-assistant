export type AnalysisDraft = {
  file: File | null;
  resumeText: string;
  savedResumeId: string | null;
  jobDescription: string;
};

const databaseName = "career-brief-drafts";
const storeName = "drafts";

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(storeName)) request.result.createObjectStore(storeName);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
  const database = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const request = action(transaction.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function readAnalysisDraft(key: string) {
  return withStore<AnalysisDraft | undefined>("readonly", (store) => store.get(key));
}

export async function writeAnalysisDraft(key: string, draft: AnalysisDraft) {
  return withStore<IDBValidKey>("readwrite", (store) => store.put(draft, key));
}

export async function deleteAnalysisDraft(key: string) {
  return withStore<undefined>("readwrite", (store) => store.delete(key));
}

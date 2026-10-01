// frontend/src/lib/syncQueue.ts
import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface SyncItem {
  id?: number;
  endpoint: string;
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  payload: any;
  createdAt: number;
}

interface VectorSyncDB extends DBSchema {
  syncQueue: {
    key: number;
    value: SyncItem;
    autoIncrement: true;
  };
}

const DB_NAME = 'VectorSyncLocalDB';
const STORE_NAME = 'syncQueue';

export async function getSyncDB(): Promise<IDBPDatabase<VectorSyncDB>> {
  return openDB<VectorSyncDB>(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    },
  });
}

// Add an action to the local queue when offline or pending
export async function queueMutation(endpoint: string, method: SyncItem['method'], payload: any) {
  const db = await getSyncDB();
  await db.add(STORE_NAME, {
    endpoint,
    method,
    payload,
    createdAt: Date.now(),
  });
}

// Get the count of pending mutations
export async function getPendingQueueCount(): Promise<number> {
  const db = await getSyncDB();
  return db.count(STORE_NAME);
}

// Drain queue and push mutations to FastAPI backend
export async function flushSyncQueue(): Promise<{ success: boolean; syncedCount: number; errors: number }> {
  const db = await getSyncDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const items = await store.getAll();
  await tx.done;

  if (items.length === 0) {
    return { success: true, syncedCount: 0, errors: 0 };
  }

  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  let syncedCount = 0;
  let errors = 0;

  for (const item of items) {
    try {
      const response = await fetch(`${baseUrl}${item.endpoint}`, {
        method: item.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.payload),
      });

      if (response.ok) {
        if (item.id !== undefined) {
          const deleteTx = db.transaction(STORE_NAME, 'readwrite');
          await deleteTx.objectStore(STORE_NAME).delete(item.id);
          await deleteTx.done;
          syncedCount++;
        }
      } else {
        errors++;
      }
    } catch {
      errors++;
      break; // Pause if network drops mid-stream
    }
  }

  return { success: errors === 0, syncedCount, errors };
}
import * as SecureStore from "expo-secure-store";

// Local in-memory cache fallback for environments without SecureStore
const memoryCache = new Map<string, string>();

export async function setItem(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    memoryCache.set(key, value);
  }
}

export async function getItem(key: string): Promise<string | null> {
  try {
    const val = await SecureStore.getItemAsync(key);
    if (val !== null) return val;
    return memoryCache.get(key) ?? null;
  } catch {
    return memoryCache.get(key) ?? null;
  }
}

export async function removeItem(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    memoryCache.delete(key);
  }
}

// ─── Typed Offline Queue Storage ──────────────────────────────

export interface OfflineQueuedVisit {
  id: string;
  queuedAt: string;
  payload: {
    doctorId?: string;
    chemistId?: string;
    hospitalId?: string;
    purpose: string;
    feedback?: string;
    latitude: number;
    longitude: number;
    durationMinutes?: number;
    samples?: { productId: string; quantity: number }[];
  };
}

export interface OfflineQueuedOrder {
  id: string;
  queuedAt: string;
  payload: {
    chemistId: string;
    distributorId: string;
    items: { productId: string; quantity: number }[];
  };
}

const OFFLINE_VISITS_KEY = "mr_offline_visits_queue";
const OFFLINE_ORDERS_KEY = "mr_offline_orders_queue";
const CACHED_DOCTORS_KEY = "mr_cached_doctors";
const CACHED_CHEMISTS_KEY = "mr_cached_chemists";

export const storageService = {
  // Offline Visits
  getQueuedVisits: async (): Promise<OfflineQueuedVisit[]> => {
    const raw = await getItem(OFFLINE_VISITS_KEY);
    return raw ? JSON.parse(raw) : [];
  },

  enqueueVisit: async (visit: OfflineQueuedVisit): Promise<void> => {
    const queue = await storageService.getQueuedVisits();
    queue.push(visit);
    await setItem(OFFLINE_VISITS_KEY, JSON.stringify(queue));
  },

  clearQueuedVisits: async (): Promise<void> => {
    await removeItem(OFFLINE_VISITS_KEY);
  },

  // Offline Orders
  getQueuedOrders: async (): Promise<OfflineQueuedOrder[]> => {
    const raw = await getItem(OFFLINE_ORDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  },

  enqueueOrder: async (order: OfflineQueuedOrder): Promise<void> => {
    const queue = await storageService.getQueuedOrders();
    queue.push(order);
    await setItem(OFFLINE_ORDERS_KEY, JSON.stringify(queue));
  },

  clearQueuedOrders: async (): Promise<void> => {
    await removeItem(OFFLINE_ORDERS_KEY);
  },

  // Cache Doctor/Chemist master records
  cacheDoctors: async (doctors: unknown[]): Promise<void> => {
    await setItem(CACHED_DOCTORS_KEY, JSON.stringify(doctors));
  },

  getCachedDoctors: async (): Promise<unknown[]> => {
    const raw = await getItem(CACHED_DOCTORS_KEY);
    return raw ? JSON.parse(raw) : [];
  },

  cacheChemists: async (chemists: unknown[]): Promise<void> => {
    await setItem(CACHED_CHEMISTS_KEY, JSON.stringify(chemists));
  },

  getCachedChemists: async (): Promise<unknown[]> => {
    const raw = await getItem(CACHED_CHEMISTS_KEY);
    return raw ? JSON.parse(raw) : [];
  },
};

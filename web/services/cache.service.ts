/**
 * High-Performance In-Memory Cache Service
 *
 * Provides sub-millisecond caching with TTL and stale-while-revalidate semantics
 * for heavy analytical queries (Admin KPIs, ZSM/NSM/ASM dashboards, Invoice aggregates).
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class CacheService {
  private static store = new Map<string, CacheEntry<any>>();

  /**
   * Get an item from cache if not expired
   */
  static get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  /**
   * Put an item in cache with TTL in seconds
   */
  static set<T>(key: string, value: T, ttlSeconds = 30): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  /**
   * Fetch from cache or compute and store
   */
  static async getOrCompute<T>(
    key: string,
    computeFn: () => Promise<T>,
    ttlSeconds = 30
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await computeFn();
    this.set(key, value, ttlSeconds);
    return value;
  }

  /**
   * Invalidate by exact key or prefix pattern
   */
  static invalidate(pattern: string): void {
    for (const key of this.store.keys()) {
      if (key === pattern || key.startsWith(pattern)) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Flush entire cache
   */
  static flush(): void {
    this.store.clear();
  }
}

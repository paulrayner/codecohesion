/**
 * Simple LRU cache using Map's insertion-order guarantee.
 *
 * On get: delete + re-insert to move key to most-recent position.
 * On eviction: delete the first key (oldest insertion).
 */
export class LRUCache<K, V> {
  private map = new Map<K, V>();
  private readonly maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.map.get(key);
    if (value === undefined) return undefined;

    // Move to most-recent position
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    // If key already exists, delete it first to refresh position
    if (this.map.has(key)) {
      this.map.delete(key);
    }

    // Evict oldest if at capacity
    if (this.map.size >= this.maxSize) {
      const oldestKey = this.map.keys().next().value;
      if (oldestKey !== undefined) {
        this.map.delete(oldestKey);
      }
    }

    this.map.set(key, value);
  }

  get size(): number {
    return this.map.size;
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  clear(): void {
    this.map.clear();
  }
}

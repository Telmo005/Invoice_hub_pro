export interface CacheStrategy<T> {
  get(key: string): Promise<T | null>;
  set(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

export class MemoryCacheStrategy<T> implements CacheStrategy<T> {
  private store = new Map<string, { value: T; expires: number }>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  async get(key: string): Promise<T | null> {
    const item = this.store.get(key);
    if (!item) return null;

    if (Date.now() > item.expires) {
      this.store.delete(key);
      return null;
    }

    return item.value;
  }

  async set(key: string, value: T, ttl: number = this.DEFAULT_TTL): Promise<void> {
    this.store.set(key, {
      value,
      expires: Date.now() + ttl
    });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}

export class RedisCacheStrategy<T> implements CacheStrategy<T> {
  // Implementação Redis para produção
  async get(key: string): Promise<T | null> {
    // Mock - implementar com ioredis ou similar
    return null;
  }

  async set(key: string, value: T, ttl?: number): Promise<void> {
    // Mock - implementar com ioredis
  }

  async delete(key: string): Promise<void> {
    // Mock
  }

  async clear(): Promise<void> {
    // Mock
  }
}
/** DI-токен key-value хранилища. */
export const KV_STORE = Symbol('KV_STORE');

/**
 * Минимальный KV-интерфейс. Реализация — `PostgresKvStore` (согласован между
 * подами). Используется для идемпотентности платежей и дедупа вебхуков.
 */
export interface KvStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  /** Атомарно записать, только если ключа нет. true = записали (захватили). */
  setIfAbsent(key: string, value: string, ttlSeconds: number): Promise<boolean>;
  del(key: string): Promise<void>;
}

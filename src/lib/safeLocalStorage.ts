const isBrowser = typeof window !== 'undefined';

class ServerStorage {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }
  setItem(key: string, value: string): void {
    this.store[key] = value;
  }
  removeItem(key: string): void {
    delete this.store[key];
  }
}

export const safeLocalStorage: Storage = isBrowser
  ? window.localStorage
  : new ServerStorage() as unknown as Storage; 
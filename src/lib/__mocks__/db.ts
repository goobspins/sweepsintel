import { vi } from 'vitest';

export const query = vi.fn();

export const transaction = vi.fn(async (handler: (tx: any) => Promise<any>) => {
  const txClient = { query: vi.fn() };
  return handler(txClient);
});

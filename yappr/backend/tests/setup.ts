import { beforeEach, vi } from 'vitest';
import { mockReset, type DeepMockProxy } from 'vitest-mock-extended';
import type { PrismaClient } from '../generated/prisma/index.js';

// vi.mock is hoisted, so the mock instance has to be created inside the factory
// and read back afterwards — referencing an outer const here hits a TDZ error.
vi.mock('../prisma.js', async () => {
  const { mockDeep } = await import('vitest-mock-extended');
  return { default: mockDeep<PrismaClient>() };
});

const prismaModule = await import('../prisma.js');
export const prismaMock = prismaModule.default as unknown as DeepMockProxy<PrismaClient>;

beforeEach(() => {
  mockReset(prismaMock);

  // $transaction takes either an array of operations or an interactive callback.
  (prismaMock.$transaction as any).mockImplementation((arg: any) =>
    typeof arg === 'function' ? arg(prismaMock) : Promise.all(arg)
  );
});

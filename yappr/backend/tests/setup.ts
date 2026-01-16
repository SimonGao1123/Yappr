import { vi } from 'vitest';

// Mock connection for transactions
const mockConnection = {
  execute: vi.fn(),
  query: vi.fn(),
  beginTransaction: vi.fn(),
  commit: vi.fn(),
  rollback: vi.fn(),
  release: vi.fn(),
};

// Mock the database module
vi.mock('../database.js', () => ({
  default: {
    execute: vi.fn(),
    query: vi.fn(),
    getConnection: vi.fn(() => Promise.resolve(mockConnection)),
  }
}));

export { mockConnection };
// Mock session
export const mockSession = {
  userId: undefined as number | undefined,
  username: undefined as string | undefined,
  destroy: vi.fn((cb) => cb()),
};

export const resetMocks = () => {
  mockSession.userId = undefined;
  mockSession.username = undefined;
  vi.clearAllMocks();
};

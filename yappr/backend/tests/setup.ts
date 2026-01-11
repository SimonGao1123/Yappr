import { vi } from 'vitest';

// Mock the database module
vi.mock('../database.js', () => ({
  default: {
    execute: vi.fn(),
    query: vi.fn(),
  }
}));
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

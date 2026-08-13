/**
 * Global Jest setup for server tests
 * Initializes mocks, test database, and utilities
 */

import jwt from 'jsonwebtoken';

// Test constants
export const TEST_SECRET = process.env.JWT_SECRET || 'test-secret-key';
export const TEST_PROJECT_ID = 'test-proj-' + Date.now();
export const TEST_USER_ID = 'test-user-' + Date.now();

// Generate test JWT token
export const generateTestToken = (overrides?: Partial<any>) => {
  const payload = {
    id: TEST_USER_ID,
    uid: TEST_USER_ID,
    role: 'user',
    email: 'test@example.com',
    ...overrides,
  };
  return jwt.sign(payload, TEST_SECRET, { expiresIn: '24h' });
};

// Create authorization header
export const createAuthHeader = (token?: string) => ({
  Authorization: `Bearer ${token || generateTestToken()}`,
});

// Mock response wrapper for testing
export const createMockResponse = () => {
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis(),
    statusCode: 200,
    headers: {},
  };
  return res;
};

// Mock request wrapper for testing
export const createMockRequest = (overrides?: any) => {
  return {
    method: 'GET',
    url: '/',
    headers: { authorization: `Bearer ${generateTestToken()}` },
    body: {},
    params: {},
    query: {},
    ...overrides,
  };
};

// Database mock helper
export const mockDatabaseConnection = () => ({
  query: jest.fn().mockResolvedValue({ rows: [] }),
  release: jest.fn(),
  end: jest.fn(),
});

export const mockDatabasePool = () => ({
  getConnection: jest.fn().mockResolvedValue(mockDatabaseConnection()),
  end: jest.fn(),
  query: jest.fn().mockResolvedValue({ rows: [] }),
});

// Socket.IO mock helper
export const mockSocket = () => ({
  on: jest.fn(),
  emit: jest.fn(),
  off: jest.fn(),
  join: jest.fn(),
  leave: jest.fn(),
  disconnect: jest.fn(),
});

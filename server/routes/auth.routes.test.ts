/**
 * Auth Routes Test Suite
 * Tests authentication endpoints (register, login, verify-token, logout)
 */

jest.mock('../helpers/hash');
jest.mock('../../src/lib/db', () => ({
  __esModule: true,
  default: {
    getConnection: jest.fn(),
  },
}));

import request from 'supertest';
import express, { Express } from 'express';
import { hashPassword, verifyPassword } from '../helpers/hash';
import mysqlPool from '../../src/lib/db';
import authRoutes from './auth.routes';
import { generateTestToken, TEST_SECRET, TEST_USER_ID } from '../test/setup';

describe('Auth Routes', () => {
  let app: Express;
  let mockConnection: any;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);

    mockConnection = {
      query: jest.fn(),
      release: jest.fn(),
      end: jest.fn(),
    };

    (mysqlPool.getConnection as jest.Mock).mockResolvedValue(mockConnection);
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should register new user successfully with valid credentials', async () => {
      const userData = {
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'SecurePass123!',
      };

      mockConnection.query
        .mockResolvedValueOnce({ rows: [] }) // Check email exists
        .mockResolvedValueOnce({ rows: [] }) // Check username exists
        .mockResolvedValueOnce({ rows: [{ id: 'new-user-id' }] }); // Insert user

      const response = await request(app).post('/api/auth/register').send(userData);

      expect(response.status).toBe(201);
      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('token');
      expect(mockConnection.query).toHaveBeenCalledTimes(3);
    });

    it('should reject registration with duplicate email', async () => {
      const userData = {
        username: 'newuser',
        email: 'existing@example.com',
        password: 'SecurePass123!',
      };

      mockConnection.query.mockResolvedValueOnce({
        rows: [{ id: 'existing-user-id' }],
      });

      const response = await request(app).post('/api/auth/register').send(userData);

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toMatch(/email/i);
    });

    it('should reject password shorter than 8 characters', async () => {
      const userData = {
        username: 'newuser',
        email: 'test@example.com',
        password: 'short123', // 8 chars exactly
      };

      const response = await request(app).post('/api/auth/register').send(userData);

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/password/i);
    });

    it('should hash password before storing', async () => {
      const userData = {
        username: 'newuser',
        email: 'test@example.com',
        password: 'SecurePass123!',
      };

      mockConnection.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'new-user-id' }] });

      (hashPassword as jest.Mock).mockReturnValue('hashed_password');

      await request(app).post('/api/auth/register').send(userData);

      expect(hashPassword).toHaveBeenCalledWith(userData.password);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login user with correct email and password', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
      };

      const storedUser = {
        id: 'user-123',
        email: userData.email,
        password_hash: 'hashed_password',
        role: 'user',
      };

      mockConnection.query.mockResolvedValueOnce({ rows: [storedUser] });
      (verifyPassword as jest.Mock).mockResolvedValueOnce(true);

      const response = await request(app).post('/api/auth/login').send(userData);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('token');
    });

    it('should reject login with non-existent email', async () => {
      const userData = {
        email: 'nonexistent@example.com',
        password: 'SecurePass123!',
      };

      mockConnection.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).post('/api/auth/login').send(userData);

      expect(response.status).toBe(401);
      expect(response.body.status).toBe('error');
    });

    it('should reject login with incorrect password', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'WrongPassword123!',
      };

      const storedUser = {
        id: 'user-123',
        email: userData.email,
        password_hash: 'hashed_password',
      };

      mockConnection.query.mockResolvedValueOnce({ rows: [storedUser] });
      (verifyPassword as jest.Mock).mockResolvedValueOnce(false);

      const response = await request(app).post('/api/auth/login').send(userData);

      expect(response.status).toBe(401);
      expect(response.body.message).toMatch(/incorrect|password/i);
    });
  });

  describe('GET /api/auth/verify-token', () => {
    it('should verify valid JWT token', async () => {
      const token = generateTestToken();

      const response = await request(app)
        .get('/api/auth/verify-token')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('userId');
    });

    it('should reject invalid JWT token', async () => {
      const response = await request(app)
        .get('/api/auth/verify-token')
        .set('Authorization', 'Bearer invalid.token.here');

      expect(response.status).toBe(401);
      expect(response.body.status).toBe('error');
    });

    it('should reject request without authorization header', async () => {
      const response = await request(app).get('/api/auth/verify-token');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout user successfully', async () => {
      const token = generateTestToken();

      mockConnection.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
    });
  });
});

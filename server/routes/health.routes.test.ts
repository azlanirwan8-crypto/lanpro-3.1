/**
 * Health Routes Test Suite
 * Tests application health check endpoints
 */

import request from 'supertest';
import express, { Express } from 'express';
import healthRoutes from './health.routes';

describe('Health Routes', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use('/api/health', healthRoutes);
  });

  describe('GET /api/health', () => {
    it('should return healthy status', async () => {
      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
    });

    it('should return timestamp', async () => {
      const response = await request(app).get('/api/health');

      expect(response.body).toHaveProperty('timestamp');
      expect(typeof response.body.timestamp).toBe('number');
    });

    it('should include version information', async () => {
      const response = await request(app).get('/api/health');

      expect(response.body).toHaveProperty('version');
    });
  });

  describe('GET /api/health/ready', () => {
    it('should return readiness status', async () => {
      const response = await request(app).get('/api/health/ready');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('ready');
    });
  });

  describe('GET /api/health/live', () => {
    it('should return liveness status', async () => {
      const response = await request(app).get('/api/health/live');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('alive');
    });
  });
});

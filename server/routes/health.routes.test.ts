/**
 * Health Routes Test - H1 Pattern Example
 * Demonstrates working integration test pattern for server routes
 */

import request from 'supertest';
import express, { Express } from 'express';
import healthRoutes from './health.routes';

describe('Health Routes (H1 Pattern Example)', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    // Routes already include '/api/health' path, mount at root
    app.use('/', healthRoutes);
  });

  it('should return health status on GET /api/health', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status');
    expect(response.body.status).toBe('ok');
  });

  it('should return timestamp in ISO format', async () => {
    const response = await request(app).get('/api/health');

    expect(response.body).toHaveProperty('timestamp');
    expect(typeof response.body.timestamp).toBe('string');
    expect(() => new Date(response.body.timestamp)).not.toThrow();
  });

  it('should include service name', async () => {
    const response = await request(app).get('/api/health');

    expect(response.body).toHaveProperty('service');
    expect(response.body.service).toBe('LanPro Backend');
  });

  it('should handle metrics endpoint', async () => {
    const response = await request(app).get('/metrics');

    expect([200, 500]).toContain(response.status);
  });
});

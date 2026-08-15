/**
 * Common test helpers for server route testing
 */

import request from "supertest";
import { Express } from "express";
import { generateTestToken } from "./setup";

/**
 * Make authenticated API request to test server
 */
export const apiRequest = (app: Express) => {
  return {
    get: (url: string, token?: string) =>
      request(app)
        .get(url)
        .set("Authorization", `Bearer ${token || generateTestToken()}`),

    post: (url: string, data?: any, token?: string) =>
      request(app)
        .post(url)
        .set("Authorization", `Bearer ${token || generateTestToken()}`)
        .send(data),

    put: (url: string, data?: any, token?: string) =>
      request(app)
        .put(url)
        .set("Authorization", `Bearer ${token || generateTestToken()}`)
        .send(data),

    patch: (url: string, data?: any, token?: string) =>
      request(app)
        .patch(url)
        .set("Authorization", `Bearer ${token || generateTestToken()}`)
        .send(data),

    delete: (url: string, token?: string) =>
      request(app)
        .delete(url)
        .set("Authorization", `Bearer ${token || generateTestToken()}`),
  };
};

/**
 * Assert API response structure and status
 */
export const expectApiResponse = (response: any, expectedStatus: number, hasData = true) => {
  expect(response.status).toBe(expectedStatus);
  expect(response.body).toBeDefined();

  if (expectedStatus >= 200 && expectedStatus < 300) {
    expect(response.body.status).toBe("success");
    if (hasData) {
      expect(response.body.data).toBeDefined();
    }
  } else {
    expect(response.body.status).toBe("error");
    expect(response.body.message).toBeDefined();
  }
};

/**
 * Assert database was called with specific query
 */
export const expectQueryCalled = (mockConnection: any, queryPattern: RegExp | string) => {
  const calls = mockConnection.query.mock.calls;
  const found = calls.some(([query]: [string]) => {
    if (typeof queryPattern === "string") {
      return query.includes(queryPattern);
    }
    return queryPattern.test(query);
  });
  expect(found).toBe(true);
};

/**
 * Create mock database with query result
 */
export const mockDatabaseResult = (data: any, count = 1) => ({
  query: jest.fn().mockResolvedValue({
    rows: Array.isArray(data) ? data : [data],
    rowCount: count,
  }),
  release: jest.fn(),
  end: jest.fn(),
});

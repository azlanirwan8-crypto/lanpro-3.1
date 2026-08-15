/**
 * Auth Middleware Test - H1 Pattern Example
 * Demonstrates middleware testing pattern with async/database mocking
 */

jest.mock("../../src/lib/db", () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

import { authenticateJWT } from "./auth";
import { createMockRequest, createMockResponse } from "../test/setup";
import db from "../../src/lib/db";

describe("Auth Middleware (H1 Pattern Example)", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = "test-secret-key-for-jwt-testing";
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 401 when no authorization header", () => {
    const req = createMockRequest({ headers: {} });
    const res = createMockResponse();
    const next = jest.fn();

    authenticateJWT(req as any, res as any, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("should return 401 when token invalid", () => {
    const req = createMockRequest({
      headers: { authorization: "Bearer invalid.token.here" },
    });
    const res = createMockResponse();
    const next = jest.fn();

    authenticateJWT(req as any, res as any, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

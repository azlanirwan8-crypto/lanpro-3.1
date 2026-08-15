# Phase 14 Testing Patterns & Guidelines

> **Purpose**: Establish reusable test patterns for Phase 15 refactoring (god-file splitting)

---

## H2: Test Pattern Standards

### 1. Server Route Tests

**Location**: `server/routes/*.routes.test.ts`

**Structure**:
```typescript
// Mock external dependencies first
jest.mock('../helpers/hash');
jest.mock('../../src/lib/db');

import request from 'supertest';
import express from 'express';
import { generateTestToken } from '../test/setup';

describe('Route Name', () => {
  let app: Express;
  let mockConnection: any;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/endpoint', routes);
    
    mockConnection = {
      query: jest.fn(),
      release: jest.fn(),
    };
    
    jest.clearAllMocks();
  });

  describe('HTTP Method /endpoint', () => {
    it('should return 200 on success', async () => {
      mockConnection.query.mockResolvedValueOnce({ rows: [{ id: '1' }] });

      const response = await request(app)
        .get('/api/endpoint')
        .set('Authorization', `Bearer ${generateTestToken()}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
    });

    it('should return 401 when unauthorized', async () => {
      const response = await request(app).get('/api/endpoint');
      expect(response.status).toBe(401);
    });
  });
});
```

**Checklist**:
- ✅ Mock all database/external calls
- ✅ Test success path (200/201/204)
- ✅ Test error paths (400/401/404/500)
- ✅ Verify database queries called correctly
- ✅ Test authentication/authorization

---

### 2. Service/Controller Tests

**Location**: `server/services/*.test.ts` or `server/controllers/*.test.ts`

**Structure**:
```typescript
import { ServiceClass } from './service';

describe('ServiceClass', () => {
  let service: ServiceClass;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      query: jest.fn(),
      release: jest.fn(),
    };
    
    service = new ServiceClass(mockDb);
  });

  describe('methodName()', () => {
    it('should return expected data', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: '1' }] });

      const result = await service.methodName('input');

      expect(result).toEqual({ id: '1' });
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        expect.any(Array)
      );
    });

    it('should throw on database error', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('DB Error'));

      await expect(service.methodName('input')).rejects.toThrow('DB Error');
    });
  });
});
```

**Checklist**:
- ✅ Inject dependencies via constructor
- ✅ Test business logic only (not DB layer)
- ✅ Verify correct DB queries called
- ✅ Test error handling
- ✅ Test edge cases

---

### 3. Middleware Tests

**Location**: `server/middleware/*.test.ts`

**Structure**:
```typescript
import { authMiddleware } from './auth';
import { createMockRequest, createMockResponse } from '../test/setup';

describe('authMiddleware', () => {
  it('should attach user to request when token valid', () => {
    const req = createMockRequest({
      headers: { authorization: `Bearer ${generateTestToken()}` },
    });
    const res = createMockResponse();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(req.user).toBeDefined();
    expect(next).toHaveBeenCalled();
  });

  it('should return 401 when token missing', () => {
    const req = createMockRequest({ headers: {} });
    const res = createMockResponse();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
```

**Checklist**:
- ✅ Test middleware chain (next callback)
- ✅ Test valid/invalid inputs
- ✅ Test error responses
- ✅ Use mock request/response helpers

---

### 4. Hook/Custom Hook Tests (React)

**Location**: `src/hooks/*.test.ts` or `src/hooks/*.test.tsx`

**Structure**:
```typescript
import { renderHook, act } from '@testing-library/react';
import { useCustomHook } from './useCustomHook';

describe('useCustomHook', () => {
  it('should initialize with default state', () => {
    const { result } = renderHook(() => useCustomHook());

    expect(result.current.state).toBe('default');
  });

  it('should update state on action', () => {
    const { result } = renderHook(() => useCustomHook());

    act(() => {
      result.current.setState('new-value');
    });

    expect(result.current.state).toBe('new-value');
  });

  it('should call API on mount', async () => {
    const { result } = await act(async () => {
      return renderHook(() => useCustomHook());
    });

    expect(result.current.data).toBeDefined();
  });
});
```

**Checklist**:
- ✅ Test initial state
- ✅ Test state updates
- ✅ Test side effects
- ✅ Wrap state changes with `act()`
- ✅ Mock API calls

---

### 5. Component Tests (React)

**Location**: `src/components/*.test.tsx` or `src/features/*/*.test.tsx`

**Structure**:
```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('should render with required props', () => {
    render(<MyComponent title="Test" onSubmit={jest.fn()} />);

    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('should call onSubmit when button clicked', async () => {
    const onSubmit = jest.fn();
    const user = userEvent.setup();
    
    render(<MyComponent onSubmit={onSubmit} />);
    await user.click(screen.getByRole('button', { name: /submit/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('should display error message on validation failure', () => {
    render(<MyComponent shouldError={true} />);

    expect(screen.getByText(/error/i)).toBeInTheDocument();
  });
});
```

**Checklist**:
- ✅ Test rendering with various props
- ✅ Test user interactions
- ✅ Test conditional rendering
- ✅ Avoid testing implementation details
- ✅ Mock child components if needed

---

## Test Coverage Targets

| Layer | Target Coverage | Priority |
|-------|-----------------|----------|
| Server Routes | 80%+ | **HIGH** |
| Services | 75%+ | **HIGH** |
| Middleware | 85%+ | **HIGH** |
| Database Layer | 70%+ | **MEDIUM** |
| React Hooks | 80%+ | **MEDIUM** |
| React Components | 65%+ | **MEDIUM** |

---

## Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific suite
npm test -- auth.routes.test.ts

# Run in watch mode
npm test -- --watch

# Update snapshots (if used)
npm test -- --updateSnapshot
```

---

## Common Mocking Patterns

### Mock Database

```typescript
const mockConnection = {
  query: jest.fn().mockResolvedValue({ rows: [{ id: '1' }] }),
  release: jest.fn(),
};

(mysqlPool.getConnection as jest.Mock).mockResolvedValue(mockConnection);
```

### Mock JWT

```typescript
jest.mock('jsonwebtoken');

(jwt.sign as jest.Mock).mockReturnValue('test-token');
(jwt.verify as jest.Mock).mockReturnValue({ id: 'user-123' });
```

### Mock API Call

```typescript
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ data: 'mock' }),
});
```

---

## H3: Coverage Baseline Goals

- **Server routes**: 50% → 80% (Phase 15: +30%)
- **Services**: 10% → 75% (Phase 15: +65%)
- **Middleware**: 25% → 85% (Phase 15: +60%)
- **Overall**: 7.19% → 50% (Phase 14 H3 target)

After Phase 15 refactoring with new module structure, target **80% overall**.

---

## Next: Phase 14.3 (H3)

Execute test suites to achieve H3 coverage targets after Phase 14.1 & H2 completion.

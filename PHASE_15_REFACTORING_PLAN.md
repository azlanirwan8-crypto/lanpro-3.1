# Phase 15.1 (A1): Server.ts Refactoring Plan

## Current State Analysis

**server.ts: 4,819 lines**
- Lines 1-141: Imports & app initialization
- Lines 142-4817: `startServer()` function (massive god-function)
- Contains 98+ route handlers inline (NOT in separate route files)

**Route Files Status:**
| File | Lines | Status | Routes |
|------|-------|--------|--------|
| project.routes.ts | 41,518 | ✅ Modularized | /api/projects, /api/project-modules |
| task.routes.ts | 86,135 | ✅ Modularized | /api/projects/:id/tasks, /api/tasks |
| auth.routes.ts | 20,431 | ✅ Modularized | /api/auth/* |
| user.routes.ts | 20,049 | ✅ Modularized | /api/users, /api/users/:id |
| file.routes.ts | 4,863 | ✅ Modularized | /api/files |
| system.routes.ts | 3,097 | ✅ Modularized | /api/system/* |
| audit.routes.ts | 1,399 | ✅ Modularized | /api/audit/* |
| health.routes.ts | 488 | ✅ Modularized | /api/health, /metrics |
| **TOTAL** | **177,980** | Modularized | |

**Embedded in server.ts (still need extraction):**
- /api/audit-logs (line 429) - audit log queries
- /api/download-brd (line 755) - document downloads
- /api/test-db, /api/db-query, /api/db-schema, /api/migrate-db (lines 773+) - DB admin
- /api/whatsapp/simulate (line 887) - WhatsApp testing
- /api/master-data (lines 898-999) - CRUD for master data
- /api/projects/:projectId/sprints (lines 1043+) - Sprint management
- /api/projects/:projectId/qa-test-suites (lines 1142+) - QA test suites
- /api/v1/qa/* (lines 1161+) - QA endpoints v1
- /api/projects/:projectId/qa-test-cases (lines 1421+) - QA test cases
- /api/v1/meetings/* (lines 2337+) - Meeting management v1
- /api/projects/:projectId/meetings/* (lines 2564+) - Meeting management

**Embedded Helper Functions (should be extracted to middleware/services):**
- `generateContentWithFallback()` (Gemini AI with fallback) - lines 48-140+
- `getJwtSecret()` - lines 311-316 (DUPLICATE in server/middleware/auth.ts)
- `generateToken()` - lines 318-324 (DUPLICATE in server/middleware/auth.ts)
- `verifyGlobalAdmin()` - lines 326-332 (DUPLICATE in server/middleware/auth.ts)
- `authenticateJWT()` - lines 334-384 (DUPLICATE in server/middleware/auth.ts)
- `sendAlert()` - lines 4732-4749 (Slack notifications)

**Socket.IO handlers:** Embedded in various route handlers

---

## Refactoring Plan: 3-Phase Approach

### Phase 15.1a: Extract Duplicated Middleware

**Goal:** Remove middleware duplicates, use shared version from server/middleware/auth.ts

| Duplicate | Location | Action |
|-----------|----------|--------|
| authenticateJWT | server.ts:334 + middleware/auth.ts | Remove server.ts version, import from middleware |
| verifyGlobalAdmin | server.ts:326 + middleware/auth.ts | Remove server.ts version, import from middleware |
| getJwtSecret | server.ts:311 + middleware/auth.ts | Remove server.ts version, import from middleware |
| generateToken | server.ts:318 + middleware/auth.ts | Remove server.ts version, import from middleware |

---

### Phase 15.1b: Extract Embedded Routes to Separate Files

Create new route files:

| Feature | Endpoint | New File | Lines |
|---------|----------|----------|-------|
| Audit Logs | /api/audit-logs | audit-logs.routes.ts | 50 |
| DB Admin | /api/db-*, /api/system/db-* | db-admin.routes.ts | 100 |
| Master Data | /api/master-data | master-data.routes.ts | 150 |
| Sprints | /api/projects/:id/sprints | Merge into project.routes.ts | Existing? |
| QA | /api/projects/:id/qa-* | qa.routes.ts | 400 |
| Meetings | /api/v1/meetings, /api/projects/:id/meetings | meetings.routes.ts | 600 |
| Documents | /api/projects/:id/documents | documents.routes.ts | 150 |
| Milestones | /api/projects/:id/milestones | milestones.routes.ts | 150 |
| WhatsApp | /api/whatsapp/* | whatsapp.routes.ts | 50 |

---

### Phase 15.1c: Extract Services & Helpers

Create service layer for complex business logic:

| Service | Purpose | Functions |
|---------|---------|-----------|
| GeminiService | AI/LLM operations | generateContentWithFallback(), callGemini() |
| AlertService | Notifications | sendAlert() (Slack, Email, etc.) |
| MeetingService | Meeting logic | Extracted from meetings.routes.ts |
| QAService | QA logic | Extracted from qa.routes.ts |

---

## Execution Steps

### Step 1: Identify & Import Shared Middleware
- [ ] Verify middleware/auth.ts exports all needed functions
- [ ] Update server.ts imports to use middleware/auth.ts
- [ ] Remove duplicate function definitions from server.ts

### Step 2: Extract Routes by Feature

**Priority Order (largest impact first):**

1. **Meetings** (600+ lines) → meetings.routes.ts
   - /api/v1/meetings/*
   - /api/projects/:id/meetings/*
   - Socket.IO meeting handlers

2. **QA** (400+ lines) → qa.routes.ts
   - /api/projects/:id/qa-test-suites
   - /api/projects/:id/qa-test-cases
   - /api/v1/qa/*

3. **Master Data** (150 lines) → master-data.routes.ts
   - /api/master-data (all CRUD)

4. **DB Admin** (100 lines) → db-admin.routes.ts
   - /api/db-query
   - /api/db-schema
   - /api/system/db-*
   - /api/test-db

5. **Audit Logs** (50 lines) → audit-logs.routes.ts
   - /api/audit-logs

6. **Documents** (150 lines) → documents.routes.ts
   - /api/projects/:id/documents

7. **Sprints** (Check if in project.routes.ts already)
   - /api/projects/:id/sprints

8. **Milestones** (150 lines) → milestones.routes.ts
   - /api/projects/:id/milestones

9. **WhatsApp** (50 lines) → whatsapp.routes.ts
   - /api/whatsapp/*

### Step 3: Extract Services

- [ ] Create GeminiService for AI operations
- [ ] Create AlertService for notifications
- [ ] Extract meeting/QA logic into services
- [ ] Create test suites for services

### Step 4: Bootstrap Cleanup

Reduce server.ts to:
- Imports
- Express app initialization
- Middleware mounting
- Route mounting
- Socket.IO setup
- Server startup

**Target: server.ts < 800 lines**

---

## Testing Strategy

### Unit Tests
- Test each extracted service independently
- Test middleware with mocks

### Integration Tests
- Test routes still work when mounted from separate files
- Test middleware chain
- Test Socket.IO integration

### Run Tests After Each Step
```bash
npm test -- --coverage
```

Target: Maintain 28+ passing tests, increase coverage

---

## Rollback Plan

If issues arise:
1. All changes committed to git (easy revert)
2. Test suite validates each step
3. If a route fails, only that extraction is reverted

---

## Success Criteria

✅ **Phase 15.1a (Middleware Deduplication)**
- Remove duplicate functions from server.ts
- All tests pass
- No functional change

✅ **Phase 15.1b (Route Extraction)**
- All 98+ routes moved to separate files
- All routes mounted via app.use()
- All tests pass
- server.ts < 1500 lines

✅ **Phase 15.1c (Service Extraction)**
- Complex business logic in services
- Services have unit tests
- All tests pass
- server.ts < 800 lines

---

## Files to be Created/Modified

**New Route Files:**
- server/routes/audit-logs.routes.ts
- server/routes/db-admin.routes.ts
- server/routes/master-data.routes.ts
- server/routes/qa.routes.ts
- server/routes/meetings.routes.ts
- server/routes/documents.routes.ts
- server/routes/milestones.routes.ts
- server/routes/whatsapp.routes.ts

**New Service Files:**
- server/services/gemini.service.ts
- server/services/alert.service.ts

**Modified Files:**
- server.ts (reduce to ~800 lines)
- server/middleware/auth.ts (ensure exports)
- jest.config.cjs (add new test patterns)

**New Test Files:**
- server/routes/*.routes.test.ts (for each extracted route)
- server/services/*.service.test.ts (for each service)

---

**Next: Execute Phase 15.1a (Step 1)**

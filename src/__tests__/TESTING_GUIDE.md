# Test Documentation

This directory contains all test files for the attendance application, organized into unit, db, integration, and websocket test groups.

## Test Logging System

**Test failure logs are automatically written to `__tests__/utils/test-failures.log`** in this directory.

- The logger captures detailed information using `testLog()` calls throughout tests
- Logs are **only written to the file when a test fails**
- Each failure includes: test name, timestamp, and all captured log data
- The log file is cleared at the start of each test run
- The log file is gitignored and not committed to the repository

**Usage in tests:**
```typescript
testLog('Creating user', { email: userEmail, role: TEACHER_ROLE });
testLog('Response received', { statusCode: response.status });
```

**View failures after running tests:**
```bash
cat src/__tests__/utils/test-failures.log
```

## Test Structure

### Unit Tests
- **jwt.test.ts** - JWT token generation and verification
- **middleware.test.ts** - Authentication and role-based middleware
- **schemas.test.ts** - Request/Response schema validation (Signup, Login, Class, SuccessResponse, ErrorResponse)


### DB Tests
- **db.test.ts** - Database connection and operations
- **db-models.test.ts** - Database model schemas (User, Class, Attendance validation)
- **dbservice.test.ts** - DBService methods (CRUD operations, getAllStudents, addStudentToClass, etc.)


### Integration Tests
- **auth.integration.test.ts** - Full authentication flow (signup, login, profile retrieval)
- **class.integration.test.ts** - Class API endpoints (create, add student, get class details)
- **students.integration.test.ts** - Students API endpoint (get all students with role-based access)

### WebSocket Tests
- **attendance.integration.test.ts** - Attendance API integration tests (start session, get my attendance, validation)
- **websocket.unit.test.ts** - WebSocketManager unit tests (session management, state queries, error handling)

---

## Running Tests

### Run All Tests
```bash
pnpm test
```
Executes all tests (unit, db, and integration) at once using Vitest.

### Run All Tests Sequentially
```bash
pnpm test-all
```
Executes unit tests first, then db tests, then integration tests, then websocket tests (suite-by-suite with internal test suite parallelism determined in config).

### Run Unit Tests Only
```bash
pnpm test:unit
```
Runs all unit tests in parallel:
- JWT functionality
- Middleware validation
- Schema validation

### Run DB Tests Only
```bash
pnpm test:db
```
Runs all database tests in sequence to avoid conflicts:
- Database connection
- Database models
- Database service methods

### Run Integration Tests Only
```bash
pnpm test:integration
```
Runs full authentication and class API flow tests with a real database connection.

### Run WebSocket Tests Only
```bash
pnpm test:websocket
```
Runs attendance API integration and WebSocketManager unit tests sequentially:
- Attendance API endpoint tests
- WebSocket session management tests

### Run Attendance Tests Only
```bash
pnpm test:attendance
```
Runs just the attendance API integration tests (start session, get my attendance, validation).

### Watch Mode (All Tests)
```bash
pnpm test:watch
```
Automatically reruns tests on file changes.

### Generate Coverage Report
```bash
pnpm test:coverage
```
Generates test coverage metrics for statements, branches, functions, and lines.

### Run Specific Test File
```bash
pnpm test-file db-models
```
Runs a specific test file from the tests folder. Just provide the file name without `.test.ts` extension.

### Run Tests Matching Pattern
```bash
pnpm test-find "login"
```
Runs all tests with names matching the pattern (e.g., tests with "login" in their name).

---

## Test Execution Strategy

| Command | Scope | Execution Mode | Use Case |
|---------|-------|----------------|----------|
| `pnpm test` | All tests | Parallel (all projects) | Quick test execution |
| `pnpm test-all` | All tests | Sequential (unit → db → integration → websocket) | Full validation before deployment |
| `pnpm test:unit` | Unit only | Parallel | Fast development feedback |
| `pnpm test:db` | Database only | Sequential | Database layer validation |
| `pnpm test:integration` | Integration only | Sequential | API endpoint validation |
| `pnpm test:websocket` | WebSocket only | Sequential | Attendance API and WebSocket functionality |
| `pnpm test:watch` | All tests | Watch mode | Continuous development |
| `pnpm test:coverage` | All tests | Coverage report | Code coverage metrics |
| `pnpm test-file <name>` | Single file | Isolated | Test specific file (e.g., `db-models`) |
| `pnpm test-find "<pattern>"` | Pattern match | Filtered | Test names containing pattern |

---

## Vitest Configuration

Tests are configured in `vitest.config.ts` with the following setup:

- **Globals**: `true` - No need to import `describe`, `it`, `expect`
- **Environment**: `node` - Tests run in Node.js environment
- **Watch**: `false` - Tests run once by default
- **fileParallelism**: `true` - Multiple test files run in parallel (tests within a file run sequentially)
- **Projects**: Four separate projects for modular execution
  - `unit`: JWT, middleware, schema validation tests (files run in parallel)
  - `db`: Database connection, models, and service tests (files run sequentially to avoid conflicts)
  - `integration`: Authentication and class API endpoint tests (files run sequentially)
  - `websocket`: Attendance API and WebSocket tests (files run sequentially)

---

## Test Dependencies

- **vitest** - Test framework
- **@vitest/coverage-v8** - Code coverage reporting
- **supertest** - HTTP assertion library for API testing
- **mongoose** - Database operations
- **bcrypt** - Password hashing
- **jsonwebtoken** - JWT utilities

---

## Example Test Runs

### Develop with Watch Mode [Hot Reload]
```bash
pnpm test:watch
```

### Validate Before Commit
```bash
pnpm test-all && pnpm test:coverage
```Debug Specific Test File
```bash
pnpm test-file middleware  ## runs middleware.test.ts only
```

### Find and Run Related Tests
```bash
pnpm test-find "should create"  ## runs all tests containing "should create"
```bash
pnpm test-find "login"  ## runs tests with "login" in their name
```

---

## Notes

- Unit tests use mocks and isolated environments
- Integration tests require a running MongoDB connection
- Tests are designed to run sequentially to prevent database conflicts
- Coverage reports are generated in the console (default)

# Test Documentation

This directory contains all test files for the attendance application, organized into unit and integration test groups.

## Test Structure

### Unit Tests
- **jwt.test.ts** - JWT token generation and verification
- **middleware.test.ts** - Authentication and role-based middleware
- **db.test.ts** - Database connection and operations

### Integration Tests
- **auth.integration.test.ts** - Full authentication flow (signup, login, profile retrieval)

---

## Running Tests

### Run All Tests
```bash
pnpm test
```
Executes unit tests first, then integration tests sequentially.

### Run Unit Tests Only
```bash
pnpm test:unit
```
Runs all unit tests in parallel:
- JWT functionality
- Middleware validation
- Database operations

### Run Integration Tests Only
```bash
pnpm test:integration
```
Runs full authentication flow tests with a real database connection.

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

---

## Test Execution Strategy

| Command | Scope | Execution Mode | Use Case |
|---------|-------|----------------|----------|
| `pnpm test` | All tests | Sequential (unit → integration) | Full validation before deployment |
| `pnpm test:unit` | Unit only | Parallel | Fast development feedback |
| `pnpm test:integration` | Integration only | Sequential | API endpoint validation |
| `pnpm test:watch` | All tests | Watch mode | Continuous development |
| `pnpm test:coverage` | All tests | Coverage report | Code coverage metrics |

---

## Vitest Configuration

Tests are configured in `vitest.config.ts` with the following setup:

- **Globals**: `true` - No need to import `describe`, `it`, `expect`
- **Environment**: `node` - Tests run in Node.js environment
- **Watch**: `false` - Tests run once by default
- **fileParallelism**: `true` - Multiple test files run in parallel (tests within a file run sequentially)
- **Projects**: Two separate projects for modular execution
  - `unit`: JWT, middleware, database tests (files run in parallel)
  - `integration`: API endpoint tests (single file, runs sequentially)

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

### Develop with Watch Mode
```bash
pnpm test:watch
```

### Validate Before Commit
```bash
pnpm test && pnpm test:coverage
```

### Run Specific Test File
```bash
vitest src/__tests__/jwt.test.ts
```

### Run Tests Matching Pattern
```bash
vitest -t "login"
```

---

## Notes

- Unit tests use mocks and isolated environments
- Integration tests require a running MongoDB connection
- Tests are designed to run sequentially to prevent database conflicts
- Coverage reports are generated in the console (default)

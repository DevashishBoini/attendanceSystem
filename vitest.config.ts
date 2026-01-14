import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    watch: false,
    testTimeout: 15000, // 15 seconds - increased for slow servers and WebSocket tests
    projects: [
      {
        test: {
          name: 'unit',
          include: [
            'src/__tests__/jwt.test.ts',
            'src/__tests__/middleware.test.ts',
            'src/__tests__/schemas.test.ts',
          ],
          // fileParallelism: true, //true by default, all files run in parallel, tests in a file run sequentially
        },
      },
            {
        test: {
          name: 'db',
          include: [
            'src/__tests__/db.test.ts',
            'src/__tests__/db-models.test.ts',
            'src/__tests__/db-service.test.ts',
          ],
          fileParallelism: false, //disable parallelism for db tests
        },
      },
      {
        test: {
          name: 'integration',
          include: [
            'src/__tests__/auth.integration.test.ts',
            'src/__tests__/class.integration.test.ts',
            'src/__tests__/students.integration.test.ts',
          ],
          fileParallelism: false, // Prevent parallel execution for integration tests to avoid database conflicts
        },
      },
      {
        test: {
          name: 'websocket',
          include: [
            'src/__tests__/websocket.unit.test.ts',
            'src/__tests__/websocket.integration.test.ts',
            'src/__tests__/attendance.integration.test.ts',
          ],
          fileParallelism: false, // Prevent parallel execution for websocket tests to avoid port conflicts
          testTimeout: 20000, // 20 seconds - longer timeout for slow servers and WebSocket operations
        },
      },
    ],
  },
});

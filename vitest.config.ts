import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    watch: false,
    projects: [
      {
        test: {
          name: 'unit',
          include: [
            'src/__tests__/jwt.test.ts',
            'src/__tests__/middleware.test.ts',
            'src/__tests__/db.test.ts',
          ],
          // fileParallelism: true, //true by default, all files run in parallel, tests in a file run sequentially
        },
      },
      {
        test: {
          name: 'integration',
          include: ['src/__tests__/auth.integration.test.ts'],
        },
      },
    ],
  },
});

import { defineConfig } from 'vitest/config';

/** תצורה נפרדת לבדיקות חוקי האבטחה, שדורשות את האמולטור של Firestore. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['rules-tests/**/*.test.ts'],
    testTimeout: 20_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});

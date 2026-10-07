import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // כתובת הבסיס של האתר. ב-GitHub Pages האתר יושב תחת /שם-ה-repository/,
  // ולכן ה-workflow מגדיר VITE_BASE_PATH. בהרצה מקומית וב-Firebase Hosting זה "/".
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});

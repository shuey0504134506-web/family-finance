import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  // כתובת הבסיס של האתר. ב-GitHub Pages האתר יושב תחת /שם-ה-repository/,
  // ולכן ה-workflow מגדיר VITE_BASE_PATH. בהרצה מקומית וב-Firebase Hosting זה "/".
  base: process.env.VITE_BASE_PATH ?? '/',
  // jsx-runtime של האפליקציה עוטף את זה של React ומתרגם טקסט לאנגלית כשהשפה אנגלית (ראו src/i18n).
  plugins: [react({ jsxImportSource: 'ff-i18n' })],
  resolve: {
    alias: { 'ff-i18n': fileURLToPath(new URL('./src/i18n', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  // כתובת הבסיס של האתר. ב-GitHub Pages האתר יושב תחת /שם-ה-repository/,
  // ולכן ה-workflow מגדיר VITE_BASE_PATH. בהרצה מקומית וב-Firebase Hosting זה "/".
  base: process.env.VITE_BASE_PATH ?? '/',
  // jsx-runtime של האפליקציה עוטף את זה של React ומתרגם טקסט לאנגלית כשהשפה אנגלית (ראו src/i18n).
  plugins: [
    react({ jsxImportSource: 'ff-i18n' }),
    // עבודה בלי אינטרנט: service worker שמטמין את קבצי האפליקציה, כך שהיא נפתחת גם בלי רשת.
    // הנתונים עצמם נשמרים ב-Firestore (מטמון מקומי מתמיד), לא כאן. באפליקציית האנדרואיד הקבצים כבר בתוך ה-APK.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      manifest: false, // יש manifest ב-public
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2,jpg,png,webmanifest}'],
        globIgnores: ['help/**', 'install-android.html'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // תמונות העזרה: נטענות בפעם הראשונה שנפתחות, ואז זמינות גם בלי רשת
            urlPattern: ({ url }) => url.pathname.includes('/help/'),
            handler: 'CacheFirst',
            options: { cacheName: 'help-assets', expiration: { maxEntries: 120 } },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { 'ff-i18n': fileURLToPath(new URL('./src/i18n', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});

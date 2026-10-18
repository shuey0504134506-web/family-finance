import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';

/**
 * הרנדרר של התוכנה משתמש בקוד האפליקציה (../src) כמות שהוא, בקריאה בלבד.
 * שום קובץ באפליקציה לא משתנה: ההפניות ל-Firebase מוחלפות כאן בלבד, בזמן הבנייה.
 */
const here = (p: string): string => path.resolve(__dirname, p);
const appSrc = here('../src');

function redirectConfig(): Plugin {
  return {
    name: 'desktop-redirect-firebase-config',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!importer || !/firebase\/config$/.test(source)) return null;
      const r = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (r && r.id.replace(/\\/g, '/').startsWith(appSrc.replace(/\\/g, '/'))) return here('src/shims/config.ts');
      return null;
    },
  };
}

/** גרסת הטלפון (VITE_TARGET=phone): נבנית ל-dist-phone, ונארזת באפליקציית האנדרואיד תחת /offline/. */
const phone = process.env.VITE_TARGET === 'phone';

function phoneEntry(): Plugin {
  return {
    name: 'phone-entry-name',
    enforce: 'post',
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const html = bundle['index.phone.html'];
        if (html) html.fileName = 'index.html';
      },
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [redirectConfig(), ...(phone ? [phoneEntry()] : []), react({ jsxImportSource: 'ff-i18n' })],
  publicDir: here('../public'),
  resolve: {
    alias: [
      { find: 'ff-i18n', replacement: here('../src/i18n') },
      { find: /^firebase\/firestore$/, replacement: here('src/shims/firestore.ts') },
      { find: /^firebase\/auth$/, replacement: here('src/shims/auth.ts') },
      { find: /^firebase\/app$/, replacement: here('src/shims/app.ts') },
      { find: /^firebase\/functions$/, replacement: here('src/shims/functions.ts') },
      { find: /^firebase-real\/(.*)$/, replacement: here('../node_modules/firebase/$1') },
    ],
    dedupe: ['react', 'react-dom', 'react-router-dom'],
  },
  server: { fs: { allow: [here('..')] } },
  build: {
    outDir: phone ? 'dist-phone' : 'dist',
    emptyOutDir: true,
    target: phone ? 'es2020' : 'chrome120',
    sourcemap: false,
    ...(phone ? { rollupOptions: { input: here('index.phone.html') } } : {}),
  },
});

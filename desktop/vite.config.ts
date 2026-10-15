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

/** במסך הבית של התוכנה מושכים יותר פעולות אחרונות (3 באפליקציה); ההתאמה לגובה הכרטיס הסמוך נעשית ב-DesktopShell. הקוד המקורי לא משתנה. */
function moreRecent(): Plugin {
  return {
    name: 'desktop-more-recent',
    enforce: 'pre',
    transform(code, id) {
      if (!id.replace(/\\/g, '/').endsWith('/src/features/home/HomeScreen.tsx')) return null;
      const out = code.replace('.slice(0, 3);\n  }, [isBusiness, business.all, household.all', '.slice(0, 12);\n  }, [isBusiness, business.all, household.all');
      if (out === code) throw new Error('desktop-more-recent: הקטע ב-HomeScreen השתנה, יש לעדכן את התוסף');
      return out;
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [redirectConfig(), moreRecent(), react({ jsxImportSource: 'ff-i18n' })],
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
  build: { outDir: 'dist', emptyOutDir: true, target: 'chrome120', sourcemap: false },
});

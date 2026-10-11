import { mergeConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import base from '../../vite.config';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/** בנייה מיוחדת לצילום מסכי ההדגמה: אותה אפליקציה, עם Firebase מדומה בזיכרון. */
export default mergeConfig(base, {
  root: here('../..'),
  resolve: {
    alias: {
      'firebase/app': here('./fake-app.ts'),
      'firebase/auth': here('./fake-auth.ts'),
      'firebase/firestore': here('./fake-firestore.ts'),
    },
  },
  build: { rollupOptions: { input: here('./index.html') } },
});

// בונה את תהליך ה-main וה-preload ל-CommonJS. esbuild מגיע מ-Vite (תלות של הפרויקט הראשי או של desktop).
import { build } from 'esbuild';

const common = { bundle: true, platform: 'node', format: 'cjs', target: 'node20', external: ['electron'], sourcemap: false, logLevel: 'info' };
await build({ ...common, entryPoints: ['electron/main.ts'], outfile: 'dist-electron/main.cjs' });
await build({ ...common, entryPoints: ['electron/preload.ts'], outfile: 'dist-electron/preload.cjs' });

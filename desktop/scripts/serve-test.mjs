// שרת סטטי קטן לבדיקות בדפדפן: node scripts/serve-test.mjs <dir> <port>
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const [dir = 'dist', port = '4180'] = process.argv.slice(2);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json', '.webmanifest': 'application/json' };
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x').pathname;
  const file = path.join(path.resolve(dir), url === '/' ? 'index.html' : url);
  try { const body = await readFile(file); res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' }); res.end(body); } catch { res.writeHead(404); res.end('nf'); }
}).listen(Number(port), '127.0.0.1');

// Minimal static server that mimics GitHub Pages: serves a folder under a URL prefix, directory index.html, and 404.html for misses.
import http from 'http';
import fs from 'fs';
import path from 'path';

const [dir, prefix = '', port = '4322'] = process.argv.slice(2);
const root = path.resolve(dir);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.ico': 'image/x-icon', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml' };

http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const send = (file, status = 200) => {
    res.writeHead(status, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  };
  if (prefix && !p.startsWith(prefix)) return send(path.join(root, '404.html'), 404);
  let rel = p.slice(prefix.length).replace(/^\/+/, '');
  let f = path.join(root, rel);
  if (!f.startsWith(root)) return send(path.join(root, '404.html'), 404);
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) {
    if (!p.endsWith('/')) { res.writeHead(301, { Location: p + '/' }); return res.end(); }
    f = path.join(f, 'index.html');
  }
  if (fs.existsSync(f)) return send(f);
  send(path.join(root, '404.html'), 404);
}).listen(Number(port), () => console.log(`serving ${root} at http://localhost:${port}${prefix}/`));

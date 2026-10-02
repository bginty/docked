import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const root = process.cwd();
const port = Number(process.env.PORT || 4173);
const host = '127.0.0.1';
const types = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

http.createServer((request, response) => {
  const requestUrl = new URL(request.url || '/', `http://${host}:${port}`);
  const pathname = requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname;
  const decoded = decodeURIComponent(pathname);
  const absolute = path.resolve(root, `.${decoded}`);
  const relative = path.relative(root, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  fs.readFile(absolute, (error, body) => {
    if (error) {
      fs.readFile(path.join(root, '404.html'), (notFoundError, notFoundBody) => {
        response.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end(notFoundError ? 'Not found' : notFoundBody);
      });
      return;
    }
    response.writeHead(200, { 'Content-Type': types[path.extname(absolute).toLowerCase()] || 'application/octet-stream' });
    response.end(body);
  });
}).listen(port, host, () => {
  console.log(`Docked static QA server: http://${host}:${port}`);
});

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const [, , targetDirArg = 'public', portArg = '4173'] = process.argv;
const rootDir = process.cwd();
const servedDir = path.resolve(rootDir, targetDirArg);
const port = Number(portArg);

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.ico', 'image/x-icon'],
  ['.svg', 'image/svg+xml'],
  ['.mp4', 'video/mp4'],
  ['.xml', 'application/xml; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8']
]);

function sendFile(response, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes.get(extension) ?? 'application/octet-stream';
  response.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(response);
}

function resolvePath(urlPath) {
  const normalized = decodeURIComponent(urlPath.split('?')[0]);
  const relativePath = normalized === '/' ? '/index.html' : normalized;
  const absolutePath = path.resolve(servedDir, `.${relativePath}`);

  if (!absolutePath.startsWith(servedDir)) {
    return null;
  }

  if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
    return absolutePath;
  }

  if (relativePath === '/landing.html') {
    const landingPath = path.join(servedDir, 'landing.html');
    if (fs.existsSync(landingPath)) {
      return landingPath;
    }
  }

  const fallbackPath = path.join(servedDir, 'index.html');
  return fs.existsSync(fallbackPath) ? fallbackPath : null;
}

const server = http.createServer((request, response) => {
  const filePath = resolvePath(request.url ?? '/');

  if (!filePath) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  sendFile(response, filePath);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Serving ${path.relative(rootDir, servedDir)} at http://127.0.0.1:${port}`);
});

import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const servedDir = path.resolve(rootDir, process.argv[2] || "public");
const port = Number(process.argv[3] || 4172);

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".mp4", "video/mp4"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".xml", "application/xml; charset=utf-8"]
]);

function resolveContentType(filePath) {
  const ext = path.extname(filePath);
  if (contentTypes.has(ext)) {
    return contentTypes.get(ext);
  }

  const fileName = path.basename(filePath);
  if (fileName.startsWith("photo-")) {
    return "image/jpeg";
  }

  return "application/octet-stream";
}

function resolveRequestPath(url) {
  const pathname = decodeURIComponent(new URL(url, "http://localhost").pathname);
  const cleanPath = pathname === "/" ? "/index.html" : pathname;
  const candidate = path.resolve(servedDir, `.${cleanPath}`);

  if (!candidate.startsWith(servedDir)) {
    return null;
  }

  return candidate;
}

createServer(async (request, response) => {
  const filePath = resolveRequestPath(request.url || "/");
  const fallbackPath = path.join(servedDir, "index.html");
  const targetPath = filePath && existsSync(filePath) ? filePath : fallbackPath;

  try {
    const fileStat = await stat(targetPath);
    if (!fileStat.isFile()) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Length": fileStat.size,
      "Content-Type": resolveContentType(targetPath)
    });
    createReadStream(targetPath).pipe(response);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
}).listen(port, () => {
  console.log(`Serving ${path.relative(rootDir, servedDir)} at http://127.0.0.1:${port}`);
});

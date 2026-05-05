import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const publicDir = path.join(rootDir, 'public');
const distDir = path.join(rootDir, 'dist');

function copyDirectory(sourceDir, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });

  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath);
      continue;
    }

    fs.copyFileSync(sourcePath, targetPath);
  }
}

fs.rmSync(distDir, { recursive: true, force: true });
copyDirectory(publicDir, distDir);

const distIndex = path.join(distDir, 'index.html');
const distLanding = path.join(distDir, 'landing.html');

if (!fs.existsSync(distLanding) && fs.existsSync(distIndex)) {
  fs.copyFileSync(distIndex, distLanding);
}

console.log(`Built static page: ${path.relative(rootDir, distDir)}`);

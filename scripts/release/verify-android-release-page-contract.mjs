import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const workflowPath = path.join(repoRoot, '.github', 'workflows', 'android-release.yml');
const pagePath = path.join(repoRoot, 'page', 'public', 'index.html');
const zhDocPath = path.join(repoRoot, 'docs', 'release', 'android.md');
const enDocPath = path.join(repoRoot, 'docs', 'release', 'android.en.md');

const latestAssetName = 'media-clean-android-latest.apk';
const canonicalDownloadUrl = `https://github.com/jiangtao/media-clean/releases/latest/download/${latestAssetName}`;

function read(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`文件不存在: ${path.relative(repoRoot, filePath)}`);
  }

  return fs.readFileSync(filePath, 'utf8');
}

function expectIncludes(haystack, needle, filePath) {
  if (!haystack.includes(needle)) {
    throw new Error(`${path.relative(repoRoot, filePath)} 缺少必需内容: ${needle}`);
  }
}

function main() {
  const workflow = read(workflowPath);
  const page = read(pagePath);
  const zhDoc = read(zhDocPath);
  const enDoc = read(enDocPath);

  expectIncludes(workflow, 'workflow_dispatch:', workflowPath);
  expectIncludes(workflow, latestAssetName, workflowPath);
  expectIncludes(workflow, 'softprops/action-gh-release@v2', workflowPath);
  expectIncludes(workflow, 'make_latest: true', workflowPath);

  expectIncludes(page, canonicalDownloadUrl, pagePath);
  expectIncludes(zhDoc, canonicalDownloadUrl, zhDocPath);
  expectIncludes(enDoc, canonicalDownloadUrl, enDocPath);

  console.log(
    JSON.stringify(
      {
        ok: true,
        canonicalDownloadUrl,
        latestAssetName,
        checkedFiles: [
          path.relative(repoRoot, workflowPath),
          path.relative(repoRoot, pagePath),
          path.relative(repoRoot, zhDocPath),
          path.relative(repoRoot, enDocPath)
        ]
      },
      null,
      2
    )
  );
}

main();

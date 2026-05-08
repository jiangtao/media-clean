import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const workflowPath = path.join(repoRoot, '.github', 'workflows', 'android-release.yml');
const pageWorkflowPath = path.join(repoRoot, '.github', 'workflows', 'page-vercel.yml');
const pagePath = path.join(repoRoot, 'page', 'public', 'index.html');
const zhDocPath = path.join(repoRoot, 'docs', 'release', 'android.md');
const enDocPath = path.join(repoRoot, 'docs', 'release', 'android.en.md');
const vercelDocPath = path.join(repoRoot, 'docs', 'release', 'vercel.md');
const vercelEnDocPath = path.join(repoRoot, 'docs', 'release', 'vercel.en.md');

const githubLatestAssetName = 'media-clean-android-latest.apk';
const pageLatestAssetName = 'android-latest.apk';
const canonicalDownloadUrl = `https://mc.jerret.me/download/${pageLatestAssetName}`;
const githubBackupDownloadUrl = `https://github.com/jiangtao/media-clean/releases/latest/download/${githubLatestAssetName}`;
const preparePageDownloadScript = 'scripts/release/prepare-page-android-download.mjs';

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
  const pageWorkflow = read(pageWorkflowPath);
  const page = read(pagePath);
  const zhDoc = read(zhDocPath);
  const enDoc = read(enDocPath);
  const vercelDoc = read(vercelDocPath);
  const vercelEnDoc = read(vercelEnDocPath);

  expectIncludes(workflow, 'workflow_dispatch:', workflowPath);
  expectIncludes(workflow, githubLatestAssetName, workflowPath);
  expectIncludes(workflow, preparePageDownloadScript, workflowPath);
  expectIncludes(workflow, canonicalDownloadUrl, workflowPath);
  expectIncludes(workflow, 'vercel deploy --prebuilt --prod', workflowPath);
  expectIncludes(workflow, 'softprops/action-gh-release@v2', workflowPath);
  expectIncludes(workflow, 'make_latest: true', workflowPath);

  expectIncludes(pageWorkflow, preparePageDownloadScript, pageWorkflowPath);
  expectIncludes(pageWorkflow, githubBackupDownloadUrl, pageWorkflowPath);
  expectIncludes(pageWorkflow, canonicalDownloadUrl, pageWorkflowPath);
  expectIncludes(pageWorkflow, 'vercel deploy --prebuilt --prod', pageWorkflowPath);

  expectIncludes(page, canonicalDownloadUrl, pagePath);
  expectIncludes(zhDoc, canonicalDownloadUrl, zhDocPath);
  expectIncludes(enDoc, canonicalDownloadUrl, enDocPath);
  expectIncludes(vercelDoc, canonicalDownloadUrl, vercelDocPath);
  expectIncludes(vercelEnDoc, canonicalDownloadUrl, vercelEnDocPath);

  console.log(
    JSON.stringify(
      {
        ok: true,
        canonicalDownloadUrl,
        githubBackupDownloadUrl,
        githubLatestAssetName,
        pageLatestAssetName,
        checkedFiles: [
          path.relative(repoRoot, workflowPath),
          path.relative(repoRoot, pageWorkflowPath),
          path.relative(repoRoot, pagePath),
          path.relative(repoRoot, zhDocPath),
          path.relative(repoRoot, enDocPath),
          path.relative(repoRoot, vercelDocPath),
          path.relative(repoRoot, vercelEnDocPath)
        ]
      },
      null,
      2
    )
  );
}

main();

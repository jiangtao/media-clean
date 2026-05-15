import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const workflowPath = path.join(repoRoot, '.github', 'workflows', 'android-release.yml');
const pageWorkflowPath = path.join(repoRoot, '.github', 'workflows', 'page-vercel.yml');
const pagePath = path.join(repoRoot, 'page', 'public', 'index.html');
const packageJsonPath = path.join(repoRoot, 'package.json');
const zhDocPath = path.join(repoRoot, 'docs', 'release', 'android.md');
const enDocPath = path.join(repoRoot, 'docs', 'release', 'android.en.md');
const vercelDocPath = path.join(repoRoot, 'docs', 'release', 'vercel.md');
const vercelEnDocPath = path.join(repoRoot, 'docs', 'release', 'vercel.en.md');
const sizeZhDocPath = path.join(repoRoot, 'docs', 'release', 'android-apk-size.md');
const sizeEnDocPath = path.join(repoRoot, 'docs', 'release', 'android-apk-size.en.md');
const sizeGovernanceReportZhPath = path.join(
  repoRoot,
  'docs',
  'release',
  'android-apk-size-governance-report.md'
);
const sizeGovernanceReportEnPath = path.join(
  repoRoot,
  'docs',
  'release',
  'android-apk-size-governance-report.en.md'
);
const apkSizeAnalyzerPath = path.join(repoRoot, 'scripts', 'android', 'analyze-apk-size.mjs');
const apkSizeComparatorPath = path.join(repoRoot, 'scripts', 'android', 'compare-apk-size-reports.mjs');
const buildReleaseApkPath = path.join(repoRoot, 'scripts', 'android', 'build-release-apk.sh');
const buildValidationApkPath = path.join(repoRoot, 'scripts', 'android', 'build-validation-apk.sh');
const dependencyFootprintAnalyzerPath = path.join(
  repoRoot,
  'scripts',
  'android',
  'analyze-dependency-footprint.mjs'
);
const apkSizePrecommitPath = path.join(repoRoot, 'scripts', 'android', 'verify-apk-size-precommit.mjs');
const gitPrecommitPath = path.join(repoRoot, '.githooks', 'pre-commit');

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

function expectExcludes(haystack, needle, filePath) {
  if (haystack.includes(needle)) {
    throw new Error(`${path.relative(repoRoot, filePath)} 不应包含公开签名报告内容: ${needle}`);
  }
}

function expectWorkflowInputDefault(workflow, inputName, expectedDefault) {
  const inputPattern = new RegExp(
    `${inputName}:\\n(?:[ \\t]+[^\\n]+\\n)*?[ \\t]+default: ${expectedDefault}\\n`,
    'm'
  );

  if (!inputPattern.test(workflow)) {
    throw new Error(
      `${path.relative(repoRoot, workflowPath)} 的 ${inputName} 默认值必须是 ${expectedDefault}`
    );
  }
}

function main() {
  const workflow = read(workflowPath);
  const pageWorkflow = read(pageWorkflowPath);
  const page = read(pagePath);
  const packageJson = read(packageJsonPath);
  const zhDoc = read(zhDocPath);
  const enDoc = read(enDocPath);
  const vercelDoc = read(vercelDocPath);
  const vercelEnDoc = read(vercelEnDocPath);
  const sizeZhDoc = read(sizeZhDocPath);
  const sizeEnDoc = read(sizeEnDocPath);
  const sizeGovernanceReportZh = read(sizeGovernanceReportZhPath);
  const sizeGovernanceReportEn = read(sizeGovernanceReportEnPath);
  const apkSizeAnalyzer = read(apkSizeAnalyzerPath);
  const apkSizeComparator = read(apkSizeComparatorPath);
  const buildReleaseApkScript = read(buildReleaseApkPath);
  const buildValidationApkScript = read(buildValidationApkPath);
  const dependencyFootprintAnalyzer = read(dependencyFootprintAnalyzerPath);
  const apkSizePrecommit = read(apkSizePrecommitPath);
  const gitPrecommit = read(gitPrecommitPath);

  expectIncludes(workflow, 'workflow_dispatch:', workflowPath);
  expectIncludes(workflow, githubLatestAssetName, workflowPath);
  expectIncludes(workflow, preparePageDownloadScript, workflowPath);
  expectIncludes(workflow, canonicalDownloadUrl, workflowPath);
  expectIncludes(workflow, 'vercel deploy --prebuilt --prod', workflowPath);
  expectIncludes(workflow, 'softprops/action-gh-release@v2', workflowPath);
  expectIncludes(workflow, 'make_latest: true', workflowPath);
  expectIncludes(workflow, 'ANDROID_RELEASE_ARCHITECTURES', workflowPath);
  expectIncludes(workflow, 'armeabi-v7a,arm64-v8a', workflowPath);
  expectIncludes(workflow, 'release_architectures', workflowPath);
  expectIncludes(workflow, 'enable_minify', workflowPath);
  expectIncludes(workflow, 'enable_resource_shrink', workflowPath);
  expectIncludes(workflow, 'enable_legacy_packaging', workflowPath);
  expectIncludes(workflow, '包体积优化专项验证后默认开启', workflowPath);
  expectIncludes(workflow, 'ANDROID_USE_LEGACY_PACKAGING', workflowPath);
  expectWorkflowInputDefault(workflow, 'enable_minify', true);
  expectWorkflowInputDefault(workflow, 'enable_resource_shrink', true);
  expectWorkflowInputDefault(workflow, 'enable_legacy_packaging', true);
  expectIncludes(workflow, 'scripts/android/analyze-apk-size.mjs', workflowPath);
  expectIncludes(workflow, '--fail-on-budget', workflowPath);
  expectIncludes(workflow, 'apk-size-report.md', workflowPath);
  expectIncludes(workflow, 'apk-size-report.json', workflowPath);
  expectIncludes(workflow, 'artifacts/android-release/app-release.signing.txt', workflowPath);
  expectExcludes(workflow, 'versioned_signing', workflowPath);
  expectExcludes(workflow, 'media-clean-android-v*.signing.txt', workflowPath);

  expectIncludes(pageWorkflow, preparePageDownloadScript, pageWorkflowPath);
  expectIncludes(pageWorkflow, githubBackupDownloadUrl, pageWorkflowPath);
  expectIncludes(pageWorkflow, canonicalDownloadUrl, pageWorkflowPath);
  expectIncludes(pageWorkflow, 'vercel deploy --prebuilt --prod', pageWorkflowPath);

  expectIncludes(page, canonicalDownloadUrl, pagePath);
  expectIncludes(zhDoc, canonicalDownloadUrl, zhDocPath);
  expectIncludes(enDoc, canonicalDownloadUrl, enDocPath);
  expectIncludes(
    zhDoc,
    '验签报告仅作为 CI artifact 保存，用于排查签名链路；不作为公开 GitHub Release asset 上传。',
    zhDocPath
  );
  expectIncludes(
    enDoc,
    'The signing report is retained only as a CI artifact for signing-chain diagnostics; it is not uploaded as a public GitHub Release asset.',
    enDocPath
  );
  expectIncludes(vercelDoc, canonicalDownloadUrl, vercelDocPath);
  expectIncludes(vercelEnDoc, canonicalDownloadUrl, vercelEnDocPath);
  expectIncludes(zhDoc, 'android-apk-size.md', zhDocPath);
  expectIncludes(enDoc, 'android-apk-size.en.md', enDocPath);
  expectIncludes(sizeZhDoc, 'arm64-v8a', sizeZhDocPath);
  expectIncludes(sizeZhDoc, 'x86', sizeZhDocPath);
  expectIncludes(sizeEnDoc, 'arm64-v8a', sizeEnDocPath);
  expectIncludes(sizeEnDoc, 'x86', sizeEnDocPath);
  expectIncludes(sizeZhDoc, 'android-apk-size-governance-report.md', sizeZhDocPath);
  expectIncludes(sizeEnDoc, 'android-apk-size-governance-report.en.md', sizeEnDocPath);
  expectIncludes(sizeGovernanceReportZh, 'Stage 1', sizeGovernanceReportZhPath);
  expectIncludes(sizeGovernanceReportZh, '47.291 MiB', sizeGovernanceReportZhPath);
  expectIncludes(sizeGovernanceReportZh, '35.558 MiB', sizeGovernanceReportZhPath);
  expectIncludes(sizeGovernanceReportZh, '51.829 MiB', sizeGovernanceReportZhPath);
  expectIncludes(sizeGovernanceReportZh, '45.283 MiB', sizeGovernanceReportZhPath);
  expectIncludes(sizeGovernanceReportZh, '30.229 MiB', sizeGovernanceReportZhPath);
  expectIncludes(sizeGovernanceReportZh, '23.690 MiB', sizeGovernanceReportZhPath);
  expectIncludes(sizeGovernanceReportZh, '22.549 MiB', sizeGovernanceReportZhPath);
  expectIncludes(sizeGovernanceReportEn, 'Stage 1', sizeGovernanceReportEnPath);
  expectIncludes(sizeGovernanceReportEn, '47.291 MiB', sizeGovernanceReportEnPath);
  expectIncludes(sizeGovernanceReportEn, '35.558 MiB', sizeGovernanceReportEnPath);
  expectIncludes(sizeGovernanceReportEn, '51.829 MiB', sizeGovernanceReportEnPath);
  expectIncludes(sizeGovernanceReportEn, '45.283 MiB', sizeGovernanceReportEnPath);
  expectIncludes(sizeGovernanceReportEn, '30.229 MiB', sizeGovernanceReportEnPath);
  expectIncludes(sizeGovernanceReportEn, '23.690 MiB', sizeGovernanceReportEnPath);
  expectIncludes(sizeGovernanceReportEn, '22.549 MiB', sizeGovernanceReportEnPath);
  expectIncludes(packageJson, 'verify:android:apk-size', packageJsonPath);
  expectIncludes(packageJson, 'verify:precommit', packageJsonPath);
  expectIncludes(packageJson, 'verify:precommit:android-size', packageJsonPath);
  expectIncludes(packageJson, 'analyze:android:deps', packageJsonPath);
  expectIncludes(packageJson, 'compare:android:apk-size', packageJsonPath);
  expectIncludes(packageJson, 'build:android:release:smoke:arm64', packageJsonPath);
  expectIncludes(packageJson, 'build:android:release:smoke:shrink', packageJsonPath);
  expectIncludes(packageJson, 'build:android:release:smoke:arm64-shrink', packageJsonPath);
  expectIncludes(packageJson, 'build:android:release:smoke:legacy', packageJsonPath);
  expectIncludes(packageJson, 'build:android:release:smoke:legacy-shrink', packageJsonPath);
  expectIncludes(packageJson, 'build:android:validation', packageJsonPath);
  expectIncludes(packageJson, 'build:android:validation:legacy-shrink', packageJsonPath);
  expectIncludes(buildReleaseApkScript, 'ANDROID_USE_LEGACY_PACKAGING', buildReleaseApkPath);
  expectIncludes(buildReleaseApkScript, '--enable-legacy-packaging', buildReleaseApkPath);
  expectIncludes(buildValidationApkScript, 'assembleValidation', buildValidationApkPath);
  expectIncludes(buildValidationApkScript, 'ANDROID_USE_LEGACY_PACKAGING', buildValidationApkPath);
  expectIncludes(buildValidationApkScript, 'android.validationApplicationIdSuffix', buildValidationApkPath);
  expectIncludes(apkSizeAnalyzer, 'user-arm-only', apkSizeAnalyzerPath);
  expectIncludes(apkSizeComparator, 'Delta vs baseline', apkSizeComparatorPath);
  expectIncludes(dependencyFootprintAnalyzer, 'ALLOWED_ZERO_IMPORT_DEPENDENCIES', dependencyFootprintAnalyzerPath);
  expectIncludes(apkSizePrecommit, 'APK_CRITICAL_PATTERNS', apkSizePrecommitPath);
  expectIncludes(apkSizePrecommit, 'SKIP_ANDROID_APK_SIZE_PRECOMMIT', apkSizePrecommitPath);
  expectIncludes(gitPrecommit, 'npm run verify:precommit', gitPrecommitPath);

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
          path.relative(repoRoot, packageJsonPath),
          path.relative(repoRoot, zhDocPath),
          path.relative(repoRoot, enDocPath),
          path.relative(repoRoot, vercelDocPath),
          path.relative(repoRoot, vercelEnDocPath),
          path.relative(repoRoot, sizeZhDocPath),
          path.relative(repoRoot, sizeEnDocPath),
          path.relative(repoRoot, sizeGovernanceReportZhPath),
          path.relative(repoRoot, sizeGovernanceReportEnPath),
          path.relative(repoRoot, apkSizeAnalyzerPath),
          path.relative(repoRoot, apkSizeComparatorPath),
          path.relative(repoRoot, buildReleaseApkPath),
          path.relative(repoRoot, buildValidationApkPath),
          path.relative(repoRoot, dependencyFootprintAnalyzerPath),
          path.relative(repoRoot, apkSizePrecommitPath),
          path.relative(repoRoot, gitPrecommitPath)
        ]
      },
      null,
      2
    )
  );
}

main();

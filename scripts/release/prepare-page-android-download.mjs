#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const targetPath = path.join(repoRoot, 'page', 'public', 'download', 'android-latest.apk');
const defaultApkPath = path.join(repoRoot, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
const defaultMaxBytes = 100 * 1024 * 1024;
const maxBytes = Number.parseInt(process.env.PAGE_ANDROID_APK_MAX_BYTES ?? `${defaultMaxBytes}`, 10);

function usage() {
  console.log(`用法:
  node scripts/release/prepare-page-android-download.mjs --apk <path>
  node scripts/release/prepare-page-android-download.mjs --from-url <url>

说明:
  --apk       从本地 APK 复制到 page/public/download/android-latest.apk
  --from-url  从远程 latest APK hydrate 到 page/public/download/android-latest.apk

环境变量:
  PAGE_ANDROID_APK_MAX_BYTES  APK 最大字节数，默认 104857600
`);
}

function parseArgs(argv) {
  const args = {
    apkPath: defaultApkPath,
    fromUrl: ''
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    switch (arg) {
      case '--apk':
        args.apkPath = path.resolve(argv[index + 1] ?? '');
        args.fromUrl = '';
        index += 1;
        break;
      case '--from-url':
        args.fromUrl = argv[index + 1] ?? '';
        index += 1;
        break;
      case '-h':
      case '--help':
        usage();
        process.exit(0);
        break;
      default:
        throw new Error(`未知参数: ${arg}`);
    }
  }

  if (args.fromUrl && !/^https?:\/\//.test(args.fromUrl)) {
    throw new Error(`--from-url 必须是 http(s) URL: ${args.fromUrl}`);
  }

  return args;
}

function ensureApkSize(byteLength, sourceLabel) {
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) {
    throw new Error(`PAGE_ANDROID_APK_MAX_BYTES 非法: ${process.env.PAGE_ANDROID_APK_MAX_BYTES}`);
  }

  if (byteLength <= 0) {
    throw new Error(`APK 为空: ${sourceLabel}`);
  }

  if (byteLength > maxBytes) {
    throw new Error(
      `APK 超过 page 静态上传限制: ${sourceLabel} is ${byteLength} bytes, max is ${maxBytes} bytes`
    );
  }
}

function assertApkZipHeader(filePath) {
  const header = Buffer.alloc(4);
  const fd = fs.openSync(filePath, 'r');

  try {
    fs.readSync(fd, header, 0, header.length, 0);
  } finally {
    fs.closeSync(fd);
  }

  if (header[0] !== 0x50 || header[1] !== 0x4b) {
    throw new Error(`目标文件不像 APK/ZIP: ${path.relative(repoRoot, filePath)}`);
  }
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function copyLocalApk(apkPath) {
  if (!fs.existsSync(apkPath)) {
    throw new Error(`APK 文件不存在: ${path.relative(repoRoot, apkPath)}`);
  }

  if (path.extname(apkPath) !== '.apk') {
    throw new Error(`源文件不是 .apk: ${path.relative(repoRoot, apkPath)}`);
  }

  const stat = fs.statSync(apkPath);
  ensureApkSize(stat.size, path.relative(repoRoot, apkPath));

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(apkPath, targetPath);
}

async function hydrateRemoteApk(fromUrl) {
  const response = await fetch(fromUrl, {
    headers: {
      'User-Agent': 'media-clean-release-page-download'
    }
  });

  if (!response.ok) {
    throw new Error(`下载 APK 失败: ${fromUrl} -> HTTP ${response.status}`);
  }

  const contentLength = Number.parseInt(response.headers.get('content-length') ?? '0', 10);
  if (contentLength > 0) {
    ensureApkSize(contentLength, fromUrl);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  ensureApkSize(bytes.byteLength, fromUrl);

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, bytes);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.fromUrl) {
    await hydrateRemoteApk(args.fromUrl);
  } else {
    copyLocalApk(args.apkPath);
  }

  const stat = fs.statSync(targetPath);
  assertApkZipHeader(targetPath);

  console.log(
    JSON.stringify(
      {
        ok: true,
        target: path.relative(repoRoot, targetPath),
        bytes: stat.size,
        sha256: sha256File(targetPath),
        maxBytes
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

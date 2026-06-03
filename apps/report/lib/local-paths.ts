import fs from 'node:fs';
import path from 'node:path';

export function repoRoot() {
  return process.env.MC_REPO_ROOT ?? path.resolve(process.cwd(), '../..');
}

export function resolveInputPath(input: string) {
  if (path.isAbsolute(input)) {
    return path.normalize(input);
  }

  return path.resolve(/* turbopackIgnore: true */ repoRoot(), input);
}

export function inferCleanupPlanPath(sessionPath: string) {
  return path.join(/* turbopackIgnore: true */ path.dirname(sessionPath), 'cleanup-plan.json');
}

export function optionalExistingPath(input: string | null) {
  if (!input) return null;
  const resolved = resolveInputPath(input);
  return fs.existsSync(resolved) ? resolved : null;
}

export function fileUriToPath(uri: string) {
  if (!uri.startsWith('file://')) {
    throw new Error(`only file:// media URIs are supported, got ${uri}`);
  }

  const parsed = new URL(uri);
  return decodeURIComponent(parsed.pathname);
}

export function contentTypeForPath(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.png') return 'image/png';
  if (extension === '.webp') return 'image/webp';
  if (extension === '.gif') return 'image/gif';
  if (extension === '.mp4') return 'video/mp4';
  if (extension === '.mov') return 'video/quicktime';
  if (extension === '.m4v') return 'video/x-m4v';
  return 'application/octet-stream';
}

export function appleScriptString(value: string) {
  return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

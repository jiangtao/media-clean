import path from 'node:path';

import { repoRoot } from '@/lib/local-paths';

interface NativeScanDirectoryInput {
  root: string;
  sessionId: string;
  sessionPath: string;
  cleanupPlanPath: string;
  mediaType: string;
  progress?: boolean;
}

interface NativeScanDirectoryResult {
  mode: 'napi';
  sessionId: string;
  session: string;
  cleanupPlan: string;
  assetCount: number;
  clusterCount: number;
  cleanupPlanCount: number;
  diagnosticCount: number;
}

interface MediaCleanEngine {
  scanDirectory(input: NativeScanDirectoryInput): NativeScanDirectoryResult;
}

export function scanDirectoryWithNativeEngine(input: NativeScanDirectoryInput) {
  if (process.env.MC_REPORT_ENGINE === 'cli') return null;

  const engine = loadNativeEngine();
  if (!engine) return null;
  return engine.scanDirectory(input);
}

function loadNativeEngine(): MediaCleanEngine | null {
  try {
    const packagePath = path.join(repoRoot(), 'packages', 'media-clean-engine');
    return loadRuntimeRequire()(packagePath) as MediaCleanEngine;
  } catch (error) {
    if (process.env.MC_REPORT_ENGINE === 'napi') {
      throw error;
    }
    return null;
  }
}

function loadRuntimeRequire() {
  const moduleBuiltin = (process as typeof process & {
    getBuiltinModule?: (id: string) => unknown;
  }).getBuiltinModule?.('node:module') as
    | { createRequire: (filename: string) => NodeRequire }
    | undefined;
  if (!moduleBuiltin) {
    throw new Error('Native engine loading requires process.getBuiltinModule("node:module")');
  }
  return moduleBuiltin.createRequire(path.join(repoRoot(), 'package.json'));
}

import {
  clearPhotoScanSessionSnapshot,
  loadPhotoScanSessionSnapshot,
  savePhotoScanSessionSnapshot,
  type PhotoScanSessionSnapshot,
} from '../../services/storage/app-storage';

export type PhotoScanSessionRuntimeSnapshotSource = 'runtime' | 'startup';

let runtimeSnapshot: PhotoScanSessionSnapshot | null = null;
let runtimeSnapshotSource: PhotoScanSessionRuntimeSnapshotSource | null = null;

export function getPhotoScanSessionRuntimeSnapshot() {
  return runtimeSnapshot;
}

export function getPhotoScanSessionRuntimeSnapshotSource() {
  return runtimeSnapshotSource;
}

export function stagePhotoScanSessionRuntimeSnapshot(
  snapshot: PhotoScanSessionSnapshot | null,
) {
  runtimeSnapshot = snapshot;
  runtimeSnapshotSource = snapshot ? 'runtime' : null;
}

export function stageStartupPhotoScanSessionRuntimeSnapshot(
  snapshot: PhotoScanSessionSnapshot | null,
) {
  runtimeSnapshot = snapshot;
  runtimeSnapshotSource = snapshot ? 'startup' : null;
}

export async function hydratePhotoScanSessionRuntimeSnapshot() {
  if (runtimeSnapshot) {
    return runtimeSnapshot;
  }

  runtimeSnapshot = await loadPhotoScanSessionSnapshot();
  runtimeSnapshotSource = runtimeSnapshot ? 'runtime' : null;
  return runtimeSnapshot;
}

export async function persistPhotoScanSessionRuntimeSnapshot(
  snapshot: PhotoScanSessionSnapshot | null,
) {
  runtimeSnapshot = snapshot;
  runtimeSnapshotSource = snapshot ? 'runtime' : null;

  if (!snapshot) {
    await clearPhotoScanSessionSnapshot();
    return;
  }

  await savePhotoScanSessionSnapshot(snapshot);
}

export async function clearPhotoScanSessionRuntimeSnapshot() {
  runtimeSnapshot = null;
  runtimeSnapshotSource = null;
  await clearPhotoScanSessionSnapshot();
}

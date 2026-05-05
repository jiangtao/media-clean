import {
  clearPhotoScanSessionSnapshot,
  loadPhotoScanSessionSnapshot,
  savePhotoScanSessionSnapshot,
  type PhotoScanSessionSnapshot,
} from '../../services/storage/app-storage';

let runtimeSnapshot: PhotoScanSessionSnapshot | null = null;

export function getPhotoScanSessionRuntimeSnapshot() {
  return runtimeSnapshot;
}

export function stagePhotoScanSessionRuntimeSnapshot(
  snapshot: PhotoScanSessionSnapshot | null,
) {
  runtimeSnapshot = snapshot;
}

export async function hydratePhotoScanSessionRuntimeSnapshot() {
  if (runtimeSnapshot) {
    return runtimeSnapshot;
  }

  runtimeSnapshot = await loadPhotoScanSessionSnapshot();
  return runtimeSnapshot;
}

export async function persistPhotoScanSessionRuntimeSnapshot(
  snapshot: PhotoScanSessionSnapshot | null,
) {
  runtimeSnapshot = snapshot;

  if (!snapshot) {
    await clearPhotoScanSessionSnapshot();
    return;
  }

  await savePhotoScanSessionSnapshot(snapshot);
}

export async function clearPhotoScanSessionRuntimeSnapshot() {
  runtimeSnapshot = null;
  await clearPhotoScanSessionSnapshot();
}

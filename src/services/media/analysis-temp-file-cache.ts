import * as FileSystem from 'expo-file-system/legacy';

const GENERATED_ANALYSIS_CACHE_DIR_NAMES = [
  'ImageManipulator',
  'VideoThumbnails',
] as const;

function joinFileUri(baseUri: string, name: string) {
  return `${baseUri.endsWith('/') ? baseUri : `${baseUri}/`}${name}`;
}

function getGeneratedAnalysisCacheUris() {
  if (!FileSystem.cacheDirectory) {
    return [];
  }

  return GENERATED_ANALYSIS_CACHE_DIR_NAMES.map((name) =>
    joinFileUri(FileSystem.cacheDirectory!, name),
  );
}

async function getDirectorySizeBytes(uri: string): Promise<number> {
  const info = await FileSystem.getInfoAsync(uri).catch(() => null);
  if (!info?.exists) {
    return 0;
  }

  if (!info.isDirectory) {
    return info.size;
  }

  const children = await FileSystem.readDirectoryAsync(uri).catch(() => []);
  const childSizes = await Promise.all(
    children.map((child) => getDirectorySizeBytes(joinFileUri(uri, child))),
  );

  return childSizes.reduce((total, size) => total + size, 0);
}

export async function loadGeneratedAnalysisFileCacheSizeBytes() {
  const sizes = await Promise.all(
    getGeneratedAnalysisCacheUris().map((uri) => getDirectorySizeBytes(uri)),
  );

  return sizes.reduce((total, size) => total + size, 0);
}

export async function clearGeneratedAnalysisFileCache() {
  await Promise.all(
    getGeneratedAnalysisCacheUris().map((uri) =>
      FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined),
    ),
  );
}

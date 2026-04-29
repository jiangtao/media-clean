import { NativeModules, Platform } from 'react-native';

export type AndroidMediaStoreMediaType = 'photo' | 'video';

export interface AndroidMediaStoreAssetMetadata {
  assetId: string;
  contentUri: string;
  mediaType: AndroidMediaStoreMediaType;
  width: number;
  height: number;
  durationMs: number;
  fileSizeBytes: number;
  dateTaken: number | null;
  dateModified: number | null;
  bucketId: string | null;
  bucketName: string | null;
  mimeType: string | null;
  isScreenshot: boolean;
  bitrate: number | null;
  frameRate: number | null;
  codec: string | null;
  orientation: number | null;
  aspectRatio: number | null;
}

export interface EnumerateAndroidMediaStoreOptions {
  createdAfter?: number | null;
  createdBefore?: number | null;
  mediaTypes?: readonly AndroidMediaStoreMediaType[];
  limit?: number | null;
}

interface AndroidMediaStoreEnumeratorModule {
  isSupported?: () => Promise<boolean> | boolean;
  enumerate?: (
    options: EnumerateAndroidMediaStoreOptions & {
      mediaTypes: readonly AndroidMediaStoreMediaType[];
    },
  ) =>
    | Promise<AndroidMediaStoreAssetMetadata[]>
    | AndroidMediaStoreAssetMetadata[];
}

const DEFAULT_MEDIA_TYPES: readonly AndroidMediaStoreMediaType[] = ['photo', 'video'];

function getAndroidMediaStoreEnumeratorModule() {
  return (NativeModules.AndroidMediaStoreEnumerator as AndroidMediaStoreEnumeratorModule | undefined) ?? null;
}

function normalizeNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function normalizeMediaType(value: unknown): AndroidMediaStoreMediaType {
  return value === 'video' ? 'video' : 'photo';
}

function normalizeAssetMetadata(asset: Partial<AndroidMediaStoreAssetMetadata>): AndroidMediaStoreAssetMetadata {
  return {
    assetId: typeof asset.assetId === 'string' ? asset.assetId : '',
    contentUri: typeof asset.contentUri === 'string' ? asset.contentUri : '',
    mediaType: normalizeMediaType(asset.mediaType),
    width: normalizeNumber(asset.width) ?? 0,
    height: normalizeNumber(asset.height) ?? 0,
    durationMs: normalizeNumber(asset.durationMs) ?? 0,
    fileSizeBytes: normalizeNumber(asset.fileSizeBytes) ?? 0,
    dateTaken: normalizeNumber(asset.dateTaken),
    dateModified: normalizeNumber(asset.dateModified),
    bucketId: normalizeString(asset.bucketId),
    bucketName: normalizeString(asset.bucketName),
    mimeType: normalizeString(asset.mimeType),
    isScreenshot: asset.isScreenshot === true,
    bitrate: normalizeNumber(asset.bitrate),
    frameRate: normalizeNumber(asset.frameRate),
    codec: normalizeString(asset.codec),
    orientation: normalizeNumber(asset.orientation),
    aspectRatio: normalizeNumber(asset.aspectRatio),
  };
}

export async function isAndroidMediaStoreEnumerationSupported() {
  if (Platform.OS !== 'android') {
    return false;
  }

  const nativeModule = getAndroidMediaStoreEnumeratorModule();
  if (!nativeModule?.isSupported) {
    return false;
  }

  return Promise.resolve(nativeModule.isSupported()).catch(() => false);
}

export async function enumerateAndroidMediaStoreAssets(
  options: EnumerateAndroidMediaStoreOptions = {},
) {
  if (Platform.OS !== 'android') {
    return [] as AndroidMediaStoreAssetMetadata[];
  }

  const nativeModule = getAndroidMediaStoreEnumeratorModule();
  if (!nativeModule?.enumerate) {
    return [] as AndroidMediaStoreAssetMetadata[];
  }

  const isSupported = await isAndroidMediaStoreEnumerationSupported();
  if (!isSupported) {
    return [] as AndroidMediaStoreAssetMetadata[];
  }

  const mediaTypes =
    options.mediaTypes && options.mediaTypes.length > 0
      ? [...options.mediaTypes]
      : [...DEFAULT_MEDIA_TYPES];
  const rawAssets = await Promise.resolve(
    nativeModule.enumerate({
      createdAfter: options.createdAfter ?? null,
      createdBefore: options.createdBefore ?? null,
      mediaTypes,
      limit: options.limit ?? null,
    }),
  ).catch(() => []);

  return rawAssets.map((asset) => normalizeAssetMetadata(asset));
}

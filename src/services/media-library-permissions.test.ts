import { beforeEach, describe, expect, it, vi } from 'vitest';

const platformState = vi.hoisted(() => ({
  os: 'android' as 'android' | 'ios',
  version: 34,
  reset() {
    this.os = 'android';
    this.version = 34;
  },
}));

const mediaLibraryApi = vi.hoisted(() => ({
  getPermissionsAsync: vi.fn(),
  requestPermissionsAsync: vi.fn(),
}));

vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return platformState.os;
    },
    get Version() {
      return platformState.version;
    },
  },
}));

vi.mock('expo-media-library', () => mediaLibraryApi);

import {
  ensureMediaLibraryDeletePermissionsAsync,
  getMediaLibraryDeletePermissionsAsync,
  getMediaLibraryPermissionsAsync,
  requestMediaLibraryDeletePermissionsAsync,
  requestMediaLibraryPermissionsAsync,
} from './media-library-permissions';

describe('media-library-permissions', () => {
  beforeEach(() => {
    platformState.reset();
    mediaLibraryApi.getPermissionsAsync.mockReset();
    mediaLibraryApi.requestPermissionsAsync.mockReset();
    mediaLibraryApi.getPermissionsAsync.mockResolvedValue({ granted: true });
    mediaLibraryApi.requestPermissionsAsync.mockResolvedValue({ granted: true });
  });

  it('requests granular media permissions on Android 13 and newer', async () => {
    platformState.os = 'android';
    platformState.version = 34;

    await getMediaLibraryPermissionsAsync();
    await requestMediaLibraryPermissionsAsync();

    expect(mediaLibraryApi.getPermissionsAsync).toHaveBeenCalledWith(false, ['photo', 'video']);
    expect(mediaLibraryApi.requestPermissionsAsync).toHaveBeenCalledWith(false, ['photo', 'video']);
  });

  it('falls back to broad media permissions on Android 12 and older', async () => {
    platformState.os = 'android';
    platformState.version = 30;

    await getMediaLibraryPermissionsAsync();
    await requestMediaLibraryPermissionsAsync();
    await getMediaLibraryDeletePermissionsAsync();
    await requestMediaLibraryDeletePermissionsAsync();

    expect(mediaLibraryApi.getPermissionsAsync).toHaveBeenCalledWith(false);
    expect(mediaLibraryApi.requestPermissionsAsync).toHaveBeenCalledWith(false);
    expect(mediaLibraryApi.getPermissionsAsync).toHaveBeenCalledWith(true);
    expect(mediaLibraryApi.requestPermissionsAsync).toHaveBeenCalledWith(true);
  });

  it('uses the non-granular path on iOS', async () => {
    platformState.os = 'ios';

    await getMediaLibraryPermissionsAsync();
    await requestMediaLibraryPermissionsAsync();
    await getMediaLibraryDeletePermissionsAsync();
    await requestMediaLibraryDeletePermissionsAsync();

    expect(mediaLibraryApi.getPermissionsAsync).toHaveBeenCalledWith(false);
    expect(mediaLibraryApi.requestPermissionsAsync).toHaveBeenCalledWith(false);
  });

  it('reuses regular media permissions for delete on Android 13 and newer', async () => {
    platformState.os = 'android';
    platformState.version = 34;

    await getMediaLibraryDeletePermissionsAsync();
    await requestMediaLibraryDeletePermissionsAsync();

    expect(mediaLibraryApi.getPermissionsAsync).toHaveBeenCalledWith(false, ['photo', 'video']);
    expect(mediaLibraryApi.requestPermissionsAsync).toHaveBeenCalledWith(false, ['photo', 'video']);
  });

  it('requests delete permission only when the current permission is insufficient', async () => {
    platformState.os = 'android';
    platformState.version = 30;
    mediaLibraryApi.getPermissionsAsync.mockResolvedValueOnce({ granted: false });
    mediaLibraryApi.requestPermissionsAsync.mockResolvedValueOnce({ granted: true });

    const permission = await ensureMediaLibraryDeletePermissionsAsync();

    expect(mediaLibraryApi.getPermissionsAsync).toHaveBeenCalledWith(true);
    expect(mediaLibraryApi.requestPermissionsAsync).toHaveBeenCalledWith(true);
    expect(permission).toEqual({ granted: true });
  });

  it('does not prompt again when delete permission is already granted', async () => {
    platformState.os = 'android';
    platformState.version = 30;
    mediaLibraryApi.getPermissionsAsync.mockResolvedValueOnce({ granted: true });

    const permission = await ensureMediaLibraryDeletePermissionsAsync();

    expect(mediaLibraryApi.getPermissionsAsync).toHaveBeenCalledWith(true);
    expect(mediaLibraryApi.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(permission).toEqual({ granted: true });
  });
});

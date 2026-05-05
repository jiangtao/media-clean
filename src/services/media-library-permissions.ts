import * as MediaLibrary from 'expo-media-library';
import { Platform } from 'react-native';

const ANDROID_GRANULAR_MEDIA_PERMISSION_SDK = 33;
const GRANULAR_MEDIA_PERMISSIONS: MediaLibrary.GranularPermission[] = ['photo', 'video'];

function supportsGranularMediaPermissions() {
  return (
    Platform.OS === 'android' &&
    typeof Platform.Version === 'number' &&
    Platform.Version >= ANDROID_GRANULAR_MEDIA_PERMISSION_SDK
  );
}

function requiresLegacyWritePermission() {
  return (
    Platform.OS === 'android' &&
    typeof Platform.Version === 'number' &&
    Platform.Version < ANDROID_GRANULAR_MEDIA_PERMISSION_SDK
  );
}

export async function getMediaLibraryPermissionsAsync() {
  if (supportsGranularMediaPermissions()) {
    return MediaLibrary.getPermissionsAsync(false, GRANULAR_MEDIA_PERMISSIONS);
  }

  return MediaLibrary.getPermissionsAsync(false);
}

export async function requestMediaLibraryPermissionsAsync() {
  if (supportsGranularMediaPermissions()) {
    return MediaLibrary.requestPermissionsAsync(false, GRANULAR_MEDIA_PERMISSIONS);
  }

  return MediaLibrary.requestPermissionsAsync(false);
}

export async function getMediaLibraryDeletePermissionsAsync() {
  if (requiresLegacyWritePermission()) {
    return MediaLibrary.getPermissionsAsync(true);
  }

  return getMediaLibraryPermissionsAsync();
}

export async function requestMediaLibraryDeletePermissionsAsync() {
  if (requiresLegacyWritePermission()) {
    return MediaLibrary.requestPermissionsAsync(true);
  }

  return requestMediaLibraryPermissionsAsync();
}

export async function ensureMediaLibraryDeletePermissionsAsync() {
  const permission = await getMediaLibraryDeletePermissionsAsync();

  if (permission.granted) {
    return permission;
  }

  return requestMediaLibraryDeletePermissionsAsync();
}

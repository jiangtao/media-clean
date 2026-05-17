import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import type { AppThemePalette } from '../../theme/app-theme';

interface VideoPlayerProps {
  uri: string;
  width: number;
  height: number;
  theme: AppThemePalette;
  autoPlay?: boolean;
  isActive?: boolean;
}

export function VideoPlayer({ uri, width, height, theme, autoPlay = false, isActive = true }: VideoPlayerProps) {
  const playerRef = useVideoPlayer({ uri }, (instance) => {
    instance.loop = true;
  });
  const styles = useMemo(() => createStyles(theme, width, height), [theme, width, height]);

  useEffect(() => {
    if (autoPlay && isActive) {
      runPlayerCommand(() => playerRef.play());
    }
  }, [autoPlay, isActive, playerRef, uri]);

  useEffect(() => {
    if (!isActive) {
      runPlayerCommand(() => playerRef.pause());
    }
  }, [isActive, playerRef, uri]);

  useEffect(() => {
    return () => {
      runPlayerCommand(() => playerRef.pause());
    };
  }, [playerRef, uri]);

  return (
    <View style={styles.container}>
      <VideoView
        player={playerRef}
        nativeControls
        contentFit="contain"
        fullscreenOptions={{ enable: true }}
        style={styles.video}
      />
    </View>
  );
}

function runPlayerCommand(command: () => void) {
  try {
    command();
  } catch {
    // expo-video can release the native player before React runs cleanup.
  }
}

function createStyles(theme: AppThemePalette, videoWidth: number, videoHeight: number) {
  // Calculate aspect ratio for the container
  const aspectRatio = videoWidth > 0 && videoHeight > 0 ? videoWidth / videoHeight : 16 / 9;

  return StyleSheet.create({
    container: {
      width: '100%',
      aspectRatio: Math.max(aspectRatio, 0.5), // Minimum aspect ratio to prevent too tall videos
      borderRadius: 28,
      backgroundColor: theme.previewBackground,
      overflow: 'hidden',
    },
    video: {
      width: '100%',
      height: '100%',
    },
  });
}

import { useVideoPlayer, VideoView } from 'expo-video';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import type { AppThemePalette } from '../../theme/app-theme';

interface VideoPlayerProps {
  uri: string;
  width: number;
  height: number;
  theme: AppThemePalette;
}

export function VideoPlayer({ uri, width, height, theme }: VideoPlayerProps) {
  const playerRef = useVideoPlayer({ uri }, (instance) => {
    instance.loop = true;
    instance.play();
  });
  const styles = useMemo(() => createStyles(theme, width, height), [theme, width, height]);

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

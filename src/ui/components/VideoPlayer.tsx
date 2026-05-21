import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useMemo } from 'react';
import { StyleSheet } from 'react-native';

import type { AppThemePalette } from '../../theme/app-theme';
import { MediaFrame } from '../primitives';
import { MEDIA_VIEWER_STYLE_TOKENS } from './media-viewer-tokens';

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
  const styles = useMemo(() => createStyles(width, height), [width, height]);

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
    <MediaFrame theme={theme} style={styles.container} testID="video-player-media-frame">
      <VideoView
        player={playerRef}
        nativeControls
        contentFit="contain"
        fullscreenOptions={{ enable: true }}
        style={styles.video}
      />
    </MediaFrame>
  );
}

function runPlayerCommand(command: () => void) {
  try {
    command();
  } catch {
    // expo-video can release the native player before React runs cleanup.
  }
}

function createStyles(videoWidth: number, videoHeight: number) {
  const { video } = MEDIA_VIEWER_STYLE_TOKENS;
  const aspectRatio =
    videoWidth > 0 && videoHeight > 0 ? videoWidth / videoHeight : video.fallbackAspectRatio;

  return StyleSheet.create({
    container: {
      width: '100%',
      aspectRatio: Math.max(aspectRatio, video.minAspectRatio),
    },
    video: {
      width: '100%',
      height: '100%',
    },
  });
}

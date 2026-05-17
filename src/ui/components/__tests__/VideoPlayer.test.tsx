import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VideoPlayer } from '../VideoPlayer';
import type { AppThemePalette } from '../../../theme/app-theme';

const useVideoPlayerMock = vi.fn();

vi.mock('react-native', () => ({
  View: 'View',
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
}));

vi.mock('expo-video', () => ({
  VideoView: 'VideoView',
  useVideoPlayer: (...args: unknown[]) => useVideoPlayerMock(...args),
}));

const mockTheme: AppThemePalette = {
  scheme: 'light',
  statusBarStyle: 'dark',
  safeArea: '#f3ecdf',
  orbTop: '#d8e7df',
  orbBottom: '#f2d4c6',
  heroBackground: '#173944',
  heroSurface: '#102a33',
  heroAccent: '#9ed3c7',
  heroTitle: '#fff7ec',
  heroText: '#dce6e5',
  heroHint: '#bfcdcf',
  pageTextPrimary: '#18212f',
  pageTextSecondary: '#546272',
  pageTextMuted: '#7c8595',
  cardBackground: '#fffaf1',
  cardBorder: '#e7dcc7',
  cardMutedBackground: '#f6f7fb',
  cardMutedBorder: '#d8dce8',
  infoBackground: '#eef3f5',
  infoBorder: '#d8e2e6',
  noticeBackground: '#fff1e8',
  noticeBorder: '#efc9b4',
  noticeTitle: '#7d3f22',
  noticeText: '#965a3a',
  inputBackground: '#f8f4ea',
  inputBorder: '#d9cfbe',
  inputText: '#18212f',
  buttonPrimaryBackground: '#173944',
  buttonPrimaryText: '#ffffff',
  buttonSuccessBackground: '#18bf63',
  buttonSuccessPressedBackground: '#15ad59',
  buttonSecondaryBackground: '#efe6d6',
  buttonSecondaryText: '#28404c',
  buttonTertiaryBackground: '#304856',
  buttonTertiaryText: '#e2edf0',
  buttonDangerBackground: '#b34f2f',
  buttonDangerPressedBackground: '#c65a60',
  buttonDangerText: '#ffffff',
  chipBackground: '#efe6d6',
  chipBorder: '#e1d5c2',
  chipText: '#304856',
  chipActiveBackground: '#173944',
  chipActiveText: '#ffffff',
  tabBackground: '#e9e1d2',
  tabText: '#596171',
  tabActiveBackground: '#173944',
  tabActiveText: '#ffffff',
  actionBarBackground: '#142a33',
  actionBarText: '#fff7ec',
  shadowColor: '#0f172a',
  thumbnailBackground: '#d8d2c5',
  previewBackground: '#141c28',
};

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('VideoPlayer', () => {
  beforeEach(() => {
    useVideoPlayerMock.mockReset();
  });

  it('pauses playback on unmount and ignores released-player cleanup errors', () => {
    const pause = vi.fn(() => {
      throw new Error('released');
    });

    useVideoPlayerMock.mockImplementationOnce(
      (
        _source: { uri: string },
        setup?: (player: { loop: boolean; play: () => void; pause: () => void }) => void,
      ) => {
        const player = {
          loop: false,
          play: vi.fn(),
          pause,
        };

        setup?.(player);
        return player;
      },
    );

    let renderer!: ReturnType<typeof TestRenderer.create>;

    act(() => {
      renderer = TestRenderer.create(
        <VideoPlayer uri="file:///test-video.mov" width={1920} height={1080} theme={mockTheme} />,
      );
    });

    expect(() => {
      act(() => {
        renderer.unmount();
      });
    }).not.toThrow();
    expect(pause).toHaveBeenCalledTimes(1);
  });

  it('configures native video playback with looping and controls without autoplay', () => {
    const play = vi.fn();
    const pause = vi.fn();

    useVideoPlayerMock.mockImplementationOnce(
      (
        _source: { uri: string },
        setup?: (player: { loop: boolean; play: () => void; pause: () => void }) => void,
      ) => {
        const player = {
          loop: false,
          play,
          pause,
        };

        setup?.(player);
        return player;
      },
    );

    let renderer!: ReturnType<typeof TestRenderer.create>;

    act(() => {
      renderer = TestRenderer.create(
        <VideoPlayer uri="file:///test-video.mov" width={1280} height={720} theme={mockTheme} />,
      );
    });

    const videoView = renderer.root.findByType('VideoView');

    expect(play).not.toHaveBeenCalled();
    expect(videoView.props.nativeControls).toBe(true);
    expect(videoView.props.contentFit).toBe('contain');
    expect(videoView.props.fullscreenOptions).toEqual({ enable: true });
  });

  it('pauses playback when the active carousel item moves away without autoplaying on return', () => {
    const play = vi.fn();
    const pause = vi.fn();
    const player = {
      loop: false,
      play,
      pause,
    };

    useVideoPlayerMock.mockImplementation(
      (
        _source: { uri: string },
        setup?: (playerRef: { loop: boolean; play: () => void; pause: () => void }) => void,
      ) => {
        setup?.(player);
        return player;
      },
    );

    let renderer!: ReturnType<typeof TestRenderer.create>;

    act(() => {
      renderer = TestRenderer.create(
        <VideoPlayer
          uri="file:///carousel-video.mov"
          width={1280}
          height={720}
          theme={mockTheme}
          isActive
        />,
      );
    });

    expect(play).not.toHaveBeenCalled();
    expect(pause).not.toHaveBeenCalled();

    act(() => {
      renderer.update(
        <VideoPlayer
          uri="file:///carousel-video.mov"
          width={1280}
          height={720}
          theme={mockTheme}
          isActive={false}
        />,
      );
    });

    expect(pause).toHaveBeenCalledTimes(1);

    act(() => {
      renderer.update(
        <VideoPlayer
          uri="file:///carousel-video.mov"
          width={1280}
          height={720}
          theme={mockTheme}
          isActive
        />,
      );
    });

    expect(play).not.toHaveBeenCalled();
    expect(pause).toHaveBeenCalledTimes(1);
  });

  it('pauses the current player when a reused video view receives a new uri', () => {
    const pause = vi.fn();
    const player = {
      loop: false,
      play: vi.fn(),
      pause,
    };

    useVideoPlayerMock.mockImplementation(
      (
        _source: { uri: string },
        setup?: (playerRef: { loop: boolean; play: () => void; pause: () => void }) => void,
      ) => {
        setup?.(player);
        return player;
      },
    );

    let renderer!: ReturnType<typeof TestRenderer.create>;

    act(() => {
      renderer = TestRenderer.create(
        <VideoPlayer uri="file:///first-video.mov" width={1280} height={720} theme={mockTheme} />,
      );
    });

    act(() => {
      renderer.update(
        <VideoPlayer uri="file:///second-video.mov" width={1280} height={720} theme={mockTheme} />,
      );
    });

    expect(pause).toHaveBeenCalledTimes(1);

    act(() => {
      renderer.unmount();
    });

    expect(pause).toHaveBeenCalledTimes(2);
  });
});

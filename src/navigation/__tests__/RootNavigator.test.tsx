import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const runtime = vi.hoisted(() => ({
  initialRouteName: undefined as string | undefined,
  navigation: {
    replace: vi.fn(),
    navigate: vi.fn(),
  },
  loadHasEnteredWorkspace: vi.fn(),
  hydrateStartupPhotoScanState: vi.fn(),
  preventAutoHideAsync: vi.fn(),
  hideAsync: vi.fn(),
  landingRenderCount: 0,
  mainRenderCount: 0,
}));

vi.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: () => runtime.preventAutoHideAsync(),
  hideAsync: () => runtime.hideAsync(),
}));

vi.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => {
    const Navigator = ({
      children,
      initialRouteName,
    }: {
      children?: React.ReactNode;
      initialRouteName?: string;
    }) => {
      runtime.initialRouteName = initialRouteName;

      const screenElements = React.Children.toArray(children).filter(React.isValidElement) as Array<
        React.ReactElement<{ name: string; component: React.ComponentType<any> }>
      >;
      const activeScreen =
        screenElements.find((screen) => screen.props.name === initialRouteName) ?? screenElements[0];
      const ActiveComponent = activeScreen?.props.component;

      return React.createElement(
        React.Fragment,
        null,
        ActiveComponent
          ? React.createElement(ActiveComponent, {
              navigation: runtime.navigation,
              route: { key: `${activeScreen.props.name}-key`, name: activeScreen.props.name },
            })
          : null,
      );
    };

    const Screen = () => null;

    return { Navigator, Screen };
  },
}));

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Animated: {
    View: 'AnimatedView',
    Value: class AnimatedValue {
      value: number;

      constructor(initialValue: number) {
        this.value = initialValue;
      }

      setValue(nextValue: number) {
        this.value = nextValue;
      }
    },
    timing: (value: { setValue?: (next: number) => void }, config: { toValue: number }) => ({
      start: () => value.setValue?.(config.toValue),
      stop: () => undefined,
    }),
    sequence: (animations: Array<{ start?: () => void; stop?: () => void }>) => ({
      start: () => animations.forEach((animation) => animation.start?.()),
      stop: () => animations.forEach((animation) => animation.stop?.()),
    }),
    loop: (animation: { start?: () => void; stop?: () => void }) => ({
      start: () => animation.start?.(),
      stop: () => animation.stop?.(),
    }),
  },
  Easing: {
    ease: (value: number) => value,
    inOut: <T,>(value: T) => value,
  },
  View: 'View',
  Text: 'Text',
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
    absoluteFill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  },
}));

vi.mock('../../ui/screens/LandingScreen', () => ({
  LandingScreen: () => {
    runtime.landingRenderCount += 1;
    return React.createElement('View', { testID: 'mock-landing-screen' });
  },
}));

vi.mock('../../ui/components/TabBar', () => ({
  TabBar: () => React.createElement('View', { testID: 'mock-tab-bar' }),
}));

vi.mock('../MainTabNavigator', () => ({
  MainTabNavigator: () => {
    runtime.mainRenderCount += 1;
    return React.createElement('View', { testID: 'mock-main-tab-navigator' });
  },
}));

vi.mock('../../ui/screens/PhotoGridScreen', () => ({
  PhotoGridScreen: () => {
    return React.createElement('View', { testID: 'mock-photo-grid-screen' });
  },
}));

vi.mock('../../ui/screens/RecycleBinScreen', () => ({
  RecycleBinScreen: () => React.createElement('View', { testID: 'mock-recycle-bin-screen' }),
}));

vi.mock('../../ui/screens/SettingsScreen', () => ({
  SettingsScreen: () => React.createElement('View', { testID: 'mock-settings-screen' }),
}));

vi.mock('../../application/AppPreferencesContext', () => ({
  useAppPreferences: () => ({
    language: 'zh-CN',
    copy: {
      skeleton: {
        loadingLabel: '正在加载内容',
      },
      tabs: {
        photos: '照片',
        recycle: '回收站',
        settings: '设置',
      },
    },
    theme: {
      scheme: 'light',
      safeArea: '#f3ecdf',
      pageTextPrimary: '#18212f',
      pageTextSecondary: '#546272',
      cardBackground: '#fffaf1',
      cardBorder: '#e7dcc7',
      cardMutedBackground: '#f6f7fb',
      cardMutedBorder: '#d8dce8',
      thumbnailBackground: '#d8d2c5',
      buttonPrimaryBackground: '#2f80ff',
      tabBarBackground: '#000000',
      tabBarBorder: '#111111',
      tabBarInactive: '#666666',
      tabBarActive: '#ffffff',
      surfaceMuted: '#222222',
      badgeBackground: '#ff3347',
      badgeText: '#ffffff',
    },
    recycleBinIds: [],
    recycleBinCount: 0,
  }),
}));

vi.mock('../../services/storage/workspace-entry-storage', () => ({
  loadHasEnteredWorkspace: () => runtime.loadHasEnteredWorkspace(),
}));

vi.mock('../startup-photo-scan-state', () => ({
  hydrateStartupPhotoScanState: () => runtime.hydrateStartupPhotoScanState(),
}));

import { RootNavigator } from '../RootNavigator';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderNavigator() {
  let renderer!: ReturnType<typeof TestRenderer.create>;

  return act(async () => {
    renderer = TestRenderer.create(<RootNavigator />);
    await Promise.resolve();
    return renderer;
  });
}

describe('RootNavigator', () => {
  const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

  beforeEach(() => {
    runtime.initialRouteName = undefined;
    runtime.navigation.replace.mockReset();
    runtime.navigation.navigate.mockReset();
    runtime.loadHasEnteredWorkspace.mockReset();
    runtime.hydrateStartupPhotoScanState.mockReset();
    runtime.hydrateStartupPhotoScanState.mockResolvedValue(undefined);
    runtime.preventAutoHideAsync.mockReset();
    runtime.preventAutoHideAsync.mockResolvedValue(undefined);
    runtime.hideAsync.mockReset();
    runtime.hideAsync.mockResolvedValue(undefined);
    runtime.landingRenderCount = 0;
    runtime.mainRenderCount = 0;
    consoleWarnSpy.mockClear();
  });

  it('starts from the landing route when the workspace entry flag is absent', async () => {
    runtime.loadHasEnteredWorkspace.mockResolvedValueOnce(false);

    const renderer = await renderNavigator();

    expect(runtime.initialRouteName).toBe('Landing');
    expect(renderer.root.findByProps({ testID: 'mock-landing-screen' })).toBeTruthy();
    expect(renderer.root.findAllByProps({ testID: 'mock-main-tab-navigator' })).toHaveLength(0);
    expect(runtime.hydrateStartupPhotoScanState).not.toHaveBeenCalled();
    expect(runtime.hideAsync).toHaveBeenCalledTimes(1);
    expect(runtime.landingRenderCount).toBeGreaterThanOrEqual(1);
    expect(runtime.mainRenderCount).toBe(0);
  });

  it('starts from the main workspace after the landing entry has been persisted', async () => {
    runtime.loadHasEnteredWorkspace.mockResolvedValueOnce(true);

    const renderer = await renderNavigator();

    expect(runtime.initialRouteName).toBe('Main');
    expect(renderer.root.findByProps({ testID: 'mock-main-tab-navigator' })).toBeTruthy();
    expect(renderer.root.findAllByProps({ testID: 'mock-landing-screen' })).toHaveLength(0);
    expect(runtime.hydrateStartupPhotoScanState).toHaveBeenCalledTimes(1);
    expect(runtime.hideAsync).toHaveBeenCalledTimes(1);
    expect(runtime.landingRenderCount).toBe(0);
    expect(runtime.mainRenderCount).toBe(1);
  });

  it('falls back to the landing workspace when the workspace entry flag cannot be loaded', async () => {
    const loadError = new Error('storage-busy');
    runtime.loadHasEnteredWorkspace.mockRejectedValueOnce(loadError);

    const renderer = await renderNavigator();

    expect(runtime.initialRouteName).toBe('Landing');
    expect(renderer.root.findByProps({ testID: 'mock-landing-screen' })).toBeTruthy();
    expect(renderer.root.findAllByProps({ testID: 'mock-main-tab-navigator' })).toHaveLength(0);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Failed to load workspace entry state, fallback to Landing.',
      loadError,
    );
    expect(runtime.hideAsync).toHaveBeenCalledTimes(1);
    expect(runtime.landingRenderCount).toBeGreaterThanOrEqual(1);
    expect(runtime.mainRenderCount).toBe(0);
  });

  it('keeps the native splash visible while the initial route is still resolving', () => {
    runtime.loadHasEnteredWorkspace.mockReturnValueOnce(new Promise(() => undefined));

    let renderer!: ReturnType<typeof TestRenderer.create>;

    act(() => {
      renderer = TestRenderer.create(<RootNavigator />);
    });

    expect(renderer.toJSON()).toBeNull();
    expect(runtime.hideAsync).not.toHaveBeenCalled();
  });
});

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const runtime = vi.hoisted(() => ({
  recycleBinIds: [] as string[],
  recycleBinCount: 0,
  tabBarSpy: vi.fn(),
  navigate: vi.fn(),
  screenSpy: vi.fn(),
  navigatorSpy: vi.fn(),
}));

vi.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: () => ({
    Navigator: ({
      children,
      tabBar,
      ...rest
    }: {
      children?: React.ReactNode;
      initialRouteName?: string;
      tabBar: (props: {
        state: { index: number; routes: Array<{ key: string; name: string }> };
        navigation: { navigate: typeof runtime.navigate };
      }) => React.ReactNode;
    }) => {
      runtime.navigatorSpy(rest);
      const screenElements = React.Children.toArray(children).filter(React.isValidElement) as Array<
        React.ReactElement<{ name: string; component?: React.ComponentType<any> }>
      >;

      return React.createElement(
        React.Fragment,
        null,
        tabBar({
          state: {
            index: 0,
            routes: [
              { key: 'Photos-key', name: 'Photos' },
              { key: 'RecycleBin-key', name: 'RecycleBin' },
              { key: 'Settings-key', name: 'Settings' },
            ],
          },
          navigation: {
            navigate: runtime.navigate,
          },
        }),
        ...screenElements
          .filter((screen) => screen.props.component)
          .map((screen) =>
            React.createElement(screen.props.component!, {
              key: `rendered-${screen.props.name}`,
              navigation: { navigate: runtime.navigate },
              route: { key: `${screen.props.name}-key`, name: screen.props.name },
            }),
          ),
        children,
      );
    },
    Screen: (props: { name: string; component?: React.ComponentType; children?: React.ReactNode }) => {
      runtime.screenSpy(props);
      return React.createElement('View', { testID: `mock-screen-${props.name}` });
    },
  }),
}));

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  View: 'View',
  Text: 'Text',
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
}));

vi.mock('../../ui/components/TabBar', () => ({
  TabBar: (props: unknown) => {
    runtime.tabBarSpy(props);
    return React.createElement('View', { testID: 'mock-tab-bar' });
  },
}));

vi.mock('../../ui/screens/PhotoGridScreen', () => ({
  PhotoGridScreen: () => React.createElement('View', { testID: 'mock-photo-grid-screen' }),
}));

vi.mock('../../ui/screens/RecycleBinScreen', () => ({
  RecycleBinScreen: () => React.createElement('View', { testID: 'mock-recycle-bin-screen' }),
}));

vi.mock('../../ui/screens/SettingsScreen', () => ({
  SettingsScreen: () => React.createElement('View', { testID: 'mock-settings-screen' }),
}));

vi.mock('../../application/AppPreferencesContext', () => ({
  useAppPreferences: () => ({
    copy: {
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
      thumbnailBackground: '#d8d2c5',
      buttonPrimaryBackground: '#173944',
      tabBarBackground: '#000000',
      tabBarBorder: '#111111',
      tabBarInactive: '#666666',
      tabBarActive: '#ffffff',
      surfaceMuted: '#222222',
      badgeBackground: '#ff3347',
      badgeText: '#ffffff',
    },
    recycleBinIds: runtime.recycleBinIds,
    recycleBinCount: runtime.recycleBinCount,
  }),
}));

import { __resetMainTabNavigatorSessionState, MainTabNavigator } from '../MainTabNavigator';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mountedRenderers: Array<ReturnType<typeof TestRenderer.create>> = [];

function renderNavigator() {
  let renderer!: ReturnType<typeof TestRenderer.create>;

  act(() => {
    renderer = TestRenderer.create(<MainTabNavigator />);
  });

  mountedRenderers.push(renderer);

  return renderer;
}

function getRenderedTabs() {
  const call = runtime.tabBarSpy.mock.lastCall;
  if (!call) {
    throw new Error('TabBar was not rendered.');
  }

  return call[0].tabs as Array<{
    name: 'Photos' | 'RecycleBin' | 'Settings';
    label: string;
    icon: string;
    badge?: number;
  }>;
}

function getRecycleBinTab() {
  const recycleBinTab = getRenderedTabs().find((tab) => tab.name === 'RecycleBin');
  if (!recycleBinTab) {
    throw new Error('RecycleBin tab was not rendered.');
  }

  return recycleBinTab;
}

describe('MainTabNavigator recycle bin badge', () => {
  beforeEach(() => {
    __resetMainTabNavigatorSessionState();
    runtime.recycleBinIds = [];
    runtime.recycleBinCount = 0;
    runtime.tabBarSpy.mockReset();
    runtime.navigate.mockReset();
    runtime.screenSpy.mockReset();
    runtime.navigatorSpy.mockReset();
  });

  afterEach(() => {
    for (const renderer of mountedRenderers.splice(0)) {
      act(() => {
        renderer.unmount();
      });
    }
  });

  it('在回收站存在条目时，应把 badge 透传给 TabBar', () => {
    runtime.recycleBinIds = ['deleted-1', 'deleted-2', 'deleted-3'];
    runtime.recycleBinCount = runtime.recycleBinIds.length;

    renderNavigator();

    expect(getRecycleBinTab().badge).toBe(3);
  });

  it('在回收站为空时，不应显示 badge', () => {
    renderNavigator();

    expect(getRecycleBinTab().badge).toBeUndefined();
  });

  it('当回收站数量变化后，badge 应随重新渲染一起更新', () => {
    const renderer = renderNavigator();

    expect(getRecycleBinTab().badge).toBeUndefined();

    runtime.recycleBinIds = ['deleted-1', 'deleted-2'];
    runtime.recycleBinCount = runtime.recycleBinIds.length;

    act(() => {
      renderer.update(<MainTabNavigator />);
    });

    expect(getRecycleBinTab().badge).toBe(2);
  });

  it('当回收站数量变化后，Photos / RecycleBin screen 注册应保持稳定 component，不应退回 children render function', () => {
    const renderer = renderNavigator();

    const initialCalls = runtime.screenSpy.mock.calls.map(([props]) => props);
    const initialPhotos = initialCalls.find((props) => props.name === 'Photos');
    const initialRecycle = initialCalls.find((props) => props.name === 'RecycleBin');

    expect(initialPhotos?.component).toBeTypeOf('function');
    expect(initialRecycle?.component).toBeTypeOf('function');
    expect(initialPhotos?.children).toBeUndefined();
    expect(initialRecycle?.children).toBeUndefined();

    runtime.recycleBinIds = ['deleted-1'];
    runtime.recycleBinCount = 1;

    act(() => {
      renderer.update(<MainTabNavigator />);
    });

    const latestCalls = runtime.screenSpy.mock.calls.slice(-3).map(([props]) => props);
    const nextPhotos = latestCalls.find((props) => props.name === 'Photos');
    const nextRecycle = latestCalls.find((props) => props.name === 'RecycleBin');

    expect(nextPhotos?.component).toBe(initialPhotos?.component);
    expect(nextRecycle?.component).toBe(initialRecycle?.component);
    expect(nextPhotos?.children).toBeUndefined();
    expect(nextRecycle?.children).toBeUndefined();
  });

  it('用户切到 RecycleBin 后，即便 badge 重新计算，也应记住最后一次主动选择的 tab', () => {
    const renderer = renderNavigator();
    const initialNavigatorProps = runtime.navigatorSpy.mock.lastCall?.[0] as { initialRouteName?: string };

    expect(initialNavigatorProps.initialRouteName).toBe('Photos');

    const tabBarProps = runtime.tabBarSpy.mock.lastCall?.[0] as { onTabPress: (name: string) => void };

    act(() => {
      tabBarProps.onTabPress('RecycleBin');
    });

    runtime.recycleBinIds = ['deleted-1'];
    runtime.recycleBinCount = 1;

    act(() => {
      renderer.update(<MainTabNavigator />);
    });

    const latestNavigatorProps = runtime.navigatorSpy.mock.lastCall?.[0] as { initialRouteName?: string };
    expect(latestNavigatorProps.initialRouteName).toBe('RecycleBin');
  });

  it('外部权限 Activity 导致 navigator remount 后，应继续停留在最后一次主动选择的 tab', () => {
    renderNavigator();

    const tabBarProps = runtime.tabBarSpy.mock.lastCall?.[0] as { onTabPress: (name: string) => void };

    act(() => {
      tabBarProps.onTabPress('RecycleBin');
    });

    runtime.navigatorSpy.mockReset();
    runtime.tabBarSpy.mockReset();
    runtime.screenSpy.mockReset();

    renderNavigator();

    const remountedNavigatorProps = runtime.navigatorSpy.mock.lastCall?.[0] as { initialRouteName?: string };
    expect(remountedNavigatorProps.initialRouteName).toBe('RecycleBin');
  });

  it('tab screens render synchronously without page bundle loading fallbacks', () => {
    const renderer = renderNavigator();

    expect(renderer.root.findByProps({ testID: 'mock-photo-grid-screen' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'mock-recycle-bin-screen' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'mock-settings-screen' })).toBeTruthy();
    expect(renderer.root.findAllByType('ActivityIndicator')).toHaveLength(0);
  });
});

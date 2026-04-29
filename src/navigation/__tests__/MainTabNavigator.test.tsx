import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const runtime = vi.hoisted(() => ({
  recycleBinIds: [] as string[],
  recycleBinCount: 0,
  tabBarSpy: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: () => ({
    Navigator: ({
      children,
      tabBar,
    }: {
      children?: React.ReactNode;
      tabBar: (props: {
        state: { index: number; routes: Array<{ key: string; name: string }> };
        navigation: { navigate: typeof runtime.navigate };
      }) => React.ReactNode;
    }) =>
      React.createElement(
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
        children,
      ),
    Screen: ({ name }: { name: string }) =>
      React.createElement('View', { testID: `mock-screen-${name}` }),
  }),
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
        recycle: '保留和清理',
        settings: '设置',
      },
    },
    theme: {
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

import { MainTabNavigator } from '../MainTabNavigator';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderNavigator() {
  let renderer!: ReturnType<typeof TestRenderer.create>;

  act(() => {
    renderer = TestRenderer.create(<MainTabNavigator />);
  });

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
    runtime.recycleBinIds = [];
    runtime.recycleBinCount = 0;
    runtime.tabBarSpy.mockReset();
    runtime.navigate.mockReset();
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
});

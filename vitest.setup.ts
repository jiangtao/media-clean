import { vi } from 'vitest';
import React from 'react';

// Define __DEV__ global - use declare to extend globalThis
declare global {
  // @ts-ignore - Allow redeclaration for testing environment
  var __DEV__: boolean;
}

// @ts-ignore - Assign to globalThis for compatibility
globalThis.__DEV__ = true;
process.env.EXPO_OS = process.env.EXPO_OS ?? 'web';

class AnimatedValue {
  value: number;

  constructor(initialValue: number) {
    this.value = initialValue;
  }

  setValue(nextValue: number) {
    this.value = nextValue;
  }

  stopAnimation() {
    return undefined;
  }

  interpolate() {
    return this.value;
  }
}

// Mock React Native
vi.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Image: 'Image',
  FlatList: 'FlatList',
  Modal: 'Modal',
  TouchableOpacity: 'TouchableOpacity',
  Pressable: 'Pressable',
  StyleSheet: {
    create: (styles: Record<string, any>) => styles,
    hairlineWidth: 1,
  },
  Dimensions: {
    get: () => ({ width: 375, height: 812 }),
  },
  PixelRatio: {
    get: () => 3,
  },
  Animated: {
    View: 'AnimatedView',
    Value: AnimatedValue,
    timing: (value: { setValue?: (next: number) => void }, config: { toValue: number }) => ({
      start: (callback?: (result: { finished: boolean }) => void) => {
        value.setValue?.(config.toValue);
        callback?.({ finished: true });
      },
      stop: () => undefined,
    }),
    spring: (value: { setValue?: (next: number) => void }, config: { toValue: number }) => ({
      start: (callback?: (result: { finished: boolean }) => void) => {
        value.setValue?.(config.toValue);
        callback?.({ finished: true });
      },
      stop: () => undefined,
    }),
    sequence: (animations: Array<{ start?: () => void; stop?: () => void }>) => ({
      start: () => {
        animations.forEach((animation) => animation.start?.());
      },
      stop: () => {
        animations.forEach((animation) => animation.stop?.());
      },
    }),
    parallel: (animations: Array<{ start?: () => void; stop?: () => void }>) => ({
      start: () => {
        animations.forEach((animation) => animation.start?.());
      },
      stop: () => {
        animations.forEach((animation) => animation.stop?.());
      },
    }),
    loop: (animation: { start?: () => void; stop?: () => void }) => ({
      start: () => animation.start?.(),
      stop: () => animation.stop?.(),
    }),
    createAnimatedComponent: <T,>(component: T) => component,
  },
  Easing: {
    linear: (value: number) => value,
    ease: (value: number) => value,
    inOut: <T,>(value: T) => value,
    out: <T,>(value: T) => value,
    cubic: (value: number) => value,
  },
  Platform: {
    OS: 'ios',
    select: (values: Record<string, unknown>) => values.ios ?? values.default,
  },
  NativeModules: {},
  TurboModuleRegistry: {
    get: () => null,
    getEnforcing: () => ({}),
  },
  useColorScheme: () => 'light',
}));

// Mock expo-image
vi.mock('expo-image', () => ({
  Image: 'Image',
}));

// Mock @expo/vector-icons
vi.mock('@expo/vector-icons', () => ({
  Ionicons: ({
    name,
    color,
    size,
    testID,
  }: {
    name: string;
    color?: string;
    size?: number;
    testID?: string;
  }) => React.createElement('Text', { testID, style: { color, fontSize: size } }, name),
}));

vi.mock('react-native-svg', () => {
  const createSvgComponent =
    (type: string) =>
    ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement(type, props, children);

  return {
    __esModule: true,
    default: createSvgComponent('Svg'),
    Svg: createSvgComponent('Svg'),
    Path: createSvgComponent('Path'),
    Rect: createSvgComponent('Rect'),
    Circle: createSvgComponent('Circle'),
    G: createSvgComponent('G'),
    Text: createSvgComponent('SvgText'),
  };
});

// Mock react-native-safe-area-context
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: any }) => children,
}));

// Mock @react-navigation/native
vi.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void) => callback(),
  NavigationContainer: ({ children }: { children: any }) => children,
}));

// Mock @react-navigation/bottom-tabs
vi.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: () => ({
    Navigator: ({ children, screenOptions, tabBar }: { children: any; screenOptions?: any; tabBar?: any }) => {
      const state = { routes: [{ name: 'Photos' }, { name: 'RecycleBin' }, { name: 'Settings' }], index: 0 };
      const navigation = { navigate: vi.fn() };
      const TabBarComponent = tabBar ? tabBar({ state, navigation, descriptors: {}, insets: { bottom: 0 } }) : null;
      return React.createElement('div', null,
        TabBarComponent,
        React.createElement('div', { testID: 'screen-container' }, children)
      );
    },
    Screen: ({ name, component, options }: { name: string; component: any; options?: any }) => {
      return React.createElement(component, { key: name });
    },
  }),
}));

// Mock theme
vi.mock('./src/theme/app-theme', async () => {
  const actual = await vi.importActual('./src/theme/app-theme') as any;

  const LIGHT_THEME = {
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
    buttonSecondaryBackground: '#efe6d6',
    buttonSecondaryText: '#28404c',
    buttonTertiaryBackground: '#304856',
    buttonTertiaryText: '#e2edf0',
    buttonDangerBackground: '#b34f2f',
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

  const DARK_THEME = {
    scheme: 'dark',
    statusBarStyle: 'light',
    safeArea: '#0d1218',
    orbTop: '#17303a',
    orbBottom: '#3d2430',
    heroBackground: '#0f2b34',
    heroSurface: '#142f38',
    heroAccent: '#82cfc1',
    heroTitle: '#f8f5ec',
    heroText: '#d2e0de',
    heroHint: '#9cb0b4',
    pageTextPrimary: '#edf2f7',
    pageTextSecondary: '#b6c2cf',
    pageTextMuted: '#8e9bab',
    cardBackground: '#161d26',
    cardBorder: '#283342',
    cardMutedBackground: '#19222d',
    cardMutedBorder: '#304052',
    infoBackground: '#152029',
    infoBorder: '#2d3d4c',
    noticeBackground: '#37231f',
    noticeBorder: '#6a3b31',
    noticeTitle: '#ffc8b5',
    noticeText: '#f2b29a',
    inputBackground: '#121922',
    inputBorder: '#334155',
    inputText: '#edf2f7',
    buttonPrimaryBackground: '#82cfc1',
    buttonPrimaryText: '#0f1d24',
    buttonSecondaryBackground: '#22303c',
    buttonSecondaryText: '#dce7ef',
    buttonTertiaryBackground: '#35485c',
    buttonTertiaryText: '#eef4f8',
    buttonDangerBackground: '#c9654a',
    buttonDangerText: '#fff7f1',
    chipBackground: '#22303c',
    chipBorder: '#36475b',
    chipText: '#d5e3ea',
    chipActiveBackground: '#82cfc1',
    chipActiveText: '#0f1d24',
    tabBackground: '#1a2430',
    tabText: '#9fb0c0',
    tabActiveBackground: '#82cfc1',
    tabActiveText: '#0f1d24',
    actionBarBackground: '#111b24',
    actionBarText: '#edf2f7',
    shadowColor: '#000000',
    thumbnailBackground: '#2d3846',
    previewBackground: '#05080d',
  };

  return {
    ...actual,
    getAppTheme: (scheme: 'light' | 'dark') => (scheme === 'dark' ? DARK_THEME : LIGHT_THEME),
  };
});

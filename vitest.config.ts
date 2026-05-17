import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    server: {
      deps: {
        inline: ['react-native', 'expo', 'react-native-gesture-handler', 'react-native-reanimated'],
      },
    },
  },
  define: {
    __DEV__: true,
    global: 'globalThis',
  },
  resolve: {
    alias: {
      'react-native': 'react-native-web',
    },
  },
});

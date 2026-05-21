const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Support package.json exports field
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs', 'cjs'];
config.resolver.unstable_enablePackageExports = true;

// Add node_modules to watch folders so Metro can compute SHA-1
config.watchFolders = [path.resolve(__dirname, 'node_modules')];

// Custom resolver to handle packages with exports field issues
const customResolver = {
  'call-bind/callBound': path.resolve(__dirname, 'node_modules/call-bind/callBound.js'),
  'call-bind': path.resolve(__dirname, 'node_modules/call-bind/index.js'),
  'expo-image': path.resolve(__dirname, 'src/vendor/expo-image-shim.tsx'),
  'object.assign/polyfill': path.resolve(__dirname, 'node_modules/object.assign/polyfill.js'),
  'object-is/polyfill': path.resolve(__dirname, 'node_modules/object-is/polyfill.js'),
  'react-native-reanimated/scripts/validate-worklets-version': path.resolve(
    __dirname,
    'src/vendor/validate-reanimated-worklets-version.js',
  ),
  'react-native-reanimated': path.resolve(
    __dirname,
    'node_modules/react-native-reanimated/src/index.ts',
  ),
  'react-native-worklets': path.resolve(
    __dirname,
    'node_modules/react-native-worklets/src/index.ts',
  ),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === '../compatibility.json' &&
    context.originModulePath?.endsWith(
      path.join('react-native-reanimated', 'scripts', 'validate-worklets-version.js'),
    )
  ) {
    return {
      filePath: path.resolve(__dirname, 'node_modules/react-native-reanimated/compatibility.json'),
      type: 'sourceFile',
    };
  }

  // Check if this is a module we need to remap
  if (customResolver[moduleName]) {
    return {
      filePath: customResolver[moduleName],
      type: 'sourceFile',
    };
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });

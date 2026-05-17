const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

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

// Store original resolveRequest
const originalResolveRequest = config.resolver.resolveRequest;

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

  // Otherwise use default resolution
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }

  // Fall back to context's default resolver
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

const fs = require('fs');
const path = require('path');
const {
  AndroidConfig,
  createRunOncePlugin,
  withAndroidManifest,
  withDangerousMod,
  withMainApplication,
} = require('expo/config-plugins');

const PACKAGE_PLACEHOLDER = '__ANDROID_PACKAGE__';
const SERVICE_NAME = '.backgroundscan.BackgroundScanForegroundService';
const TEMPLATE_DIR = path.join(__dirname, 'android', 'backgroundscan');

function getAndroidPackage(config) {
  const androidPackage = config?.android?.package;
  if (!androidPackage || typeof androidPackage !== 'string') {
    throw new Error('Background scan plugin requires expo.android.package to be set.');
  }
  return androidPackage;
}

function renderTemplate(fileName, androidPackage) {
  const templatePath = path.join(TEMPLATE_DIR, fileName);
  const template = fs.readFileSync(templatePath, 'utf8');
  return template.split(PACKAGE_PLACEHOLDER).join(androidPackage);
}

function writeBackgroundScanSources(projectRoot, androidPackage) {
  const targetDir = path.join(
    projectRoot,
    'android',
    'app',
    'src',
    'main',
    'java',
    ...androidPackage.split('.'),
    'backgroundscan',
  );
  fs.mkdirSync(targetDir, { recursive: true });

  for (const fileName of [
    'AndroidNativeScanExecutor.kt',
    'AndroidNativeScanExecutorModule.kt',
    'BackgroundScanForegroundService.kt',
    'BackgroundScanForegroundServiceModule.kt',
    'BackgroundScanPackage.kt',
  ]) {
    const targetPath = path.join(targetDir, fileName);
    const nextContents = renderTemplate(fileName, androidPackage);
    const currentContents = fs.existsSync(targetPath)
      ? fs.readFileSync(targetPath, 'utf8')
      : null;

    if (currentContents !== nextContents) {
      fs.writeFileSync(targetPath, nextContents.endsWith('\n') ? nextContents : `${nextContents}\n`);
    }
  }
}

function ensureImport(contents, importPath) {
  const importLine = `import ${importPath}`;
  if (contents.includes(importLine)) {
    return contents;
  }

  const lines = contents.split('\n');
  const packageIndex = lines.findIndex((line) => /^package\s+/.test(line));
  if (packageIndex < 0) {
    throw new Error('Background scan plugin could not find a package declaration in MainApplication.kt.');
  }

  lines.splice(packageIndex + 1, 0, importLine);
  return lines.join('\n');
}

function ensurePackageRegistration(contents) {
  const registrationLine = 'add(BackgroundScanPackage())';
  if (contents.includes(registrationLine)) {
    return contents;
  }

  const applyAnchor = 'PackageList(this).packages.apply {';
  if (contents.includes(applyAnchor)) {
    return contents.replace(
      applyAnchor,
      `${applyAnchor}\n              ${registrationLine}`,
    );
  }

  const packageListAnchor = 'PackageList(this).packages';
  if (contents.includes(packageListAnchor)) {
    return contents.replace(
      packageListAnchor,
      `${packageListAnchor}.apply {\n              ${registrationLine}\n            }`,
    );
  }

  throw new Error('Background scan plugin could not find the ReactPackage list in MainApplication.kt.');
}

function ensureUsesPermission(manifest, permissionName) {
  const permissions = manifest.manifest['uses-permission'] ?? [];
  if (!permissions.some((permission) => permission.$['android:name'] === permissionName)) {
    permissions.push({
      $: {
        'android:name': permissionName,
      },
    });
  }
  manifest.manifest['uses-permission'] = permissions;
}

function ensureBackgroundScanService(mainApplication) {
  const services = mainApplication.service ?? [];
  const service = services.find((item) => item.$['android:name'] === SERVICE_NAME);
  const nextService = {
    $: {
      'android:name': SERVICE_NAME,
      'android:enabled': 'true',
      'android:exported': 'false',
      'android:foregroundServiceType': 'dataSync',
    },
  };

  if (service) {
    service.$ = {
      ...service.$,
      ...nextService.$,
    };
  } else {
    services.push(nextService);
  }

  mainApplication.service = services;
}

function withBackgroundScanFiles(config) {
  return withDangerousMod(config, [
    'android',
    async (modConfig) => {
      const androidPackage = getAndroidPackage(modConfig);
      writeBackgroundScanSources(modConfig.modRequest.projectRoot, androidPackage);
      return modConfig;
    },
  ]);
}

function withBackgroundScanManifest(config) {
  return withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults;
    ensureUsesPermission(manifest, 'android.permission.FOREGROUND_SERVICE');
    ensureUsesPermission(manifest, 'android.permission.FOREGROUND_SERVICE_DATA_SYNC');
    ensureUsesPermission(manifest, 'android.permission.WAKE_LOCK');
    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
    ensureBackgroundScanService(mainApplication);
    return modConfig;
  });
}

function withBackgroundScanMainApplication(config) {
  return withMainApplication(config, (modConfig) => {
    if (modConfig.modResults.language !== 'kt') {
      throw new Error('Background scan plugin expects MainApplication.kt.');
    }

    const androidPackage = getAndroidPackage(modConfig);
    const importPath = `${androidPackage}.backgroundscan.BackgroundScanPackage`;
    const nextContents = ensurePackageRegistration(
      ensureImport(modConfig.modResults.contents, importPath),
    );

    modConfig.modResults.contents = nextContents;
    return modConfig;
  });
}

function withBackgroundScan(config) {
  config = withBackgroundScanFiles(config);
  config = withBackgroundScanManifest(config);
  config = withBackgroundScanMainApplication(config);
  return config;
}

module.exports = createRunOncePlugin(
  withBackgroundScan,
  'app-cleaner-backgroundscan',
  require('../package.json').version,
);

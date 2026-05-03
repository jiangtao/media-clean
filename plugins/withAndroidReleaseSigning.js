const { createRunOncePlugin, withAppBuildGradle } = require('expo/config-plugins');

const KEYSTORE_BOOTSTRAP = `def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
`;

const RELEASE_SIGNING_CONFIG = `        release {
            if (keystorePropertiesFile.exists()) {
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
                if (keystoreProperties['storeType']) {
                    storeType keystoreProperties['storeType']
                }
            }
        }
`;

function ensureKeystoreBootstrap(contents) {
  if (contents.includes('def keystorePropertiesFile = rootProject.file("keystore.properties")')) {
    return contents;
  }

  return contents.replace(/android\s*\{/, `${KEYSTORE_BOOTSTRAP}\nandroid {`);
}

function ensureReleaseSigningConfig(contents) {
  if (contents.includes("storeFile file(keystoreProperties['storeFile'])")) {
    return contents;
  }

  return contents.replace(
    /signingConfigs\s*\{\s*debug\s*\{[\s\S]*?\n\s*}\s*\n\s*}/,
    (match) => match.replace(/\n\s*}\s*$/, `\n${RELEASE_SIGNING_CONFIG}    }`),
  );
}

function ensureDebugBuildTypeUsesDebugSigning(contents) {
  return contents.replace(
    /(buildTypes\s*\{\s*debug\s*\{[\s\S]*?)signingConfig\s+[^\n]+/,
    '$1signingConfig signingConfigs.debug',
  );
}

function ensureReleaseBuildTypeUsesReleaseSigning(contents) {
  const releaseSigningLine =
    'signingConfig keystorePropertiesFile.exists() ? signingConfigs.release : signingConfigs.debug';

  return contents.replace(
    /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig\s+[^\n]+/,
    `$1${releaseSigningLine}`,
  );
}

function withAndroidReleaseSigning(config) {
  return withAppBuildGradle(config, (modConfig) => {
    let contents = modConfig.modResults.contents;
    contents = ensureKeystoreBootstrap(contents);
    contents = ensureReleaseSigningConfig(contents);
    contents = ensureDebugBuildTypeUsesDebugSigning(contents);
    contents = ensureReleaseBuildTypeUsesReleaseSigning(contents);
    modConfig.modResults.contents = contents;
    return modConfig;
  });
}

module.exports = createRunOncePlugin(
  withAndroidReleaseSigning,
  'app-cleaner-android-release-signing',
  require('../package.json').version,
);

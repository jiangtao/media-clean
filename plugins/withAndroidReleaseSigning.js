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

const DEBUG_APPLICATION_ID_SUFFIX_LINE =
  "applicationIdSuffix = findProperty('android.debugApplicationIdSuffix') ?: '.debug'";

const VALIDATION_BUILD_TYPE = `        validation {
            initWith release
            signingConfig signingConfigs.debug
            applicationIdSuffix = findProperty('android.validationApplicationIdSuffix') ?: '.debug'
            versionNameSuffix = '-validation'
            matchingFallbacks = ['release']
            def enableValidationShrinkResources = findProperty('android.enableShrinkResourcesInValidationBuilds') ?: findProperty('android.enableShrinkResourcesInReleaseBuilds') ?: 'false'
            shrinkResources = enableValidationShrinkResources.toBoolean()
            minifyEnabled = (findProperty('android.enableMinifyInValidationBuilds') ?: findProperty('android.enableMinifyInReleaseBuilds') ?: false).toBoolean()
            proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"
            def enablePngCrunchInValidation = findProperty('android.enablePngCrunchInReleaseBuilds') ?: 'true'
            crunchPngs = enablePngCrunchInValidation.toBoolean()
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

function ensureDebugBuildTypeHasApplicationIdSuffix(contents) {
  const debugBlockMatch = contents.match(/buildTypes\s*\{\s*debug\s*\{[\s\S]*?\n\s*}/);
  if (!debugBlockMatch || debugBlockMatch[0].includes('applicationIdSuffix')) {
    return contents;
  }

  return contents.replace(
    /(buildTypes\s*\{\s*debug\s*\{\n)/,
    `$1            ${DEBUG_APPLICATION_ID_SUFFIX_LINE}\n`,
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

function ensureValidationBuildType(contents) {
  if (contents.includes('validation {')) {
    return contents;
  }

  return contents.replace(
    /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?\n\s*}\n)(\s*})/,
    `$1${VALIDATION_BUILD_TYPE}$2`,
  );
}

function withAndroidReleaseSigning(config) {
  return withAppBuildGradle(config, (modConfig) => {
    let contents = modConfig.modResults.contents;
    contents = ensureKeystoreBootstrap(contents);
    contents = ensureReleaseSigningConfig(contents);
    contents = ensureDebugBuildTypeUsesDebugSigning(contents);
    contents = ensureDebugBuildTypeHasApplicationIdSuffix(contents);
    contents = ensureReleaseBuildTypeUsesReleaseSigning(contents);
    contents = ensureValidationBuildType(contents);
    modConfig.modResults.contents = contents;
    return modConfig;
  });
}

module.exports = createRunOncePlugin(
  withAndroidReleaseSigning,
  'app-cleaner-android-release-signing',
  require('../package.json').version,
);

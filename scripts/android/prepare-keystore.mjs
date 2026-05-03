import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const androidDir = path.join(repoRoot, 'android');
const keystoreDir = path.join(androidDir, 'keystores');
const keystorePath = path.join(keystoreDir, 'release.keystore');
const keystorePropertiesPath = path.join(androidDir, 'keystore.properties');

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function resolveStoreType(filename) {
  const explicitType = process.env.ANDROID_KEYSTORE_TYPE;
  if (explicitType) {
    return explicitType;
  }

  if (!filename) {
    return 'JKS';
  }

  const lower = filename.toLowerCase();
  if (lower.endsWith('.p12') || lower.endsWith('.pfx')) {
    return 'PKCS12';
  }

  return 'JKS';
}

function main() {
  if (!fs.existsSync(androidDir)) {
    throw new Error('android directory does not exist. Run `expo prebuild --platform android --clean` first.');
  }

  const keystoreBase64 = requireEnv('ANDROID_KEYSTORE_BASE64');
  const storePassword = requireEnv('ANDROID_KEYSTORE_PASSWORD');
  const keyAlias = requireEnv('ANDROID_KEY_ALIAS');
  const filename = process.env.ANDROID_KEYSTORE_FILENAME ?? 'release.keystore';
  const storeType = resolveStoreType(filename);
  const keyPassword =
    process.env.ANDROID_KEY_PASSWORD || (storeType === 'PKCS12' ? storePassword : '');

  if (!keyPassword) {
    throw new Error('Missing required environment variable: ANDROID_KEY_PASSWORD');
  }

  fs.mkdirSync(keystoreDir, { recursive: true });
  fs.writeFileSync(keystorePath, Buffer.from(keystoreBase64, 'base64'));

  const props = [
    'storeFile=../keystores/release.keystore',
    `storePassword=${storePassword}`,
    `keyAlias=${keyAlias}`,
    `keyPassword=${keyPassword}`,
    `storeType=${storeType}`,
  ].join('\n');

  fs.writeFileSync(keystorePropertiesPath, `${props}\n`);
}

main();

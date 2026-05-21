import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

import { generateI18nResourceOutput } from './generate-i18n-resources.mjs';

const DEFAULT_ROOT = 'src/i18n/locales';
const DEFAULT_OUTPUT = 'src/i18n/resources.generated.ts';
const LOCALES = ['zh', 'en'];

function parseArgs(argv) {
  const options = {
    root: DEFAULT_ROOT,
    output: DEFAULT_OUTPUT,
    outputProvided: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--root') {
      options.root = argv[++index];
    } else if (arg === '--output') {
      options.output = argv[++index];
      options.outputProvided = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function listNamespaces(root) {
  const namespaces = new Set();
  for (const locale of LOCALES) {
    const localeRoot = join(root, locale);
    if (!existsSync(localeRoot)) {
      continue;
    }

    for (const entry of readdirSync(localeRoot, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.json')) {
        namespaces.add(basename(entry.name, '.json'));
      }
    }
  }

  return [...namespaces].sort();
}

function listFiles(directory, predicate, files = []) {
  if (!existsSync(directory)) {
    return files;
  }

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      listFiles(absolutePath, predicate, files);
      continue;
    }

    if (predicate(absolutePath)) {
      files.push(absolutePath);
    }
  }

  return files;
}

function collectLeafKeys(value, pathParts = [], errors = [], context = '') {
  if (typeof value === 'string') {
    const keyPath = pathParts.join('.');
    if (value.length === 0) {
      errors.push(`${context} empty string: ${keyPath}`);
    }
    return [keyPath];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      collectLeafKeys(item, [`${pathParts.join('.')}[${index}]`].filter(Boolean), errors, context),
    );
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) =>
      collectLeafKeys(item, [...pathParts, key], errors, context),
    );
  }

  errors.push(`${context} non-string value: ${pathParts.join('.')}`);
  return [];
}

function verifyResources(root) {
  const namespaces = listNamespaces(root);
  const errors = [];

  for (const namespace of namespaces) {
    const resourcesByLocale = {};
    const keySetsByLocale = {};

    for (const locale of LOCALES) {
      const filePath = join(root, locale, `${namespace}.json`);
      const context = `[${locale}/${namespace}]`;
      if (!existsSync(filePath)) {
        errors.push(`${context} missing namespace file`);
        continue;
      }

      try {
        resourcesByLocale[locale] = readJson(filePath);
      } catch (error) {
        errors.push(`${context} invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
        continue;
      }

      keySetsByLocale[locale] = new Set(
        collectLeafKeys(resourcesByLocale[locale], [], errors, context),
      );
    }

    const allKeys = new Set(
      LOCALES.flatMap((locale) => [...(keySetsByLocale[locale] ?? new Set())]),
    );

    for (const locale of LOCALES) {
      const keySet = keySetsByLocale[locale];
      if (!keySet) {
        continue;
      }

      for (const key of allKeys) {
        if (!keySet.has(key)) {
          errors.push(`[${locale}/${namespace}] missing key: ${key}`);
        }
      }
    }
  }

  return { errors, namespaces };
}

function verifyProductionSourceHasNoHardcodedChineseCopy(projectRoot) {
  const srcRoot = join(projectRoot, 'src');
  const sourceFiles = listFiles(srcRoot, (filePath) => {
    if (!/\.(ts|tsx)$/.test(filePath)) {
      return false;
    }

    return (
      !filePath.includes('/__tests__/') &&
      !filePath.includes('.test.') &&
      !filePath.includes('/src/i18n/locales/') &&
      !filePath.endsWith('/src/i18n/resources.generated.ts')
    );
  });

  return sourceFiles
    .map((filePath) => ({
      filePath,
      source: readFileSync(filePath, 'utf8'),
    }))
    .filter(({ source }) => /[\u4e00-\u9fff]/.test(source))
    .map(({ filePath }) => filePath.replace(`${projectRoot}/`, ''));
}

const options = parseArgs(process.argv.slice(2));
const root = resolve(process.cwd(), options.root);
const { errors, namespaces } = verifyResources(root);
const hardcodedChineseCopyFiles = verifyProductionSourceHasNoHardcodedChineseCopy(process.cwd());
const shouldCheckGeneratedOutput = options.root === DEFAULT_ROOT || options.outputProvided;

for (const filePath of hardcodedChineseCopyFiles) {
  errors.push(
    `[source] hard-coded Chinese text outside src/i18n/locales or tests: ${filePath}`,
  );
}

if (shouldCheckGeneratedOutput) {
  try {
    generateI18nResourceOutput({
      root: options.root,
      output: options.output,
      check: true,
    });
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
}

if (errors.length > 0) {
  console.error(`i18n resource verification failed for ${root}:`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`i18n resources verified: ${namespaces.length} namespaces.`);

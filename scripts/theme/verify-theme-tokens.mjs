#!/usr/bin/env node

import { generateThemeTokenOutputs } from './generate-theme-tokens.mjs';

try {
  const result = generateThemeTokenOutputs({ check: true });
  for (const filePath of result.files) {
    console.log(`Verified ${filePath}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

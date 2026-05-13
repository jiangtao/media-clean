#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync } from 'node:fs';
import path from 'node:path';

const args = new Set(process.argv.slice(2));
const ifGit = args.has('--if-git');

function runGit(gitArgs) {
  return execFileSync('git', gitArgs, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

let repoRoot;
try {
  repoRoot = runGit(['rev-parse', '--show-toplevel']);
} catch (error) {
  if (ifGit) {
    process.exit(0);
  }

  console.error('Cannot install hooks because this directory is not inside a Git repository.');
  process.exit(1);
}

const hooksPath = '.githooks';
const preCommitPath = path.join(repoRoot, hooksPath, 'pre-commit');

if (!existsSync(preCommitPath)) {
  console.error(`Cannot install hooks because ${path.relative(repoRoot, preCommitPath)} is missing.`);
  process.exit(1);
}

chmodSync(preCommitPath, 0o755);
runGit(['config', 'core.hooksPath', hooksPath]);
console.log(`Git hooks installed: core.hooksPath=${hooksPath}`);

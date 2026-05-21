#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const planDir = 'docs/plans/2026-05-17-android-stable-maintainability-plan';
const designDir = 'docs/plans/2026-05-17-android-stable-maintainability-design';
const indexPath = path.join(planDir, '_index.md');
const teamPlanPath = path.join(designDir, 'team-plan.md');

const expectedTasks = [
  '001',
  '002',
  '003',
  '004',
  '005',
  '006',
  '007',
  '008',
  '009',
  '010',
  '011',
  '012',
  '013',
  '014',
  '015',
  '016',
];

const requiredScripts = {
  'generate:i18n:resources': 'node scripts/i18n/generate-i18n-resources.mjs',
  'verify:theme:tokens': 'node scripts/theme/verify-theme-tokens.mjs',
  'verify:i18n:resources': 'node scripts/i18n/verify-i18n-resources.mjs',
  'verify:nativewind-rnr': 'node scripts/verify/verify-nativewind-rnr-infra.mjs',
  'verify:ui-composition': 'node scripts/verify/verify-ui-composition.mjs',
  'verify:high-risk-leaf-boundary': 'node scripts/verify/verify-high-risk-leaf-boundary.mjs',
  'verify:maintainability-plan': 'node scripts/verify/verify-maintainability-plan.mjs',
  'verify:maintainability': 'npm run generate:i18n:resources -- --check && npm run verify:theme:tokens && npm run verify:i18n:resources && npm run verify:nativewind-rnr && npm run verify:ui-composition && npm run verify:high-risk-leaf-boundary && npm run verify:maintainability-plan && npm run typecheck',
};

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!existsSync(absolutePath)) {
    throw new Error(`Missing required file: ${relativePath}`);
  }
  return readFileSync(absolutePath, 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function parseTasks(indexSource) {
  const taskBlocks = indexSource
    .split(/\n(?=  - id: "\d{3}")/)
    .filter((block) => block.includes('- id: "'));

  return taskBlocks.map((block) => {
    const id = block.match(/id: "([^"]+)"/)?.[1];
    const owner = block.match(/owner: "([^"]+)"/)?.[1];
    const dependsOnSource = block.match(/depends-on: \[([^\]]*)\]/)?.[1] ?? '';
    const dependsOn = [...dependsOnSource.matchAll(/"([^"]+)"/g)].map((match) => match[1]);

    return { id, owner, dependsOn };
  });
}

function verifyAcyclic(tasks) {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const visiting = new Set();
  const visited = new Set();

  function visit(taskId, chain = []) {
    if (visited.has(taskId)) {
      return;
    }
    if (visiting.has(taskId)) {
      throw new Error(`Task dependency cycle detected: ${[...chain, taskId].join(' -> ')}`);
    }

    const task = byId.get(taskId);
    assert(task, `Unknown task dependency: ${taskId}`);
    visiting.add(taskId);
    for (const dependency of task.dependsOn) {
      visit(dependency, [...chain, taskId]);
    }
    visiting.delete(taskId);
    visited.add(taskId);
  }

  for (const task of tasks) {
    visit(task.id);
  }
}

function verifyTaskFile(taskReferenceLine) {
  const match = taskReferenceLine.match(/\((\.\/[^)]+)\)/);
  assert(match, `Task reference is missing a relative link: ${taskReferenceLine}`);

  const relativePath = path.join(planDir, match[1].replace(/^\.\//, ''));
  const source = read(relativePath);
  const requiredMarkers = [
    '**depends-on**',
    '**Owner**',
    '## Files to Modify/Create',
    '## Verification Commands',
    '## Success Criteria',
  ];

  for (const marker of requiredMarkers) {
    assert(source.includes(marker), `${relativePath} missing marker: ${marker}`);
  }

  const filesSection = source.split('## Files to Modify/Create')[1]?.split('## Steps')[0] ?? '';
  assert(/^- /m.test(filesSection), `${relativePath} must list at least one write-scope file.`);
}

const indexSource = read(indexPath);
const tasks = parseTasks(indexSource);
assert(tasks.length === expectedTasks.length, `Expected ${expectedTasks.length} tasks, found ${tasks.length}.`);
assert(
  expectedTasks.every((id) => tasks.some((task) => task.id === id)),
  'Task index does not contain the complete 001-016 task set.',
);
assert(tasks.every((task) => task.owner), 'Every task in _index.md must have an owner.');
verifyAcyclic(tasks);

const taskReferenceLines = indexSource
  .split('\n')
  .filter((line) => line.startsWith('- [Task '));
assert(
  taskReferenceLines.length === expectedTasks.length,
  `Expected ${expectedTasks.length} task reference links, found ${taskReferenceLines.length}.`,
);
for (const line of taskReferenceLines) {
  verifyTaskFile(line);
}

const teamPlanSource = read(teamPlanPath);
for (const packet of [
  'baseline-android-visual',
  'theme-token-source',
  'i18n-json-source',
  'nativewind-rnr-infra',
  'settings-landing-leaf-ui',
  'module-skeletons',
  'photo-recycle-detail-leaf-token',
]) {
  assert(teamPlanSource.includes(`Work Packet: ${packet}`), `team-plan.md missing packet: ${packet}`);
}
for (const marker of [
  'Owner:',
  'Write Scope:',
  'Verification:',
  '高冲突文件',
  '串行合并',
  'PhotoGrid / RecycleBin / Detail',
]) {
  assert(teamPlanSource.includes(marker), `team-plan.md missing governance marker: ${marker}`);
}

const packageJson = JSON.parse(read('package.json'));
for (const [scriptName, command] of Object.entries(requiredScripts)) {
  assert(
    packageJson.scripts?.[scriptName] === command,
    `package.json script ${scriptName} must equal: ${command}`,
  );
}

console.log(`Maintainability plan verified: ${tasks.length} tasks, ${taskReferenceLines.length} task files.`);
console.log('Team ownership, write scopes, dependency graph, and verification aliases are present.');

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const args = parseArgs(process.argv.slice(2));
const port = args.port ?? process.env.MC_REPORT_PORT ?? '4310';
const session =
  args.session ??
  process.env.MC_REPORT_SESSION ??
  firstExisting([
    '.mc/mc-test/session.json',
    '.mc/rust-cli-default-layout/session.json',
    'artifacts/scan/case-full/session.json',
    'artifacts/scan/rust-cli/session.json',
  ]);

if (!session) {
  throw new Error('missing --session and no default report session exists');
}

const plan = args.plan ?? process.env.MC_REPORT_PLAN ?? inferPlan(session);
const query = new URLSearchParams({ session });
if (plan && fs.existsSync(resolveRepoPath(plan))) {
  query.set('plan', plan);
}

const url = `http://127.0.0.1:${port}/?${query.toString()}`;
console.log(`Media Clean report: ${url}`);
console.log(`Session: ${session}`);
if (plan) console.log(`Cleanup plan: ${plan}`);

const child = spawn('npm', ['--prefix', 'apps/report', 'run', 'dev', '--', '--port', port], {
  cwd: repoRoot,
  env: {
    ...process.env,
    MC_REPO_ROOT: repoRoot,
    MC_REPORT_SESSION: session,
    MC_REPORT_PLAN: plan ?? '',
  },
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith('--')) {
      throw new Error(`unexpected argument: ${value}`);
    }
    const key = value.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      throw new Error(`missing value for ${value}`);
    }
    parsed[key] = next;
    index += 1;
  }
  return parsed;
}

function firstExisting(candidates) {
  return candidates.find((candidate) => fs.existsSync(resolveRepoPath(candidate))) ?? null;
}

function inferPlan(sessionPath) {
  const candidate = path.join(path.dirname(sessionPath), 'cleanup-plan.json');
  return fs.existsSync(resolveRepoPath(candidate)) ? candidate : null;
}

function resolveRepoPath(input) {
  return path.isAbsolute(input) ? input : path.resolve(repoRoot, input);
}

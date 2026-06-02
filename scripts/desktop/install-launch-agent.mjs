import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const label = 'com.mediaclean.desktop.guardian';
const productDir = path.join(os.homedir(), 'Library', 'Application Support', 'Media Clean');
const guardianDir = path.join(productDir, 'guardian');
const launchAgentsDir = path.join(os.homedir(), 'Library', 'LaunchAgents');
const plistPath = path.join(launchAgentsDir, `${label}.plist`);
const guardianScriptPath = path.join(guardianDir, 'run.sh');
const stdoutPath = path.join(guardianDir, 'stdout.log');
const stderrPath = path.join(guardianDir, 'stderr.log');
const quitMarkerPath = path.join(productDir, 'intentional-quit');

const args = parseArgs(process.argv.slice(2));
const command = args.install ? 'install' : args.uninstall ? 'uninstall' : args.status ? 'status' : 'help';
const dryRun = args['dry-run'] === '1';

if (process.platform !== 'darwin') {
  throw new Error('Media Clean process guardian currently uses macOS LaunchAgent.');
}

if (command === 'help') {
  printHelp();
  process.exit(0);
}

if (command === 'install') {
  const appPath = path.resolve(args.app || args['app-path'] || process.env.MC_DESKTOP_APP_PATH || '/Applications/Media Clean.app');
  const executablePath = resolveAppExecutable(appPath);
  installLaunchAgent({ appPath, executablePath });
  process.exit(0);
}

if (command === 'uninstall') {
  uninstallLaunchAgent();
  process.exit(0);
}

if (command === 'status') {
  statusLaunchAgent();
  process.exit(0);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      parsed[key] = '1';
      continue;
    }
    parsed[key] = next;
    index += 1;
  }
  return parsed;
}

function resolveAppExecutable(appPath) {
  const macosDir = path.join(appPath, 'Contents', 'MacOS');
  if (!fs.existsSync(macosDir)) {
    if (dryRun) return path.join(macosDir, 'Electron');
    throw new Error(`Invalid app bundle: ${appPath}`);
  }

  const electronPath = path.join(macosDir, 'Electron');
  if (fs.existsSync(electronPath)) return electronPath;

  const candidates = fs.readdirSync(macosDir)
    .map((name) => path.join(macosDir, name))
    .filter((candidate) => fs.statSync(candidate).isFile());
  const executable = candidates.find((candidate) => (fs.statSync(candidate).mode & 0o111) !== 0);
  if (!executable) {
    throw new Error(`No executable found in ${macosDir}`);
  }
  return executable;
}

function installLaunchAgent({ appPath, executablePath }) {
  fs.mkdirSync(guardianDir, { recursive: true });
  fs.mkdirSync(launchAgentsDir, { recursive: true });
  writeGuardianScript(executablePath);
  writePlist(appPath);

  if (dryRun) {
    console.log(`[desktop guardian] dry-run install plist: ${plistPath}`);
    console.log(`[desktop guardian] app: ${appPath}`);
    console.log(`[desktop guardian] executable: ${executablePath}`);
    return;
  }

  launchctl(['bootout', guiDomain(), plistPath], { allowFailure: true });
  launchctl(['bootstrap', guiDomain(), plistPath]);
  launchctl(['enable', `${guiDomain()}/${label}`], { allowFailure: true });
  console.log(`[desktop guardian] installed ${label}`);
}

function uninstallLaunchAgent() {
  if (!dryRun) launchctl(['bootout', guiDomain(), plistPath], { allowFailure: true });
  if (fs.existsSync(plistPath)) fs.rmSync(plistPath, { force: true });
  if (fs.existsSync(guardianScriptPath)) fs.rmSync(guardianScriptPath, { force: true });
  console.log(`[desktop guardian] uninstalled ${label}`);
}

function statusLaunchAgent() {
  const result = spawnSync('launchctl', ['print', `${guiDomain()}/${label}`], { encoding: 'utf8' });
  if (result.status === 0) {
    process.stdout.write(result.stdout);
    return;
  }
  console.log(`[desktop guardian] ${label} is not loaded`);
}

function writeGuardianScript(executablePath) {
  const script = [
    '#!/bin/sh',
    'set -eu',
    `APP_EXEC=${shellQuote(executablePath)}`,
    `QUIT_MARKER=${shellQuote(quitMarkerPath)}`,
    '',
    'if [ -f "$QUIT_MARKER" ]; then',
    '  now="$(date +%s)"',
    '  marker_time="$(stat -f %m "$QUIT_MARKER" 2>/dev/null || echo 0)"',
    '  age="$((now - marker_time))"',
    '  if [ "$age" -lt 120 ]; then',
    '    exit 0',
    '  fi',
    '  rm -f "$QUIT_MARKER"',
    'fi',
    '',
    '"$APP_EXEC"',
    'status="$?"',
    '',
    'if [ -f "$QUIT_MARKER" ]; then',
    '  exit 0',
    'fi',
    '',
    'exit "$status"',
    '',
  ].join('\n');
  fs.writeFileSync(guardianScriptPath, script, { mode: 0o755 });
  fs.chmodSync(guardianScriptPath, 0o755);
}

function writePlist(appPath) {
  const plist = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    '<dict>',
    '  <key>Label</key>',
    `  <string>${label}</string>`,
    '  <key>ProgramArguments</key>',
    '  <array>',
    `    <string>${xmlEscape(guardianScriptPath)}</string>`,
    '  </array>',
    '  <key>RunAtLoad</key>',
    '  <true/>',
    '  <key>KeepAlive</key>',
    '  <dict>',
    '    <key>SuccessfulExit</key>',
    '    <false/>',
    '  </dict>',
    '  <key>WorkingDirectory</key>',
    `  <string>${xmlEscape(path.dirname(appPath))}</string>`,
    '  <key>StandardOutPath</key>',
    `  <string>${xmlEscape(stdoutPath)}</string>`,
    '  <key>StandardErrorPath</key>',
    `  <string>${xmlEscape(stderrPath)}</string>`,
    '</dict>',
    '</plist>',
    '',
  ].join('\n');
  fs.writeFileSync(plistPath, plist, 'utf8');
}

function launchctl(commandArgs, { allowFailure = false } = {}) {
  const result = spawnSync('launchctl', commandArgs, { encoding: 'utf8' });
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`launchctl ${commandArgs.join(' ')} failed: ${result.stderr || result.stdout}`);
  }
}

function guiDomain() {
  return `gui/${process.getuid()}`;
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function xmlEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function printHelp() {
  console.log([
    'Media Clean Desktop LaunchAgent guardian',
    '',
    'Usage:',
    '  node scripts/desktop/install-launch-agent.mjs --install --app "/Applications/Media Clean.app"',
    '  node scripts/desktop/install-launch-agent.mjs --uninstall',
    '  node scripts/desktop/install-launch-agent.mjs --status',
    '',
  ].join('\n'));
}

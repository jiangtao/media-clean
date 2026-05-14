import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const session = firstExisting([
  'artifacts/scan/rust-cli/session.json',
  'artifacts/scan/case-video/session.json',
  'artifacts/scan/case-full/session.json',
]);

if (!session) {
  throw new Error('verify:report:app needs an existing scan session artifact');
}

const scanFixtureRoot = path.join(repoRoot, '.tmp', 'report-app-fixture');
prepareScanFixture(scanFixtureRoot);

await run('npm', ['--prefix', 'apps/report', 'run', 'typecheck']);
await run('npm', ['--prefix', 'apps/report', 'run', 'build']);

const port = await freePort();
const server = spawn('npm', ['--prefix', 'apps/report', 'run', 'start', '--', '--port', String(port)], {
  cwd: repoRoot,
  env: {
    ...process.env,
    MC_REPO_ROOT: repoRoot,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

try {
  await waitFor(`http://127.0.0.1:${port}/api/report?session=${encodeURIComponent(session)}`);
  const payload = await getJson(
    `http://127.0.0.1:${port}/api/report?session=${encodeURIComponent(session)}`,
  );
  assert(payload.session?.assets?.length > 0, 'report API must return assets');
  assert(Array.isArray(payload.session?.clusters), 'report API must return clusters');
  if (payload.cleanupPlan?.assets?.length > 0) {
    const dryRun = await postJson(`http://127.0.0.1:${port}/api/trash`, {
      session: payload.paths.session,
      plan: payload.paths.cleanupPlan,
      assetIds: [payload.cleanupPlan.assets[0].id],
      confirm: false,
    });
    assert(dryRun.mode === 'dry-run', 'trash bridge dry-run must not move files');
    assert(dryRun.planCount === 1, 'trash bridge dry-run must select one cleanup plan');
    assert(dryRun.assetCount === 1, 'trash bridge dry-run must support selecting one file');
  }
  const directoryListing = await getJson(
    `http://127.0.0.1:${port}/api/directories?path=${encodeURIComponent(path.dirname(scanFixtureRoot))}`,
  );
  assert(directoryListing.current, 'directory API must return current path');
  assert(Array.isArray(directoryListing.directories), 'directory API must return directories');
  const scanJob = await postJson(`http://127.0.0.1:${port}/api/scan`, {
    root: scanFixtureRoot,
    sessionId: `verify-report-app-${Date.now()}`,
    mediaType: 'all',
  });
  assert(scanJob.jobId, 'scan API must return a job id');
  const completedScan = await waitForScanJob(port, scanJob.jobId);
  assert(completedScan.status === 'completed', `scan job must complete, got ${completedScan.status}`);
  assert(completedScan.session && completedScan.cleanupPlan, 'scan job must return session and cleanup plan paths');
  const scannedPayload = await getJson(
    `http://127.0.0.1:${port}/api/report?session=${encodeURIComponent(completedScan.session)}&plan=${encodeURIComponent(completedScan.cleanupPlan)}`,
  );
  assert(scannedPayload.summary?.assetCount > 0, 'scan job result must be readable by report API');
  await getText(`http://127.0.0.1:${port}/?session=${encodeURIComponent(session)}`);
  console.log(`report app verify ok: http://127.0.0.1:${port}/?session=${encodeURIComponent(session)}`);
} finally {
  server.kill('SIGTERM');
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: repoRoot, stdio: 'inherit' });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} failed with ${code}`));
    });
  });
}

function getJson(url) {
  return getText(url).then((text) => JSON.parse(text));
}

function postJson(url, body) {
  const payload = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const request = http.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (response) => {
        let data = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          data += chunk;
        });
        response.on('end', () => {
          if (response.statusCode && response.statusCode >= 400) {
            reject(new Error(`${url} returned ${response.statusCode}: ${data.slice(0, 500)}`));
            return;
          }
          resolve(JSON.parse(data));
        });
      },
    );
    request.on('error', reject);
    request.end(payload);
  });
}

function getText(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (response) => {
        let data = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          data += chunk;
        });
        response.on('end', () => {
          if (response.statusCode && response.statusCode >= 400) {
            reject(new Error(`${url} returned ${response.statusCode}: ${data.slice(0, 500)}`));
            return;
          }
          resolve(data);
        });
      })
      .on('error', reject);
  });
}

function waitFor(url) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      getText(url)
        .then(resolve)
        .catch((error) => {
          if (Date.now() - startedAt > 60_000) {
            reject(error);
            return;
          }
          setTimeout(tick, 500);
        });
    };
    tick();
  });
}

function waitForScanJob(port, jobId) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      getJson(`http://127.0.0.1:${port}/api/scan/${encodeURIComponent(jobId)}`)
        .then((job) => {
          if (job.status === 'completed') {
            resolve(job);
            return;
          }
          if (job.status === 'failed' || job.status === 'canceled') {
            reject(new Error(`scan job ${job.status}: ${job.error ?? 'no error'}`));
            return;
          }
          if (Date.now() - startedAt > 60_000) {
            reject(new Error(`scan job timed out: ${jobId}`));
            return;
          }
          setTimeout(tick, 500);
        })
        .catch((error) => {
          if (Date.now() - startedAt > 60_000) {
            reject(error);
            return;
          }
          setTimeout(tick, 500);
        });
    };
    tick();
  });
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === 'object') resolve(address.port);
        else reject(new Error('failed to allocate a free port'));
      });
    });
  });
}

function firstExisting(candidates) {
  return candidates.find((candidate) => fs.existsSync(path.resolve(repoRoot, candidate))) ?? null;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function prepareScanFixture(root) {
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, 'tiny.png'), solidPng(12, 12, [12, 28, 48]));
}

function solidPng(width, height, [red, green, blue]) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const offset = row + 1 + x * 4;
      raw[offset] = red;
      raw[offset + 1] = green;
      raw[offset + 2] = blue;
      raw[offset + 3] = 255;
    }
  }
  return pngBuffer(width, height, raw);
}

function pngBuffer(width, height, raw) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([signature, pngChunk('IHDR', ihdr), pngChunk('IDAT', zlib.deflateSync(raw)), pngChunk('IEND', Buffer.alloc(0))]);
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

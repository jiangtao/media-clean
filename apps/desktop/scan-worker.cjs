const path = require('node:path');

function decodeInput() {
  const encoded = process.argv[2];
  if (!encoded) throw new Error('scan worker input is required');
  return JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
}

function send(message) {
  if (typeof process.send === 'function') process.send(message);
}

function enginePackageRoot(input) {
  if (input.enginePackagePath) return path.normalize(input.enginePackagePath);
  if (process.env.MC_ENGINE_PACKAGE_PATH) return path.normalize(process.env.MC_ENGINE_PACKAGE_PATH);
  throw new Error('MC_ENGINE_PACKAGE_PATH is required');
}

function main() {
  const input = decodeInput();
  const engine = require(enginePackageRoot(input));
  const result = engine.scanDirectory({
    root: input.root,
    sessionId: input.sessionId,
    sessionPath: input.sessionPath,
    cleanupPlanPath: input.cleanupPlanPath,
    mediaType: input.mediaType || 'all',
    progress: true,
  });
  send({ type: 'complete', result });
}

try {
  main();
} catch (error) {
  send({
    type: 'error',
    error: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
}

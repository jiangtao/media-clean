const path = require('node:path');

function loadNative() {
  const explicit = process.env.MC_ENGINE_NATIVE;
  const candidates = [
    explicit,
    path.join(__dirname, 'native', 'mc_recognition_node.node'),
  ].filter(Boolean);

  const errors = [];
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (error) {
      errors.push(`${candidate}: ${error.message}`);
    }
  }
  throw new Error(`Unable to load Media Clean native engine:\n${errors.join('\n')}`);
}

const native = loadNative();

function analyzeRequest(request) {
  return JSON.parse(native.analyzeRequestJson(JSON.stringify(request)));
}

function scanDirectory(options) {
  return JSON.parse(native.scanDirectoryJson(JSON.stringify(options)));
}

module.exports = {
  analyzeRequest,
  scanDirectory,
};

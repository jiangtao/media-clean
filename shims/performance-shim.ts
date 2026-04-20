// Performance polyfill for React Native 0.81.5 (Bridgeless New Architecture)
// Provides performance.now() and other performance APIs

// @ts-nocheck
// @eslint-disable

if (typeof global.performance === 'undefined') {
  global.performance = {};
}

if (typeof global.performance.now !== 'function') {
  const start = Date.now();
  global.performance.now = function() {
    return Date.now() - start;
  };
}

// Ensure performance.mark and performance.measure exist (used by React DevTools)
if (typeof global.performance.mark !== 'function') {
  global.performance.mark = function() {};
}

if (typeof global.performance.measure !== 'function') {
  global.performance.measure = function() {};
}

if (typeof global.performance.getEntriesByName !== 'function') {
  global.performance.getEntriesByName = function() { return []; };
}

if (typeof global.performance.clearMarks !== 'function') {
  global.performance.clearMarks = function() {};
}

if (typeof global.performance.clearMeasures !== 'function') {
  global.performance.clearMeasures = function() {};
}

export {};

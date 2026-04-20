// Window shim for React Native 0.81.5 (Bridgeless New Architecture)
// Provides a minimal window object to prevent "Property 'window' doesn't exist" errors
// The real React Native implementation will replace this at runtime

// @ts-nocheck
// @eslint-disable

if (typeof global.window === 'undefined') {
  // Create a minimal window object
  const windowStub: Record<string, any> = {
    // Window properties
    document: undefined,
    location: { href: '' },
    navigator: global.navigator || {},
    self: undefined,
    top: undefined,
    parent: undefined,

    // Common window methods (no-ops)
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
    alert: () => {},
    confirm: () => true,
    prompt: () => null,
    setTimeout: global.setTimeout,
    clearTimeout: global.clearTimeout,
    setInterval: global.setInterval,
    clearInterval: global.clearInterval,
    setImmediate: global.setImmediate,
    clearImmediate: global.clearImmediate,
    requestAnimationFrame: global.requestAnimationFrame || ((cb) => setTimeout(cb, 16)),
    cancelAnimationFrame: global.cancelAnimationFrame || ((id) => clearTimeout(id)),

    // Console
    console: global.console,

    // Fetch
    fetch: global.fetch,

    // Storage (use AsyncStorage or memory fallback)
    localStorage: undefined,
    sessionStorage: undefined,

    // React Native specific
    __DEV__: global.__DEV__,
  };

  // Self-reference for window.self
  windowStub.self = windowStub;
  windowStub.top = windowStub;
  windowStub.parent = windowStub;

  global.window = windowStub;
}

export {};

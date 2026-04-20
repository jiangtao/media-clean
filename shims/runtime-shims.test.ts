import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalWindow = global.window;
const originalSetImmediate = global.setImmediate;
const originalClearImmediate = global.clearImmediate;

describe('runtime startup shims', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();

    if (typeof originalWindow === 'undefined') {
      Reflect.deleteProperty(global, 'window');
    } else {
      global.window = originalWindow;
    }

    if (typeof originalSetImmediate === 'undefined') {
      Reflect.deleteProperty(global, 'setImmediate');
    } else {
      global.setImmediate = originalSetImmediate;
    }

    if (typeof originalClearImmediate === 'undefined') {
      Reflect.deleteProperty(global, 'clearImmediate');
    } else {
      global.clearImmediate = originalClearImmediate;
    }
  });

  it('installs setImmediate and clearImmediate when they are missing', async () => {
    Reflect.deleteProperty(global, 'setImmediate');
    Reflect.deleteProperty(global, 'clearImmediate');
    Reflect.deleteProperty(global, 'window');

    await import('./immediate-shim');

    expect(typeof global.setImmediate).toBe('function');
    expect(typeof global.clearImmediate).toBe('function');

    const callback = vi.fn();
    const cancelledId = global.setImmediate(callback, 'cancelled');

    global.clearImmediate(cancelledId);
    vi.runAllTimers();

    expect(callback).not.toHaveBeenCalled();

    global.setImmediate(callback, 'executed');
    vi.runAllTimers();

    expect(callback).toHaveBeenCalledWith('executed');
  });

  it('creates a stable window stub with self references and timer hooks', async () => {
    Reflect.deleteProperty(global, 'window');
    Reflect.deleteProperty(global, 'setImmediate');
    Reflect.deleteProperty(global, 'clearImmediate');

    await import('./immediate-shim');
    await import('./window-shim');

    expect(global.window).toBeDefined();
    expect(global.window.self).toBe(global.window);
    expect(global.window.top).toBe(global.window);
    expect(global.window.parent).toBe(global.window);
    expect(global.window.setImmediate).toBe(global.setImmediate);
    expect(global.window.clearImmediate).toBe(global.clearImmediate);
  });
});

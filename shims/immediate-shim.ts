// setImmediate polyfill for Expo Go / bridgeless runtime startup.
// Some Expo module promise paths expect these globals to exist before the app mounts.

// @ts-nocheck
// @eslint-disable

if (typeof global.setImmediate !== 'function') {
  let immediateId = 0;
  const handles = new Map<number, ReturnType<typeof setTimeout>>();

  global.setImmediate = (callback: (...args: any[]) => void, ...args: any[]) => {
    const id = ++immediateId;
    const handle = setTimeout(() => {
      handles.delete(id);
      callback(...args);
    }, 0);

    handles.set(id, handle);
    return id;
  };

  global.clearImmediate = (id: number) => {
    const handle = handles.get(id);

    if (handle) {
      clearTimeout(handle);
      handles.delete(id);
    }
  };
}

if (typeof global.window !== 'undefined') {
  if (typeof global.window.setImmediate !== 'function') {
    global.window.setImmediate = global.setImmediate;
  }

  if (typeof global.window.clearImmediate !== 'function') {
    global.window.clearImmediate = global.clearImmediate;
  }
}

export {};

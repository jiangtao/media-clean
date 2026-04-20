// FormData shim for Metro bundler
// This provides a minimal FormData implementation during module loading
// The real implementation from React Native will replace this at runtime

class FormDataShim {
  private _parts: Array<[string, any]> = [];

  append(key: string, value: any): void {
    this._parts.push([key, value]);
  }

  set(key: string, value: any): void {
    // Remove existing entries with this key
    for (let i = this._parts.length - 1; i >= 0; i--) {
      if (this._parts[i][0] === key) {
        this._parts.splice(i, 1);
      }
    }
    this._parts.push([key, value]);
  }

  delete(key: string): void {
    for (let i = this._parts.length - 1; i >= 0; i--) {
      if (this._parts[i][0] === key) {
        this._parts.splice(i, 1);
      }
    }
  }

  has(key: string): boolean {
    return this._parts.some(([name]) => name === key);
  }

  get(key: string): any | null {
    const entry = this._parts.find(([name]) => name === key);
    return entry ? entry[1] : null;
  }

  getAll(key: string): Array<any> {
    return this._parts
      .filter(([name]) => name === key)
      .map(([, value]) => value);
  }

  *entries(): Generator<[string, any]> {
    for (const entry of this._parts) {
      yield entry;
    }
  }

  *keys(): Generator<string> {
    for (const [key] of this._parts) {
      yield key;
    }
  }

  *values(): Generator<any> {
    for (const [, value] of this._parts) {
      yield value;
    }
  }

  forEach(callback: (value: any, key: string, formData: FormDataShim) => void, thisArg?: any): void {
    for (const [key, value] of this._parts) {
      callback.call(thisArg, value, key, this);
    }
  }
}

// Only set if not already defined (React Native will define its own)
if (typeof global.FormData === 'undefined') {
  global.FormData = FormDataShim as any;
}

export {};

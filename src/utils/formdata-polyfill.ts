// Polyfill for React Native 0.81.5 - FormData
// This module provides lazy polyfills for FormData methods that are missing in React Native

// Extend FormData interface for React Native's internal _parts property
// Use interface merging to avoid conflicting with built-in DOM FormData
declare global {
  interface FormData {
    // React Native internal storage
    _parts?: Array<[string, any]>;
  }
}

// Type-safe wrapper for missing methods (these will be polyfilled at runtime)
type FormDataWithPolyfills = FormData & {
  set?(key: string, value: any): void;
  delete?(key: string): void;
  has?(key: string): boolean;
  get?(key: string): any | null;
  entries?(): Generator<[string, any]>;
  keys?(): Generator<string>;
  values?(): Generator<any>;
  forEach?(callback: (value: any, key: string, formData: FormData) => void, thisArg?: any): void;
};

/**
 * Apply FormData polyfills lazily
 * Call this function early in the app lifecycle, after React Native has initialized
 */
export function applyFormDataPolyfill(): void {
  if (typeof global.FormData === 'undefined') {
    console.warn('FormData is not available on global object');
    return;
  }

  const FormDataPrototype = global.FormData.prototype as FormDataWithPolyfills;

  // Add set() method - replaces existing values with the same key
  if (!FormDataPrototype.set) {
    FormDataPrototype.set = function(this: FormDataWithPolyfills, key: string, value: any) {
      const parts = (this._parts ||= []);
      // Remove all existing entries with this key
      for (let i = parts.length - 1; i >= 0; i--) {
        if (parts[i][0] === key) {
          parts.splice(i, 1);
        }
      }
      // Add the new value
      parts.push([key, value]);
    };
  }

  // Add delete() method - removes all entries with the given key
  if (!FormDataPrototype.delete) {
    FormDataPrototype.delete = function(this: FormDataWithPolyfills, key: string) {
      const parts = this._parts;
      if (!parts) return;
      for (let i = parts.length - 1; i >= 0; i--) {
        if (parts[i][0] === key) {
          parts.splice(i, 1);
        }
      }
    };
  }

  // Add has() method - checks if key exists
  if (!FormDataPrototype.has) {
    FormDataPrototype.has = function(this: FormDataWithPolyfills, key: string): boolean {
      const parts = this._parts;
      if (!parts) return false;
      return parts.some(([name]) => name === key);
    };
  }

  // Add get() method - returns first value for key
  if (!FormDataPrototype.get) {
    FormDataPrototype.get = function(this: FormDataWithPolyfills, key: string): any | null {
      const parts = this._parts;
      if (!parts) return null;
      const entry = parts.find(([name]) => name === key);
      return entry ? entry[1] : null;
    };
  }

  // Add entries() iterator
  if (!FormDataPrototype.entries) {
    FormDataPrototype.entries = function* (this: FormDataWithPolyfills): Generator<[string, any]> {
      const parts = this._parts;
      if (!parts) return;
      for (const entry of parts) {
        yield entry;
      }
    };
  }

  // Add keys() iterator
  if (!FormDataPrototype.keys) {
    FormDataPrototype.keys = function* (this: FormDataWithPolyfills): Generator<string> {
      const parts = this._parts;
      if (!parts) return;
      for (const [key] of parts) {
        yield key;
      }
    };
  }

  // Add values() iterator
  if (!FormDataPrototype.values) {
    FormDataPrototype.values = function* (this: FormDataWithPolyfills): Generator<any> {
      const parts = this._parts;
      if (!parts) return;
      for (const [, value] of parts) {
        yield value;
      }
    };
  }

  // Add forEach() method
  if (!FormDataPrototype.forEach) {
    FormDataPrototype.forEach = function(
      this: FormDataWithPolyfills,
      callback: (value: any, key: string, formData: FormData) => void,
      thisArg?: any
    ) {
      const parts = this._parts;
      if (!parts) return;
      for (const [key, value] of parts) {
        callback.call(thisArg, value, key, this);
      }
    };
  }
}

// Apply polyfill immediately for environments where FormData is already available
if (typeof global !== 'undefined' && typeof global.FormData !== 'undefined') {
  applyFormDataPolyfill();
}

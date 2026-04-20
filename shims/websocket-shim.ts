// WebSocket shim for React Native 0.81.5 (Bridgeless New Architecture)
// Provides a minimal WebSocket stub to prevent crashes during module loading
// The real React Native WebSocket implementation will replace this at runtime

// @ts-nocheck
// @eslint-disable

if (typeof global.WebSocket === 'undefined') {
  const WebSocketStub = class {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    CONNECTING = 0;
    OPEN = 1;
    CLOSING = 2;
    CLOSED = 3;

    url = '';
    readyState = 0;
    protocol = '';
    extensions = '';
    bufferedAmount = 0;

    onopen: any = null;
    onclose: any = null;
    onmessage: any = null;
    onerror: any = null;

    constructor(url: any, protocols?: any) {
      this.url = String(url);
      this.readyState = 0; // CONNECTING
      // Auto-trigger open after a tick
   setTimeout(() => {
        this.readyState = 1; // OPEN
     if (this.onopen) {
          try {
     this.onopen({ type: 'open' });
  } catch {}
        }
      }, 0);
    }

    send(data: any): void {
  // Stub - prevents crashes
    }

    close(code?: number, reason?: string): void {
      this.readyState = 3; // CLOSED
   if (this.onclose) {
        try {
       this.onclose({ type: 'close', code: code || 1000, reason: reason || '', wasClean: true });
        } catch {}
      }
    }

 addEventListener(type: string, listener: any): void {}
    removeEventListener(type: string, listener: any): void {}
    dispatchEvent(event: any): boolean {
   return true;
    }
  };

  (global as any).WebSocket = WebSocketStub;
}

export {};

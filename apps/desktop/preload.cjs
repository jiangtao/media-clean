const { contextBridge, ipcRenderer } = require('electron');

const scanListeners = new Set();
const trayListeners = new Set();

ipcRenderer.on('scan:changed', (_event, jobs) => {
  for (const listener of scanListeners) {
    listener(jobs);
  }
});

ipcRenderer.on('tray:changed', (_event, state) => {
  for (const listener of trayListeners) {
    listener(state);
  }
});

ipcRenderer.on('tray:shown', () => {
  window.dispatchEvent(new CustomEvent('media-clean:tray-shown'));
});

ipcRenderer.on('desktop:navigate-home', () => {
  window.dispatchEvent(new CustomEvent('media-clean:navigate-home'));
});

ipcRenderer.on('desktop:navigate-review', () => {
  window.dispatchEvent(new CustomEvent('media-clean:navigate-review'));
});

ipcRenderer.on('desktop:open-report', (_event, input) => {
  window.dispatchEvent(new CustomEvent('media-clean:open-report', { detail: input }));
});

const api = {
  version: () => ipcRenderer.invoke('desktop:version'),
  rendererMode: () => ipcRenderer.invoke('desktop:renderer-mode'),
  updateCheck: () => ipcRenderer.invoke('desktop:update-check'),
  notificationStatus: () => ipcRenderer.invoke('desktop:notification-status'),
  openNotificationSettings: () => ipcRenderer.invoke('desktop:open-notification-settings'),
  openHome: () => ipcRenderer.invoke('desktop:open-home'),
  chooseDirectories: () => ipcRenderer.invoke('dialog:choose-directories'),
  directoriesList: (input) => ipcRenderer.invoke('directories:list', input),
  scanStart: (input) => ipcRenderer.invoke('scan:start', input),
  scanList: () => ipcRenderer.invoke('scan:list'),
  scanCancel: (jobId) => ipcRenderer.invoke('scan:cancel', jobId),
  scanSubscribe: (listener) => {
    scanListeners.add(listener);
    return () => scanListeners.delete(listener);
  },
  sessionsList: (input) => ipcRenderer.invoke('sessions:list', input),
  sessionsDelete: (input) => ipcRenderer.invoke('sessions:delete', input),
  reportLoad: (input) => ipcRenderer.invoke('report:load', input),
  trashConfirm: (input) => ipcRenderer.invoke('trash:confirm', input),
  trayState: () => ipcRenderer.invoke('tray:state'),
  trayOpenWorkbench: () => ipcRenderer.invoke('tray:open-workbench'),
  trayOpenReview: () => ipcRenderer.invoke('tray:open-review'),
  trayOpenJobReview: (input) => ipcRenderer.invoke('tray:open-job-review', input),
  trayChooseAndScan: () => ipcRenderer.invoke('tray:choose-and-scan'),
  trayPause: () => ipcRenderer.invoke('tray:pause'),
  trayNotificationStatus: () => ipcRenderer.invoke('tray:notification-status'),
  trayOpenNotificationSettings: () => ipcRenderer.invoke('tray:open-notification-settings'),
  trayQuit: () => ipcRenderer.invoke('tray:quit'),
  trayClose: () => ipcRenderer.invoke('tray:close'),
  traySubscribe: (listener) => {
    trayListeners.add(listener);
    return () => trayListeners.delete(listener);
  },
  mediaUrl: (assetId) => `app://media/${encodeURIComponent(String(assetId))}`,
  posterUrl: (assetId) => `app://poster/${encodeURIComponent(String(assetId))}`,
};

contextBridge.exposeInMainWorld('mediaCleanDesktop', api);
contextBridge.exposeInMainWorld('mediaClean', api);

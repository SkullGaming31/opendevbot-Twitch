// eslint-disable-next-line @typescript-eslint/no-require-imports
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  startServer: async () => {
    return await ipcRenderer.invoke('start-server');
  }
  ,
  stopServer: async () => {
    return await ipcRenderer.invoke('stop-server');
  },
  onServerLog: (cb) => {
    const handler = (_e, msg) => cb(msg);
    ipcRenderer.on('server-log', handler);
    return () => ipcRenderer.removeListener('server-log', handler);
  }
  ,
  onServerHealth: (cb) => {
    const handler = (_e, msg) => cb(msg);
    ipcRenderer.on('server-health', handler);
    return () => ipcRenderer.removeListener('server-health', handler);
  }
  ,
  onServerReady: (cb) => {
    const handler = (_e, msg) => cb(msg);
    ipcRenderer.on('server-ready', handler);
    return () => ipcRenderer.removeListener('server-ready', handler);
  }

});

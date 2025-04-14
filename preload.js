// preload.js
const { contextBridge, ipcRenderer } = require('electron');

console.log('[Preload] Script starting.'); // Log start

contextBridge.exposeInMainWorld('electronAPI', {
  sendRequest: (payload) => {
    console.log('[Preload] invoking send-request'); // Log invocation
    return ipcRenderer.invoke('send-request', payload);
  },
  // New function to send log messages (info, error, etc.) to main process
  logMessage: (level, message) => {
    ipcRenderer.send('log-message', { level, message }); // Use ipcRenderer.send for one-way messages
  }
});

console.log('[Preload] contextBridge setup complete. electronAPI exposed.'); // Log completion
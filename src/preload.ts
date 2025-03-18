// Simple preload script
console.log('Preload script is running');

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    send: (channel, ...args) => ipcRenderer.send(channel, ...args),
    on: (channel, func) => {
      const subscription = (_event, ...args) => func(...args);
      ipcRenderer.on(channel, subscription);
      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },
    once: (channel, func) => {
      ipcRenderer.once(channel, (_event, ...args) => func(...args));
    },
    removeAllListeners: (channel) => {
      ipcRenderer.removeAllListeners(channel);
    }
  }
}); 
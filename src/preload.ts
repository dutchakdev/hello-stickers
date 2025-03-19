// Simple preload script
console.log('Preload script is running');

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    invoke: (channel, ...args) => {
      // List of allowed channels for invoke
      const validChannels = [
        'db-get-products',
        'db-get-products-by-type',
        'db-search-products',
        'db-get-product',
        'db-update-product',
        'db-get-stickers',
        'db-update-sticker',
        'db-get-printer-settings',
        'db-update-printer-settings',
        'db-get-printer-setting',
        'db-create-printer-setting',
        'db-get-notion-settings',
        'db-save-notion-settings',
        'db-get-google-drive-settings',
        'db-save-google-drive-settings',
        'db-get-general-settings',
        'db-save-general-settings',
        'save-file',
        'fetch-notion-data',
        'download-image-from-drive',
        'get-app-path',
        'get-available-printers',
        'print-pdf',
        'toggle-fullscreen',
        'is-fullscreen',
        'db:getAppSetting',
        'db:createOrUpdateAppSetting',
        'db:deleteAppSetting',
        'db:getAllAppSettings',
        // Debug feature channels
        'reset-database',
        'flush-downloaded-files',
        'restart-app',
        'confirm-dialog',
        'get-log-file-path',
        'clear-logs'
      ];
      
      if (validChannels.includes(channel)) {
        return ipcRenderer.invoke(channel, ...args);
      }
      
      throw new Error(`Unauthorized IPC invoke channel: ${channel}`);
    },
    send: (channel, ...args) => {
      // List of allowed channels for send
      const validChannels = [
        'print-progress',
        'log-message'
      ];
      
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, ...args);
      }
    },
    on: (channel, func) => {
      // List of allowed channels for on
      const validChannels = [
        'print-progress',
        'log-message'
      ];
      
      if (validChannels.includes(channel)) {
        const subscription = (_event, ...args) => func(...args);
        ipcRenderer.on(channel, subscription);
        return () => {
          ipcRenderer.removeListener(channel, subscription);
        };
      }
    },
    once: (channel, func) => {
      // List of allowed channels for once
      const validChannels = [
        'print-progress',
        'log-message'
      ];
      
      if (validChannels.includes(channel)) {
        ipcRenderer.once(channel, (_event, ...args) => func(...args));
      }
    },
    removeAllListeners: (channel) => {
      // List of allowed channels for removeAllListeners
      const validChannels = [
        'print-progress',
        'log-message'
      ];
      
      if (validChannels.includes(channel)) {
        ipcRenderer.removeAllListeners(channel);
      }
    }
  },
  // Expose database operations
  database: {
    // Settings operations
    getAppSetting: (key) => ipcRenderer.invoke('db:getAppSetting', key),
    createOrUpdateAppSetting: (key, value) => ipcRenderer.invoke('db:createOrUpdateAppSetting', key, value),
    deleteAppSetting: (key) => ipcRenderer.invoke('db:deleteAppSetting', key),
    getAllAppSettings: () => ipcRenderer.invoke('db:getAllAppSettings')
  }
}); 
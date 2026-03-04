const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // VPN Actions
  connect: (data) => ipcRenderer.invoke('vpn-connect', data),
  disconnect: (data) => ipcRenderer.invoke('vpn-disconnect', data),
  checkDeps: () => ipcRenderer.invoke('check-deps'),
  pingTest: (data) => ipcRenderer.invoke('ping-test', data),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  checkSetupStatus: () => ipcRenderer.invoke('check-setup-status'),
  installAdmin: () => ipcRenderer.invoke('install-admin-privileges'),
  completeSetup: () => ipcRenderer.invoke('complete-setup'),

  // Event Listeners
  onVpnStatus: (callback) => {
    ipcRenderer.on('vpn-status', (_event, value) => callback(value));
  },
  onXrayLog: (callback) => {
    ipcRenderer.on('xray-log', (_event, value) => callback(value));
  },
  onVpnStats: (callback) => {
    ipcRenderer.on('vpn-stats', (_event, value) => callback(value));
  },

  // Cleanup
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('vpn-status');
    ipcRenderer.removeAllListeners('xray-log');
    ipcRenderer.removeAllListeners('vpn-stats');
  },
});

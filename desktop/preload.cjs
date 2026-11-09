const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('rosterDesktop', {
  load: () => ipcRenderer.sendSync('roster:load'),
  save: text => ipcRenderer.sendSync('roster:save', text),
  print: () => ipcRenderer.invoke('roster:print')
});

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  settingsGet: () => ipcRenderer.invoke('settings:get'),
  settingsSet: (s) => ipcRenderer.invoke('settings:set', s),
  pickFolder: (key) => ipcRenderer.invoke('dialog:pickFolder', key),
  openPath: (p) => ipcRenderer.invoke('shell:openPath', p),
  deleteFile: (p) => ipcRenderer.invoke('file:delete', p),
  showItem: (p) => ipcRenderer.invoke('shell:showItem', p),
  libraryList: (f) => ipcRenderer.invoke('library:list', f),
  convertStart: (p) => ipcRenderer.invoke('convert:start', p),
  convertCancel: (id) => ipcRenderer.invoke('convert:cancel', id),
  toolsStatus: () => ipcRenderer.invoke('tools:status'),
  toolsEnsure: () => ipcRenderer.invoke('tools:ensure'),
  toolsUpdate: () => ipcRenderer.invoke('tools:update'),
  onJobProgress: (cb) => ipcRenderer.on('job:progress', (_e, d) => cb(d)),
  onJobDone: (cb) => ipcRenderer.on('job:done', (_e, d) => cb(d)),
  onJobFailed: (cb) => ipcRenderer.on('job:failed', (_e, d) => cb(d)),
  onToolsProgress: (cb) => ipcRenderer.on('tools:progress', (_e, d) => cb(d)),
});

const { contextBridge, ipcRenderer } = require('electron')

const invoke = ch => (...args) => ipcRenderer.invoke(ch, ...args)
contextBridge.exposeInMainWorld('api', {
  init: invoke('init'),
  checkUpdate: invoke('check-update'),
  downloadUpdate: invoke('download-update'),
  restartUpdate: invoke('restart-update'),
  updateState: invoke('update-state'),
  onUpdateState: cb => ipcRenderer.on('update-state', (_e, state) => cb(state)),
  loadAccount: invoke('load-account'),
  saveConfig: invoke('save-config'),
  fetchData: invoke('fetch-data'),
  copyUrl: invoke('copy-url'),
  exportExcel: invoke('export-excel'),
  exportJson: invoke('export-json'),
  importJson: invoke('import-json'),
  pickGameDir: invoke('pick-game-dir'),
  openDataDir: invoke('open-data-dir'),
  openExternal: invoke('open-external'),
  onProgress: cb => ipcRenderer.on('progress', (_e, text) => cb(text))
})

const { app, BrowserWindow, ipcMain, dialog, shell, clipboard, Menu } = require('electron')
const path = require('path')
const fs = require('fs')
const { Store } = require('./src/store')
const { parseGachaUrl, findGachaUrl, detectGameDir } = require('./src/url')
const { fetchAll } = require('./src/api')
const { exportExcel } = require('./src/excel')
const i18n = require('./src/i18n')

// 참고 앱처럼 실행 파일(개발 중에는 프로젝트) 옆 userData 폴더에 저장
const appRoot = app.isPackaged ? path.dirname(process.execPath) : __dirname
const store = new Store(process.env.WUWA_DATA_DIR || path.join(appRoot, 'userData'))
let win

function createWindow () {
  Menu.setApplicationMenu(null)
  win = new BrowserWindow({
    width: 1100,
    height: Number(process.env.WUWA_HEIGHT) || 760,
    minWidth: 720,
    minHeight: 500,
    title: tr('app.title'),
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'))
  if (process.env.WUWA_DEVTOOLS) win.webContents.openDevTools({ mode: 'detach' })
  // 개발용: 화면을 캡처해 파일로 저장하고 종료
  if (process.env.WUWA_SCREENSHOT) {
    win.webContents.on('console-message', (_e, level, msg) => console.log('[renderer]', msg))
    win.webContents.once('did-finish-load', () => setTimeout(async () => {
      const js = process.env.WUWA_SCREENSHOT_JS
      if (js) { await win.webContents.executeJavaScript(js); await new Promise(r => setTimeout(r, 800)) }
      const img = await win.webContents.capturePage()
      fs.writeFileSync(process.env.WUWA_SCREENSHOT, img.toPNG())
      app.quit()
    }, 2500))
  }
}

// 현재 언어: 설정값, 없으면 시스템 언어
const lang = () => i18n.normalize(store.loadConfig().lang || i18n.fromLocale(app.getLocale()))
const tr = (key, params) => i18n.t(lang(), key, params)

const progress = text => { if (win && !win.isDestroyed()) win.webContents.send('progress', text) }

function state (current) {
  const config = store.loadConfig()
  const accounts = store.listAccounts()
  const uid = current || config.current || accounts[0] || ''
  return { config, lang: lang(), version: app.getVersion(), accounts, current: uid, data: store.loadAccount(uid), dataDir: store.dir }
}

ipcMain.handle('init', () => {
  const config = store.loadConfig()
  if (!config.gameDir) {
    config.gameDir = detectGameDir('')
    store.saveConfig(config)
  }
  return state()
})

ipcMain.handle('load-account', (_e, uid) => {
  const config = store.loadConfig()
  config.current = uid
  store.saveConfig(config)
  return state(uid)
})

ipcMain.handle('save-config', (_e, patch) => {
  const config = Object.assign(store.loadConfig(), patch)
  store.saveConfig(config)
  return config
})

function resolveUrl (manualUrl) {
  if (manualUrl) return { url: manualUrl, from: tr('main.fromManual') }
  const config = store.loadConfig()
  const found = findGachaUrl([config.gameDir, detectGameDir(config.gameDir)])
  if (found.url) return { url: found.url, from: path.basename(found.file) }
  // 로그에 없으면 지난번에 쓴 URL로 시도 (만료됐을 수 있음)
  const saved = config.urls && config.urls[config.current]
  if (saved) return { url: saved, from: tr('main.fromSaved') }
  return { url: null }
}

ipcMain.handle('fetch-data', async (_e, manualUrl) => {
  const { url, from } = resolveUrl(manualUrl)
  if (!url) {
    throw new Error(tr('main.noUrl'))
  }
  const info = parseGachaUrl(url)
  if (!info) throw new Error(tr('main.badUrl'))
  progress(tr('main.urlFound', { from, uid: info.playerId }))
  const pools = await fetchAll(info, progress, lang())
  const fetchedTotal = Object.values(pools).reduce((a, p) => a + p.records.length, 0)
  const before = store.loadAccount(info.playerId)
  const { added } = store.mergeAccount(info, pools, 'api')
  const config = store.loadConfig()
  config.urls = Object.assign({}, config.urls, { [info.playerId]: info.url })
  config.current = info.playerId
  store.saveConfig(config)
  const st = state(info.playerId)
  st.result = { added, fetchedTotal, maybeExpired: fetchedTotal === 0 && !!before }
  return st
})

ipcMain.handle('copy-url', () => {
  const { url } = resolveUrl()
  if (url) clipboard.writeText(url)
  return !!url
})

ipcMain.handle('export-excel', async (_e, uid) => {
  const data = store.loadAccount(uid)
  if (!data) return false
  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: tr('dlg.excel'),
    defaultPath: path.join(app.getPath('documents'), `${tr('excel.filePrefix')}_${uid}_${stamp}.xlsx`),
    filters: [{ name: 'Excel', extensions: ['xlsx'] }]
  })
  if (canceled || !filePath) return false
  await exportExcel(data, filePath, lang())
  shell.showItemInFolder(filePath)
  return true
})

ipcMain.handle('export-json', async (_e, uid) => {
  const data = store.loadAccount(uid)
  if (!data) return false
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: tr('dlg.exportJson'),
    defaultPath: path.join(app.getPath('documents'), `wuwa-convene-${uid}.json`),
    filters: [{ name: 'JSON', extensions: ['json'] }]
  })
  if (canceled || !filePath) return false
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
  shell.showItemInFolder(filePath)
  return true
})

ipcMain.handle('import-json', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: tr('dlg.importJson'),
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile']
  })
  if (canceled || !filePaths.length) return null
  const data = JSON.parse(fs.readFileSync(filePaths[0], 'utf8'))
  if (!data || !data.playerId || !data.pools) throw new Error(tr('main.badJson'))
  const { added } = store.mergeAccount({ playerId: String(data.playerId), serverId: data.serverId, lang: data.lang }, data.pools, 'import')
  const st = state(String(data.playerId))
  st.result = { added }
  return st
})

ipcMain.handle('pick-game-dir', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: tr('dlg.pickDir'),
    properties: ['openDirectory']
  })
  if (canceled || !filePaths.length) return null
  return filePaths[0]
})

ipcMain.handle('detect-game-dir', () => detectGameDir(''))
ipcMain.handle('open-data-dir', () => shell.openPath(store.dir))
ipcMain.handle('open-external', (_e, url) => { if (/^https:\/\//.test(url)) shell.openExternal(url) })

app.whenReady().then(createWindow)
app.on('window-all-closed', () => app.quit())

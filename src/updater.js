const fs = require('fs')
const path = require('path')
const os = require('os')
const crypto = require('crypto')
const { Readable, Transform } = require('stream')
const { pipeline } = require('stream/promises')
const { execFile } = require('child_process')
const { promisify } = require('util')
const run = promisify(execFile)
const REPO = 'noire113-dev/wuwa-convenes-exporter'
const API = `https://api.github.com/repos/${REPO}/releases/latest`
const powershell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')

function versionParts (v) {
  const m = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(v)
  return m ? m.slice(1).map(Number) : null
}
function isNewer (remote, local) {
  const a = versionParts(remote); const b = versionParts(local)
  if (!a || !b) return false
  for (let i = 0; i < 3; i++) { if (a[i] !== b[i]) return a[i] > b[i] }
  return false
}
function releaseInfo (release, current) {
  if (!release || release.draft || release.prerelease || !versionParts(release.tag_name)) throw new Error('Invalid stable release')
  const version = release.tag_name.replace(/^v/, '')
  const asset = (release.assets || []).find(a => a.name === `WuWa-Convenes-Exporter-${version}-win-x64.zip`)
  const prefix = `https://github.com/${REPO}/releases/download/`
  const valid = asset && asset.browser_download_url.startsWith(prefix) && /^sha256:[a-f0-9]{64}$/i.test(asset.digest || '') && Number.isSafeInteger(asset.size) && asset.size > 0 && asset.size < 1024 ** 3
  return { version, available: isNewer(version, current), installable: !!valid, asset: valid ? asset : null }
}

function createUpdater (app, notify) {
  let release = null; let busy = false; let ready = null; let lastCheck = 0
  let state = { status: 'idle', version: '', percent: 0 }
  const set = patch => { state = { ...state, ...patch }; notify(state); return state }
  async function check () {
    if (busy || ready || Date.now() - lastCheck < 60000) return state
    busy = true
    set({ status: 'checking' })
    try {
      const response = await fetch(API, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'WuWa-Convenes-Exporter' }, signal: AbortSignal.timeout(15000) })
      if (response.status === 404) { release = null; lastCheck = Date.now(); return set({ status: 'no-release' }) }
      if (!response.ok) throw new Error(`GitHub HTTP ${response.status}`)
      release = releaseInfo(await response.json(), app.getVersion())
      lastCheck = Date.now()
      return set({ status: release.available ? (release.installable ? 'available' : 'unsupported') : 'latest', version: release.version })
    } catch (e) { set({ status: 'error' }); throw e } finally { busy = false }
  }
  async function download () {
    if (busy || ready) return state
    if (!app.isPackaged || process.platform !== 'win32' || process.arch !== 'x64') throw new Error('Automatic update requires the Windows x64 portable build')
    if (!release || !release.available || !release.installable) throw new Error('No verified update available')
    busy = true
    let temp
    try {
      set({ status: 'downloading', percent: 0 })
      temp = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'wuwa-update-'))
      const archive = path.join(temp, 'update.zip')
      const asset = release.asset
      const response = await fetch(asset.browser_download_url, { signal: AbortSignal.timeout(15 * 60 * 1000) })
      if (!response.ok || !response.body) throw new Error(`Download HTTP ${response.status}`)
      let received = 0; let lastPercent = -1
      const hash = crypto.createHash('sha256')
      await pipeline(Readable.fromWeb(response.body), new Transform({ transform (chunk, encoding, cb) {
        received += chunk.length
        if (received > asset.size) return cb(new Error('Unexpected archive size'))
        hash.update(chunk)
        const percent = Math.floor(received * 100 / asset.size)
        if (percent !== lastPercent) { lastPercent = percent; set({ percent }) }
        cb(null, chunk)
      } }), fs.createWriteStream(archive, { flags: 'wx' }))
      if (received !== asset.size || `sha256:${hash.digest('hex')}` !== asset.digest.toLowerCase()) throw new Error('Archive SHA-256 verification failed')
      set({ status: 'preparing' })
      const target = path.dirname(process.execPath)
      const stage = path.join(path.dirname(target), `.wuwa-update-${crypto.randomUUID()}`)
      const backup = `${target}.backup-${Date.now()}`
      const config = { target, stage, backup, archive, pid: process.pid, exe: path.basename(process.execPath), version: release.version }
      const configFile = path.join(temp, 'config.json')
      const script = path.join(temp, 'updater.ps1')
      await fs.promises.copyFile(path.join(__dirname, 'updater.ps1'), script)
      await fs.promises.writeFile(configFile, JSON.stringify(config), 'utf8')
      await run(powershell, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, '-Mode', 'Prepare', '-ConfigFile', configFile], { windowsHide: true, timeout: 180000 })
      await fs.promises.unlink(archive).catch(() => {})
      ready = { script, configFile, temp }
      return set({ status: 'ready', percent: 100 })
    } catch (e) {
      if (temp) await fs.promises.unlink(path.join(temp, 'update.zip')).catch(() => {})
      set({ status: 'download-error' }); throw e
    } finally { busy = false }
  }
  async function restart () {
    if (!ready || busy) return false
    busy = true
    const marker = path.join(ready.temp, 'helper-ready')
    let helperPid
    try {
      const launched = await run(powershell, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', ready.script, '-Mode', 'Launch', '-ConfigFile', ready.configFile], { windowsHide: true, cwd: ready.temp, timeout: 15000 })
      helperPid = Number(launched.stdout.trim())
      for (let i = 0; i < 150; i++) {
        if (fs.existsSync(marker)) { app.quit(); return true }
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      throw new Error('Update helper did not start')
    } catch (e) {
      if (Number.isInteger(helperPid) && helperPid > 0) { try { process.kill(helperPid) } catch (_) {} }
      busy = false; throw e
    }
  }
  return { check, download, restart, getState: () => state }
}
module.exports = { createUpdater, isNewer, releaseInfo }

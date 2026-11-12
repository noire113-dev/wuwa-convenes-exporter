const { test } = require('node:test')
const assert = require('node:assert/strict')
const { isNewer, releaseInfo, createUpdater } = require('../src/updater')
const release = (version = '3.8.3') => ({
  tag_name: `v${version}`, draft: false, prerelease: false,
  assets: [{ name: `WuWa-Convenes-Exporter-${version}-win-x64.zip`, size: 123,
    browser_download_url: `https://github.com/noire113-dev/wuwa-convenes-exporter/releases/download/v${version}/app.zip`, digest: `sha256:${'a'.repeat(64)}` }]
})
test('numeric stable versions only; no downgrade', () => {
  assert.ok(isNewer('v3.10.0', '3.9.9'))
  for (const v of ['3.8.2', '3.8.1', 'v3.8.3-beta.1', 'garbage', '03.9.0']) assert.equal(isNewer(v, '3.8.2'), false)
})
test('only exact Windows package with GitHub digest can be installed', () => {
  assert.equal(releaseInfo(release(), '3.8.2').installable, true)
  for (const patch of [{ digest: null }, { browser_download_url: 'https://evil.test/a.zip' }, { name: 'source.zip' }, { size: -1 }]) {
    const r = release(); Object.assign(r.assets[0], patch)
    assert.equal(releaseInfo(r, '3.8.2').installable, false)
  }
  assert.throws(() => releaseInfo({ ...release(), prerelease: true }, '3.8.2'))
})
test('check handles network failures, retry, caching, and newest version', async () => {
  const original = global.fetch
  let calls = 0
  const updater = createUpdater({ getVersion: () => '3.8.2' }, () => {})
  try {
    global.fetch = async () => { throw new Error('offline') }
    await assert.rejects(updater.check())
    assert.equal(updater.getState().status, 'error')
    global.fetch = async () => { calls++; return { ok: true, json: async () => release() } }
    assert.equal((await updater.check()).status, 'available')
    await updater.check()
    assert.equal(calls, 1)
    const current = createUpdater({ getVersion: () => '3.8.3' }, () => {})
    assert.equal((await current.check()).status, 'latest')
    global.fetch = async () => ({ status: 404 })
    assert.equal((await createUpdater({ getVersion: () => '3.8.2' }, () => {}).check()).status, 'no-release')
  } finally { global.fetch = original }
})
test('corrupt download never becomes ready', { skip: process.platform !== 'win32' }, async () => {
  const original = global.fetch
  const r = release(); r.assets[0].size = 3
  const updater = createUpdater({ isPackaged: true, getVersion: () => '3.8.2' }, () => {})
  try {
    global.fetch = async url => url.includes('api.github.com')
      ? { ok: true, json: async () => r }
      : { ok: true, body: new ReadableStream({ start (controller) { controller.enqueue(Buffer.from('bad')); controller.close() } }) }
    await updater.check()
    await assert.rejects(updater.download(), /SHA-256/)
    assert.equal(updater.getState().status, 'download-error')
    assert.equal(await updater.restart(), false)
  } finally { global.fetch = original }
})

require('./updater-windows.test')

test('game folder must be explicitly selected and contain Client', () => {
  const fs = require('fs'); const path = require('path'); const os = require('os')
  const { isGameDir } = require('../src/url')
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wuwa-path-test-'))
  try {
    assert.equal(isGameDir(''), false)
    assert.equal(isGameDir(root), false)
    const game = path.join(root, 'Wuthering Waves Game')
    fs.mkdirSync(path.join(game, 'Client'), { recursive: true })
    assert.equal(isGameDir(root), true)
    assert.equal(isGameDir(game), true)
    assert.equal(isGameDir(path.join(root, 'missing')), false)
  } finally { fs.rmSync(root, { recursive: true, force: true }) }
})

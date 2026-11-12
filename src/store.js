// 로컬 저장소: <앱 폴더>/userData 에 config.json 과 계정별 gacha-list-<UID>.json
const fs = require('fs')
const path = require('path')
const { mergeByTime } = require('./stats')

class Store {
  constructor (dir) {
    this.dir = dir
    fs.mkdirSync(dir, { recursive: true })
  }

  file (name) { return path.join(this.dir, name) }

  readJson (name, fallback) {
    try { return JSON.parse(fs.readFileSync(this.file(name), 'utf8')) } catch (_) { return fallback }
  }

  // 임시 파일에 쓰고 바꿔치기 + 직전 파일은 .bak 로 남긴다.
  writeJson (name, data) {
    const target = this.file(name)
    const tmp = target + '.tmp'
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8')
    if (fs.existsSync(target)) fs.copyFileSync(target, target + '.bak')
    fs.renameSync(tmp, target)
  }

  loadConfig () {
    return Object.assign({ gameDir: '', current: '', urls: {} }, this.readJson('config.json', {}))
  }

  saveConfig (cfg) { this.writeJson('config.json', cfg) }

  listAccounts () {
    return fs.readdirSync(this.dir)
      .map(n => n.match(/^gacha-list-(\d+)\.json$/))
      .filter(Boolean)
      .map(m => m[1])
  }

  loadAccount (uid) {
    if (!uid) return null
    return this.readJson(`gacha-list-${uid}.json`, null)
  }

  // pools: { [type]: { name, records } } 을 기존 데이터와 합쳐 저장
  mergeAccount (meta, pools, source = 'api') {
    const old = this.loadAccount(meta.playerId) || {
      app: 'wuwa-convene-export', version: 1, playerId: meta.playerId, pools: {}
    }
    let added = 0
    for (const [type, pool] of Object.entries(pools)) {
      const cur = old.pools[type] || { name: pool.name, records: [] }
      const { merged, added: n } = mergeByTime(cur.records, pool.records)
      old.pools[type] = { name: pool.name || cur.name, records: merged }
      added += Math.max(0, n)
    }
    if (meta.serverId) old.serverId = meta.serverId
    if (meta.lang) old.lang = meta.lang
    old.updatedAt = new Date().toISOString()
    old.lastSource = source
    this.writeJson(`gacha-list-${meta.playerId}.json`, old)
    return { data: old, added }
  }
}

module.exports = { Store }

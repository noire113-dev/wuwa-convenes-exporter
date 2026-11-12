// 게임 로그에서 튜닝 기록 URL을 찾고 파싱한다.
const fs = require('fs')
const path = require('path')

const GACHA_URL_RE = /https:\/\/aki-gm-resources(?:-oversea)?\.aki-game\.(?:net|com)\/aki\/gacha\/index\.html#\/record\?[^"\s<>'\\]+/g

function parseGachaUrl (url) {
  const text = String(url || '').trim()
  const m = text.match(new RegExp(GACHA_URL_RE.source))
  if (!m) return null
  const clean = m[0]
  const query = clean.split('#/record?')[1] || ''
  const p = new URLSearchParams(query)
  const info = {
    url: clean,
    playerId: p.get('player_id'),
    serverId: p.get('svr_id'),
    lang: p.get('lang') || 'ko',
    recordId: p.get('record_id'),
    cardPoolId: p.get('resources_id') || p.get('gacha_id'),
    svrArea: p.get('svr_area') || ''
  }
  if (!info.playerId || !info.serverId || !info.recordId || !info.cardPoolId) return null
  const isCn = info.svrArea === 'cn' || (!clean.includes('-oversea') && info.svrArea !== 'global')
  info.apiUrl = isCn
    ? 'https://gmserver-api.aki-game2.com/gacha/record/query'
    : 'https://gmserver-api.aki-game2.net/gacha/record/query'
  return info
}

// 게임 폴더(런처 폴더 또는 게임 본체 폴더)에서 로그 파일 후보를 최신순으로 모은다.
function collectLogFiles (gameDir) {
  const roots = [gameDir, path.join(gameDir, 'Wuthering Waves Game')]
  const files = []
  for (const root of roots) {
    const logDir = path.join(root, 'Client', 'Saved', 'Logs')
    try {
      for (const name of fs.readdirSync(logDir)) {
        if (/^Client.*\.log$/i.test(name)) files.push(path.join(logDir, name))
      }
    } catch (_) {}
    for (const sdk of ['KrPcSdk_Global', 'KrPcSdk_Mainland']) {
      files.push(path.join(root, 'Client', 'Binaries', 'Win64', 'ThirdParty', sdk, 'KRSDKRes', 'KRSDKWebView', 'debug.log'))
    }
  }
  return files
    .map(f => { try { return { f, t: fs.statSync(f).mtimeMs } } catch (_) { return null } })
    .filter(Boolean)
    .sort((a, b) => b.t - a.t)
    .map(x => x.f)
}

// 최신 클라이언트는 Client.log를 바이트 단위 XOR로 저장한다.
// 바이트의 최하위 비트가 1이면 0xA5, 0이면 0xEF 와 XOR (wuwatracker import.ps1 과 같은 방식)
function decodeClientLog (buf) {
  const out = Buffer.allocUnsafe(buf.length)
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i]
    out[i] = b ^ ((b & 1) ? 0xA5 : 0xEF)
  }
  return out
}

function lastMatch (text) {
  const all = text.match(GACHA_URL_RE)
  return all && all.length ? all[all.length - 1] : null
}

function findUrlInFile (file) {
  let buf
  try { buf = fs.readFileSync(file) } catch (_) { return null }
  if (/^Client.*\.log$/i.test(path.basename(file))) {
    const url = lastMatch(decodeClientLog(buf).toString('utf8'))
    if (url) return url
  }
  return lastMatch(buf.toString('latin1'))
}

// 모든 설치 폴더의 로그를 최신순으로 합쳐서, 처음 찾은 유효한 URL을 돌려준다.
function findGachaUrl (gameDirs) {
  const dirs = [...new Set(gameDirs.filter(Boolean))].filter(d => fs.existsSync(d))
  const files = dirs.flatMap(collectLogFiles)
    .map(f => ({ f, t: fs.statSync(f).mtimeMs }))
    .sort((a, b) => b.t - a.t)
    .map(x => x.f)
  for (const file of [...new Set(files)]) {
    const url = findUrlInFile(file)
    if (url && parseGachaUrl(url)) return { url, file }
  }
  return { url: null, file: null, searched: dirs }
}

function isGameDir (dir) {
  if (typeof dir !== 'string' || !dir.trim()) return false
  return [dir, path.join(dir, 'Wuthering Waves Game')].some(root => {
    try { return fs.statSync(path.join(root, 'Client')).isDirectory() } catch (_) { return false }
  })
}

module.exports = { GACHA_URL_RE, parseGachaUrl, findGachaUrl, collectLogFiles, isGameDir, decodeClientLog }

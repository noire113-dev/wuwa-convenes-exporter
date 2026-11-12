// 쿠로 튜닝 기록 API 호출
const { t, poolName } = require('./i18n')

// 게임 튜닝 기록 화면의 6개 풀 (서버의 cardPoolType 번호 → 게임 표기 이름)
const POOLS = [
  { type: 1, name: '공명자 이벤트 튜닝' },
  { type: 2, name: '무기 이벤트 튜닝' },
  { type: 3, name: '공명자 레귤러 튜닝' },
  { type: 4, name: '무기 레귤러 튜닝' },
  { type: 10, name: '여정이 남긴 캐릭터 튜닝' },
  { type: 11, name: '여정이 남긴 무기 튜닝' }
]
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function fetchPool (info, type) {
  const body = {
    playerId: info.playerId,
    cardPoolId: info.cardPoolId,
    cardPoolType: type,
    serverId: info.serverId,
    languageCode: info.lang,
    recordId: info.recordId
  }
  let lastErr
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(info.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20000)
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (json.code !== 0) {
        const e = new Error(json.message || `code ${json.code}`)
        e.apiCode = json.code
        throw e
      }
      return Array.isArray(json.data) ? json.data : []
    } catch (e) {
      lastErr = e
      if (e.apiCode !== undefined) break
      await sleep(800 * (attempt + 1))
    }
  }
  throw lastErr
}

// API는 최신순으로 준다 → 시간순으로 뒤집어 저장 형식으로 바꾼다.
function normalize (list, type) {
  return [...list].reverse().map(r => ({
    time: r.time,
    name: r.name,
    resourceId: r.resourceId,
    resourceType: r.resourceType,
    qualityLevel: r.qualityLevel,
    count: r.count,
    cardPoolType: type
  }))
}

// lang: 진행 문구·오류 문구의 언어 (저장되는 풀 이름은 데이터 호환을 위해 한국어 그대로)
async function fetchAll (info, onProgress, lang = 'ko') {
  const result = {}
  for (const pool of POOLS) {
    const label = poolName(lang, pool.type, pool.name)
    onProgress && onProgress(t(lang, 'main.fetching', { pool: label }))
    let raw
    try {
      raw = await fetchPool(info, pool.type)
    } catch (e) {
      if (e.apiCode !== undefined) throw new Error(t(lang, 'main.expired', { msg: e.message }))
      throw new Error(`${label}: ${e.message}`)
    }
    result[pool.type] = { name: pool.name, records: normalize(raw, pool.type) }
    await sleep(350)
  }
  return result
}

module.exports = { POOLS, fetchAll }

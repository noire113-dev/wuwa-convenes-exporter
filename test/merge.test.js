// 병합·천장 계산 검사: node test/merge.test.js
const assert = require('assert')
const { mergeByTime, poolStats } = require('../src/stats')
const { parseGachaUrl } = require('../src/url')

const rec = (time, name, q = 3, id = 21010013) => ({ time, name, qualityLevel: q, resourceId: id })

// 1) 빈 기록에 새 기록
let r = mergeByTime([], [rec('2026-01-01 10:00:00', 'a'), rec('2026-01-01 10:00:01', 'b')])
assert.strictEqual(r.merged.length, 2)
assert.strictEqual(r.added, 2)

// 2) 겹치는 범위 + 새 기록, 오래된 기록은 서버 범위 밖이어도 유지
const old = [rec('2025-01-01 00:00:00', 'old'), rec('2026-01-01 10:00:00', 'x'), rec('2026-01-01 10:00:00', 'y')]
const fetched = [rec('2026-01-01 10:00:00', 'x'), rec('2026-01-01 10:00:00', 'y'), rec('2026-01-02 00:00:00', 'new')]
r = mergeByTime(old, fetched)
assert.deepStrictEqual(r.merged.map(x => x.name), ['old', 'x', 'y', 'new'])
assert.strictEqual(r.added, 1)

// 3) 같은 기록을 다시 병합해도 늘지 않음
r = mergeByTime(r.merged, fetched)
assert.strictEqual(r.added, 0)

// 4) 같은 초에 10연차가 일부만 있던 경우 → 더 많은 쪽으로 채움
const ten = Array.from({ length: 10 }, (_, i) => rec('2026-02-01 12:00:00', 'p' + i))
r = mergeByTime(ten.slice(0, 4), ten)
assert.strictEqual(r.merged.length, 10)
assert.strictEqual(r.added, 6)

// 5) 천장·픽뚫 계산
const list = []
for (let i = 0; i < 69; i++) list.push(rec('2026-03-01 00:00:' + String(i % 60).padStart(2, '0'), 'w3'))
list.push(rec('2026-03-02 00:00:00', '베리나', 5, 1503)) // 70회째 픽뚫
for (let i = 0; i < 9; i++) list.push(rec('2026-03-03 00:00:00', 'w3'))
list.push(rec('2026-03-03 00:00:01', '사슬', 4, 1102))
list.push(rec('2026-03-04 00:00:00', '한정캐', 5, 1606)) // 11회째 확정
list.push(rec('2026-03-05 00:00:00', 'w3'))
const s = poolStats(list, '1')
assert.strictEqual(s.total, 82)
assert.deepStrictEqual(s.ssrPos.map(p => [p.name, p.pity, p.lost]), [['베리나', 70, true], ['한정캐', 11, false]])
assert.strictEqual(s.lost, 1)
assert.strictEqual(s.won, 0)
assert.strictEqual(s.pity5, 1)
assert.strictEqual(s.count4c, 1)
assert.strictEqual(s.avg5, 40.5)

// 6) URL 파싱
const url = 'https://aki-gm-resources-oversea.aki-game.net/aki/gacha/index.html#/record?svr_id=abc&player_id=500000001&lang=ko&gacha_id=100001&gacha_type=6&svr_area=global&record_id=deadbeef&resources_id=0123456789abcdef0123456789abcdef'
const info = parseGachaUrl('로그 앞부분 "' + url + '" 뒷부분')
assert.strictEqual(info.playerId, '500000001')
assert.strictEqual(info.cardPoolId, '0123456789abcdef0123456789abcdef')
assert.strictEqual(info.apiUrl, 'https://gmserver-api.aki-game2.net/gacha/record/query')
assert.strictEqual(parseGachaUrl('https://example.com'), null)

// 7) Client.log XOR 해독: 실제 로그 첫 바이트들로 확인한 방식과 같은지
const { decodeClientLog } = require('../src/url')
const plain = Buffer.from('[2026.11.12-22.30.23:265] ' + url, 'utf8')
// 인코딩은 해독의 역: 해독 결과의 최하위 비트가 바뀌므로 후보 두 개 중 해독이 맞는 쪽을 고른다
const enc = Buffer.from(plain.map(p => [p ^ 0xA5, p ^ 0xEF].find(c => (c ^ ((c & 1) ? 0xA5 : 0xEF)) === p)))
assert.strictEqual(decodeClientLog(enc).toString('utf8'), plain.toString('utf8'))

console.log('모든 검사 통과')

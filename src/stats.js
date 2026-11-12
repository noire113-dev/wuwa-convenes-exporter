// 통계·병합 로직. Node(main)와 브라우저(renderer) 양쪽에서 쓴다.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory()
  else root.WuwaStats = factory()
})(typeof self !== 'undefined' ? self : this, function () {
  // 상시 5성 공명자: 능양·앙코·카카루·감심·베리나 (이벤트 공명자 튜닝에서 나오면 통상 = 반반 실패)
  const STANDARD_5_IDS = new Set([1104, 1203, 1301, 1405, 1503])
  const STANDARD_5_NAMES = new Set(['능양', '앙코', '카카루', '감심', '베리나', 'Lingyang', 'Encore', 'Calcharo', 'Jianxin', 'Verina', '凌阳', '安可', '卡卡罗', '鉴心', '维里奈'])

  const isResonator = r => Number(r.resourceId) < 100000
  const isStandard5 = r => STANDARD_5_IDS.has(Number(r.resourceId)) || STANDARD_5_NAMES.has(r.name)

  // 같은 시각(초 단위)끼리 묶어 비교하고, 같은 시각에 기록이 더 많은 쪽을 택한다.
  // 기존 기록은 지우지 않으며, 새로 가져온 범위 밖의 오래된 기록도 그대로 남는다.
  function mergeByTime (oldList, newList) {
    const groups = new Map()
    const put = (list, src) => {
      const local = new Map()
      for (const r of list) {
        if (!local.has(r.time)) local.set(r.time, [])
        local.get(r.time).push(r)
      }
      for (const [t, g] of local) {
        const cur = groups.get(t)
        if (!cur || g.length > cur.length) groups.set(t, g)
      }
    }
    put(oldList || [], 'old')
    put(newList || [], 'new')
    const times = [...groups.keys()].sort()
    const merged = []
    for (const t of times) merged.push(...groups.get(t))
    return { merged, added: merged.length - (oldList || []).length }
  }

  function poolStats (records, poolType) {
    const s = {
      total: records.length,
      date: [records[0] && records[0].time, records.length ? records[records.length - 1].time : null],
      count5: 0, count5c: 0, count5w: 0,
      count4: 0, count4c: 0, count4w: 0,
      count3: 0,
      ssrPos: [],
      pity5: 0, pity4: 0,
      lost: 0, won: 0
    }
    let since5 = 0
    let since4 = 0
    let guaranteed = false
    for (const r of records) {
      since5++
      since4++
      const q = Number(r.qualityLevel)
      if (q === 5) {
        s.count5++
        isResonator(r) ? s.count5c++ : s.count5w++
        let lost = false
        if (Number(poolType) === 1) {
          if (isStandard5(r)) { lost = true; s.lost++; guaranteed = true } else { if (!guaranteed) s.won++; guaranteed = false }
        }
        s.ssrPos.push({ name: r.name, pity: since5, time: r.time, lost })
        since5 = 0
        since4 = 0
      } else if (q === 4) {
        s.count4++
        isResonator(r) ? s.count4c++ : s.count4w++
        since4 = 0
      } else {
        s.count3++
      }
    }
    s.pity5 = since5
    s.pity4 = since4
    s.avg5 = s.ssrPos.length ? Math.round(s.ssrPos.reduce((a, b) => a + b.pity, 0) / s.ssrPos.length * 100) / 100 : 0
    return s
  }

  return { mergeByTime, poolStats, isResonator, isStandard5 }
})

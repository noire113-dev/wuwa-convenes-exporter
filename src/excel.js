const ExcelJS = require('exceljs')
const { poolStats, isResonator } = require('./stats')

async function exportExcel (data, filePath) {
  const wb = new ExcelJS.Workbook()
  wb.creator = '명조 튜닝 기록 내보내기'
  const types = Object.keys(data.pools).sort((a, b) => a - b)
  for (const type of types) {
    const pool = data.pools[type]
    const sheetName = pool.name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31)
    const ws = wb.addWorksheet(sheetName)
    ws.columns = [
      { header: '시간', key: 'time', width: 22 },
      { header: '이름', key: 'name', width: 18 },
      { header: '종류', key: 'kind', width: 10 },
      { header: '등급', key: 'q', width: 6 },
      { header: '총 회차', key: 'idx', width: 8 },
      { header: '천장 카운트', key: 'pity', width: 11 },
      { header: '비고', key: 'note', width: 10 }
    ]
    const stats = poolStats(pool.records, type)
    const lostTimes = new Set(stats.ssrPos.filter(p => p.lost).map(p => p.time + p.name))
    let since = 0
    pool.records.forEach((r, i) => {
      since++
      const q = Number(r.qualityLevel)
      const row = ws.addRow({
        time: r.time,
        name: r.name,
        kind: r.resourceType || (isResonator(r) ? '공명자' : '무기'),
        q,
        idx: i + 1,
        pity: since,
        note: q === 5 && lostTimes.has(r.time + r.name) ? '통상' : ''
      })
      if (q === 5) { row.font = { bold: true, color: { argb: 'FFC0841A' } }; since = 0 } else if (q === 4) row.font = { color: { argb: 'FF8E44AD' } }
    })
    ws.getRow(1).font = { bold: true }
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBD7D3' } }
    ws.views = [{ state: 'frozen', ySplit: 1 }]
  }
  await wb.xlsx.writeFile(filePath)
}

module.exports = { exportExcel }

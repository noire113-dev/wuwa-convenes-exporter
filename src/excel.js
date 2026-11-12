const ExcelJS = require('exceljs')
const { poolStats, isResonator } = require('./stats')
const { t, poolName } = require('./i18n')

async function exportExcel (data, filePath, lang = 'ko') {
  const wb = new ExcelJS.Workbook()
  wb.creator = t(lang, 'app.title')
  const types = Object.keys(data.pools)
    .filter(type => data.pools[type].records.length)
    .sort((a, b) => a - b)
  for (const type of types) {
    const pool = data.pools[type]
    const sheetName = poolName(lang, type, pool.name).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31)
    const ws = wb.addWorksheet(sheetName)
    ws.columns = [
      { header: t(lang, 'excel.time'), key: 'time', width: 22 },
      { header: t(lang, 'excel.name'), key: 'name', width: 18 },
      { header: t(lang, 'excel.kind'), key: 'kind', width: 11 },
      { header: t(lang, 'excel.quality'), key: 'q', width: 7 },
      { header: t(lang, 'excel.index'), key: 'idx', width: 8 },
      { header: t(lang, 'excel.pity'), key: 'pity', width: 11 },
      { header: t(lang, 'excel.note'), key: 'note', width: 10 }
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
        kind: t(lang, isResonator(r) ? 'detail.resonator' : 'detail.weapon'),
        q,
        idx: i + 1,
        pity: since,
        note: q === 5 && lostTimes.has(r.time + r.name) ? t(lang, 'excel.std') : ''
      })
      if (q === 5) {
        row.font = { bold: true, color: { argb: 'FFC0841A' } }
        since = 0
      } else if (q === 4) {
        row.font = { color: { argb: 'FF8E44AD' } }
      }
    })
    ws.getRow(1).font = { bold: true }
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBD7D3' } }
    ws.views = [{ state: 'frozen', ySplit: 1 }]
  }
  await wb.xlsx.writeFile(filePath)
}

module.exports = { exportExcel }

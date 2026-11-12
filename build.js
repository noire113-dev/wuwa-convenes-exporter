// exe 빌드: node build.js  →  dist/WuWa Convenes Exporter-win32-x64/WuWa Convenes Exporter.exe
// 기존 userData(저장된 기록)가 있으면 결과 폴더로 복사한다.
const fs = require('fs')
const path = require('path')

;(async () => {
  const { packager } = await import('@electron/packager')
  const [outDir] = await packager({
    dir: __dirname,
    name: 'WuWa Convenes Exporter',
    executableName: 'WuWa Convenes Exporter',
    platform: 'win32',
    arch: 'x64',
    out: path.join(__dirname, 'dist'),
    overwrite: true,
    asar: true,
    prune: true,
    ignore: [/^\/dist($|\/)/, /^\/userData($|\/)/, /^\/test($|\/)/, /^\/docs($|\/)/, /^\/\.git($|\/)/, /^\/\.gitignore$/, /^\/README\.md$/, /^\/start\.bat$/, /^\/build\.js$/, /^\/vendor\.js$/],
    appCopyright: 'MIT',
    win32metadata: {
      FileDescription: '명조 튜닝 기록 내보내기',
      ProductName: '명조 튜닝 기록 내보내기'
    }
  })
  // 내 기록까지 함께 넣으려면: node build.js --with-data  (배포용 빌드에는 넣지 않는다)
  const src = path.join(__dirname, 'userData')
  if (process.argv.includes('--with-data') && fs.existsSync(src)) {
    fs.cpSync(src, path.join(outDir, 'userData'), { recursive: true })
    console.log('userData 복사함')
  }
  console.log('완료:', outDir)
})().catch(e => { console.error(e); process.exit(1) })

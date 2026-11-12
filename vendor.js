// 화면에서 쓰는 라이브러리·폰트 배포 파일만 renderer/vendor 로 복사 (npm start / build 전에 실행)
const fs = require('fs')
const path = require('path')

const scripts = {
  'vue.global.prod.js': 'vue/dist/vue.global.prod.js',
  'element-plus.js': 'element-plus/dist/index.full.min.js',
  'element-plus.css': 'element-plus/dist/index.css',
  'element-plus-ko.js': 'element-plus/dist/locale/ko.min.js',
  'element-plus-en.js': 'element-plus/dist/locale/en.min.js',
  'element-plus-icons.js': '@element-plus/icons-vue/dist/index.iife.min.js',
  'echarts.min.js': 'echarts/dist/echarts.min.js'
}
// Pretendard (SIL Open Font License 1.1) — 라이선스 파일을 폰트와 함께 둔다
const binaries = {
  'PretendardVariable.woff2': 'pretendard/dist/web/variable/woff2/PretendardVariable.woff2',
  'Pretendard-LICENSE.txt': 'pretendard/dist/LICENSE.txt'
}

const out = path.join(__dirname, 'renderer', 'vendor')
fs.mkdirSync(out, { recursive: true })
const src = rel => path.join(__dirname, 'node_modules', rel)

for (const [name, rel] of Object.entries(scripts)) {
  // 원본 끝의 소스맵 주석은 없는 파일을 가리키므로 지운다
  const text = fs.readFileSync(src(rel), 'utf8').replace(/\n\/[/*]# sourceMappingURL=.*$/m, '')
  fs.writeFileSync(path.join(out, name), text)
}
for (const [name, rel] of Object.entries(binaries)) {
  fs.copyFileSync(src(rel), path.join(out, name))
}

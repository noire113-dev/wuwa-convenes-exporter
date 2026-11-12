// 화면에서 쓰는 라이브러리 배포 파일만 renderer/vendor 로 복사 (npm start / build 전에 실행)
const fs = require('fs')
const path = require('path')

const files = {
  'vue.global.prod.js': 'vue/dist/vue.global.prod.js',
  'element-plus.js': 'element-plus/dist/index.full.min.js',
  'element-plus.css': 'element-plus/dist/index.css',
  'element-plus-ko.js': 'element-plus/dist/locale/ko.min.js',
  'element-plus-icons.js': '@element-plus/icons-vue/dist/index.iife.min.js',
  'echarts.min.js': 'echarts/dist/echarts.min.js'
}
const out = path.join(__dirname, 'renderer', 'vendor')
fs.mkdirSync(out, { recursive: true })
for (const [name, rel] of Object.entries(files)) {
  fs.copyFileSync(path.join(__dirname, 'node_modules', rel), path.join(out, name))
}
// 원본 파일 끝의 소스맵 주석은 없는 파일을 가리키므로 지운다
for (const name of Object.keys(files)) {
  const p = path.join(out, name)
  const text = fs.readFileSync(p, 'utf8').replace(/\n\/[/*]# sourceMappingURL=.*$/m, '')
  fs.writeFileSync(p, text)
}

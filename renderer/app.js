/* global Vue, ElementPlus, ElementPlusLocaleKo, ElementPlusIconsVue, echarts, WuwaStats */
const { createApp, reactive, computed, toRefs, ref, onMounted, onBeforeUnmount, watch, markRaw } = Vue
const { ElMessage } = ElementPlus
const icons = markRaw(ElementPlusIconsVue)
const bridge = window.api

const PALETTE = ['#5470c6', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc', '#2ab7ca', '#005b96', '#ff8b94', '#72a007', '#b60d1b', '#16570d']
const nameColors = new Map()
function colorOf (name) {
  if (!nameColors.has(name)) nameColors.set(name, PALETTE[nameColors.size % PALETTE.length])
  return nameColors.get(name)
}
const cleanErr = e => String((e && e.message) || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
const fmtTime = iso => iso ? new Date(iso).toLocaleString('ko-KR') : ''

const PieChart = {
  props: { stats: Object },
  template: '<div class="chart"><div ref="el" class="chart-inner"></div></div>',
  setup (props) {
    const el = ref(null)
    let chart
    const render = () => {
      const s = props.stats
      const items = [
        ['5성 공명자', s.count5c, '#fac858'],
        ['5성 무기', s.count5w, '#ee6666'],
        ['4성 공명자', s.count4c, '#5470c6'],
        ['4성 무기', s.count4w, '#91cc75'],
        ['3성 무기', s.count3, '#73c0de']
      ].filter(x => x[1] > 0)
      chart.setOption({
        tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
        legend: { top: 0, itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 11 }, data: items.map(x => x[0]) },
        series: [{
          type: 'pie',
          radius: '60%',
          center: ['50%', '60%'],
          minAngle: 4,
          label: { fontSize: 11, formatter: '{b}: {c}' },
          data: items.map(x => ({ name: x[0], value: x[1], itemStyle: { color: x[2] } }))
        }]
      }, true)
    }
    const resize = () => chart && chart.resize()
    onMounted(() => { chart = echarts.init(el.value); render(); window.addEventListener('resize', resize) })
    onBeforeUnmount(() => { window.removeEventListener('resize', resize); chart && chart.dispose() })
    watch(() => props.stats, () => chart && render())
    return { el }
  }
}

const PoolDetail = {
  props: { stats: Object, type: String },
  template: '#tpl-detail',
  setup (props) {
    return {
      colorOf,
      day: t => t ? t.slice(0, 10) : '-',
      pct: n => props.stats.total ? `${Math.round(n / props.stats.total * 10000) / 100}%` : '0%'
    }
  }
}

const SettingPanel = {
  props: { config: Object, current: String, dataDir: String },
  emits: ['close', 'changed', 'imported'],
  template: '#tpl-setting',
  setup (props, { emit }) {
    const st = reactive({ gameDir: props.config.gameDir || '' })
    watch(() => props.config, c => { st.gameDir = c.gameDir || '' })
    const save = async patch => emit('changed', await bridge.saveConfig(patch))
    return {
      ...toRefs(st),
      icons,
      save,
      async pick () {
        const d = await bridge.pickGameDir()
        if (d) { st.gameDir = d; save({ gameDir: d }) }
      },
      async detect () {
        const d = await bridge.detectGameDir()
        if (d) {
          st.gameDir = d
          save({ gameDir: d })
          ElMessage.success('게임 폴더를 찾았습니다.')
        } else {
          ElMessage.warning('기본 위치에서 게임 폴더를 찾지 못했습니다. 직접 지정해 주세요.')
        }
      },
      async importJson () {
        try {
          const res = await bridge.importJson()
          if (res) {
            emit('imported', res)
            ElMessage.success(`가져오기 완료: 새 기록 ${res.result.added}건`)
          }
        } catch (e) { ElMessage.error(cleanErr(e)) }
      },
      async exportJson () {
        try { await bridge.exportJson(props.current) } catch (e) { ElMessage.error(cleanErr(e)) }
      },
      openDir: () => bridge.openDataDir()
    }
  }
}

const App = {
  template: '#tpl-app',
  components: { PieChart, PoolDetail, SettingPanel },
  setup () {
    const s = reactive({
      ready: false,
      loading: false,
      progress: '',
      config: {},
      accounts: [],
      current: '',
      data: null,
      dataDir: '',
      showSetting: false,
      showUrlDlg: false,
      urlInput: ''
    })

    const applyState = st => {
      s.config = st.config
      s.accounts = st.accounts
      s.current = st.current
      s.data = st.data
      s.dataDir = st.dataDir
    }

    const pools = computed(() => {
      if (!s.data) return []
      return Object.keys(s.data.pools).sort((a, b) => a - b).map(type => {
        const p = s.data.pools[type]
        return { type, name: p.name, stats: WuwaStats.poolStats(p.records, type) }
      })
    })
    const visiblePools = computed(() => pools.value.filter(p => p.stats.total > 0))
    const hasData = computed(() => pools.value.some(p => p.stats.total > 0))
    const statusText = computed(() => {
      if (s.loading) return s.progress || '불러오는 중…'
      if (s.data) return `UID ${s.data.playerId} · 마지막 업데이트: ${fmtTime(s.data.updatedAt)}`
      return ''
    })

    async function fetchData (url) {
      s.loading = true
      s.progress = '게임 로그에서 튜닝 기록 URL을 찾는 중…'
      try {
        const st = await bridge.fetchData(url || null)
        applyState(st)
        const r = st.result
        if (r.maybeExpired) {
          ElMessage.warning({ message: '서버에서 받은 기록이 없습니다. URL이 만료됐을 수 있으니 게임에서 튜닝 기록 화면을 다시 연 뒤 시도하세요.', duration: 8000, showClose: true })
        } else {
          ElMessage.success(`업데이트 완료: 새 기록 ${r.added}건 (서버에서 받은 기록 ${r.fetchedTotal}건)`)
        }
      } catch (e) {
        ElMessage.error({ message: cleanErr(e), duration: 8000, showClose: true })
      } finally {
        s.loading = false
        s.progress = ''
      }
    }

    async function switchAccount (uid) { applyState(await bridge.loadAccount(uid)) }

    async function onCommand (cmd) {
      if (cmd === 'setting') {
        s.showSetting = true
      } else if (cmd === 'url') {
        s.urlInput = ''
        s.showUrlDlg = true
      } else if (cmd === 'copyUrl') {
        const ok = await bridge.copyUrl()
        if (ok) ElMessage.success('튜닝 기록 URL을 복사했습니다.')
        else ElMessage.warning('URL을 찾지 못했습니다. 게임에서 튜닝 기록 화면을 먼저 열어 주세요.')
      } else if (cmd === 'dataDir') {
        bridge.openDataDir()
      }
    }

    async function exportExcel () {
      try { await bridge.exportExcel(s.current) } catch (e) { ElMessage.error(cleanErr(e)) }
    }

    bridge.onProgress(t => { s.progress = t })
    onMounted(async () => {
      applyState(await bridge.init())
      s.ready = true
    })

    return {
      ...toRefs(s),
      icons,
      visiblePools,
      hasData,
      statusText,
      fetchData,
      switchAccount,
      onCommand,
      exportExcel,
      applyState,
      onConfigChanged: c => { s.config = c }
    }
  }
}

createApp(App).use(ElementPlus, { locale: ElementPlusLocaleKo }).mount('#app')

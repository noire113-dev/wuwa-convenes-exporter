/* global Vue, ElementPlus, ElementPlusLocaleKo, ElementPlusLocaleEn, ElementPlusIconsVue, echarts, WuwaStats, WuwaI18n */
const { createApp, reactive, computed, toRefs, ref, onMounted, onBeforeUnmount, watch, markRaw } = Vue
const { ElMessage } = ElementPlus
const icons = markRaw(ElementPlusIconsVue)
const bridge = window.api

// 언어는 시작할 때 정해지고, 바꾸면 화면을 다시 불러온다
let LANG = 'ko'
const t = (key, params) => WuwaI18n.t(LANG, key, params)
const FONT = '"Pretendard Variable", Pretendard, "Malgun Gothic", sans-serif'

const PALETTE = ['#5470c6', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc', '#2ab7ca', '#005b96', '#ff8b94', '#72a007', '#b60d1b', '#16570d']
const nameColors = new Map()
function colorOf (name) {
  if (!nameColors.has(name)) nameColors.set(name, PALETTE[nameColors.size % PALETTE.length])
  return nameColors.get(name)
}
const cleanErr = e => String((e && e.message) || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
const fmtTime = iso => iso ? new Date(iso).toLocaleString(LANG === 'ko' ? 'ko-KR' : 'en-US') : ''

const PieChart = {
  props: { stats: Object },
  template: '<div class="chart"><div ref="el" class="chart-inner"></div></div>',
  setup (props) {
    const el = ref(null)
    let chart
    const render = () => {
      const s = props.stats
      const items = [
        [t('chart.c5'), s.count5c, '#fac858'],
        [t('chart.w5'), s.count5w, '#ee6666'],
        [t('chart.c4'), s.count4c, '#5470c6'],
        [t('chart.w4'), s.count4w, '#91cc75'],
        [t('chart.w3'), s.count3, '#73c0de']
      ].filter(x => x[1] > 0)
      chart.setOption({
        textStyle: { fontFamily: FONT },
        tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)', textStyle: { fontFamily: FONT } },
        legend: { top: 0, itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 11, fontFamily: FONT }, data: items.map(x => x[0]) },
        series: [{
          type: 'pie',
          radius: '60%',
          center: ['50%', '60%'],
          minAngle: 4,
          label: { fontSize: 11, fontFamily: FONT, formatter: '{b}: {c}' },
          data: items.map(x => ({ name: x[0], value: x[1], itemStyle: { color: x[2] } }))
        }]
      }, true)
    }
    const resize = () => chart && chart.resize()
    onMounted(() => {
      chart = echarts.init(el.value)
      render()
      window.addEventListener('resize', resize)
      // 폰트를 늦게 불러오면 그래프 글자를 다시 그린다
      if (document.fonts) document.fonts.ready.then(() => chart && render())
    })
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
      t,
      colorOf,
      day: d => d ? d.slice(0, 10) : '-',
      pct: n => props.stats.total ? `${Math.round(n / props.stats.total * 10000) / 100}%` : '0%',
      split: (c, w) => `${t('detail.resonator')}: ${c}\n${t('detail.weapon')}: ${w}`
    }
  }
}

const SettingPanel = {
  props: { config: Object, current: String, dataDir: String, version: String },
  emits: ['close', 'changed', 'imported'],
  template: '#tpl-setting',
  setup (props, { emit }) {
    const st = reactive({ gameDir: props.config.gameDir || '', lang: LANG })
    watch(() => props.config, c => { st.gameDir = c.gameDir || '' })
    const save = async patch => emit('changed', await bridge.saveConfig(patch))
    return {
      ...toRefs(st),
      t,
      icons,
      langs: WuwaI18n.LANGS,
      save,
      async changeLang (lang) {
        await bridge.saveConfig({ lang })
        location.reload()
      },
      async pick () {
        const d = await bridge.pickGameDir()
        if (d) { st.gameDir = d; save({ gameDir: d }) }
      },
      async detect () {
        const d = await bridge.detectGameDir()
        if (d) {
          st.gameDir = d
          save({ gameDir: d })
          ElMessage.success(t('msg.dirFound'))
        } else {
          ElMessage.warning(t('msg.dirNotFound'))
        }
      },
      async importJson () {
        try {
          const res = await bridge.importJson()
          if (res) {
            emit('imported', res)
            ElMessage.success(t('msg.imported', { n: res.result.added }))
          }
        } catch (e) { ElMessage.error(cleanErr(e)) }
      },
      async exportJson () {
        try { await bridge.exportJson(props.current) } catch (e) { ElMessage.error(cleanErr(e)) }
      },
      openDir: () => bridge.openDataDir(),
      openRepo: () => bridge.openExternal('https://github.com/noire113-dev/wuwa-convenes-exporter')
    }
  }
}

function makeApp (initial) {
  return {
    template: '#tpl-app',
    components: { PieChart, PoolDetail, SettingPanel },
    setup () {
      const s = reactive({
        loading: false,
        progress: '',
        config: {},
        accounts: [],
        current: '',
        data: null,
        dataDir: '',
        version: '',
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
        if (st.version) s.version = st.version
      }
      applyState(initial)

      const pools = computed(() => {
        if (!s.data) return []
        return Object.keys(s.data.pools).sort((a, b) => a - b).map(type => {
          const p = s.data.pools[type]
          return { type, name: WuwaI18n.poolName(LANG, type, p.name), stats: WuwaStats.poolStats(p.records, type) }
        })
      })
      const visiblePools = computed(() => pools.value.filter(p => p.stats.total > 0))
      const hasData = computed(() => pools.value.some(p => p.stats.total > 0))
      const statusText = computed(() => {
        if (s.loading) return s.progress || t('status.loading')
        if (s.data) return t('status.lastUpdate', { uid: s.data.playerId, time: fmtTime(s.data.updatedAt) })
        return ''
      })

      async function fetchData (url) {
        s.loading = true
        s.progress = t('status.findingUrl')
        try {
          const st = await bridge.fetchData(url || null)
          applyState(st)
          const r = st.result
          if (r.maybeExpired) {
            ElMessage.warning({ message: t('msg.expiredEmpty'), duration: 8000, showClose: true })
          } else {
            ElMessage.success(t('msg.updated', { added: r.added, total: r.fetchedTotal }))
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
          if (ok) ElMessage.success(t('msg.urlCopied'))
          else ElMessage.warning(t('msg.urlNotFound'))
        } else if (cmd === 'dataDir') {
          bridge.openDataDir()
        }
      }

      async function exportExcel () {
        try { await bridge.exportExcel(s.current) } catch (e) { ElMessage.error(cleanErr(e)) }
      }

      bridge.onProgress(text => { s.progress = text })

      return {
        ...toRefs(s),
        t,
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
}

;(async () => {
  const initial = await bridge.init()
  LANG = initial.lang
  document.documentElement.lang = LANG
  document.title = t('app.title')
  const locale = LANG === 'ko' ? ElementPlusLocaleKo : ElementPlusLocaleEn
  createApp(makeApp(initial)).use(ElementPlus, { locale }).mount('#app')
})()

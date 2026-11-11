<template>
  <div ref="rootEl" class="crm" :style="rootStyle">
    <canvas
      ref="canvasEl"
      class="crm__canvas"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointerleave="onPointerUp"
      @wheel="onWheel"
    />

    <div v-if="controls" class="crm__toolbar">
      <button type="button" title="缩小" @click="zoomBy(1 / 1.22)">−</button>
      <button type="button" title="回到全图" @click="resetCamera">⌂</button>
      <button type="button" title="放大" @click="zoomBy(1.22)">+</button>
      <span class="crm__zoom">{{ Math.round(camera.zoom * 100) }}%</span>
    </div>

    <div v-if="controls" class="crm__playbar">
      <button type="button" class="crm__play" :disabled="points.length < 2" @click="togglePlay">
        {{ playing ? '停止' : '播放路线' }}
      </button>
      <span class="crm__progress">{{ progressText }}</span>
    </div>

    <p v-if="tip" class="crm__tip">{{ tipText }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import mapData from './china-route-map.data'

/*
 * 由中国地图轨迹路线图（交互效果/地图轨迹路线图）提取而来。
 *
 * 原 demo 是一个「路线编辑器」：canvas 上点击打点、自动识别最近城市、右侧列表可拖动排序、
 * 还能录像导出、换箭头贴图、调时长 / 缩放。这里把编辑器和导出剥掉，留下可复用的核心：
 * - 画中国轮廓（大陆 + 海南 + 台湾）、省份线、城市点；
 * - 按经纬度画路线、带序号的站点和名称；
 * - 播放时镜头放大并跟随箭头走完全程，走过的部分高亮、未走的虚线打底；
 * - 支持滚轮缩放 / 拖拽平移 / 点地图加点（加点会自动找最近的景点或城市命名）。
 *
 * 底图数据来自同目录的 china-route-map.data.ts（原 map-data.js，手工描的简版轮廓）。
 */
type LonLat = [number, number]
type RoutePoint = { name?: string; lon: number; lat: number }

const WORLD = { width: 1000, height: 680 }
const GEO = { minLon: 73, maxLon: 135, minLat: 17, maxLat: 54 }
const BOX = { x: 58, y: 58, width: 884, height: 560 }

const {
  mainland,
  hainan,
  taiwan,
  provinceLines,
  attractionMarks,
  cityLookup,
  demoRoute,
}: {
  mainland: LonLat[]
  hainan: LonLat[]
  taiwan: LonLat[]
  provinceLines: LonLat[][]
  attractionMarks: { name: string; lon: number; lat: number }[]
  cityLookup: { name: string; lon: number; lat: number }[]
  demoRoute: [string, number, number][]
} = mapData as never

const props = defineProps({
  /**
   * @description 路线站点（经纬度），默认给一组示例景点
   */
  points: {
    type: Array as () => RoutePoint[],
    // defineProps 的默认值会被提升到 setup 外，不能引用下面的局部变量，这里直接写常量
    default: () => [
      { name: '故宫', lon: 116.4, lat: 39.92 },
      { name: '兵马俑', lon: 109.27, lat: 34.38 },
      { name: '九寨沟', lon: 103.92, lat: 33.25 },
      { name: '丽江古城', lon: 100.23, lat: 26.87 },
      { name: '西湖', lon: 120.14, lat: 30.25 },
    ],
  },
  /**
   * @description 是否允许点地图追加站点
   */
  editable: {
    type: Boolean,
    default: true,
  },
  /**
   * @description 播放一遍的时长，单位秒
   */
  duration: {
    type: Number,
    default: 8,
  },
  /**
   * @description 路线主色
   */
  color: {
    type: String,
    default: '#c64024',
  },
  /**
   * @description 播放时的跟随缩放倍数
   */
  followZoom: {
    type: Number,
    default: 2.2,
  },
  /**
   * @description 是否显示城市点
   */
  showCities: {
    type: Boolean,
    default: true,
  },
  /**
   * @description 是否显示站点名称
   */
  showLabels: {
    type: Boolean,
    default: true,
  },
  /**
   * @description 是否显示缩放 / 播放控制条
   */
  controls: {
    type: Boolean,
    default: true,
  },
  /**
   * @description 是否显示底部提示
   */
  tip: {
    type: Boolean,
    default: true,
  },
  /**
   * @description 提示文案
   */
  tipText: {
    type: String,
    default: '点地图加点 · 滚轮缩放 · 拖动平移',
  },
  /**
   * @description 是否正在播放（可用 v-model:playing）
   */
  playing: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits<{
  'update:points': [points: RoutePoint[]]
  'update:playing': [playing: boolean]
  /** 新增了一个站点 */
  add: [point: RoutePoint]
  /** 一轮播放结束 */
  finish: []
}>()

const rootEl = ref<HTMLElement | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)
const progress = ref(0)
const playing = ref(props.playing)
const camera = ref({ zoom: 1, panX: 0, panY: 0 })

let ctx: CanvasRenderingContext2D | null = null
let dpr = 1
let width = 0
let height = 0
let fitScale = 1
let rafId = 0
let observer: ResizeObserver | null = null

let drag: { id: number; x: number; y: number; panX: number; panY: number; moved: boolean } | null = null
let playStart = 0
let playRaf = 0

const rootStyle = computed(() => ({ '--crm-accent': props.color }))

const progressText = computed(() =>
  playing.value ? `${Math.round(progress.value * 100)}%` : `${props.points.length} 站`,
)

/** 经纬度 → 世界坐标 */
function project(lon: number, lat: number) {
  return {
    x: BOX.x + ((lon - GEO.minLon) / (GEO.maxLon - GEO.minLon)) * BOX.width,
    y: BOX.y + ((GEO.maxLat - lat) / (GEO.maxLat - GEO.minLat)) * BOX.height,
  }
}

/** 屏幕坐标 → 经纬度 */
function unproject(screenX: number, screenY: number) {
  const scale = fitScale * camera.value.zoom
  const worldX = (screenX - width / 2) / scale + (WORLD.width / 2 - camera.value.panX)
  const worldY = (screenY - height / 2) / scale + (WORLD.height / 2 - camera.value.panY)
  return {
    lon: GEO.minLon + ((worldX - BOX.x) / BOX.width) * (GEO.maxLon - GEO.minLon),
    lat: GEO.maxLat - ((worldY - BOX.y) / BOX.height) * (GEO.maxLat - GEO.minLat),
  }
}

function isInsideChina(lon: number, lat: number, polygon: LonLat[]) {
  const point = project(lon, lat)
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = project(polygon[i][0], polygon[i][1])
    const pj = project(polygon[j][0], polygon[j][1])
    const intersects =
      pi.y > point.y !== pj.y > point.y &&
      point.x < ((pj.x - pi.x) * (point.y - pi.y)) / (pj.y - pi.y) + pi.x
    if (intersects) inside = !inside
  }
  return inside
}

/** 给新加的点找个像样的名字：优先最近景点，其次最近城市 */
function nearestName(lon: number, lat: number) {
  let best = ''
  let bestDistance = Infinity
  const consider = (list: { name: string; lon: number; lat: number }[], limit: number) => {
    list.forEach((item) => {
      const distance = Math.hypot(item.lon - lon, (item.lat - lat) * 1.4)
      if (distance < bestDistance && distance <= limit) {
        bestDistance = distance
        best = item.name
      }
    })
  }
  consider(attractionMarks || [], 1.2)
  consider(cityLookup || [], 1.8)
  return best || `地点 ${Math.round(lon)}°${Math.round(lat)}°`
}

function resize() {
  const canvas = canvasEl.value
  const root = rootEl.value
  if (!canvas || !root) return
  dpr = Math.min(2, window.devicePixelRatio || 1)
  width = root.clientWidth || 1
  height = root.clientHeight || 1
  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  ctx = canvas.getContext('2d')

  const padding = 28
  fitScale = Math.min(
    (width - padding * 2) / WORLD.width,
    (height - padding * 2) / WORLD.height,
  )
  requestRender()
}

function applyCamera() {
  if (!ctx) return
  // screen = (world - origin) * scale + 画布中心，origin 由 pan 决定
  const scale = fitScale * camera.value.zoom
  const originX = WORLD.width / 2 - camera.value.panX
  const originY = WORLD.height / 2 - camera.value.panY
  ctx.setTransform(
    scale * dpr,
    0,
    0,
    scale * dpr,
    dpr * (width / 2 - originX * scale),
    dpr * (height / 2 - originY * scale),
  )
}

function pathOf(polygon: LonLat[]) {
  const path = new Path2D()
  polygon.forEach(([lon, lat], index) => {
    const p = project(lon, lat)
    if (index === 0) path.moveTo(p.x, p.y)
    else path.lineTo(p.x, p.y)
  })
  path.closePath()
  return path
}

function drawMap() {
  if (!ctx) return
  ctx.clearRect(0, 0, width, height)

  // 海面
  const sea = ctx.createLinearGradient(0, 0, width, height)
  sea.addColorStop(0, '#eef6ff')
  sea.addColorStop(1, '#dbe9f5')
  ctx.fillStyle = sea
  ctx.fillRect(0, 0, width, height)

  ctx.save()
  applyCamera()
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  // 陆地
  const land = ctx.createLinearGradient(BOX.x, BOX.y, BOX.x + BOX.width, BOX.y + BOX.height)
  land.addColorStop(0, '#edf6df')
  land.addColorStop(0.45, '#dbeccf')
  land.addColorStop(1, '#c7dfbd')
  ctx.fillStyle = land
  ctx.strokeStyle = 'rgba(58, 96, 68, 0.55)'
  ctx.lineWidth = 2.4
  ;[mainland, hainan, taiwan].forEach((polygon) => {
    const path = pathOf(polygon)
    ctx!.fill(path)
    ctx!.stroke(path)
  })

  // 省界
  ctx.strokeStyle = 'rgba(84, 122, 92, 0.22)'
  ctx.lineWidth = 1
  provinceLines.forEach((line) => {
    ctx!.beginPath()
    line.forEach(([lon, lat], index) => {
      const p = project(lon, lat)
      if (index === 0) ctx!.moveTo(p.x, p.y)
      else ctx!.lineTo(p.x, p.y)
    })
    ctx!.stroke()
  })

  // 城市点：放大后才显示，避免糊成一片
  if (props.showCities && camera.value.zoom > 1.35) {
    ctx.fillStyle = 'rgba(54, 92, 74, 0.35)'
    ;(cityLookup || []).forEach((city) => {
      const p = project(city.lon, city.lat)
      ctx!.beginPath()
      ctx!.arc(p.x, p.y, 1.6, 0, Math.PI * 2)
      ctx!.fill()
    })
  }

  ctx.restore()
}

function drawRoute() {
  if (!ctx || props.points.length < 2) return
  ctx.save()
  applyCamera()
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  const screen = props.points.map((p) => project(p.lon, p.lat))

  // 未走过的部分：虚线打底
  ctx.setLineDash([1, 12])
  ctx.strokeStyle = 'rgba(8, 40, 42, 0.34)'
  ctx.lineWidth = 9
  ctx.beginPath()
  screen.forEach((p, index) => (index ? ctx!.lineTo(p.x, p.y) : ctx!.moveTo(p.x, p.y)))
  ctx.stroke()
  ctx.setLineDash([])

  // 白色描边 + 主色线（主色线只画到播放进度）
  ctx.strokeStyle = 'rgba(255, 248, 228, 0.92)'
  ctx.lineWidth = 6
  ctx.beginPath()
  screen.forEach((p, index) => (index ? ctx!.lineTo(p.x, p.y) : ctx!.moveTo(p.x, p.y)))
  ctx.stroke()

  const ratio = playing.value ? progress.value : 1
  ctx.strokeStyle = props.color
  ctx.lineWidth = 3
  ctx.beginPath()
  let budget = totalLength * ratio
  ctx.moveTo(screen[0].x, screen[0].y)
  for (let i = 1; i < screen.length; i += 1) {
    const segment = Math.hypot(screen[i].x - screen[i - 1].x, screen[i].y - screen[i - 1].y)
    if (budget <= 0) break
    if (budget >= segment) {
      ctx.lineTo(screen[i].x, screen[i].y)
      budget -= segment
    } else {
      const t = budget / segment
      ctx.lineTo(screen[i - 1].x + (screen[i].x - screen[i - 1].x) * t, screen[i - 1].y + (screen[i].y - screen[i - 1].y) * t)
      budget = 0
    }
  }
  ctx.stroke()

  // 站点
  screen.forEach((p, index) => {
    const active = !playing.value || ratio >= cumulative[index] / (totalLength || 1) - 0.001
    ctx.beginPath()
    ctx.arc(p.x, p.y, 6.5, 0, Math.PI * 2)
    ctx.fillStyle = active ? props.color : 'rgba(255, 248, 228, 0.9)'
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = active ? 'rgba(255, 248, 228, 0.95)' : 'rgba(8, 40, 42, 0.35)'
    ctx.stroke()

    // 序号
    ctx.fillStyle = active ? '#fff8e4' : '#25342b'
    ctx.font = '600 9px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(index + 1), p.x, p.y + 0.5)

    if (props.showLabels && props.points[index]?.name) {
      const label = props.points[index].name as string
      ctx.font = '600 10px system-ui, sans-serif'
      const textWidth = ctx.measureText(label).width
      ctx.fillStyle = 'rgba(255, 253, 244, 0.86)'
      ctx.beginPath()
      ctx.roundRect(p.x - textWidth / 2 - 5, p.y - 25, textWidth + 10, 15, 6)
      ctx.fill()
      ctx.fillStyle = '#2b3a31'
      ctx.fillText(label, p.x, p.y - 17.5)
    }
  })

  // 播放箭头
  if (playing.value && totalLength) {
    const head = pointAtDistance(totalLength * ratio)
    if (head) {
      ctx.save()
      ctx.translate(head.x, head.y)
      ctx.rotate(head.angle)
      ctx.beginPath()
      ctx.moveTo(9, 0)
      ctx.lineTo(-6, 6)
      ctx.lineTo(-3, 0)
      ctx.lineTo(-6, -6)
      ctx.closePath()
      ctx.fillStyle = props.color
      ctx.fill()
      ctx.lineWidth = 1.5
      ctx.strokeStyle = 'rgba(255, 248, 228, 0.95)'
      ctx.stroke()
      ctx.restore()
    }
  }

  ctx.restore()
}

/** 每个站点在整条路线上的累计长度（用来判断「走过没有」） */
let cumulative: number[] = []
let totalLength = 0

function rebuildLengths() {
  const screen = props.points.map((p) => project(p.lon, p.lat))
  cumulative = [0]
  totalLength = 0
  for (let i = 1; i < screen.length; i += 1) {
    totalLength += Math.hypot(screen[i].x - screen[i - 1].x, screen[i].y - screen[i - 1].y)
    cumulative.push(totalLength)
  }
}

/** 按弧长取路线上的点（含朝向） */
function pointAtDistance(distance: number) {
  const screen = props.points.map((p) => project(p.lon, p.lat))
  let rest = Math.max(0, Math.min(distance, totalLength))
  for (let i = 1; i < screen.length; i += 1) {
    const segment = cumulative[i] - cumulative[i - 1]
    if (rest <= segment || i === screen.length - 1) {
      const t = segment ? rest / segment : 0
      const x = screen[i - 1].x + (screen[i].x - screen[i - 1].x) * t
      const y = screen[i - 1].y + (screen[i].y - screen[i - 1].y) * t
      return {
        x,
        y,
        angle: Math.atan2(screen[i].y - screen[i - 1].y, screen[i].x - screen[i - 1].x),
      }
    }
    rest -= segment
  }
  return null
}

function requestRender() {
  if (rafId) return
  rafId = requestAnimationFrame(() => {
    rafId = 0
    drawMap()
    drawRoute()
  })
}

/* ───────── 播放 ───────── */

function startPlay() {
  if (playing.value || props.points.length < 2) return
  playing.value = true
  emit('update:playing', true)
  progress.value = 0
  playStart = performance.now()
  requestRender()

  const tick = (now: number) => {
    if (!playing.value) return
    progress.value = Math.min(1, (now - playStart) / (props.duration * 1000))

    // 镜头跟随：放大到 followZoom，并把当前点拉到画面中心（panX = 世界中心 - 目标世界坐标）
    const head = pointAtDistance(totalLength * progress.value)
    if (head) {
      const targetZoom = props.followZoom
      const targetPanX = WORLD.width / 2 - head.x
      const targetPanY = WORLD.height / 2 - head.y
      camera.value = {
        zoom: camera.value.zoom + (targetZoom - camera.value.zoom) * 0.08,
        panX: camera.value.panX + (targetPanX - camera.value.panX) * 0.1,
        panY: camera.value.panY + (targetPanY - camera.value.panY) * 0.1,
      }
      clampCamera()
    }
    requestRender()

    if (progress.value < 1) {
      playRaf = requestAnimationFrame(tick)
      return
    }
    stopPlay(true)
  }

  cancelAnimationFrame(playRaf)
  playRaf = requestAnimationFrame(tick)
}

function stopPlay(finished = false) {
  playing.value = false
  emit('update:playing', false)
  cancelAnimationFrame(playRaf)
  playRaf = 0
  if (finished) {
    progress.value = 1
    emit('finish')
  }
  requestRender()
}

function togglePlay() {
  if (playing.value) stopPlay()
  else startPlay()
}

/* ───────── 缩放 / 平移 / 加点 ───────── */

function clampCamera() {
  camera.value.zoom = Math.min(4.2, Math.max(1, camera.value.zoom))
  if (camera.value.zoom <= 1.0001) {
    camera.value.zoom = 1
    camera.value.panX = 0
    camera.value.panY = 0
    return
  }
  const limitX = (WORLD.width / 2) * (1 - 1 / camera.value.zoom) + 40
  const limitY = (WORLD.height / 2) * (1 - 1 / camera.value.zoom) + 40
  camera.value.panX = Math.min(limitX, Math.max(-limitX, camera.value.panX))
  camera.value.panY = Math.min(limitY, Math.max(-limitY, camera.value.panY))
}

function zoomBy(factor: number) {
  camera.value.zoom *= factor
  clampCamera()
  requestRender()
}

function resetCamera() {
  camera.value = { zoom: 1, panX: 0, panY: 0 }
  requestRender()
}

function onWheel(event: WheelEvent) {
  event.preventDefault()
  zoomBy(event.deltaY > 0 ? 1 / 1.12 : 1.12)
}

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0 && event.pointerType === 'mouse') return
  drag = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    panX: camera.value.panX,
    panY: camera.value.panY,
    moved: false,
  }
  try {
    canvasEl.value?.setPointerCapture?.(event.pointerId)
  } catch {
    // 合成事件下忽略
  }
}

function onPointerMove(event: PointerEvent) {
  if (!drag || drag.id !== event.pointerId) return
  const dx = event.clientX - drag.x
  const dy = event.clientY - drag.y
  if (!drag.moved && Math.hypot(dx, dy) > 3) drag.moved = true
  if (!drag.moved) return
  const scale = fitScale * camera.value.zoom
  camera.value.panX = drag.panX - dx / scale
  camera.value.panY = drag.panY - dy / scale
  clampCamera()
  requestRender()
}

function onPointerUp(event: PointerEvent) {
  if (!drag || drag.id !== event.pointerId) return
  const moved = drag.moved
  drag = null
  try {
    canvasEl.value?.releasePointerCapture?.(event.pointerId)
  } catch {
    // 同上
  }
  if (moved || !props.editable || playing.value) return

  const rect = canvasEl.value?.getBoundingClientRect()
  if (!rect) return
  const { lon, lat } = unproject(event.clientX - rect.left, event.clientY - rect.top)
  if (!isInsideChina(lon, lat, mainland) && !isInsideChina(lon, lat, hainan) && !isInsideChina(lon, lat, taiwan)) {
    return
  }

  const point: RoutePoint = { name: nearestName(lon, lat), lon, lat }
  const next = [...props.points, point]
  emit('add', point)
  emit('update:points', next)
  rebuildLengths()
  requestRender()
}

watch(
  () => props.points,
  () => {
    rebuildLengths()
    requestRender()
  },
  { deep: true, immediate: true },
)

watch(
  () => props.playing,
  (next) => {
    if (next && !playing.value) startPlay()
    else if (!next && playing.value) stopPlay()
  },
)

onMounted(() => {
  resize()
  rebuildLengths()
  observer = new ResizeObserver(() => resize())
  if (rootEl.value) observer.observe(rootEl.value)
  requestRender()
})

onBeforeUnmount(() => {
  observer?.disconnect()
  cancelAnimationFrame(rafId)
  cancelAnimationFrame(playRaf)
})

defineExpose({
  play: startPlay,
  stop: () => stopPlay(),
  reset: resetCamera,
  zoomTo: (zoom: number) => {
    camera.value.zoom = zoom
    clampCamera()
    requestRender()
  },
})
</script>

<style scoped>
.crm {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 260px;
  overflow: hidden;
  border-radius: 14px;
  background: #eef6ff;
  touch-action: none;
  cursor: grab;
}

.crm:active {
  cursor: grabbing;
}

.crm__canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.crm__toolbar {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border: 1px solid rgba(33, 47, 39, 0.12);
  border-radius: 10px;
  background: rgba(255, 253, 244, 0.9);
  box-shadow: 0 6px 18px rgba(25, 40, 35, 0.12);
  backdrop-filter: blur(6px);
}

.crm__toolbar button {
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: #2b3a31;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.2s ease;
}

.crm__toolbar button:hover {
  background: rgba(8, 118, 111, 0.12);
}

.crm__zoom {
  min-width: 38px;
  padding-right: 4px;
  color: #3e493f;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.crm__playbar {
  position: absolute;
  left: 12px;
  bottom: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  border: 1px solid rgba(33, 47, 39, 0.12);
  border-radius: 10px;
  background: rgba(255, 253, 244, 0.9);
  box-shadow: 0 6px 18px rgba(25, 40, 35, 0.12);
  backdrop-filter: blur(6px);
}

.crm__play {
  padding: 5px 12px;
  border: none;
  border-radius: 7px;
  background: var(--crm-accent);
  color: #fff8e4;
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: filter 0.2s ease;
}

.crm__play:hover:not(:disabled) {
  filter: brightness(1.08);
}

.crm__play:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.crm__progress {
  color: #3e493f;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.crm__tip {
  position: absolute;
  right: 12px;
  bottom: 14px;
  margin: 0;
  color: rgba(62, 73, 63, 0.55);
  font-size: 11px;
  pointer-events: none;
}

@media (max-width: 520px) {
  .crm__tip {
    display: none;
  }
}
</style>

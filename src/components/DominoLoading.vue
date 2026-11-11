<template>
  <div class="domino" :style="rootStyle" role="status" :aria-label="text || '加载中'">
    <canvas ref="canvasEl" class="domino__canvas" />
    <div v-if="showBar" class="domino__bar">
      <div class="domino__fill" :style="{ width: `${barPercent}%` }" />
    </div>
    <p v-if="text" class="domino__text">{{ text }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

/*
 * 由 video-code / UI组件/loading效果/多米诺骨牌loading.html 提取而来。
 *
 * 原 demo 是 14 张带点数、带 3D 侧面的骨牌，从第一张开始连锁倒下去，带重力加速度和「靠在下一张
 * 身上」的接触角，全倒完再重来，旁边还有 Chain / Speed / Tiles 的读数。
 *
 * 组件里保留了：连锁触发（前一张转过接触角才带动下一张）、角加速度、最后的骨牌拍平在地上、
 * 蓝→粉的渐变色、3D 侧面与点数；去掉了读数面板和拖拽，改成一条随倒伏比例增长的进度条，
 * 尺寸 / 张数 / 速度 / 暂停都是 props。
 */
type Tile = {
  x: number
  theta: number
  omega: number
  restTheta: number
  hue: number
  pips: { rx: number; ry: number }[]
}

const props = defineProps({
  /**
   * @description 画布宽度，单位 px（高度按 0.6 比例）
   */
  size: {
    type: Number,
    default: 480,
  },
  /**
   * @description 骨牌张数
   */
  count: {
    type: Number,
    default: 14,
  },
  /**
   * @description 速度倍率，1 为原始节奏
   */
  speed: {
    type: Number,
    default: 1,
  },
  /**
   * @description 是否显示底部进度条
   */
  showBar: {
    type: Boolean,
    default: true,
  },
  /**
   * @description 是否暂停
   */
  paused: {
    type: Boolean,
    default: false,
  },
  /**
   * @description 底部文案，留空则不显示
   */
  text: {
    type: String,
    default: 'Loading',
  },
})

const emit = defineEmits<{
  'update:progress': [value: number]
  /** 一轮骨牌全部倒下 */
  complete: []
}>()

const canvasEl = ref<HTMLCanvasElement | null>(null)
const fallenRatio = ref(0)
const rootStyle = computed(() => ({ '--domino-w': `${props.size}px` }))
const barPercent = computed(() => Math.round(fallenRatio.value * 100))

let ctx: CanvasRenderingContext2D | null = null
let rafId = 0
let lastTime = 0
let tiles: Tile[] = []
let phase: 'falling' | 'hold' | 'rising' = 'falling'
let phaseTimer = 0
let observer: ResizeObserver | null = null
let width = 0
let height = 0

const TILE_H_RATIO = 0.143
const TILE_W_RATIO = 0.0185
const GAP_RATIO = 0.049
const GROUND_RATIO = 0.82
const DEPTH_RATIO = 0.009
const CAP_RATIO = 0.006

function tileHeight() {
  return height * TILE_H_RATIO
}

function tileWidth() {
  return width * TILE_W_RATIO
}

function gap() {
  return width * GAP_RATIO
}

function groundY() {
  return height * GROUND_RATIO
}

/** 一张骨牌靠到下一张时大约转过的角度 */
function contactAngle() {
  return Math.asin(Math.min(0.95, gap() / tileHeight()))
}

function buildTiles() {
  const count = Math.max(2, Math.round(props.count))
  const spacing = gap()
  const total = (count - 1) * spacing
  const startX = width / 2 - total / 2
  const contact = contactAngle()

  tiles = Array.from({ length: count }, (_, index) => ({
    x: startX + index * spacing,
    theta: 0,
    omega: 0,
    // 最后一张直接拍在地上，其余靠在下一张身上
    restTheta: index === count - 1 ? Math.PI / 2 - 0.06 : contact,
    hue: 240 + (index / Math.max(1, count - 1)) * 90,
    pips: createPips(),
  }))
}

function createPips() {
  const count = 1 + Math.floor(Math.random() * 3)
  if (count === 1) return [{ rx: 0.5, ry: 0.5 }]
  if (count === 2) {
    return [
      { rx: 0.35, ry: 0.33 },
      { rx: 0.65, ry: 0.67 },
    ]
  }
  return [
    { rx: 0.35, ry: 0.25 },
    { rx: 0.5, ry: 0.5 },
    { rx: 0.65, ry: 0.75 },
  ]
}

function drawPiece(index: number, tile: Tile) {
  if (!ctx) return
  const w = tileWidth()
  const h = tileHeight()
  const depthW = width * DEPTH_RATIO
  const depthH = height * CAP_RATIO
  const baseY = groundY()

  // 以底边右侧为轴心顺时针倒
  ctx.save()
  ctx.translate(tile.x + w / 2, baseY)
  ctx.rotate(tile.theta)

  const front = `hsl(${tile.hue}, 70%, ${58 - index * 0.6}%)`
  const top = `hsl(${tile.hue + 8}, 72%, 70%)`
  const side = `hsl(${tile.hue - 10}, 65%, 42%)`

  // 右侧面（3D 厚度）
  ctx.beginPath()
  ctx.moveTo(w / 2, 0)
  ctx.lineTo(w / 2 + depthW, -depthH)
  ctx.lineTo(w / 2 + depthW, -h - depthH)
  ctx.lineTo(w / 2, -h)
  ctx.closePath()
  ctx.fillStyle = side
  ctx.fill()

  // 顶面
  ctx.beginPath()
  ctx.moveTo(-w / 2, -h)
  ctx.lineTo(w / 2, -h)
  ctx.lineTo(w / 2 + depthW, -h - depthH)
  ctx.lineTo(-w / 2 + depthW, -h - depthH)
  ctx.closePath()
  ctx.fillStyle = top
  ctx.fill()

  // 正面
  const gradient = ctx.createLinearGradient(-w / 2, -h, w / 2, 0)
  gradient.addColorStop(0, front)
  gradient.addColorStop(1, `hsl(${tile.hue + 14}, 68%, ${48 - index * 0.5}%)`)
  ctx.beginPath()
  ctx.roundRect(-w / 2, -h, w, h, Math.max(1.5, w * 0.18))
  ctx.fillStyle = gradient
  ctx.fill()

  // 点数
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  tile.pips.forEach((pip) => {
    ctx!.beginPath()
    ctx!.arc(-w / 2 + pip.rx * w, -h + pip.ry * h, Math.max(0.8, w * 0.11), 0, Math.PI * 2)
    ctx!.fill()
  })

  ctx.restore()
}

function frame(now: number) {
  if (!ctx) return
  const rawDelta = (now - lastTime) / 1000
  const dt = Math.min(0.05, rawDelta || 0.016)
  lastTime = now

  ctx.clearRect(0, 0, width, height)

  // 地面
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(width * 0.03, groundY())
  ctx.lineTo(width * 0.97, groundY())
  ctx.stroke()
  ctx.restore()

  const speed = Math.max(0.1, props.speed)
  const contact = contactAngle()

  if (phase === 'falling') {
    const angularAccel = 26 * speed
    tiles.forEach((tile, index) => {
      const triggered = index === 0 || tiles[index - 1].theta > contact * 0.92
      if (!triggered) return
      if (tile.theta >= tile.restTheta) {
        tile.theta = tile.restTheta
        tile.omega = 0
        return
      }
      // 角加速度积分：越倒越快，落到 next 或地面就停住
      tile.omega += angularAccel * dt
      tile.theta = Math.min(tile.restTheta, tile.theta + tile.omega * dt)
    })

    const fallen = tiles.filter((tile) => tile.theta >= tile.restTheta - 0.01).length
    const ratio = fallen / tiles.length
    if (Math.abs(ratio - fallenRatio.value) > 0.001) {
      fallenRatio.value = ratio
      emit('update:progress', Math.round(ratio * 100))
    }

    if (fallen === tiles.length) {
      phase = 'hold'
      phaseTimer = 0
      emit('complete')
    }
  } else if (phase === 'hold') {
    phaseTimer += dt
    if (phaseTimer > 0.9) {
      phase = 'rising'
      phaseTimer = 0
    }
  } else {
    // 一起立回来，再从头倒
    let done = true
    const riseSpeed = 1.6 * speed
    tiles.forEach((tile) => {
      tile.theta = Math.max(0, tile.theta - riseSpeed * dt)
      tile.omega = 0
      if (tile.theta > 0) done = false
    })
    fallenRatio.value = 0
    if (done) {
      buildTiles()
      phase = 'falling'
    }
  }

  tiles.forEach((tile, index) => drawPiece(index, tile))

  rafId = requestAnimationFrame(frame)
}

function resize() {
  const canvas = canvasEl.value
  if (!canvas) return
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  width = props.size
  height = props.size * 0.6
  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  ctx = canvas.getContext('2d')
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
}

function start() {
  if (rafId || props.paused) return
  lastTime = performance.now()
  rafId = requestAnimationFrame(frame)
}

function stop() {
  if (rafId) cancelAnimationFrame(rafId)
  rafId = 0
}

function onVisibilityChange() {
  if (document.hidden) stop()
  else start()
}

onMounted(() => {
  resize()
  buildTiles()
  document.addEventListener('visibilitychange', onVisibilityChange)
  observer = new ResizeObserver(() => resize())
  if (canvasEl.value) observer.observe(canvasEl.value)
  start()
})

onBeforeUnmount(() => {
  stop()
  observer?.disconnect()
  document.removeEventListener('visibilitychange', onVisibilityChange)
})

watch(
  () => [props.size, props.count] as const,
  () => {
    resize()
    buildTiles()
    phase = 'falling'
    fallenRatio.value = 0
    if (!rafId && !props.paused) start()
  },
)

watch(
  () => props.paused,
  (paused) => {
    if (paused) stop()
    else start()
  },
)
</script>

<style scoped>
.domino {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.domino__canvas {
  display: block;
  border-radius: 16px;
  background: radial-gradient(circle at 50% 20%, #151a26 0%, #0a0c12 75%);
}

.domino__bar {
  width: calc(var(--domino-w) * 0.42);
  height: 3px;
  overflow: hidden;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.08);
}

.domino__fill {
  height: 100%;
  border-radius: 2px;
  background: linear-gradient(90deg, #6ea8ff, #ff8ad4);
  transition: width 0.2s linear;
}

.domino__text {
  margin: 0;
  color: rgba(255, 255, 255, 0.45);
  font-size: 12px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}
</style>

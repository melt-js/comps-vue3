<template>
  <div
    ref="rootEl"
    class="warp"
    :style="rootStyle"
    @pointermove="onPointerMove"
    @pointerdown="onPointerDown"
    @pointerup="onPointerUp"
    @pointerleave="onPointerUp"
    @wheel="onWheel"
  >
    <canvas ref="canvasEl" class="warp__canvas" />

    <span v-if="interactive" class="warp__crosshair" aria-hidden="true" />

    <div v-if="hud" class="warp__hud">
      <span class="warp__hud-label">WARP SPEED</span>
      <span class="warp__hud-value">{{ speedText }}</span>
      <span class="warp__hud-unit">× LIGHT SPEED</span>
    </div>

    <p v-if="tip" class="warp__tip">{{ tipText }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

/*
 * 由 video-code / 动画特效/星际穿越/index.html 提取而来。
 *
 * 原 demo 是一整页全屏的「曲速飞行」：1500 颗星星从消失点向后飞、按深度拉出星轨，鼠标位置决定消失点
 * 偏到哪（整个星场跟着偏转），按住鼠标速度 ×4，滚轮调巡航速度，左上角 HUD 显示当前曲速，另外还有
 * 星云团、高速时的速度线、边缘晕影和屏幕中心的十字准星。
 *
 * 组件化后：
 * - 画布尺寸跟的是**组件自己的容器**（ResizeObserver + DPR），不再绑 window，塞进卡片里也能用；
 * - 鼠标交互改成 Pointer Events 并限制在容器内，滚轮只在容器上生效且 preventDefault，不会带跑整页滚动；
 * - 星数、巡航速度、按住倍率、星云 / HUD / 提示 / 交互都能关，`paused` 停掉 rAF；
 * - 滚轮调速会通过 update:speed 抛出去，宿主可以自己接管。
 */
type Star = {
  x: number
  y: number
  z: number
  pz: number
  color: [number, number, number]
}

type Nebula = {
  x: number
  y: number
  z: number
  size: number
  hue: number
  alpha: number
}

/** 原 demo 的星点配色：白、蓝白、暖白、淡蓝、橙、青 */
const STAR_COLORS: [number, number, number][] = [
  [255, 255, 255],
  [200, 220, 255],
  [255, 240, 220],
  [180, 200, 255],
  [255, 200, 150],
  [200, 255, 255],
]

const MAX_DEPTH = 1500

const props = defineProps({
  /**
   * @description 星星数量
   */
  stars: {
    type: Number,
    default: 1500,
  },
  /**
   * @description 巡航速度（滚轮可调，可用 v-model:speed 双向绑定）
   */
  speed: {
    type: Number,
    default: 2,
  },
  /**
   * @description 按住指针时速度放大到多少倍
   */
  boost: {
    type: Number,
    default: 4,
  },
  /**
   * @description 滚轮调速的下限
   */
  minSpeed: {
    type: Number,
    default: 0.5,
  },
  /**
   * @description 滚轮调速的上限
   */
  maxSpeed: {
    type: Number,
    default: 8,
  },
  /**
   * @description 是否开启「移动指针控方向 / 按住加速 / 滚轮调速」
   */
  interactive: {
    type: Boolean,
    default: true,
  },
  /**
   * @description 是否显示左上角的曲速 HUD
   */
  hud: {
    type: Boolean,
    default: true,
  },
  /**
   * @description 是否显示底部操作提示
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
    default: '移动鼠标控制方向 · 按住加速 · 滚轮调节巡航速度',
  },
  /**
   * @description HUD / 准星的主色
   */
  color: {
    type: String,
    default: '#64c8ff',
  },
  /**
   * @description 是否画背景星云团
   */
  nebula: {
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
})

const emit = defineEmits<{
  'update:speed': [speed: number]
}>()

const rootEl = ref<HTMLElement | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)
const speedText = ref('0.0')

let ctx: CanvasRenderingContext2D | null = null
let stars: Star[] = []
let nebulae: Nebula[] = []
let rafId = 0
let observer: ResizeObserver | null = null

let width = 0
let height = 0
let centerX = 0
let centerY = 0

/** 指针位置（相对容器）与消失点（带平滑） */
let pointerX = 0
let pointerY = 0
let boosted = false
let baseSpeed = props.speed
let currentSpeed = 0
let vanishX = 0
let vanishY = 0

const rootStyle = computed(() => ({ '--warp-color': props.color }))

function randomColor(): [number, number, number] {
  return STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)]
}

function createStar(): Star {
  return {
    x: (Math.random() - 0.5) * width * 2,
    y: (Math.random() - 0.5) * height * 2,
    z: Math.random() * MAX_DEPTH,
    pz: 0,
    color: randomColor(),
  }
}

function resetStar(star: Star) {
  star.x = (Math.random() - 0.5) * width * 2
  star.y = (Math.random() - 0.5) * height * 2
  star.z = MAX_DEPTH
  star.pz = star.z
  star.color = randomColor()
}

function createNebula(): Nebula {
  return {
    x: (Math.random() - 0.5) * width * 3,
    y: (Math.random() - 0.5) * height * 3,
    z: Math.random() * MAX_DEPTH,
    size: 50 + Math.random() * 150,
    hue: Math.random() * 360,
    alpha: 0.02 + Math.random() * 0.03,
  }
}

function buildField() {
  stars = Array.from({ length: Math.max(1, Math.round(props.stars)) }, createStar)
  stars.forEach((star) => {
    star.pz = star.z
  })
  nebulae = props.nebula
    ? Array.from({ length: 20 }, createNebula)
    : []
}

function resize() {
  const canvas = canvasEl.value
  const root = rootEl.value
  if (!canvas || !root) return

  const dpr = Math.min(2, window.devicePixelRatio || 1)
  width = root.clientWidth || 1
  height = root.clientHeight || 1
  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`

  ctx = canvas.getContext('2d')
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)

  centerX = width / 2
  centerY = height / 2
  vanishX = centerX
  vanishY = centerY
  pointerX = centerX
  pointerY = centerY
  buildField()
}

function project(x: number, y: number, z: number) {
  return {
    x: (x / z) * centerX + vanishX,
    y: (y / z) * centerY + vanishY,
  }
}

function drawNebulae() {
  if (!ctx) return
  nebulae.forEach((n) => {
    const { x: sx, y: sy } = project(n.x, n.y, n.z)
    const scale = 1 - n.z / MAX_DEPTH
    const size = n.size * scale
    if (size < 5) return

    const gradient = ctx!.createRadialGradient(sx, sy, 0, sx, sy, size)
    gradient.addColorStop(0, `hsla(${n.hue}, 60%, 50%, ${n.alpha * scale})`)
    gradient.addColorStop(0.5, `hsla(${n.hue + 20}, 50%, 40%, ${n.alpha * scale * 0.5})`)
    gradient.addColorStop(1, `hsla(${n.hue}, 60%, 30%, 0)`)

    ctx!.save()
    ctx!.globalCompositeOperation = 'screen'
    ctx!.fillStyle = gradient
    ctx!.beginPath()
    ctx!.arc(sx, sy, size, 0, Math.PI * 2)
    ctx!.fill()
    ctx!.restore()
  })
}

function drawStars() {
  if (!ctx) return
  // 远的先画，近的压在上面
  stars.sort((a, b) => b.z - a.z)
  const trailLength = Math.min(currentSpeed / 5, 1)

  stars.forEach((star) => {
    const sx = (star.x / star.z) * centerX + vanishX
    const sy = (star.y / star.z) * centerY + vanishY
    const px = (star.x / star.pz) * centerX + vanishX
    const py = (star.y / star.pz) * centerY + vanishY

    const size = Math.max(0.5, (1 - star.z / MAX_DEPTH) * 3)
    const brightness = Math.max(0, 1 - star.z / MAX_DEPTH)
    const [r, g, b] = star.color

    if (trailLength > 0.1) {
      ctx!.beginPath()
      ctx!.moveTo(px, py)
      ctx!.lineTo(sx, sy)
      ctx!.strokeStyle = `rgba(${r}, ${g}, ${b}, ${brightness * trailLength * 0.7})`
      ctx!.lineWidth = size * 0.8
      ctx!.stroke()
    }

    ctx!.beginPath()
    ctx!.arc(sx, sy, size, 0, Math.PI * 2)
    ctx!.fillStyle = `rgba(${r}, ${g}, ${b}, ${brightness})`
    ctx!.fill()

    // 近处高速时补一圈光晕
    if (brightness > 0.7 && currentSpeed > 3) {
      ctx!.beginPath()
      ctx!.arc(sx, sy, size * 3, 0, Math.PI * 2)
      ctx!.fillStyle = `rgba(${r}, ${g}, ${b}, ${(brightness - 0.7) * 0.3})`
      ctx!.fill()
    }
  })
}

function drawSpeedLines() {
  if (!ctx || currentSpeed < 8) return
  const intensity = Math.min((currentSpeed - 8) / 20, 1)
  const count = Math.floor(intensity * 30)

  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2
    const distance = 50 + Math.random() * Math.max(width, height) * 0.4
    const x = vanishX + Math.cos(angle) * distance
    const y = vanishY + Math.sin(angle) * distance
    const length = 20 + Math.random() * 60 * intensity
    const dx = Math.cos(angle)
    const dy = Math.sin(angle)

    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + dx * length, y + dy * length)
    ctx.strokeStyle = `rgba(150, 200, 255, ${0.1 * intensity * Math.random()})`
    ctx.lineWidth = 1
    ctx.stroke()
  }
  ctx.restore()
}

function drawVignette() {
  if (!ctx) return
  const intensity = Math.min(currentSpeed / 15, 1)
  const gradient = ctx.createRadialGradient(
    vanishX,
    vanishY,
    Math.min(width, height) * 0.2,
    vanishX,
    vanishY,
    Math.max(width, height) * 0.75,
  )
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)')
  gradient.addColorStop(0.7, `rgba(0, 5, 15, ${0.3 * intensity})`)
  gradient.addColorStop(1, `rgba(0, 5, 15, ${0.6 + 0.3 * intensity})`)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  // 高速时边缘泛蓝
  if (currentSpeed > 5) {
    const blueIntensity = Math.min((currentSpeed - 5) / 20, 1)
    const blue = ctx.createRadialGradient(
      vanishX,
      vanishY,
      Math.min(width, height) * 0.35,
      vanishX,
      vanishY,
      Math.max(width, height) * 0.7,
    )
    blue.addColorStop(0, 'rgba(0, 50, 150, 0)')
    blue.addColorStop(0.8, `rgba(0, 30, 100, ${0.05 * blueIntensity})`)
    blue.addColorStop(1, `rgba(0, 50, 150, ${0.1 * blueIntensity})`)
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    ctx.fillStyle = blue
    ctx.fillRect(0, 0, width, height)
    ctx.restore()
  }
}

function frame() {
  if (!ctx) return

  const target = boosted ? baseSpeed * props.boost : baseSpeed
  currentSpeed += (target - currentSpeed) * 0.05

  // 指针偏移：控制消失点，最多偏到屏幕 30%
  const ox = (pointerX - centerX) / centerX
  const oy = (pointerY - centerY) / centerY
  vanishX += (centerX + ox * width * 0.3 - vanishX) * 0.08
  vanishY += (centerY + oy * height * 0.3 - vanishY) * 0.08

  // 半透明覆盖做拖尾
  ctx.fillStyle = `rgba(0, 2, 8, ${Math.max(0.15, 1 - currentSpeed * 0.03)})`
  ctx.fillRect(0, 0, width, height)

  if (nebulae.length) drawNebulae()

  stars.forEach((star) => {
    star.pz = star.z
    star.z -= currentSpeed
    star.x += ox * currentSpeed * 0.1
    star.y += oy * currentSpeed * 0.1

    if (star.z <= 0) resetStar(star)

    const { x: sx, y: sy } = project(star.x, star.y, star.z)
    if (sx < -200 || sx > width + 200 || sy < -200 || sy > height + 200) resetStar(star)
  })

  drawStars()
  drawSpeedLines()
  drawVignette()

  const nextText = (currentSpeed * 1.5).toFixed(1)
  if (nextText !== speedText.value) speedText.value = nextText

  rafId = requestAnimationFrame(frame)
}

function start() {
  if (rafId || props.paused) return
  rafId = requestAnimationFrame(frame)
}

function stop() {
  if (rafId) cancelAnimationFrame(rafId)
  rafId = 0
}

function onPointerMove(event: PointerEvent) {
  if (!props.interactive) return
  const rect = rootEl.value?.getBoundingClientRect()
  if (!rect) return
  pointerX = event.clientX - rect.left
  pointerY = event.clientY - rect.top
}

function onPointerDown(event: PointerEvent) {
  if (!props.interactive) return
  boosted = true
  const rect = rootEl.value?.getBoundingClientRect()
  if (rect) {
    pointerX = event.clientX - rect.left
    pointerY = event.clientY - rect.top
  }
}

function onPointerUp() {
  boosted = false
}

function onWheel(event: WheelEvent) {
  if (!props.interactive) return
  event.preventDefault()
  const next = Math.min(
    props.maxSpeed,
    Math.max(props.minSpeed, baseSpeed + (event.deltaY > 0 ? -0.5 : 0.5)),
  )
  if (next !== baseSpeed) {
    baseSpeed = next
    emit('update:speed', next)
  }
}

function onVisibilityChange() {
  if (document.hidden) stop()
  else start()
}

watch(
  () => props.speed,
  (next) => {
    baseSpeed = Math.min(props.maxSpeed, Math.max(props.minSpeed, next))
  },
)

watch(
  () => props.paused,
  (paused) => {
    if (paused) stop()
    else start()
  },
)

watch(
  () => [props.stars, props.nebula] as const,
  () => {
    buildField()
    currentSpeed = 0
  },
)

onMounted(() => {
  baseSpeed = Math.min(props.maxSpeed, Math.max(props.minSpeed, props.speed))
  resize()
  observer = new ResizeObserver(() => resize())
  if (rootEl.value) observer.observe(rootEl.value)
  document.addEventListener('visibilitychange', onVisibilityChange)
  start()
})

onBeforeUnmount(() => {
  stop()
  observer?.disconnect()
  document.removeEventListener('visibilitychange', onVisibilityChange)
})

defineExpose({
  /** 直接设定巡航速度 */
  setSpeed: (value: number) => {
    baseSpeed = Math.min(props.maxSpeed, Math.max(props.minSpeed, value))
    emit('update:speed', baseSpeed)
  },
  currentSpeed: () => currentSpeed,
})
</script>

<style scoped>
.warp {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #000;
  cursor: crosshair;
  touch-action: none;
}

.warp__canvas {
  display: block;
  width: 100%;
  height: 100%;
}

/* 屏幕中心的十字准星 */
.warp__crosshair {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  pointer-events: none;
}

.warp__crosshair::before,
.warp__crosshair::after {
  content: '';
  position: absolute;
  background: color-mix(in srgb, var(--warp-color) 30%, transparent);
}

.warp__crosshair::before {
  top: -15px;
  left: 0;
  width: 1px;
  height: 30px;
}

.warp__crosshair::after {
  top: 0;
  left: -15px;
  width: 30px;
  height: 1px;
}

.warp__hud {
  position: absolute;
  top: 22px;
  left: 24px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  color: color-mix(in srgb, var(--warp-color) 70%, transparent);
  font-family: 'Courier New', Consolas, monospace;
  pointer-events: none;
  text-shadow: 0 0 10px color-mix(in srgb, var(--warp-color) 50%, transparent);
}

.warp__hud-label {
  color: color-mix(in srgb, var(--warp-color) 50%, transparent);
  font-size: 12px;
}

.warp__hud-value {
  color: color-mix(in srgb, var(--warp-color) 88%, transparent);
  font-size: 28px;
  font-weight: 700;
  line-height: 1.1;
}

.warp__hud-unit {
  color: color-mix(in srgb, var(--warp-color) 50%, transparent);
  font-size: 12px;
}

.warp__tip {
  position: absolute;
  bottom: 18px;
  left: 0;
  width: 100%;
  margin: 0;
  color: color-mix(in srgb, var(--warp-color) 40%, transparent);
  font-family: 'Courier New', Consolas, monospace;
  font-size: 13px;
  text-align: center;
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .warp__tip {
    display: none;
  }
}
</style>

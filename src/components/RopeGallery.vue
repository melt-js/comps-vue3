<template>
  <div ref="rootEl" class="rope" :style="rootStyle">
    <canvas ref="canvasEl" class="rope__canvas" />

    <div class="rope__stage">
      <div
        v-for="(photo, i) in items"
        :key="`p-${i}`"
        :ref="(el) => setPhotoEl(el as HTMLElement | null, i)"
        class="rope__photo"
        :style="{ backgroundImage: `url(&quot;${photo.src}&quot;)` }"
        :title="photo.alt || ''"
        @pointerdown="onPointerDown($event, i)"
      />
      <span
        v-for="(photo, i) in items"
        :key="`pass-${i}`"
        :ref="(el) => setPassEl(el as HTMLElement | null, i)"
        class="rope__pass"
        aria-hidden="true"
      />
    </div>

    <div v-if="controls" class="rope__controls">
      <label>
        <span>风强度</span>
        <span>{{ wind.toFixed(1) }}x</span>
      </label>
      <input v-model.number="draftWind" type="range" min="0" max="6" step="0.1" @input="emitWind" />
    </div>

    <p v-if="hint" class="rope__hint">{{ hintText }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

/*
 * 由 video-code / 交互效果/绳串图片.html 提取而来。
 *
 * 原 demo 是一整页：一根往下垂的绳子横过画面上方，7 张照片按随机间距挂在绳上，各自带一点质量，
 * 会被「风」吹得小幅摆动；抓住任意一张拖动，整根绳子和所有照片都会跟着偏、松手再弹回去。
 * 绳子是 canvas 画的一条二次弧线（垂度 + 横向摆动都是弹簧），照片是绝对定位的 div，
 * 每张照片上还压着一小段「穿绳」把它和绳子连起来。
 *
 * 组件化后：
 * - 照片由 photos 传入，风强度走 v-model:wind，可拖动 / 可暂停；
 * - 画布尺寸跟容器（ResizeObserver + DPR），不再绑 window；
 * - 点一下不拖动会派发 select，方便宿主做点开大图之类的交互；
 * - 绳子的垂度 / 摆动 / 每张照片的摆角仍是原来的弹簧积分，逐帧直接写 DOM。
 */
type Photo = string | { src: string; alt?: string }

type PhotoState = {
  t: number
  mass: number
  restAngle: number
  angle: number
  velocity: number
  phase: number
  x: number
  y: number
}

const HOLE = { x: 16, y: 6 }
const ROPE_SAMPLES = 110

const props = defineProps({
  /**
   * @description 照片列表（字符串地址，或 { src, alt }）
   */
  photos: {
    type: Array as () => Photo[],
    default: () => [],
  },
  /**
   * @description 风强度 0 ~ 6（可用 v-model:wind 双向绑定）
   */
  wind: {
    type: Number,
    default: 3,
  },
  /**
   * @description 照片宽度，单位 px
   */
  photoWidth: {
    type: Number,
    default: 170,
  },
  /**
   * @description 照片高度，单位 px
   */
  photoHeight: {
    type: Number,
    default: 120,
  },
  /**
   * @description 绳子两端的水平留白，单位 px
   */
  inset: {
    type: Number,
    default: 78,
  },
  /**
   * @description 是否允许拖动照片拉动绳子
   */
  draggable: {
    type: Boolean,
    default: true,
  },
  /**
   * @description 是否显示内置的风强度滑杆
   */
  controls: {
    type: Boolean,
    default: false,
  },
  /**
   * @description 是否显示底部提示
   */
  hint: {
    type: Boolean,
    default: true,
  },
  /**
   * @description 提示文案
   */
  hintText: {
    type: String,
    default: '拖动任意一张照片，整根绳子都会跟着晃',
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
  'update:wind': [wind: number]
  /** 点中某张照片（不拖动） */
  select: [index: number, src: string]
}>()

const rootEl = ref<HTMLElement | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)
const draftWind = ref(props.wind)

const photoEls: (HTMLElement | null)[] = []
const passEls: (HTMLElement | null)[] = []
let states: PhotoState[] = []

let ctx: CanvasRenderingContext2D | null = null
let width = 0
let height = 0
let dpr = 1
let rafId = 0
let observer: ResizeObserver | null = null
let lastTime = 0

let ropeStart = { x: 0, y: 0 }
let ropeEnd = { x: 0, y: 0 }
let ropeSag = 0
let ropeSagVel = 0
let ropeSway = 0
let ropeSwayVel = 0

let dragX = 0
let dragY = 0
let dragVX = 0
let dragVY = 0
let dragTargetX = 0
let dragTargetY = 0
let activeDrag: {
  pointerId: number
  index: number
  startPointerX: number
  startPointerY: number
  startDragX: number
  startDragY: number
  moved: boolean
} | null = null

const items = computed(() =>
  props.photos.map((photo) => (typeof photo === 'string' ? { src: photo, alt: '' } : photo)),
)

const rootStyle = computed(() => ({
  '--rope-w': `${props.photoWidth}px`,
  '--rope-h': `${props.photoHeight}px`,
  '--rope-hole-x': `${HOLE.x}px`,
  '--rope-hole-y': `${HOLE.y}px`,
}))

function setPhotoEl(el: HTMLElement | null, i: number) {
  photoEls[i] = el
}

function setPassEl(el: HTMLElement | null, i: number) {
  passEls[i] = el
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

/** 沿绳均匀撒点，带最小间距，避免照片叠在一起 */
function buildTs(count: number, minT = 0.12, maxT = 0.88, minGap = 0.085) {
  const values: number[] = []
  let attempts = 0
  while (values.length < count && attempts < 4000) {
    const t = minT + Math.random() * (maxT - minT)
    if (values.every((v) => Math.abs(v - t) >= minGap)) values.push(t)
    attempts += 1
  }
  if (values.length < count) {
    values.length = 0
    const step = (maxT - minT) / (count + 1)
    for (let i = 0; i < count; i += 1) {
      const base = minT + step * (i + 1)
      const jitter = (Math.random() - 0.5) * step * 0.6
      values.push(clamp(base + jitter, minT, maxT))
    }
  }
  return values.sort((a, b) => a - b)
}

function resetStates() {
  const ts = buildTs(items.value.length)
  states = items.value.map((_, i) => {
    const dx = props.photoWidth - HOLE.x
    const dy = props.photoHeight - HOLE.y
    const restAngle = Math.atan2(dx, dy)
    return {
      t: ts[i],
      mass: 1 + Math.random() * 0.6,
      restAngle,
      angle: restAngle + (Math.random() - 0.5) * 0.06,
      velocity: 0,
      phase: Math.random() * Math.PI * 2,
      x: 0,
      y: 0,
    }
  })
}

/* ───────── 绳子的几何 ───────── */

function ropePoint(t: number) {
  const lineX = lerp(ropeStart.x, ropeEnd.x, t)
  const lineY = lerp(ropeStart.y, ropeEnd.y, t)
  const arc = 4 * t * (1 - t)
  const dragWeight = 0.36 + 0.64 * arc
  return {
    x: lineX + ropeSway * arc + dragX * dragWeight,
    y: lineY + ropeSag * arc + dragY * dragWeight,
  }
}

function ropeTangent(t: number) {
  const e = 0.004
  const a = ropePoint(clamp(t - e, 0, 1))
  const b = ropePoint(clamp(t + e, 0, 1))
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  return { x: dx / len, y: dy / len }
}

function resize() {
  const root = rootEl.value
  const canvas = canvasEl.value
  if (!root || !canvas) return

  width = root.clientWidth || 1
  height = root.clientHeight || 1
  dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1))
  canvas.width = Math.floor(width * dpr)
  canvas.height = Math.floor(height * dpr)
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`

  ctx = canvas.getContext('2d')
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)

  const inset = Math.min(props.inset, Math.max(12, width * 0.12))
  ropeStart = { x: inset, y: Math.max(56, height * 0.13) }
  ropeEnd = { x: width - inset, y: Math.max(72, height * 0.2) }

  ropeSag = Math.min(168, Math.max(88, height * 0.16))
  ropeSagVel = 0
  ropeSway = 0
  ropeSwayVel = 0
  dragX = 0
  dragY = 0
  dragVX = 0
  dragVY = 0
  dragTargetX = 0
  dragTargetY = 0
}

/* ───────── 每帧 ───────── */

function update(dt: number, timeS: number) {
  let windSum = 0
  const windStrength = props.wind

  states.forEach((state) => {
    const wind = Math.sin(timeS * 0.8 + state.phase) * 0.12 + Math.sin(timeS * 0.31 + state.phase * 0.7) * 0.06
    const windBoost = 0.2 + windStrength * windStrength * 0.35
    const gust = Math.sin(timeS * 1.9 + state.phase * 1.3) * 0.04 * windStrength
    const scaledWind = wind * windBoost + gust
    windSum += scaledWind

    const stiffness = 9.2
    const damping = 2.45
    const acc = -stiffness * Math.sin(state.angle - state.restAngle) - damping * state.velocity + scaledWind
    state.velocity += acc * dt
    state.angle += state.velocity * dt
    state.angle = clamp(state.angle, state.restAngle - 0.24, state.restAngle + 0.24)
  })

  if (!activeDrag) {
    dragTargetX = 0
    dragTargetY = 0
  }
  const dragK = activeDrag ? 42 : 16
  const dragDamping = activeDrag ? 9.5 : 7.6
  dragVX += (dragTargetX - dragX) * dragK * dt
  dragVY += (dragTargetY - dragY) * dragK * dt
  dragVX *= Math.exp(-dragDamping * dt)
  dragVY *= Math.exp(-dragDamping * dt)
  dragX += dragVX * dt
  dragY += dragVY * dt

  if (
    !activeDrag &&
    Math.abs(dragX) < 0.04 &&
    Math.abs(dragY) < 0.04 &&
    Math.abs(dragVX) < 0.04 &&
    Math.abs(dragVY) < 0.04
  ) {
    dragX = 0
    dragY = 0
    dragVX = 0
    dragVY = 0
  }

  const avgWind = windSum / Math.max(1, states.length)
  const avgMass = states.reduce((sum, p) => sum + p.mass, 0) / Math.max(1, states.length)
  const baseSag = Math.min(172, Math.max(90, height * 0.15 + avgMass * 20))
  const targetSag = baseSag + avgWind * 12 + dragY * 0.16
  const targetSway = avgWind * 30 + dragX * 0.18

  ropeSagVel += (targetSag - ropeSag) * 7.2 * dt
  ropeSagVel *= Math.exp(-3.9 * dt)
  ropeSag += ropeSagVel * dt

  ropeSwayVel += (targetSway - ropeSway) * 6.8 * dt
  ropeSwayVel *= Math.exp(-3.5 * dt)
  ropeSway += ropeSwayVel * dt

  states.forEach((state) => {
    const point = ropePoint(state.t)
    state.x = point.x
    state.y = point.y
  })
}

function drawRope() {
  if (!ctx) return
  ctx.clearRect(0, 0, width, height)

  // 主绳
  ctx.beginPath()
  for (let i = 0; i <= ROPE_SAMPLES; i += 1) {
    const point = ropePoint(i / ROPE_SAMPLES)
    if (i === 0) ctx.moveTo(point.x, point.y)
    else ctx.lineTo(point.x, point.y)
  }
  ctx.lineWidth = 6
  ctx.strokeStyle = '#5f4532'
  ctx.lineCap = 'round'
  ctx.stroke()

  // 高光
  ctx.beginPath()
  for (let i = 0; i <= ROPE_SAMPLES; i += 1) {
    const point = ropePoint(i / ROPE_SAMPLES)
    if (i === 0) ctx.moveTo(point.x, point.y - 1.5)
    else ctx.lineTo(point.x, point.y - 1.5)
  }
  ctx.lineWidth = 2
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
  ctx.stroke()
}

function drawPhotos() {
  if (!states.length) return

  // 从绳头到绳尾依次抬高层级，右边的照片压住左边的
  const order = states.map((state, index) => ({ state, index })).sort((a, b) => a.state.t - b.state.t)
  const zMap = new Map<number, number>()
  order.forEach((entry, i) => zMap.set(entry.index, 1000 + i * 10))

  states.forEach((state, i) => {
    const el = photoEls[i]
    const pass = passEls[i]
    if (!el || !pass) return
    const baseZ = zMap.get(i) ?? 1000

    el.style.left = `${state.x - HOLE.x}px`
    el.style.top = `${state.y - HOLE.y}px`
    el.style.zIndex = String(baseZ)
    const tiltY = clamp(state.angle * 58, -14, 14)
    const tiltX = clamp(-Math.abs(state.velocity) * 24, -6, 0)
    el.style.transform = `rotateZ(${state.angle}rad) rotateY(${tiltY}deg) rotateX(${tiltX}deg)`

    const tangent = ropeTangent(state.t)
    const tangentAngle = Math.atan2(tangent.y, tangent.x)
    pass.style.left = `${state.x - 3}px`
    pass.style.top = `${state.y}px`
    pass.style.zIndex = String(baseZ + 1)
    pass.style.transform = `translate(0, -50%) rotate(${tangentAngle}rad)`
  })
}

function frame(now: number) {
  const dt = Math.min(0.033, (now - lastTime) / 1000)
  lastTime = now
  update(dt, now / 1000)
  drawRope()
  drawPhotos()
  rafId = requestAnimationFrame(frame)
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

/* ───────── 拖动 ───────── */

function onPointerDown(event: PointerEvent, index: number) {
  if (!props.draggable) {
    // 不能拖的时候退化成点击
    emit('select', index, items.value[index].src)
    return
  }
  if (event.button !== 0 && event.pointerType === 'mouse') return
  activeDrag = {
    pointerId: event.pointerId,
    index,
    startPointerX: event.clientX,
    startPointerY: event.clientY,
    startDragX: dragX,
    startDragY: dragY,
    moved: false,
  }
  dragTargetX = dragX
  dragTargetY = dragY
  const el = photoEls[index]
  el?.classList.add('is-dragging')
  try {
    el?.setPointerCapture?.(event.pointerId)
  } catch {
    // 合成事件下会抛 NotFoundError
  }
  event.preventDefault()
}

function onPointerMove(event: PointerEvent) {
  if (!activeDrag || event.pointerId !== activeDrag.pointerId) return
  const dx = activeDrag.startDragX + (event.clientX - activeDrag.startPointerX)
  const dy = activeDrag.startDragY + (event.clientY - activeDrag.startPointerY)
  if (Math.hypot(event.clientX - activeDrag.startPointerX, event.clientY - activeDrag.startPointerY) > 4) {
    activeDrag.moved = true
  }
  const len = Math.hypot(dx, dy)
  const limit = 110
  const ratio = len > limit ? limit / len : 1
  dragTargetX = dx * ratio
  dragTargetY = dy * ratio
}

function onPointerUp(event: PointerEvent) {
  if (!activeDrag || event.pointerId !== activeDrag.pointerId) return
  const { index, moved } = activeDrag
  const el = photoEls[index]
  el?.classList.remove('is-dragging')
  try {
    el?.releasePointerCapture?.(event.pointerId)
  } catch {
    // 指针可能已释放
  }
  activeDrag = null
  dragTargetX = 0
  dragTargetY = 0
  if (!moved) emit('select', index, items.value[index].src)
}

function emitWind() {
  emit('update:wind', draftWind.value)
}

watch(
  () => props.wind,
  (next) => {
    draftWind.value = next
  },
)

watch(
  () => props.photos,
  () => {
    photoEls.length = 0
    passEls.length = 0
    resetStates()
  },
  { deep: true },
)

// 照片尺寸变了，挂点和静止角都要重算
watch(
  () => [props.photoWidth, props.photoHeight] as const,
  () => {
    resetStates()
    resize()
  },
)

watch(
  () => props.paused,
  (paused) => {
    if (paused) stop()
    else start()
  },
)

onMounted(() => {
  resetStates()
  resize()
  observer = new ResizeObserver(() => resize())
  if (rootEl.value) observer.observe(rootEl.value)
  document.addEventListener('pointermove', onPointerMove)
  document.addEventListener('pointerup', onPointerUp)
  document.addEventListener('pointercancel', onPointerUp)
  start()
})

onBeforeUnmount(() => {
  stop()
  observer?.disconnect()
  document.removeEventListener('pointermove', onPointerMove)
  document.removeEventListener('pointerup', onPointerUp)
  document.removeEventListener('pointercancel', onPointerUp)
})

defineExpose({
  /** 重新随机挂点位置 */
  shake: () => {
    resetStates()
  },
  getWind: () => props.wind,
})
</script>

<style scoped>
.rope {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 260px;
  overflow: hidden;
  background:
    radial-gradient(circle at 20% 10%, rgba(255, 255, 255, 0.65) 0%, rgba(255, 255, 255, 0) 40%),
    radial-gradient(circle at 85% 5%, rgba(255, 255, 255, 0.55) 0%, rgba(255, 255, 255, 0) 36%),
    linear-gradient(180deg, #ece4d7 0%, #f2ede4 45%, #e9e1d4 100%);
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
  touch-action: none;
  user-select: none;
}

.rope__canvas {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
}

.rope__stage {
  position: absolute;
  inset: 0;
  z-index: 2;
  perspective: 1200px;
  perspective-origin: 50% 20%;
}

/* 每张照片挂在自己的孔上，绕孔旋转 */
.rope__photo {
  position: absolute;
  width: var(--rope-w);
  height: var(--rope-h);
  border-radius: 8px;
  background: #ddd center / cover no-repeat;
  box-shadow: 0 16px 24px rgba(32, 18, 8, 0.22);
  transform-origin: var(--rope-hole-x) var(--rope-hole-y);
  transform-style: preserve-3d;
  backface-visibility: hidden;
  cursor: grab;
  will-change: transform, top, left;
  pointer-events: auto;
}

.rope__photo.is-dragging {
  cursor: grabbing;
}

/* 压在照片上那一小段「穿绳」，让它看起来是挂上去的 */
.rope__pass {
  position: absolute;
  width: 26px;
  height: 6px;
  border-radius: 999px;
  transform-origin: 0 50%;
  background: linear-gradient(
    90deg,
    rgba(95, 69, 50, 0) 0%,
    rgba(95, 69, 50, 0.95) 28%,
    rgba(95, 69, 50, 0.95) 72%,
    rgba(95, 69, 50, 0) 100%
  );
  pointer-events: none;
}

.rope__pass::after {
  content: '';
  position: absolute;
  top: 1px;
  right: 3px;
  left: 3px;
  height: 2px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.3);
}

.rope__controls {
  position: absolute;
  bottom: 14px;
  left: 18px;
  z-index: 5;
  min-width: 210px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.78);
  color: #5f4b39;
  backdrop-filter: blur(3px);
}

.rope__controls label {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 13px;
}

.rope__controls input {
  width: 100%;
  accent-color: #8a6844;
}

.rope__hint {
  position: absolute;
  right: 18px;
  bottom: 16px;
  margin: 0;
  color: rgba(95, 75, 57, 0.55);
  font-size: 12px;
  pointer-events: none;
}

@media (max-width: 560px) {
  .rope__hint {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .rope__photo {
    transition: none;
  }
}
</style>

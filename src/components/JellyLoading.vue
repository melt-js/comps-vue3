<template>
  <div class="jelly" :style="rootStyle" role="status" :aria-label="text || '加载中'">
    <canvas ref="canvasEl" class="jelly__canvas" />
    <p v-if="text" class="jelly__text">{{ text }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

/*
 * 由 video-code / UI组件/loading效果/果冻弹跳loading.html 提取而来。
 *
 * 原 demo 是 5 只带表情的果冻球轮流弹跳：落地时被压扁并喷出小碎片，空中拉长，
 * 地面有随高度缩放的影子。原实现有 600 行（控制点轮廓 + 弹簧物理 + 进度条 + 拖拽交互），
 * 这里保留「弹跳节奏 + 压扁拉长 + 落地碎屑 + 表情」这套视觉核心，用归一化尺寸重画：
 * - 所有尺寸按 size 归一化，500px 和 200px 观感一致；
 * - 用相位 + 三角函数代替逐帧物理积分，节奏稳定、也不会因掉帧而乱；
 * - 果冻数、速度、配色、表情开关、暂停都是 props。
 */
type Blob = {
  color: { body: string; light: string; dark: string }
  phase: number
  lastPhase: number
}

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  radius: number
  color: string
}

/** 原 demo 的五套马卡龙配色 */
const PALETTE = [
  { body: '#B8A9E8', light: '#D4C8F5', dark: '#8B7CC8' },
  { body: '#8DD8C8', light: '#B5EADF', dark: '#5CB8A5' },
  { body: '#F5B8A0', light: '#FCDACF', dark: '#E8937A' },
  { body: '#8BC4E8', light: '#B5DBF3', dark: '#5FA8D4' },
  { body: '#E8A0B8', light: '#F5C8D8', dark: '#D47A95' },
]

const props = defineProps({
  /**
   * @description 画布宽度，单位 px（高度按 0.9 比例）
   */
  size: {
    type: Number,
    default: 480,
  },
  /**
   * @description 果冻数量
   */
  count: {
    type: Number,
    default: 5,
  },
  /**
   * @description 一只果冻弹一次的时长，单位秒
   */
  speed: {
    type: Number,
    default: 1.8,
  },
  /**
   * @description 相邻果冻的起跳错开时间，单位秒
   */
  stagger: {
    type: Number,
    default: 0.15,
  },
  /**
   * @description 是否画表情（眼睛 + 嘴）
   */
  face: {
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
    default: '',
  },
})

const canvasEl = ref<HTMLCanvasElement | null>(null)
const rootStyle = computed(() => ({ '--jelly-w': `${props.size}px` }))

let ctx: CanvasRenderingContext2D | null = null
let rafId = 0
let lastTime = 0
let time = 0
let blobs: Blob[] = []
let particles: Particle[] = []
let observer: ResizeObserver | null = null
let width = 0
let height = 0

const GROUND_RATIO = 0.72
const RADIUS_RATIO = 25 / 550
const SPACING_RATIO = 90 / 550
const BOUNCE_RATIO = 160 / 500

function groundY() {
  return height * GROUND_RATIO
}

function radius() {
  return width * RADIUS_RATIO
}

function bounceHeight() {
  return height * BOUNCE_RATIO
}

function buildBlobs() {
  blobs = Array.from({ length: Math.max(1, Math.round(props.count)) }, (_, index) => {
    const phase = index * (props.stagger / Math.max(0.2, props.speed))
    return {
      color: PALETTE[index % PALETTE.length],
      phase,
      // 初始相位直接当上一帧相位，避免第一帧被误判成「刚落地」
      lastPhase: ((phase % 1) + 1) % 1,
    }
  })
}

function blobX(index: number) {
  const count = blobs.length
  const spacing = width * SPACING_RATIO
  return width / 2 + (index - (count - 1) / 2) * spacing
}

function spawnParticles(x: number, y: number, color: string) {
  const count = 3 + Math.floor(Math.random() * 3)
  for (let i = 0; i < count; i += 1) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9
    const speed = (60 + Math.random() * 90) * (width / 480)
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      radius: (2 + Math.random() * 2.5) * (width / 480),
      color,
    })
  }
}

function drawBlob(blob: Blob, index: number, lift: number) {
  if (!ctx) return
  const x = blobX(index)
  const r = radius()
  const restY = groundY() - r
  const y = restY - lift * bounceHeight()

  // 越贴地越扁（squash），越高越拉长（stretch）
  const closeness = Math.pow(1 - lift, 3)
  const scaleX = 1 + 0.34 * closeness - 0.08 * lift
  const scaleY = 1 - 0.3 * closeness + 0.12 * lift

  // 地面影子：越高越小越淡
  const shadowScale = 1 - lift * 0.45
  ctx.save()
  ctx.globalAlpha = 0.22 * (1 - lift * 0.6)
  ctx.fillStyle = '#000'
  ctx.beginPath()
  ctx.ellipse(x, groundY() + r * 0.18, r * 0.95 * shadowScale, r * 0.28 * shadowScale, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  ctx.save()
  ctx.translate(x, y)
  ctx.scale(scaleX, scaleY)

  // 果冻本体：主体 + 左上高光
  const gradient = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.15, 0, 0, r * 1.15)
  gradient.addColorStop(0, blob.color.light)
  gradient.addColorStop(0.65, blob.color.body)
  gradient.addColorStop(1, blob.color.dark)
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fillStyle = gradient
  ctx.fill()

  ctx.beginPath()
  ctx.ellipse(-r * 0.34, -r * 0.42, r * 0.24, r * 0.16, -0.5, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.fill()

  // 表情：落地时眯眼笑，空中睁大眼睛
  if (props.face) {
    const eyeY = -r * 0.12
    const eyeX = r * 0.3
    const open = 1 - closeness
    ctx.fillStyle = '#4b3f63'
    if (open > 0.55) {
      ctx.beginPath()
      ctx.arc(-eyeX, eyeY, r * 0.1, 0, Math.PI * 2)
      ctx.arc(eyeX, eyeY, r * 0.1, 0, Math.PI * 2)
      ctx.fill()
    } else {
      // 眯成两条弧
      ctx.strokeStyle = '#4b3f63'
      ctx.lineWidth = Math.max(1.4, r * 0.09)
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.arc(-eyeX, eyeY + r * 0.05, r * 0.12, Math.PI * 1.15, Math.PI * 1.85)
      ctx.arc(eyeX, eyeY + r * 0.05, r * 0.12, Math.PI * 1.15, Math.PI * 1.85)
      ctx.stroke()
    }

    // 嘴：扁的时候是微笑，飞起来是小圆嘴
    ctx.beginPath()
    if (open > 0.55) {
      ctx.arc(0, r * 0.24, r * 0.13, 0, Math.PI * 2)
      ctx.fillStyle = '#4b3f63'
      ctx.fill()
    } else {
      ctx.strokeStyle = '#4b3f63'
      ctx.lineWidth = Math.max(1.4, r * 0.09)
      ctx.beginPath()
      ctx.arc(0, r * 0.18, r * 0.2, Math.PI * 0.15, Math.PI * 0.85)
      ctx.stroke()
    }
  }

  ctx.restore()
}

function drawParticles(dt: number) {
  if (!ctx) return
  particles.forEach((particle) => {
    particle.x += particle.vx * dt
    particle.y += particle.vy * dt
    particle.vy += 320 * dt
    particle.life -= 1.8 * dt
  })
  particles = particles.filter((particle) => particle.life > 0)

  particles.forEach((particle) => {
    ctx!.save()
    ctx!.globalAlpha = Math.max(0, particle.life) * 0.65
    ctx!.beginPath()
    ctx!.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2)
    ctx!.fillStyle = particle.color
    ctx!.fill()
    ctx!.restore()
  })
}

function frame(now: number) {
  if (!ctx) return
  const dt = Math.min(0.05, (now - lastTime) / 1000 || 0.016)
  lastTime = now
  time += dt

  ctx.clearRect(0, 0, width, height)

  // 地面基线
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(width * 0.08, groundY())
  ctx.lineTo(width * 0.92, groundY())
  ctx.stroke()
  ctx.restore()

  const period = Math.max(0.3, props.speed)

  blobs.forEach((blob, index) => {
    const p = ((time / period + blob.phase) % 1 + 1) % 1
    const lift = Math.sin(Math.PI * p)

    // 相位回绕（p 从接近 1 跳回 0）= 落地，喷一次碎屑
    if (p < blob.lastPhase && blob.lastPhase > 0.5) {
      spawnParticles(blobX(index), groundY() - radius() * 0.2, blob.color.body)
    }
    blob.lastPhase = p

    drawBlob(blob, index, lift)
  })

  drawParticles(dt)

  rafId = requestAnimationFrame(frame)
}

function resize() {
  const canvas = canvasEl.value
  if (!canvas) return
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  width = props.size
  height = props.size * 0.9
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
  buildBlobs()
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
  () => [props.size, props.count, props.stagger] as const,
  () => {
    resize()
    buildBlobs()
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
.jelly {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.jelly__canvas {
  display: block;
  border-radius: 16px;
  background: radial-gradient(circle at 50% 30%, #1b2233 0%, #0b0d13 70%);
}

.jelly__text {
  margin: 0;
  color: rgba(255, 255, 255, 0.45);
  font-size: 12px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}
</style>

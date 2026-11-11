<template>
  <div class="vtx" :style="rootStyle" role="status" :aria-label="text || '加载中'">
    <canvas ref="canvasEl" class="vtx__canvas" />
    <p v-if="text" class="vtx__text">{{ text }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

/*
 * 由 video-code / UI组件/loading效果/粒子漩涡loading.html 提取而来。
 *
 * 原 demo 的 canvas 铺满整个视口，粒子的半径（30~220）和画布尺寸绑定，换尺寸就会跑到画布外。
 * 组件里改成「画布 = 组件自己的方框」，所有半径都按 size / 440 归一化，所以缩小到 120px
 * 仍然是一团同心的漩涡；另外补了设备像素比适配（高分屏不糊）和可见性暂停。
 *
 * 保留的观感：三层粒子（内层蓝、中层紫、外层粉）各自绕中心旋转 + 半径呼吸 + 光晕，
 * 同层粒子靠得近时连一条淡线；中心有一团会呼吸的辉光。
 */
type Particle = {
  layer: number
  angle: number
  radius: number
  baseRadius: number
  speed: number
  size: number
  hue: number
  alpha: number
  pulseSpeed: number
  pulsePhase: number
  oscillation: number
  tilt: number
  x: number
  y: number
  currentSize: number
}

/** 三层粒子的比例配置（原 demo 的三层） */
const LAYERS = [
  { ratio: 0.25, minR: 30, maxR: 80, speed: 0.03, size: 2.5, hue: 200 },
  { ratio: 0.35, minR: 80, maxR: 140, speed: 0.018, size: 2, hue: 270 },
  { ratio: 0.45, minR: 140, maxR: 220, speed: 0.01, size: 1.5, hue: 320 },
]
/** 半径基准：原 demo 的最外圈直径约 440 */
const BASE_DIAMETER = 440

const props = defineProps({
  /**
   * @description 画布边长，单位 px
   */
  size: {
    type: Number,
    default: 260,
  },
  /**
   * @description 粒子总数（按 25% / 35% / 45% 分配到三层）
   */
  count: {
    type: Number,
    default: 100,
  },
  /**
   * @description 色相基准，整体偏蓝（200）/ 紫（270）/ 粉（320）都从这里派生
   */
  hue: {
    type: Number,
    default: 200,
  },
  /**
   * @description 速度倍率，1 为原始转速
   */
  speed: {
    type: Number,
    default: 1,
  },
  /**
   * @description 是否画同层粒子之间的连线
   */
  connect: {
    type: Boolean,
    default: true,
  },
  /**
   * @description 是否用半透明覆盖做拖尾（关掉是干净的黑底）
   */
  trail: {
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
   * @description 底部文字，留空则不显示
   */
  text: {
    type: String,
    default: 'LOADING',
  },
})

const canvasEl = ref<HTMLCanvasElement | null>(null)

let ctx: CanvasRenderingContext2D | null = null
let particles: Particle[] = []
let rafId = 0
let time = 0
let width = 0
let height = 0
let centerX = 0
let centerY = 0
let radiusScale = 1
let observer: ResizeObserver | null = null

const rootStyle = computed(() => ({
  '--vtx-size': `${props.size}px`,
}))

function randomRange(min: number, max: number) {
  return Math.random() * (max - min) + min
}

function createParticle(layerIndex: number): Particle {
  const config = LAYERS[layerIndex]
  const angle = Math.random() * Math.PI * 2
  const baseRadius = randomRange(config.minR, config.maxR) * radiusScale
  return {
    layer: layerIndex,
    angle,
    radius: baseRadius,
    baseRadius,
    speed: config.speed * props.speed * (0.8 + Math.random() * 0.4),
    size: config.size * (0.5 + Math.random()) * Math.max(0.5, radiusScale),
    hue: config.hue + (props.hue - 200) + randomRange(-15, 15),
    alpha: 0.6 + Math.random() * 0.4,
    pulseSpeed: 0.02 + Math.random() * 0.03,
    pulsePhase: Math.random() * Math.PI * 2,
    oscillation: randomRange(5, 20) * radiusScale,
    tilt: (Math.random() - 0.5) * 0.3,
    x: centerX,
    y: centerY,
    currentSize: 2,
  }
}

function buildParticles() {
  radiusScale = props.size / BASE_DIAMETER
  particles = []
  LAYERS.forEach((layer, layerIndex) => {
    const layerCount = Math.round(props.count * layer.ratio)
    for (let i = 0; i < layerCount; i += 1) particles.push(createParticle(layerIndex))
  })
}

function resize() {
  const canvas = canvasEl.value
  if (!canvas) return
  const size = props.size
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  width = size
  height = size
  canvas.width = Math.round(size * dpr)
  canvas.height = Math.round(size * dpr)
  canvas.style.width = `${size}px`
  canvas.style.height = `${size}px`
  ctx = canvas.getContext('2d')
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
  centerX = size / 2
  centerY = size / 2
}

function drawCenterGlow() {
  if (!ctx) return
  const pulse = Math.sin(time * 0.03) * 0.2 + 0.8
  const glowRadius = Math.max(12, 60 * radiusScale * pulse)
  const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, glowRadius)
  gradient.addColorStop(0, `rgba(255, 255, 255, ${0.15 * pulse})`)
  gradient.addColorStop(0.3, `rgba(100, 150, 255, ${0.08 * pulse})`)
  gradient.addColorStop(0.6, `rgba(150, 50, 255, ${0.04 * pulse})`)
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.beginPath()
  ctx.arc(centerX, centerY, glowRadius, 0, Math.PI * 2)
  ctx.fillStyle = gradient
  ctx.fill()
}

function drawConnections() {
  if (!ctx || !props.connect) return
  const maxDist = 60 * Math.max(0.6, radiusScale)
  for (let i = 0; i < particles.length; i += 1) {
    const a = particles[i]
    for (let j = i + 1; j < particles.length; j += 1) {
      const b = particles[j]
      if (a.layer !== b.layer) continue
      const dx = a.x - b.x
      const dy = a.y - b.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      if (distance >= maxDist) continue

      const alpha = (1 - distance / maxDist) * 0.15
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.strokeStyle = `hsla(${(a.hue + b.hue) / 2}, 100%, 60%, ${alpha})`
      ctx.lineWidth = 0.5
      ctx.stroke()
    }
  }
}

function frame() {
  if (!ctx) return
  time += 1

  // 拖尾：半透明黑覆盖；否则整块清空
  ctx.fillStyle = props.trail ? 'rgba(5, 5, 16, 0.15)' : 'rgba(5, 5, 16, 1)'
  ctx.fillRect(0, 0, width, height)

  drawCenterGlow()
  drawConnections()

  particles.forEach((p) => {
    p.angle += p.speed
    p.radius = p.baseRadius + Math.sin(time * p.pulseSpeed + p.pulsePhase) * p.oscillation
    p.x = centerX + Math.cos(p.angle) * p.radius
    p.y = centerY + Math.sin(p.angle) * p.radius * (0.85 + p.tilt)
    p.currentSize = p.size * (0.8 + Math.sin(time * 0.05 + p.pulsePhase) * 0.3)

    const haloRadius = p.currentSize * 4
    const gradient = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, haloRadius)
    gradient.addColorStop(0, `hsla(${p.hue}, 100%, 70%, ${p.alpha})`)
    gradient.addColorStop(0.4, `hsla(${p.hue}, 100%, 50%, ${p.alpha * 0.3})`)
    gradient.addColorStop(1, `hsla(${p.hue}, 100%, 50%, 0)`)

    ctx!.beginPath()
    ctx!.arc(p.x, p.y, haloRadius, 0, Math.PI * 2)
    ctx!.fillStyle = gradient
    ctx!.fill()

    ctx!.beginPath()
    ctx!.arc(p.x, p.y, p.currentSize, 0, Math.PI * 2)
    ctx!.fillStyle = `hsla(${p.hue}, 100%, 85%, ${p.alpha})`
    ctx!.fill()
  })

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

function onVisibilityChange() {
  if (document.hidden) stop()
  else start()
}

onMounted(() => {
  resize()
  buildParticles()
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

// 尺寸 / 数量 / 色相变化时重算粒子并重开画布
watch(
  () => [props.size, props.count, props.hue] as const,
  () => {
    resize()
    buildParticles()
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

watch(
  () => props.speed,
  () => buildParticles(),
)
</script>

<style scoped>
.vtx {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.vtx__canvas {
  display: block;
  border-radius: 12px;
  background: #050510;
}

.vtx__text {
  display: inline-flex;
  margin: 0;
  color: rgba(255, 255, 255, 0.6);
  font-family: 'Helvetica Neue', sans-serif;
  font-size: 12px;
  letter-spacing: 8px;
  text-transform: uppercase;
}

/* 末尾跟着跳的三个点，和原 demo 的 steps 动画一致 */
.vtx__text::after {
  content: '';
  display: inline-block;
  width: 1.5em;
  text-align: left;
  animation: vtx-dots 1.5s steps(4, end) infinite;
}

@keyframes vtx-dots {
  0% {
    content: '';
  }
  25% {
    content: '.';
  }
  50% {
    content: '..';
  }
  75% {
    content: '...';
  }
}

@media (prefers-reduced-motion: reduce) {
  .vtx__text::after {
    animation: none;
    content: '...';
  }
}
</style>

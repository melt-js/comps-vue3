<template>
  <div class="gear" :style="rootStyle" role="status" :aria-label="text || '处理中'">
    <div class="gear__frame" :style="frameStyle">
      <div class="gear__system" :style="systemStyle">
        <div
          v-for="gear in gears"
          :key="gear.key"
          class="gear__wrapper"
          :class="{ 'is-ccw': gear.direction === 'ccw' }"
          :style="gear.wrapperStyle"
        >
          <svg
            class="gear__svg"
            :width="gear.svgSize"
            :height="gear.svgSize"
            :viewBox="`0 0 ${gear.svgSize} ${gear.svgSize}`"
            :style="{ animationDuration: gear.duration, color: gear.color }"
            aria-hidden="true"
          >
            <path
              :d="gear.path"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              opacity="0.9"
            />
            <circle
              :cx="gear.center"
              :cy="gear.center"
              :r="gear.holeRadius"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              opacity="0.7"
            />
            <circle
              :cx="gear.center"
              :cy="gear.center"
              :r="gear.hubRadius"
              fill="currentColor"
              opacity="0.8"
            />
            <line
              :x1="gear.center"
              :y1="gear.center - gear.holeRadius"
              :x2="gear.center"
              :y2="gear.center - gear.spokeRadius"
              stroke="currentColor"
              stroke-width="1.5"
              opacity="0.4"
            />
            <line
              :x1="gear.center"
              :y1="gear.center + gear.holeRadius"
              :x2="gear.center"
              :y2="gear.center + gear.spokeRadius"
              stroke="currentColor"
              stroke-width="1.5"
              opacity="0.4"
            />
            <line
              :x1="gear.center - gear.holeRadius"
              :y1="gear.center"
              :x2="gear.center - gear.spokeRadius"
              :y2="gear.center"
              stroke="currentColor"
              stroke-width="1.5"
              opacity="0.4"
            />
            <line
              :x1="gear.center + gear.holeRadius"
              :y1="gear.center"
              :x2="gear.center + gear.spokeRadius"
              :y2="gear.center"
              stroke="currentColor"
              stroke-width="1.5"
              opacity="0.4"
            />
          </svg>
        </div>

        <span
          v-for="particle in steamParticles"
          :key="particle.id"
          class="gear__steam"
          :style="particle.style"
          aria-hidden="true"
          @animationend="removeSteam(particle.id)"
        />

        <div v-if="showBar" class="gear__bar-track">
          <div class="gear__bar" />
        </div>
      </div>
    </div>

    <p v-if="text" class="gear__text">{{ text }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

/*
 * 由 video-code / UI组件/loading效果/齿轮联动loading.html 提取而来。
 *
 * 原 demo 的核心是一段「按齿数算多边形路径」的代码：给定半径和齿数，就能画出一个齿轮轮廓。
 * 组件里把这段保留成 createGearPath()，四个齿轮的坐标 / 半径 / 齿数 / 配色 / 转向 / 转速仍然
 * 写在布局表里（按 350x280 的基准坐标设计），整块再按 size 等比缩放 —— 所以缩到 120px 也不会散架。
 *
 * 另外几处变化：
 * - 蒸汽粒子从 setInterval + DOM 直接 append 改成 Vue 列表 + animationend 回收，卸载时清零；
 * - 底部进度条、蒸汽、文字都做成开关；
 * - 用 speed 统一乘所有齿轮的转速，paused 统一暂停。
 */
type GearConfig = {
  key: string
  x: number
  y: number
  radius: number
  teeth: number
  direction: 'cw' | 'ccw'
  duration: number
}

/** 基准坐标系 350x280 里的四个齿轮（和原 demo 一致） */
const GEAR_LAYOUT: GearConfig[] = [
  { key: 'a', x: 90, y: 100, radius: 50, teeth: 12, direction: 'cw', duration: 3 },
  { key: 'b', x: 175, y: 75, radius: 35, teeth: 9, direction: 'ccw', duration: 2.1 },
  { key: 'c', x: 240, y: 110, radius: 45, teeth: 11, direction: 'cw', duration: 2.65 },
  { key: 'd', x: 155, y: 145, radius: 25, teeth: 7, direction: 'ccw', duration: 1.5 },
]

const BASE_W = 350
const BASE_H = 280

const props = defineProps({
  /**
   * @description 齿轮组宽度，单位 px（整体等比缩放）
   */
  size: {
    type: Number,
    default: 350,
  },
  /**
   * @description 四个齿轮的颜色，按顺序对应
   */
  colors: {
    type: Array as () => string[],
    default: () => ['#e94560', '#ffb830', '#00d2ff', '#ff6b9d'],
  },
  /**
   * @description 速度倍率，1 为原始转速，越大转得越快
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
   * @description 是否显示齿轮间飘起的蒸汽粒子
   */
  steam: {
    type: Boolean,
    default: true,
  },
  /**
   * @description 是否暂停动画
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
    default: 'Processing',
  },
})

const scale = computed(() => props.size / BASE_W)

const rootStyle = computed(() => ({
  '--gear-play': props.paused ? 'paused' : 'running',
}))

/** 外层占位：按缩放后的真实尺寸留出空间，避免整块还占着 350x280 */
const frameStyle = computed(() => ({
  width: `${BASE_W * scale.value}px`,
  height: `${BASE_H * scale.value}px`,
}))

const systemStyle = computed(() => ({
  width: `${BASE_W}px`,
  height: `${BASE_H}px`,
  transform: `scale(${scale.value})`,
  transformOrigin: 'top left',
}))

const gears = computed(() =>
  GEAR_LAYOUT.map((config, index) => {
    const geometry = createGearPath(config.radius, config.teeth)
    return {
      ...config,
      color: props.colors[index % props.colors.length] || '#e94560',
      path: geometry.path,
      svgSize: geometry.size,
      center: geometry.center,
      holeRadius: config.radius * 0.25,
      hubRadius: Math.max(1.5, config.radius * 0.08),
      spokeRadius: config.radius * 0.6,
      duration: `${config.duration / Math.max(0.1, props.speed)}s`,
      wrapperStyle: {
        left: `${config.x - geometry.size / 2}px`,
        top: `${config.y - geometry.size / 2}px`,
        width: `${geometry.size}px`,
        height: `${geometry.size}px`,
      },
    }
  }),
)

/** 按齿数生成齿轮外轮廓：每颗齿由内外半径上的六个点连成 */
function createGearPath(radius: number, teeth: number) {
  const toothHeight = radius * 0.2
  const innerR = radius - toothHeight
  const outerR = radius + toothHeight
  const size = (outerR + 4) * 2
  const center = size / 2
  const step = (Math.PI * 2) / teeth
  const point = (angle: number, r: number) =>
    `${(center + Math.cos(angle) * r).toFixed(2)} ${(center + Math.sin(angle) * r).toFixed(2)}`

  let path = ''
  for (let i = 0; i < teeth; i += 1) {
    const a1 = i * step
    const a2 = a1 + step * 0.15
    const a3 = a1 + step * 0.35
    const a4 = a1 + step * 0.5
    const a5 = a1 + step * 0.65
    const a6 = a1 + step * 0.85
    const points = [
      point(a1, innerR),
      point(a2, innerR),
      point(a3, outerR),
      point(a4, outerR),
      point(a5, outerR),
      point(a6, innerR),
    ]
    if (i === 0) path += `M ${points[0]} `
    points.slice(1).forEach((p) => {
      path += `L ${p} `
    })
  }
  path += 'Z'

  return { path, size, center }
}

type Steam = {
  id: number
  style: Record<string, string>
}

const steamParticles = ref<Steam[]>([])
let steamSeed = 0
let steamTimer: ReturnType<typeof setInterval> | null = null

function spawnSteam() {
  const gear = GEAR_LAYOUT[Math.floor(Math.random() * GEAR_LAYOUT.length)]
  const angle = Math.random() * Math.PI * 2
  const distance = gear.radius * 0.6
  const size = 2 + Math.random() * 3

  steamParticles.value.push({
    id: (steamSeed += 1),
    style: {
      left: `${gear.x + Math.cos(angle) * distance}px`,
      top: `${gear.y + Math.sin(angle) * distance}px`,
      width: `${size}px`,
      height: `${size}px`,
      '--drift': `${Math.random() * 30 - 15}px`,
      animationDuration: `${1.5 + Math.random()}s`,
      background: `rgba(255, 255, 255, ${0.2 + Math.random() * 0.3})`,
    },
  })
}

function removeSteam(id: number) {
  steamParticles.value = steamParticles.value.filter((item) => item.id !== id)
}

function startSteam() {
  if (steamTimer || props.paused || !props.steam) return
  steamTimer = setInterval(spawnSteam, 200)
}

function stopSteam() {
  if (steamTimer) {
    clearInterval(steamTimer)
    steamTimer = null
  }
}

onMounted(startSteam)
onBeforeUnmount(stopSteam)

// steam / paused 变化时开关定时器
watch(
  () => [props.steam, props.paused] as const,
  ([steamEnabled, paused]) => {
    if (steamEnabled && !paused) startSteam()
    else stopSteam()
  },
)
</script>

<style scoped>
.gear {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
}

/* 基准坐标系：内部按 350x280 排版，整体 scale 到目标尺寸 */
.gear__system {
  position: relative;
  transform-origin: center center;
  animation-play-state: var(--gear-play);
}

.gear__wrapper {
  position: absolute;
}

.gear__svg {
  display: block;
  animation-name: gear-cw;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
  animation-play-state: var(--gear-play);
  filter: drop-shadow(0 0 6px currentColor);
}

.gear__wrapper.is-ccw .gear__svg {
  animation-name: gear-ccw;
}

.gear__steam {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  animation: gear-steam 2s ease-out forwards;
  animation-play-state: var(--gear-play);
}

.gear__bar-track {
  position: absolute;
  bottom: 0;
  left: 50%;
  width: 250px;
  height: 6px;
  overflow: hidden;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.1);
  transform: translateX(-50%);
}

.gear__bar {
  width: 0;
  height: 100%;
  border-radius: 3px;
  background: linear-gradient(90deg, #e94560, #ffb830, #00d2ff);
  background-size: 200% 100%;
  animation:
    gear-progress 3s ease-in-out infinite,
    gear-shimmer 1.5s linear infinite;
  animation-play-state: var(--gear-play);
}

.gear__text {
  margin: 10px 0 0;
  color: rgba(255, 255, 255, 0.5);
  font-family: 'Courier New', monospace;
  font-size: 12px;
  letter-spacing: 6px;
  text-transform: uppercase;
}

@keyframes gear-cw {
  to {
    transform: rotate(360deg);
  }
}

@keyframes gear-ccw {
  to {
    transform: rotate(-360deg);
  }
}

@keyframes gear-steam {
  0% {
    opacity: 0.8;
    transform: translateY(0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateY(-60px) translateX(var(--drift)) scale(0.3);
  }
}

@keyframes gear-progress {
  0% {
    width: 0%;
  }
  50% {
    width: 100%;
  }
  51% {
    width: 100%;
  }
  100% {
    width: 0%;
  }
}

@keyframes gear-shimmer {
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -200% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .gear__svg,
  .gear__bar,
  .gear__steam {
    animation: none;
  }
}
</style>

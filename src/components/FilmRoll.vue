<template>
  <div class="fr" :style="rootStyle">
    <section
      ref="stageEl"
      class="fr__stage"
      tabindex="0"
      role="region"
      aria-roledescription="轮播图"
      aria-label="旅行胶卷：左右拖动或方向键浏览，回车打开照片"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @wheel="onWheel"
      @keydown="onKeydown"
    >
      <div ref="trackEl" class="fr__track">
        <article
          v-for="(photo, i) in photos"
          :key="i"
          :ref="(el) => setFilmRef(el as HTMLElement | null, i)"
          class="fr__film"
        >
          <div class="fr__label">
            <span>{{ rollLabel }}</span>
            <span>{{ pad(i + 1) }} ▸</span>
          </div>

          <button
            type="button"
            class="fr__picture"
            :aria-label="`查看${photo.place || '照片'}`"
            :tabindex="i === index ? 0 : -1"
            @click="onPictureClick(i)"
          >
            <img class="fr__photo" :src="photo.src" :alt="photo.place || ''" :style="{ objectPosition: photo.pos || '50% 50%' }" draggable="false" />
            <img class="fr__ghost" :src="photo.src" alt="" aria-hidden="true" draggable="false" />
            <img class="fr__ghost fr__ghost--second" :src="photo.src" alt="" aria-hidden="true" draggable="false" />
            <span v-if="photo.date" class="fr__stamp">{{ stampOf(photo) }}</span>
            <span class="fr__expand" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" />
              </svg>
            </span>
          </button>

          <div class="fr__label fr__label--bottom">
            <span>{{ pad(i + 1) }}格</span>
            <span>{{ rollSubLabel }}</span>
            <span>{{ pad(i + 2) }}</span>
          </div>
        </article>
      </div>

      <span class="fr__mark" aria-hidden="true" />
    </section>

    <section v-if="details" class="fr__details" :class="{ 'is-moving': moving }">
      <div class="fr__index">
        <strong>{{ pad(index + 1) }}</strong>
        <span>/ {{ pad(photos.length) }} 张</span>
      </div>
      <div class="fr__memory" aria-live="polite">
        <h2 class="fr__place">{{ activePhoto?.place || '' }}</h2>
        <p class="fr__note">{{ activePhoto?.note || '' }}</p>
      </div>
      <div v-if="controls" class="fr__controls">
        <button type="button" class="fr__round" aria-label="上一张" :disabled="index === 0" @click="prev">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M19 12H5m6-6-6 6 6 6" /></svg>
        </button>
        <button type="button" class="fr__round" aria-label="下一张" :disabled="index === photos.length - 1" @click="next">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
        </button>
      </div>
    </section>

    <nav v-if="timeline && photos.length > 1" class="fr__timeline" aria-label="按日期选择照片">
      <span class="fr__timeline-label">{{ monthDay(photos[0]?.date) }}</span>
      <div class="fr__stops">
        <button
          v-for="(photo, i) in photos"
          :key="i"
          type="button"
          class="fr__stop"
          :class="{ 'is-active': i === index }"
          :aria-label="`${photo.date || ''} ${photo.place || ''}`"
          :aria-current="i === index ? 'true' : 'false'"
          @click="go(i)"
        >
          <span>{{ monthDay(photo.date, true) }}</span>
        </button>
      </div>
      <span class="fr__timeline-label">{{ monthDay(photos[photos.length - 1]?.date) }}</span>
    </nav>

    <slot name="footer" />

    <Teleport to="body">
      <Transition name="fr-viewer">
        <div v-if="viewerOpen" class="fr-viewer" role="dialog" aria-modal="true" :aria-label="viewerPhoto?.place || '照片预览'">
          <img class="fr-viewer__image" :src="viewerPhoto?.src || ''" :alt="viewerPhoto?.place || ''" />
          <div class="fr-viewer__top">
            <span class="fr-viewer__label">{{ pad(viewerIndex + 1) }} / {{ pad(photos.length) }}</span>
            <button type="button" class="fr-viewer__close" aria-label="关闭全屏预览" @click="closeViewer">×</button>
          </div>
          <div class="fr-viewer__caption">
            <p class="fr-viewer__date">{{ viewerPhoto?.date }} {{ viewerPhoto?.time }}</p>
            <h2 class="fr-viewer__place">{{ viewerPhoto?.place }}</h2>
            <p class="fr-viewer__note">{{ viewerPhoto?.note }}</p>
          </div>
          <div class="fr-viewer__nav">
            <button type="button" class="fr-viewer__round" aria-label="预览上一张" :disabled="viewerIndex === 0" @click="viewerStep(-1)">←</button>
            <button type="button" class="fr-viewer__round" aria-label="预览下一张" :disabled="viewerIndex === photos.length - 1" @click="viewerStep(1)">→</button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

/*
 * 由 video-code / 交互效果/旅行胶卷.html 提取而来。
 *
 * 原 demo 是一整页「山河拾光」旅行胶卷：一条横向胶片，每格是一个拍立得式的画面（上下片边 + 齿孔编号 +
 * 日期时间戳），拖动时整条胶片会随速度被拉扯 —— 离开中心越远越暗、越糊、越缩，飞快拖动时还有重影和倾斜；
 * 松手后按惯性滑一段再吸附到最近一格。另外有左右箭头、方向键、底部时间轴，点照片进全屏预览。
 *
 * 组件化后：
 * - 照片数组由 photos 传入，当前格用 v-model:index 双向绑定；
 * - 位置 / 速度 / 吸附还是原来的弹簧动画（rAF + 直接写 DOM，不走响应式，避免每帧重渲染）；
 * - 胶片尺寸、间距、是否可拖 / 可滚轮 / 显示详情 / 时间轴 / 全屏预览都能单独关；
 * - 全屏预览用 Teleport 挂到 body，Esc 关闭，左右可翻。
 */
type Photo = {
  src: string
  place?: string
  date?: string
  time?: string
  note?: string
  pos?: string
}

const props = defineProps({
  /**
   * @description 胶卷照片列表
   */
  photos: {
    type: Array as () => Photo[],
    default: () => [],
  },
  /**
   * @description 单格宽度，单位 px
   */
  frame: {
    type: Number,
    default: 380,
  },
  /**
   * @description 照片高度，单位 px
   */
  photoHeight: {
    type: Number,
    default: 260,
  },
  /**
   * @description 格子之间的间距，单位 px
   */
  gap: {
    type: Number,
    default: 22,
  },
  /**
   * @description 当前第几张（可用 v-model:index 双向绑定）
   */
  index: {
    type: Number,
    default: 0,
  },
  /**
   * @description 胶片上方的小字（片基型号）
   */
  rollLabel: {
    type: String,
    default: '柯达 彩色负片 400',
  },
  /**
   * @description 胶片下方的小字（卷次说明）
   */
  rollSubLabel: {
    type: String,
    default: '中国 · 2026年5月',
  },
  /**
   * @description 是否允许拖动
   */
  draggable: {
    type: Boolean,
    default: true,
  },
  /**
   * @description 是否允许滚轮翻页
   */
  wheelable: {
    type: Boolean,
    default: true,
  },
  /**
   * @description 是否显示下方的地点 / 备注和左右按钮
   */
  details: {
    type: Boolean,
    default: true,
  },
  /**
   * @description 是否显示左右按钮
   */
  controls: {
    type: Boolean,
    default: true,
  },
  /**
   * @description 是否显示底部时间轴
   */
  timeline: {
    type: Boolean,
    default: true,
  },
  /**
   * @description 是否允许点照片打开全屏预览
   */
  viewer: {
    type: Boolean,
    default: true,
  },
})

const emit = defineEmits<{
  'update:index': [index: number]
  /** 切到某一格 */
  change: [index: number, photo: Photo]
  /** 打开了全屏预览 */
  open: [index: number, photo: Photo]
}>()

const stageEl = ref<HTMLElement | null>(null)
const trackEl = ref<HTMLElement | null>(null)
const index = ref(Math.max(0, props.index))
const moving = ref(false)
const viewerOpen = ref(false)
const viewerIndex = ref(0)

const films: HTMLElement[] = []
const reduced =
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** 位置 / 速度用普通变量，动画循环里直接算，不进响应式 */
let position = 0
let velocity = 0
let target: number | null = null
let dragging = false
let moved = false
let startX = 0
let lastX = 0
let lastTime = 0
let rafId = 0
let lastFrameTime = 0

const activePhoto = computed(() => props.photos[index.value])
const viewerPhoto = computed(() => props.photos[viewerIndex.value])
const step = computed(() => props.frame + props.gap)

const rootStyle = computed(() => ({
  '--fr-frame': `${props.frame}px`,
  '--fr-h': `${props.photoHeight}px`,
  '--fr-gap': `${props.gap}px`,
}))

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function stampOf(photo: Photo) {
  return `${(photo.date || '').slice(2).replaceAll('.', ' ')} ${photo.time || ''}`.trim()
}

function monthDay(date?: string, withSlash = false) {
  if (!date) return ''
  const parts = date.split('.')
  if (parts.length < 3) return date
  const month = Number(parts[1])
  const day = Number(parts[2])
  return withSlash ? `${pad(month)} / ${pad(day)}` : `${month}月${day}日`
}

function setFilmRef(el: HTMLElement | null, i: number) {
  if (el) films[i] = el
}

function clampIndex(value: number) {
  return Math.max(0, Math.min(props.photos.length - 1, value))
}

/* ───────── 动画 ───────── */

function render() {
  const track = trackEl.value
  if (!track) return
  // 垂直方向保持 -50%（CSS 里的居中会被这一行覆盖，所以必须一起写）
  track.style.transform = `translate3d(${-position - props.frame / 2}px, -50%, 0)`

  films.forEach((film, i) => {
    if (!film) return
    const distance = (i * step.value - position) / step.value
    const dist = Math.abs(distance)
    const focus = Math.max(0, 1 - dist)
    const speed = reduced ? 0 : Math.min(Math.abs(velocity) / 30, 1)
    const bend = reduced ? 0 : Math.min(Math.abs(distance), 2.5) * Math.min(Math.abs(velocity) * 0.25, 9)
    const rotate = reduced ? 0 : Math.max(-4, Math.min(4, distance * velocity * 0.045))

    film.style.transform = `translateY(${bend}px) rotate(${rotate}deg) scale(${0.9 + focus * 0.1})`
    film.style.setProperty('--brightness', String(0.5 + focus * 0.5))
    film.style.setProperty('--blur', `${reduced ? 0 : Math.min(dist * 1.4, 2.5)}px`)
    film.style.setProperty('--ghost', String(speed > 0.25 ? speed * 0.3 : 0))
    film.style.setProperty('--trail', `${velocity * -1.8}px`)
  })

  const next = Math.round(position / step.value)
  if (next !== index.value && next >= 0 && next < props.photos.length) {
    index.value = next
  }
}

function settle() {
  moving.value = false
}

function wake() {
  if (rafId) return
  lastFrameTime = performance.now()
  rafId = requestAnimationFrame(tick)
}

function tick(now: number) {
  rafId = 0
  const dt = Math.min((now - lastFrameTime) / 16.667, 2)
  lastFrameTime = now

  if (!dragging) {
    if (target === null) {
      position += velocity * dt
      velocity *= Math.pow(0.94, dt)

      // 越界回弹
      if (position < 0 || position > (props.photos.length - 1) * step.value) {
        const edge = position < 0 ? 0 : (props.photos.length - 1) * step.value
        velocity += (edge - position) * 0.025 * dt
        velocity *= Math.pow(0.8, dt)
      }
      if (Math.abs(velocity) < 1.6) {
        target = clampIndex(Math.round(position / step.value)) * step.value
      }
    } else {
      const delta = target - position
      velocity = (velocity + delta * 0.035 * dt) * Math.pow(0.73, dt)
      position += velocity * dt
      if (Math.abs(delta) < 0.35 && Math.abs(velocity) < 0.15) {
        position = target
        velocity = 0
        settle()
      }
    }
  }

  render()
  if (dragging || !settledState()) wake()
}

function settledState() {
  return !moving.value && velocity === 0 && target !== null && position === target
}

function go(i: number) {
  const next = clampIndex(i)
  target = next * step.value
  if (reduced) {
    position = target
    velocity = 0
    render()
    settle()
    return
  }
  moving.value = true
  wake()
}

function next() {
  go(index.value + 1)
}

function prev() {
  go(index.value - 1)
}

/* ───────── 拖拽 / 滚轮 / 键盘 ───────── */

function onPointerDown(event: PointerEvent) {
  if (!props.draggable) return
  if (event.button !== 0 && event.pointerType === 'mouse') return
  dragging = true
  moved = false
  startX = lastX = event.clientX
  lastTime = performance.now()
  velocity = 0
  target = null
  moving.value = true
  try {
    stageEl.value?.setPointerCapture?.(event.pointerId)
  } catch {
    // 合成事件下会抛 NotFoundError
  }
}

function onPointerMove(event: PointerEvent) {
  if (!dragging) return
  const dx = event.clientX - lastX
  const now = performance.now()
  const dt = Math.max(now - lastTime, 1)
  lastX = event.clientX
  lastTime = now

  position -= dx
  velocity = (-dx / dt) * 16
  if (Math.abs(event.clientX - startX) > 4) moved = true
  render()
  wake()
}

function onPointerUp(event: PointerEvent) {
  if (!dragging) return
  dragging = false
  try {
    stageEl.value?.releasePointerCapture?.(event.pointerId)
  } catch {
    // 指针可能已释放
  }
  // 松手后接着滑一段，再吸附
  velocity = Math.max(-60, Math.min(60, velocity))
  target = null
  wake()
}

let wheelLock = 0
function onWheel(event: WheelEvent) {
  if (!props.wheelable) return
  event.preventDefault()
  const now = performance.now()
  if (now - wheelLock < 260) return
  if (Math.abs(event.deltaY) < 4 && Math.abs(event.deltaX) < 4) return
  wheelLock = now
  if (event.deltaY > 0 || event.deltaX > 0) next()
  else prev()
}

function onKeydown(event: KeyboardEvent) {
  if (viewerOpen.value) return
  if (event.key === 'ArrowRight') next()
  else if (event.key === 'ArrowLeft') prev()
  else if (event.key === 'Enter' && props.viewer) openViewer()
  else return
  event.preventDefault()
}

/* ───────── 预览 ───────── */

function onPictureClick(i: number) {
  // 拖完会紧跟一个 click，这一下不算「点开照片」；用完把标记清掉，
  // 否则之后的键盘 / 程序化 click 会被一直挡住
  const dragged = moved
  moved = false
  if (dragged) return
  if (i === index.value) {
    if (props.viewer) openViewer()
  } else {
    go(i)
  }
}

function openViewer() {
  if (!props.photos.length) return
  viewerIndex.value = index.value
  viewerOpen.value = true
  emit('open', index.value, props.photos[index.value])
}

function closeViewer() {
  viewerOpen.value = false
}

function viewerStep(delta: number) {
  viewerIndex.value = Math.max(0, Math.min(props.photos.length - 1, viewerIndex.value + delta))
}

function onViewerKey(event: KeyboardEvent) {
  if (!viewerOpen.value) return
  if (event.key === 'Escape') closeViewer()
  else if (event.key === 'ArrowRight') viewerStep(1)
  else if (event.key === 'ArrowLeft') viewerStep(-1)
  else return
  event.preventDefault()
}

/* ───────── 生命周期 ───────── */

let resizeObserver: ResizeObserver | null = null

function measure() {
  position = target ?? index.value * step.value
  target = index.value * step.value
  position = target
  velocity = 0
  render()
}

watch(
  () => props.index,
  (next) => {
    if (next !== index.value) {
      index.value = next
      go(next)
    }
  },
)

watch(index, (next) => {
  emit('update:index', next)
  const photo = props.photos[next]
  if (photo) emit('change', next, photo)
})

watch(
  () => props.photos.length,
  () => {
    measure()
  },
)

onMounted(() => {
  measure()
  document.addEventListener('keydown', onViewerKey)
  resizeObserver = new ResizeObserver(() => measure())
  if (stageEl.value) resizeObserver.observe(stageEl.value)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(rafId)
  rafId = 0
  document.removeEventListener('keydown', onViewerKey)
  resizeObserver?.disconnect()
})

defineExpose({ go, next, prev, openViewer })
</script>

<style scoped>
.fr {
  --fr-paper: #e8e6d9;
  --fr-accent: #d5a762;
  --fr-line: #34362f;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
  padding: 26px 0 18px;
  background: #141512;
  color: var(--fr-paper);
  font-family: 'Helvetica Neue', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  overflow: hidden;
  user-select: none;
}

/* ── 胶片舞台 ── */
.fr__stage {
  position: relative;
  height: calc(var(--fr-h) + 96px);
  overflow: hidden;
  cursor: grab;
  outline: none;
  touch-action: pan-y;
}

.fr__stage:active {
  cursor: grabbing;
}

.fr__stage:focus-visible {
  box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--fr-accent) 60%, transparent);
}

/* 整条胶片从舞台中心往两边铺 */
.fr__track {
  position: absolute;
  top: 50%;
  left: 50%;
  display: flex;
  gap: var(--fr-gap);
  align-items: center;
  transform: translate3d(0, -50%, 0);
  will-change: transform;
}

.fr__film {
  flex: 0 0 var(--fr-frame);
  width: var(--fr-frame);
  filter: brightness(var(--brightness, 1)) blur(var(--blur, 0));
  transition: filter 0.12s linear;
  will-change: transform, filter;
}

.fr__label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  color: rgba(232, 230, 217, 0.55);
  font-family: 'Courier New', monospace;
  font-size: 10px;
  letter-spacing: 0.08em;
  background: #22241f;
}

.fr__label--bottom {
  color: rgba(232, 230, 217, 0.4);
  background: #1c1e1a;
}

.fr__picture {
  position: relative;
  display: block;
  width: 100%;
  height: var(--fr-h);
  padding: 0;
  border: none;
  background: #2a2c26;
  cursor: pointer;
  overflow: hidden;
}

.fr__photo,
.fr__ghost {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
}

/* 飞快拖动时叠两层错位的同一张图，做出胶片拖影 */
.fr__ghost {
  opacity: var(--ghost, 0);
  mix-blend-mode: screen;
  transform: translateX(var(--trail, 0));
}

.fr__ghost--second {
  transform: translateX(calc(var(--trail, 0) * 1.7));
  opacity: calc(var(--ghost, 0) * 0.6);
}

.fr__stamp {
  position: absolute;
  right: 8px;
  bottom: 10px;
  color: #ffd9a0;
  font-family: 'Courier New', monospace;
  font-size: 11px;
  letter-spacing: 0.06em;
  text-shadow: 0 0 6px rgba(0, 0, 0, 0.8);
}

.fr__expand {
  position: absolute;
  top: 8px;
  right: 8px;
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.45);
  color: var(--fr-paper);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.fr__picture:hover .fr__expand,
.fr__picture:focus-visible .fr__expand {
  opacity: 1;
}

.fr__expand svg {
  width: 14px;
  height: 14px;
  stroke-width: 1.6;
}

/* 中心的取景刻度 */
.fr__mark {
  position: absolute;
  top: 8px;
  bottom: 8px;
  left: 50%;
  width: 1px;
  background: linear-gradient(
    to bottom,
    transparent,
    color-mix(in srgb, var(--fr-accent) 55%, transparent) 22%,
    color-mix(in srgb, var(--fr-accent) 55%, transparent) 78%,
    transparent
  );
  pointer-events: none;
}

/* ── 详情 ── */
.fr__details {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 18px;
  align-items: center;
  padding: 0 26px;
  transition: opacity 0.2s ease;
}

.fr__details.is-moving {
  opacity: 0.55;
}

.fr__index {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-family: 'Courier New', monospace;
}

.fr__index strong {
  color: var(--fr-accent);
  font-size: 28px;
  font-weight: 700;
  line-height: 1;
}

.fr__index span {
  color: rgba(232, 230, 217, 0.45);
  font-size: 11px;
}

.fr__memory {
  min-width: 0;
}

.fr__place {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.fr__note {
  margin: 0;
  color: rgba(232, 230, 217, 0.5);
  font-size: 12px;
  line-height: 1.6;
}

.fr__controls {
  display: flex;
  gap: 8px;
}

.fr__round,
.fr-viewer__round {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 1px solid rgba(232, 230, 217, 0.22);
  border-radius: 50%;
  background: transparent;
  color: var(--fr-paper);
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    opacity 0.2s ease;
}

.fr__round svg {
  width: 16px;
  height: 16px;
  stroke-width: 1.6;
}

.fr__round:hover:not(:disabled) {
  border-color: var(--fr-accent);
  background: color-mix(in srgb, var(--fr-accent) 14%, transparent);
}

.fr__round:disabled {
  opacity: 0.22;
  cursor: not-allowed;
}

/* ── 时间轴 ── */
.fr__timeline {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 26px;
}

.fr__timeline-label {
  flex: none;
  color: rgba(232, 230, 217, 0.35);
  font-family: 'Courier New', monospace;
  font-size: 10px;
}

.fr__stops {
  display: flex;
  flex: 1;
  gap: 4px;
  overflow-x: auto;
  scrollbar-width: none;
}

.fr__stops::-webkit-scrollbar {
  display: none;
}

.fr__stop {
  flex: 0 0 auto;
  min-width: 46px;
  padding: 6px 4px;
  border: none;
  border-top: 1px solid rgba(232, 230, 217, 0.16);
  background: transparent;
  color: rgba(232, 230, 217, 0.4);
  font-family: 'Courier New', monospace;
  font-size: 10px;
  white-space: nowrap;
  cursor: pointer;
  transition:
    color 0.2s ease,
    border-color 0.2s ease;
}

.fr__stop:hover {
  color: var(--fr-paper);
}

.fr__stop.is-active {
  border-top-color: var(--fr-accent);
  color: var(--fr-accent);
}

/* ── 全屏预览 ── */
.fr-viewer {
  position: fixed;
  inset: 0;
  z-index: 9000;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 28px;
  background: rgba(10, 11, 9, 0.94);
  backdrop-filter: blur(6px);
  color: #e8e6d9;
  font-family: 'Helvetica Neue', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

.fr-viewer__image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 56px 56px 128px;
}

.fr-viewer__top {
  position: absolute;
  top: 22px;
  right: 26px;
  left: 26px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.fr-viewer__label {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  letter-spacing: 0.1em;
  opacity: 0.6;
}

.fr-viewer__close {
  width: 34px;
  height: 34px;
  border: 1px solid rgba(232, 230, 217, 0.24);
  border-radius: 50%;
  background: transparent;
  color: #e8e6d9;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}

.fr-viewer__caption {
  position: relative;
  max-width: 640px;
}

.fr-viewer__date {
  margin: 0 0 6px;
  color: #d5a762;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  letter-spacing: 0.08em;
}

.fr-viewer__place {
  margin: 0 0 6px;
  font-size: 22px;
}

.fr-viewer__note {
  margin: 0;
  color: rgba(232, 230, 217, 0.55);
  font-size: 13px;
  line-height: 1.7;
}

.fr-viewer__nav {
  position: absolute;
  right: 26px;
  bottom: 28px;
  display: flex;
  gap: 8px;
}

.fr-viewer__round {
  width: 38px;
  height: 38px;
  font-size: 15px;
}

.fr-viewer__round:disabled {
  opacity: 0.25;
  cursor: not-allowed;
}

.fr-viewer-enter-active,
.fr-viewer-leave-active {
  transition: opacity 0.24s ease;
}

.fr-viewer-enter-from,
.fr-viewer-leave-to {
  opacity: 0;
}

@media (max-width: 640px) {
  .fr__details {
    grid-template-columns: auto 1fr;
    padding: 0 16px;
  }

  .fr__controls {
    grid-column: 1 / -1;
    justify-content: flex-end;
  }

  .fr__timeline {
    padding: 0 16px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .fr__film {
    transition: none;
  }
}
</style>

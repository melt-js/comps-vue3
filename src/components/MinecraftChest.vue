<template>
  <div
    ref="rootEl"
    class="mc"
    :class="{ 'is-scene': scene }"
    :style="rootStyle"
    tabindex="0"
    role="button"
    :aria-pressed="opened"
    aria-label="Minecraft 箱子"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @keydown="onKeydown"
  >
    <template v-if="scene">
      <span v-for="index in 3" :key="index" class="mc__cloud" :class="`mc__cloud--${index}`" />
      <span class="mc__ground" />
    </template>

    <div
      class="mc__camera"
      :style="{ '--mc-yaw': `${yaw}deg`, '--mc-pitch': `${pitch}deg` }"
    >
      <div class="mc__model" :style="modelStyle">
        <span class="mc__shadow" />

        <div
          v-for="face in bodyFaces"
          :key="face.key"
          class="mc__slot"
          :style="face.slotStyle"
        >
          <span class="mc__face" :class="face.className" :style="face.faceStyle" />
        </div>

        <!-- 盖子：绕后侧边缘向上翻 -->
        <div class="mc__lid" :style="lidStyle">
          <div
            v-for="face in lidFaces"
            :key="face.key"
            class="mc__slot"
            :style="face.slotStyle"
          >
            <span class="mc__face" :class="face.className" :style="face.faceStyle" />
          </div>
        </div>
      </div>
    </div>

    <p v-if="hint" class="mc__hint">{{ hintText }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

/*
 * 由 video-code / 交互效果/Minecraft箱子.html 提取而来。
 *
 * 原 demo 是一整页的 Minecraft 风格场景：天空 + 方块云 + 草皮地面，中间一个用纯 CSS 3D 面片拼出来的
 * 木箱子（外箱体 + 内壁 + 箱沿 + 铰链 + 铁锁），拖动可以环视（yaw 无限、pitch 限制在 -48° ~ -12°），
 * 点一下盖子绕后沿翻起 86°，还带一个 WebAudio 合成的「开箱」音效。
 *
 * 组件化后：
 * - 箱子几何改成数据驱动（外箱 / 内壁 / 箱沿 / 铰链 / 盖子 / 锁各是一组面片），尺寸六件套都能调；
 * - 开合状态走 v-model:open，盖子的翻转交给 CSS transition（原 demo 是 rAF 手写缓动）；
 * - 场景（云 / 草地）可以整体关掉，只留箱子本体贴在宿主背景上；
 * - 音效、提示、拖拽、点击都能单独关，第一次点击时才创建 AudioContext。
 */
type Tone =
  | 'front'
  | 'top'
  | 'side'
  | 'back'
  | 'dark'
  | 'innerFloor'
  | 'innerWall'
  | 'innerBack'
  | 'rim'
  | 'iron'

type FaceSpec = {
  key: string
  className: string
  slotStyle: Record<string, string>
  faceStyle: Record<string, string>
}

type CuboidFaces = Partial<Record<'front' | 'back' | 'right' | 'left' | 'top' | 'bottom', Tone>>

const props = defineProps({
  /**
   * @description 箱子是否打开（可用 v-model:open 双向绑定）
   */
  open: {
    type: Boolean,
    default: false,
  },
  /**
   * @description 箱体宽度，单位 px
   */
  width: {
    type: Number,
    default: 280,
  },
  /**
   * @description 箱体进深，单位 px
   */
  depth: {
    type: Number,
    default: 220,
  },
  /**
   * @description 箱体高度，单位 px
   */
  height: {
    type: Number,
    default: 160,
  },
  /**
   * @description 盖子的高度，单位 px
   */
  lidHeight: {
    type: Number,
    default: 48,
  },
  /**
   * @description 木板厚度（箱壁 / 箱沿），单位 px
   */
  wall: {
    type: Number,
    default: 18,
  },
  /**
   * @description 整体缩放
   */
  scale: {
    type: Number,
    default: 1,
  },
  /**
   * @description 初始水平环绕角，单位度
   */
  yaw: {
    type: Number,
    default: -28,
  },
  /**
   * @description 初始俯仰角，单位度（限 -48 ~ -12）
   */
  pitch: {
    type: Number,
    default: -28,
  },
  /**
   * @description 是否允许拖动环视
   */
  draggable: {
    type: Boolean,
    default: true,
  },
  /**
   * @description 是否允许点击开合
   */
  clickable: {
    type: Boolean,
    default: true,
  },
  /**
   * @description 是否播放开箱 / 关箱音效
   */
  sound: {
    type: Boolean,
    default: true,
  },
  /**
   * @description 是否画天空 / 云 / 草皮地面这套场景
   */
  scene: {
    type: Boolean,
    default: true,
  },
  /**
   * @description 盖子翻转时长，单位毫秒
   */
  duration: {
    type: Number,
    default: 280,
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
    default: '拖动环视 · 点击开合',
  },
})

const emit = defineEmits<{
  'update:open': [open: boolean]
  /** 开合状态变化 */
  toggle: [open: boolean]
}>()

const rootEl = ref<HTMLElement | null>(null)
const yaw = ref(props.yaw)
const pitch = ref(clamp(props.pitch, -48, -12))
const opened = ref(props.open)

let drag: { id: number; x: number; y: number; distance: number } | null = null
let audioContext: AudioContext | null = null

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

const rootStyle = computed(() => ({
  '--mc-scale': String(props.scale),
  '--mc-duration': `${props.duration}ms`,
}))

const modelStyle = computed(() => ({
  transform: `translateY(${(-props.height * 0.49).toFixed(1)}px)`,
}))

/** 盖子绕后沿翻转：0° 合上，86° 全开 */
const lidStyle = computed(() => ({
  transform: `translate3d(0px, 0px, ${-props.depth / 2}px) rotateX(${
    opened.value ? 86 : 0
  }deg)`,
}))

const TONE_CLASS: Record<Tone, string> = {
  front: 'tone-front',
  top: 'tone-top',
  side: 'tone-side',
  back: 'tone-back',
  dark: 'tone-dark',
  innerFloor: 'tone-inner-floor',
  innerWall: 'tone-inner-wall',
  innerBack: 'tone-inner-back',
  rim: 'tone-rim',
  iron: 'tone-iron',
}

/** 生成一个长方体的六个面（按原 demo 的面片摆法） */
function cuboid(
  group: string,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  faces: CuboidFaces,
): FaceSpec[] {
  const list: FaceSpec[] = []
  const push = (key: string, tone: Tone, fw: number, fh: number, fx: number, fy: number, fz: number, rotation: string) => {
    list.push(makeFace(`${group}-${key}`, tone, fw, fh, fx, fy, fz, rotation))
  }

  if (faces.front) push('front', faces.front, w, h, x, y, z + d / 2, '')
  if (faces.back) push('back', faces.back, w, h, x, y, z - d / 2, 'rotateY(180deg)')
  if (faces.right) push('right', faces.right, d, h, x + w / 2, y, z, 'rotateY(90deg)')
  if (faces.left) push('left', faces.left, d, h, x - w / 2, y, z, 'rotateY(-90deg)')
  if (faces.top) push('top', faces.top, w, d, x, y - h / 2, z, 'rotateX(90deg)')
  if (faces.bottom) push('bottom', faces.bottom, w, d, x, y + h / 2, z, 'rotateX(-90deg)')

  return list
}

function makeFace(
  key: string,
  tone: Tone,
  width: number,
  height: number,
  x: number,
  y: number,
  z: number,
  rotation: string,
): FaceSpec {
  return {
    key,
    className: TONE_CLASS[tone],
    slotStyle: { transform: `translate3d(${x}px, ${y}px, ${z}px)` },
    faceStyle: {
      width: `${width}px`,
      height: `${height}px`,
      marginLeft: `${-width / 2}px`,
      marginTop: `${-height / 2}px`,
      transform: rotation,
    },
  }
}

/** 箱体（不含盖子）：外箱 + 内壁 + 箱沿 + 铰链 */
const bodyFaces = computed<FaceSpec[]>(() => {
  const { width, depth, height, wall } = props
  const innerWidth = width - wall * 2
  const innerDepth = depth - wall * 2
  const innerHeight = height - wall * 1.3
  const faces: FaceSpec[] = []

  faces.push(
    ...cuboid('base', 0, height / 2, 0, width, height, depth, {
      front: 'front',
      back: 'back',
      right: 'side',
      left: 'dark',
      bottom: 'dark',
    }),
  )

  // 内壁：底板 + 后 / 前 / 右 / 左四面
  faces.push(makeFace('inner-floor', 'innerFloor', innerWidth, innerDepth, 0, height - wall, 0, 'rotateX(90deg)'))
  faces.push(
    makeFace('inner-back-wall', 'innerBack', innerWidth, innerHeight, 0, innerHeight / 2 + 6, -depth / 2 + wall, 'rotateY(180deg)'),
  )
  faces.push(makeFace('inner-front-wall', 'innerWall', innerWidth, innerHeight * 0.72, 0, innerHeight * 0.36 + 22, depth / 2 - wall, ''))
  faces.push(makeFace('inner-right-wall', 'innerWall', innerDepth, innerHeight, width / 2 - wall, innerHeight / 2 + 6, 0, 'rotateY(90deg)'))
  faces.push(makeFace('inner-left-wall', 'innerWall', innerDepth, innerHeight, -width / 2 + wall, innerHeight / 2 + 6, 0, 'rotateY(-90deg)'))

  // 箱沿
  faces.push(
    ...cuboid('rim-front', 0, 2, depth / 2 - wall / 2, width + 6, 12, wall, {
      front: 'rim',
      back: 'side',
      top: 'rim',
      bottom: 'dark',
    }),
  )
  faces.push(
    ...cuboid('rim-back', 0, 2, -depth / 2 + wall / 2, width + 6, 12, wall, {
      front: 'side',
      back: 'back',
      top: 'rim',
      bottom: 'dark',
    }),
  )
  faces.push(
    ...cuboid('rim-left', -width / 2 + wall / 2, 2, 0, wall, 12, depth, {
      front: 'front',
      back: 'back',
      left: 'dark',
      top: 'rim',
    }),
  )
  faces.push(
    ...cuboid('rim-right', width / 2 - wall / 2, 2, 0, wall, 12, depth, {
      front: 'front',
      back: 'back',
      right: 'side',
      top: 'rim',
    }),
  )

  return faces
})

/** 盖子：盖板 + 铁锁（跟着盖子一起翻） */
const lidFaces = computed<FaceSpec[]>(() => {
  const { width, depth, lidHeight } = props
  const faces: FaceSpec[] = []

  faces.push(
    ...cuboid('lid', 0, -lidHeight / 2, depth / 2, width, lidHeight, depth, {
      front: 'top',
      back: 'back',
      right: 'side',
      left: 'dark',
      top: 'top',
      bottom: 'innerFloor',
    }),
  )
  faces.push(
    ...cuboid('lock', 0, -8, depth + 8, 42, 58, 16, {
      front: 'iron',
      back: 'iron',
      right: 'iron',
      left: 'iron',
      top: 'iron',
      bottom: 'iron',
    }),
  )

  return faces
})

function setOpen(next: boolean) {
  if (opened.value === next) return
  opened.value = next
  emit('update:open', next)
  emit('toggle', next)
  playSound(next)
}

/** 用 WebAudio 合成一个短促的木板「咔哒」声，不依赖音频文件 */
function playSound(opening: boolean) {
  if (!props.sound || typeof window === 'undefined') return
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    if (!audioContext) audioContext = new Ctor()
    const audio = audioContext
    const now = audio.currentTime
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    const filter = audio.createBiquadFilter()

    osc.type = 'triangle'
    osc.frequency.setValueAtTime(opening ? 150 : 92, now)
    osc.frequency.exponentialRampToValueAtTime(opening ? 74 : 54, now + (opening ? 0.16 : 0.1))
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(opening ? 740 : 380, now)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.075, now + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (opening ? 0.2 : 0.13))

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(audio.destination)
    osc.start(now)
    osc.stop(now + 0.22)
  } catch {
    // 浏览器可能因为缺少用户手势而拦截音频，忽略即可
  }
}

function onPointerDown(event: PointerEvent) {
  if (!props.draggable && !props.clickable) return
  if (event.button !== 0 && event.pointerType === 'mouse') return
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY, distance: 0 }
  try {
    rootEl.value?.setPointerCapture?.(event.pointerId)
  } catch {
    // 合成事件下会抛 NotFoundError
  }
}

function onPointerMove(event: PointerEvent) {
  if (!drag || drag.id !== event.pointerId || !props.draggable) return
  const dx = event.clientX - drag.x
  const dy = event.clientY - drag.y
  drag.x = event.clientX
  drag.y = event.clientY
  drag.distance += Math.hypot(dx, dy)
  if (drag.distance <= 2) return

  yaw.value += dx * 0.34
  pitch.value = clamp(pitch.value - dy * 0.26, -48, -12)
}

function onPointerUp(event: PointerEvent) {
  if (!drag || drag.id !== event.pointerId) return
  // 位移很小才算「点击」，拖动环视不会顺手开箱
  const isClick = drag.distance < 6
  drag = null
  try {
    rootEl.value?.releasePointerCapture?.(event.pointerId)
  } catch {
    // 指针可能已经释放
  }
  if (isClick && props.clickable) setOpen(!opened.value)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    setOpen(!opened.value)
  }
}

watch(
  () => props.open,
  (next) => {
    opened.value = next
  },
)

onBeforeUnmount(() => {
  audioContext?.close?.().catch(() => {})
  audioContext = null
})

defineExpose({
  toggle: () => setOpen(!opened.value),
  open: () => setOpen(true),
  close: () => setOpen(false),
  resetView: () => {
    yaw.value = props.yaw
    pitch.value = clamp(props.pitch, -48, -12)
  },
})
</script>

<style scoped>
.mc {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 280px;
  overflow: hidden;
  /* 默认透明：关掉场景时让宿主的背景透上来 */
  background: transparent;
  image-rendering: pixelated;
  user-select: none;
  touch-action: none;
  cursor: grab;
  perspective: 960px;
  perspective-origin: 50% 42%;
  outline: none;
}

/* 打开场景时才是 Minecraft 的天空蓝 */
.mc.is-scene {
  background: #72bdf4;
}

.mc:active {
  cursor: grabbing;
}

/* 方块云：三个横向小方块 + 投影 */
.mc__cloud {
  position: absolute;
  height: 18px;
  background: rgba(255, 255, 255, 0.24);
  box-shadow:
    42px -18px 0 rgba(255, 255, 255, 0.24),
    84px 0 0 rgba(255, 255, 255, 0.24);
  pointer-events: none;
}

.mc__cloud--1 {
  top: 15%;
  left: 8%;
  width: 86px;
}

.mc__cloud--2 {
  top: 13%;
  left: 39%;
  width: 78px;
}

.mc__cloud--3 {
  top: 16%;
  right: 17%;
  width: 92px;
}

/* 草皮 + 泥土，带方块纹理 */
.mc__ground {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 42%;
  background:
    linear-gradient(#7fbe55 0 24px, #315f25 24px 36px, transparent 36px),
    repeating-linear-gradient(90deg, rgba(58, 35, 20, 0.34) 0 1px, transparent 1px 52px),
    repeating-linear-gradient(0deg, rgba(58, 35, 20, 0.34) 0 1px, transparent 1px 52px),
    #95572f;
  pointer-events: none;
}

/* 相机：整块靠 yaw / pitch 旋转 */
.mc__camera {
  position: absolute;
  top: 53%;
  left: 50%;
  width: 0;
  height: 0;
  transform-style: preserve-3d;
  transform: translate(-50%, -50%) scale(var(--mc-scale)) rotateX(var(--mc-pitch)) rotateY(var(--mc-yaw));
}

.mc__model,
.mc__lid,
.mc__slot {
  position: absolute;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
  transform-style: preserve-3d;
}

.mc__lid {
  transition: transform var(--mc-duration) cubic-bezier(0.17, 0.67, 0.23, 1);
}

/* 地面阴影 */
.mc__shadow {
  position: absolute;
  top: 112px;
  left: -145px;
  width: 290px;
  height: 88px;
  border-radius: 50%;
  background: rgba(35, 18, 8, 0.24);
  filter: blur(13px);
  transform: translateZ(-120px) rotateX(90deg);
}

.mc__face {
  position: absolute;
  top: 0;
  left: 0;
  box-sizing: border-box;
  overflow: hidden;
  border: 3px solid #211309;
  background-color: #c87929;
  backface-visibility: visible;
  transform-style: preserve-3d;
  box-shadow:
    inset 0 0 0 1px rgba(255, 229, 146, 0.12),
    inset 0 -18px 0 rgba(60, 31, 12, 0.16);
}

/* 木纹：横竖格线 + 中段分隔条 */
.mc__face::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    repeating-linear-gradient(90deg, transparent 0 37px, rgba(36, 20, 8, 0.34) 37px 40px),
    repeating-linear-gradient(0deg, transparent 0 37px, rgba(36, 20, 8, 0.3) 37px 40px);
  pointer-events: none;
}

.mc__face::after {
  content: '';
  position: absolute;
  top: 34%;
  right: 0;
  left: 0;
  height: 15%;
  background:
    linear-gradient(rgba(68, 36, 14, 0.36), rgba(68, 36, 14, 0.36)) 0 0 / 100% 42% no-repeat,
    linear-gradient(rgba(255, 207, 93, 0.16), rgba(255, 207, 93, 0.16)) 0 100% / 100% 30% no-repeat;
  pointer-events: none;
}

/* 六种木板色 */
.tone-front {
  background-color: #c87929;
}

.tone-top {
  background-color: #e09637;
}

.tone-side {
  background-color: #a85f22;
}

.tone-back {
  background-color: #96551f;
}

.tone-dark {
  background-color: #7f471b;
}

/* 内壁：没有木纹格线，只有更暗的底色 */
.tone-inner-floor {
  background-color: #d88a35;
  box-shadow:
    inset 0 0 0 2px rgba(255, 226, 138, 0.14),
    inset 0 28px 0 rgba(255, 197, 78, 0.1);
}

.tone-inner-wall {
  background-color: #bd6d28;
  box-shadow: inset 0 0 0 2px rgba(255, 226, 138, 0.1);
}

.tone-inner-back {
  background-color: #a65e24;
}

.tone-rim {
  background-color: #de9637;
  box-shadow: inset 0 -7px 0 rgba(69, 36, 13, 0.22);
}

.tone-iron {
  border-color: #252525;
  background: #cfcfcf;
  box-shadow:
    inset 6px 0 0 rgba(255, 255, 255, 0.58),
    inset -7px 0 0 rgba(0, 0, 0, 0.28);
}

.tone-inner-floor::before,
.tone-inner-floor::after,
.tone-inner-wall::before,
.tone-inner-wall::after,
.tone-inner-back::before,
.tone-inner-back::after,
.tone-rim::before,
.tone-rim::after,
.tone-iron::before,
.tone-iron::after {
  display: none;
}

.mc__hint {
  position: absolute;
  bottom: 14px;
  left: 0;
  width: 100%;
  margin: 0;
  color: rgba(255, 255, 255, 0.72);
  font-family: monospace;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-align: center;
  text-shadow: 0 2px 0 rgba(0, 0, 0, 0.35);
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .mc__lid {
    transition-duration: 0.01ms;
  }
}
</style>

<template>
  <div class="wb" :style="rootStyle" role="status" :aria-label="`加载中 ${displayPercent}%`">
    <span class="wb__wave wb__wave--1" />
    <span class="wb__wave wb__wave--2" />

    <span
      v-for="drop in drops"
      :key="`drop-${drop.id}`"
      class="wb__drop"
      :style="drop.style"
      aria-hidden="true"
      @animationend="onDropEnd(drop)"
    />
    <span
      v-for="ripple in ripples"
      :key="`ripple-${ripple.id}`"
      class="wb__ripple"
      :style="ripple.style"
      aria-hidden="true"
      @animationend="removeRipple(ripple.id)"
    />

    <span v-if="showPercent" class="wb__percent">{{ displayPercent }}%</span>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

/*
 * 由 video-code / UI组件/loading效果/水球进度加载.html 提取而来。
 *
 * 原 demo 是一个全屏遮罩里的水球：两层旋转的「波形」用 clip 出水面，水位跟着进度上升，
 * 边上有水滴落下、落点炸开涟漪，中间是百分比，15 秒走完一轮后归零重来。
 *
 * 组件化后：
 * - 尺寸、双色、波浪转速、走完一轮的时长都是 props；
 * - 水位从「JS 直接改 wave.style.top」换成 CSS 变量 --wb-top，进度变化只改一个变量；
 * - 水滴 / 涟漪改成 Vue 列表 + animationend 回收，卸载时不再有游离的定时器；
 * - 进度可以自动走（auto，默认），也可以受控（auto=false + progress），
 *   同时通过 update:progress 把内部进度抛给宿主。
 */
type Drop = { id: number; left: number; target: string; style: Record<string, string> }
type Ripple = { id: number; style: Record<string, string> }

const props = defineProps({
  /**
   * @description 水球直径，单位 px
   */
  size: {
    type: Number,
    default: 200,
  },
  /**
   * @description 水的深色（第一层波浪）
   */
  color: {
    type: String,
    default: '#6c5ce7',
  },
  /**
   * @description 水的浅色（第二层波浪）
   */
  color2: {
    type: String,
    default: '#00ceff',
  },
  /**
   * @description 是否自动推进进度（关掉则吃 progress 的受控值）
   */
  auto: {
    type: Boolean,
    default: true,
  },
  /**
   * @description 受控进度 0~100，auto 为 false 时生效
   */
  progress: {
    type: Number,
    default: 0,
  },
  /**
   * @description 自动模式下走完一轮的时长，单位秒
   */
  duration: {
    type: Number,
    default: 15,
  },
  /**
   * @description 波浪转速倍率，1 为原始速度
   */
  speed: {
    type: Number,
    default: 1,
  },
  /**
   * @description 是否显示中间百分比
   */
  showPercent: {
    type: Boolean,
    default: true,
  },
  /**
   * @description 是否显示水滴与涟漪
   */
  drops: {
    type: Boolean,
    default: true,
  },
  /**
   * @description 是否暂停（波浪、进度、水滴都停）
   */
  paused: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits<{
  'update:progress': [value: number]
}>()

const autoProgress = ref(0)
const drops = ref<Drop[]>([])
const ripples = ref<Ripple[]>([])

let progressTimer: ReturnType<typeof setInterval> | null = null
let dropTimer: ReturnType<typeof setInterval> | null = null
let seed = 0
let resetTo: ReturnType<typeof setTimeout> | null = null

const displayPercent = computed(() =>
  Math.round(
    props.auto ? autoProgress.value : Math.min(100, Math.max(0, props.progress)),
  ),
)

/** 水面位置：0% 水位 = 水面在底部（top 100%），100% = 顶到上沿（top 0%） */
const waterTop = computed(() => 100 - displayPercent.value)

const rootStyle = computed(() => ({
  '--wb-size': `${props.size}px`,
  '--wb-c1': props.color,
  '--wb-c2': props.color2,
  '--wb-top': `${waterTop.value}%`,
  '--wb-top2': `${waterTop.value + 10}%`,
  '--wb-speed': String(Math.max(0.1, props.speed)),
  '--wb-play': props.paused ? 'paused' : 'running',
}))

function tickProgress() {
  if (!props.auto || props.paused) return
  const step = 100 / (Math.max(1, props.duration) * 20)
  autoProgress.value = Math.min(100, autoProgress.value + step)
  emit('update:progress', autoProgress.value)

  if (autoProgress.value >= 100) {
    // 走满后停一会儿再归零，给水面留一个满格的瞬间
    if (resetTo) clearTimeout(resetTo)
    resetTo = setTimeout(() => {
      autoProgress.value = 0
      emit('update:progress', 0)
    }, 1500)
  }
}

function spawnDrop() {
  if (!props.drops || props.paused) return
  const id = (seed += 1)
  const left = 10 + Math.random() * 80
  const duration = 0.5 + Math.random() * 0.35
  drops.value.push({
    id,
    left,
    target: `${waterTop.value}%`,
    style: {
      left: `${left}%`,
      '--wb-drop-dur': `${duration}s`,
      '--wb-target': `${waterTop.value}%`,
    },
  })
  // 水滴只是装饰，万一 animationend 没触发（标签隐藏等）也要回收
  setTimeout(() => removeDrop(id), (duration + 0.5) * 1000)
}

function removeDrop(id: number) {
  drops.value = drops.value.filter((item) => item.id !== id)
}

function onDropEnd(drop: Drop) {
  removeDrop(drop.id)
  if (!props.drops) return
  // 落点炸一个涟漪
  ripples.value.push({
    id: (seed += 1),
    style: { left: `${drop.left}%`, top: drop.target },
  })
}

function removeRipple(id: number) {
  ripples.value = ripples.value.filter((item) => item.id !== id)
}

function startTimers() {
  if (props.paused) return
  if (!progressTimer && props.auto) progressTimer = setInterval(tickProgress, 50)
  if (!dropTimer && props.drops) dropTimer = setInterval(spawnDrop, 260)
}

function stopTimers() {
  if (progressTimer) {
    clearInterval(progressTimer)
    progressTimer = null
  }
  if (dropTimer) {
    clearInterval(dropTimer)
    dropTimer = null
  }
  if (resetTo) {
    clearTimeout(resetTo)
    resetTo = null
  }
}

watch(
  () => [props.paused, props.auto, props.drops] as const,
  () => {
    stopTimers()
    startTimers()
  },
  { immediate: true },
)

onBeforeUnmount(stopTimers)
</script>

<style scoped>
.wb {
  position: relative;
  width: var(--wb-size);
  height: var(--wb-size);
  overflow: hidden;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  box-shadow:
    0 0 0 calc(var(--wb-size) * 0.05) rgba(255, 255, 255, 0.04),
    0 0 calc(var(--wb-size) * 0.1) color-mix(in srgb, var(--wb-c1) 30%, transparent);
}

/* 两层旋转的「波浪」：本身是 200% 大的圆角方块，靠 top 决定水面 */
.wb__wave {
  position: absolute;
  left: -50%;
  width: 200%;
  height: 200%;
  border-radius: 45%;
  transform-origin: 50% 50%;
  animation: wb-spin calc(var(--wb-speed) * 6s) linear infinite;
  animation-play-state: var(--wb-play);
}

.wb__wave--1 {
  top: var(--wb-top);
  background: color-mix(in srgb, var(--wb-c1) 80%, transparent);
}

.wb__wave--2 {
  top: var(--wb-top2);
  border-radius: 40%;
  background: color-mix(in srgb, var(--wb-c2) 60%, transparent);
  animation-duration: calc(var(--wb-speed) * 8s);
  animation-direction: reverse;
}

.wb__percent {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 2;
  color: #fff;
  font-family: sans-serif;
  font-size: calc(var(--wb-size) * 0.16);
  font-weight: 700;
  text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
  transform: translate(-50%, -50%);
}

/* 水滴：从球外落到当前水面，落点炸涟漪 */
.wb__drop {
  position: absolute;
  top: -14px;
  z-index: 3;
  width: calc(var(--wb-size) * 0.04);
  height: calc(var(--wb-size) * 0.06);
  border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--wb-c2) 90%, transparent),
    color-mix(in srgb, var(--wb-c1) 90%, transparent)
  );
  box-shadow: 0 0 5px rgba(255, 255, 255, 0.3);
  animation: wb-fall var(--wb-drop-dur, 0.6s) cubic-bezier(0.55, 0.06, 0.85, 0.4) forwards;
  animation-play-state: var(--wb-play);
}

.wb__ripple {
  position: absolute;
  z-index: 3;
  width: 0;
  height: 0;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  animation: wb-ripple 0.9s ease-out forwards;
  animation-play-state: var(--wb-play);
}

@keyframes wb-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes wb-fall {
  from {
    top: -14px;
    opacity: 0.9;
  }
  to {
    top: var(--wb-target, 100%);
    opacity: 0.9;
  }
}

@keyframes wb-ripple {
  0% {
    width: 0;
    height: 0;
    opacity: 0.7;
  }
  100% {
    width: calc(var(--wb-size) * 0.16);
    height: calc(var(--wb-size) * 0.08);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .wb__wave,
  .wb__drop,
  .wb__ripple {
    animation: none;
  }
}
</style>

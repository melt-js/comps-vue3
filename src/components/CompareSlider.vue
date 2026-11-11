<template>
  <div class="cmp" :style="rootStyle">
    <div class="cmp__layer cmp__layer--after">
      <img :src="after" alt="对比右侧 After 图片" draggable="false" />
    </div>
    <div class="cmp__layer cmp__layer--before">
      <img :src="before" alt="对比左侧 Before 图片" draggable="false" />
    </div>

    <span v-if="showLabels && beforeLabel" class="cmp__label cmp__label--before">
      {{ beforeLabel }}
    </span>
    <span v-if="showLabels && afterLabel" class="cmp__label cmp__label--after">
      {{ afterLabel }}
    </span>

    <div class="cmp__divider" aria-hidden="true" />
    <div class="cmp__handle" aria-hidden="true">
      <i /><i />
    </div>

    <input
      class="cmp__range"
      type="range"
      min="0"
      max="100"
      step="0.1"
      :value="current"
      aria-label="图片对比滑块"
      @input="onInput"
      @dblclick="reset"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

/*
 * 由 video-code / 交互效果/图片对比.html 提取而来。
 *
 * 原 demo 是一页「Before / After」对比器：两张图叠在一起，上层用 clip-path 按中线裁掉右半边，
 * 中间一条发光的中线 + 圆形把手，拖动 / 键盘方向键都能调；另外还有上传两张图、交换左右、重置、
 * 自动巡航（来回扫）。
 *
 * 组件化后：
 * - 只保留对比卡本体：两张图 + 标签 + 中线 + 把手 + 一个透明的 range 输入（拖动和键盘都靠它，天然无障碍）；
 * - 位置走 v-model:position，自动巡航是 autoSweep 开关 + sweepSpeed；
 * - 上传 / 交换 / 重置这类「编辑器」操作留在 demo 页，组件暴露 swap() / reset() / sweep() 给宿主调用；
 * - 宽高比、圆角、中线颜色、把手大小、标签文字都能调。
 */
const props = defineProps({
  /**
   * @description 对比左侧（Before）图片地址
   */
  before: {
    type: String,
    default: '',
  },
  /**
   * @description 对比右侧（After）图片地址
   */
  after: {
    type: String,
    default: '',
  },
  /**
   * @description 中线位置 0 ~ 100（可用 v-model:position 双向绑定）
   */
  position: {
    type: Number,
    default: 50,
  },
  /**
   * @description 卡片宽高比，默认 16:9（约 1.78）
   */
  ratio: {
    type: Number,
    default: 1.78,
  },
  /**
   * @description 左侧标签文字，传空字符串则不显示
   */
  beforeLabel: {
    type: String,
    default: 'Before',
  },
  /**
   * @description 右侧标签文字
   */
  afterLabel: {
    type: String,
    default: 'After',
  },
  /**
   * @description 是否显示左上 / 右上两个标签
   */
  showLabels: {
    type: Boolean,
    default: true,
  },
  /**
   * @description 圆形把手直径，单位 px
   */
  handleSize: {
    type: Number,
    default: 62,
  },
  /**
   * @description 中线 / 把手的主色
   */
  accent: {
    type: String,
    default: '#f26d3d',
  },
  /**
   * @description 是否开启自动巡航（中线来回扫）
   */
  autoSweep: {
    type: Boolean,
    default: false,
  },
  /**
   * @description 自动巡航速度（每帧移动的百分比）
   */
  sweepSpeed: {
    type: Number,
    default: 0.35,
  },
})

const emit = defineEmits<{
  'update:position': [position: number]
  /** 位置变化（拖完 / 键盘调整后） */
  change: [position: number]
}>()

const current = ref(clamp(props.position))
// 属性面板里如果把 ratio 拖到 0 或负值，卡片会被压成一条线，这里兜一下
const safeRatio = computed(() => (props.ratio > 0.2 ? props.ratio : 1.78))
const rootStyle = computed(() => ({
  '--cmp-split': `${current.value}%`,
  '--cmp-ratio': String(safeRatio.value),
  '--cmp-accent': props.accent,
  '--cmp-handle': `${props.handleSize}px`,
}))

let sweepFrame = 0
let sweepDirection = 1

function clamp(value: number) {
  return Math.min(100, Math.max(0, value))
}

function applyPosition(next: number, notify = true) {
  const value = clamp(next)
  current.value = value
  if (notify) {
    emit('update:position', value)
    emit('change', value)
  }
}

function onInput(event: Event) {
  stopSweep()
  applyPosition(Number((event.target as HTMLInputElement).value))
}

/** 双击回到中线 */
function reset() {
  stopSweep()
  applyPosition(50)
}

function sweepStep() {
  let next = current.value + sweepDirection * props.sweepSpeed
  if (next >= 100 || next <= 0) {
    sweepDirection *= -1
    next = clamp(next)
  }
  applyPosition(next)
  sweepFrame = requestAnimationFrame(sweepStep)
}

function sweep() {
  stopSweep()
  sweepDirection = current.value >= 95 ? -1 : 1
  sweepFrame = requestAnimationFrame(sweepStep)
}

function stopSweep() {
  if (sweepFrame) cancelAnimationFrame(sweepFrame)
  sweepFrame = 0
}

watch(
  () => props.position,
  (next) => {
    if (next !== current.value) current.value = clamp(next)
  },
)

watch(
  () => props.autoSweep,
  (on) => {
    if (on) sweep()
    else stopSweep()
  },
)

onBeforeUnmount(() => {
  stopSweep()
})

defineExpose({
  reset,
  sweep,
  stopSweep,
  setPosition: (value: number) => applyPosition(value),
  position: current,
})
</script>

<style scoped>
.cmp {
  position: relative;
  width: 100%;
  aspect-ratio: var(--cmp-ratio);
  overflow: hidden;
  border: 1px solid rgba(37, 31, 26, 0.18);
  border-radius: 10px;
  background: #d8cec0;
  box-shadow:
    0 28px 70px rgba(83, 52, 27, 0.18),
    inset 0 0 0 1px rgba(255, 255, 255, 0.45);
  user-select: none;
  touch-action: none;
}

/* 四角压暗，让中间的对比更聚焦 */
.cmp::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 4;
  background:
    linear-gradient(90deg, rgba(0, 0, 0, 0.22), transparent 16%, transparent 84%, rgba(0, 0, 0, 0.18)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.22), transparent 18%, transparent 78%, rgba(0, 0, 0, 0.18));
  opacity: 0.48;
  pointer-events: none;
}

.cmp__layer {
  position: absolute;
  inset: 0;
}

.cmp__layer img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: fill;
  pointer-events: none;
}

/* 上层只显示中线左边那部分 */
.cmp__layer--before {
  z-index: 2;
  clip-path: inset(0 calc(100% - var(--cmp-split)) 0 0);
  filter: drop-shadow(10px 0 18px rgba(37, 31, 26, 0.22));
}

.cmp__layer--after {
  z-index: 1;
}

.cmp__label {
  position: absolute;
  top: 16px;
  z-index: 6;
  display: inline-flex;
  gap: 8px;
  align-items: center;
  padding: 8px 12px;
  border: 1px solid rgba(255, 255, 255, 0.34);
  border-radius: 999px;
  background: rgba(37, 31, 26, 0.42);
  color: #fffdf8;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  backdrop-filter: blur(12px);
  pointer-events: none;
}

.cmp__label::before {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.cmp__label--before {
  left: 16px;
}

.cmp__label--after {
  right: 16px;
}

/* 中线：中间亮、两头淡，带一点橙色光晕 */
.cmp__divider {
  position: absolute;
  top: 0;
  bottom: 0;
  left: var(--cmp-split);
  z-index: 7;
  width: 3px;
  transform: translateX(-50%);
  background: linear-gradient(
    180deg,
    transparent,
    #ffe5c2 14%,
    var(--cmp-accent) 48%,
    #ffe5c2 86%,
    transparent
  );
  box-shadow:
    0 0 0 1px rgba(37, 31, 26, 0.18),
    0 0 22px color-mix(in srgb, var(--cmp-accent) 72%, transparent);
  pointer-events: none;
}

.cmp__divider::before,
.cmp__divider::after {
  content: '';
  position: absolute;
  left: 50%;
  width: 24px;
  height: 2px;
  transform: translateX(-50%);
  border-radius: 999px;
  background: rgba(255, 250, 241, 0.82);
}

.cmp__divider::before {
  top: 18px;
}

.cmp__divider::after {
  bottom: 18px;
}

.cmp__handle {
  position: absolute;
  top: 50%;
  left: var(--cmp-split);
  z-index: 8;
  width: var(--cmp-handle);
  height: var(--cmp-handle);
  transform: translate(-50%, -50%);
  border: 2px solid rgba(255, 255, 255, 0.92);
  border-radius: 50%;
  background: linear-gradient(90deg, #2f6f73 0 48%, #d85c3a 52% 100%);
  box-shadow:
    0 0 0 9px rgba(255, 250, 241, 0.26),
    0 16px 32px rgba(37, 31, 26, 0.34);
  pointer-events: none;
}

.cmp__handle i {
  position: absolute;
  top: 50%;
  width: 12px;
  height: 12px;
  border-top: 3px solid #fffaf1;
  border-right: 3px solid #fffaf1;
}

.cmp__handle i:first-child {
  left: 12px;
  transform: translateY(-50%) rotate(-135deg);
}

.cmp__handle i:last-child {
  right: 12px;
  transform: translateY(-50%) rotate(45deg);
}

/* 透明的 range：负责拖动和键盘（不用自己算坐标，无障碍也是现成的） */
.cmp__range {
  position: absolute;
  inset: 0;
  z-index: 9;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: ew-resize;
}

.cmp__range:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--cmp-accent) 32%, transparent);
  outline-offset: -6px;
}

@media (max-width: 640px) {
  .cmp__label {
    top: 10px;
    padding: 7px 10px;
    font-size: 11px;
  }

  .cmp__label--before {
    left: 10px;
  }

  .cmp__label--after {
    right: 10px;
  }
}
</style>

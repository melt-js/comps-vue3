<template>
  <div class="wheel" :style="rootStyle">
    <!-- 主按钮：既是开关也是拖拽把手 -->
    <button
      ref="buttonEl"
      type="button"
      class="wheel__btn"
      :class="{ 'is-open': opened, 'is-dragging': dragging }"
      :style="buttonStyle"
      :aria-expanded="opened"
      aria-haspopup="true"
      :aria-label="opened ? closeText || '收起菜单' : openText || '打开菜单'"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @click="onClick"
      @keydown.esc="close"
    >
      <span class="wheel__label">{{ opened ? closeText : openText }}</span>
    </button>

    <!-- 环形菜单：以按钮中心为圆心排开，展开时按需整体内移避免出屏 -->
    <div class="wheel__ring" :class="{ 'is-open': opened }" :style="ringStyle" :aria-hidden="!opened">
      <button
        v-for="(item, index) in items"
        :key="item.key || item.label || index"
        type="button"
        class="wheel__item"
        :style="itemStyle(index)"
        :tabindex="opened ? 0 : -1"
        @click="pick(item)"
      >
        <span v-if="item.icon" class="wheel__item-icon">{{ item.icon }}</span>
        <span v-if="item.label" class="wheel__item-text">{{ item.label }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

/*
 * 由 video-code / UI组件/炫酷按钮集合/轮盘按钮.html 提取而来。
 *
 * 原 demo 是一颗固定在页面中间的圆按钮：点一下绕圆环弹出 7 个子按钮，主按钮转 360° 并把
 * 「展开」换成「收起」。组件化之后加了两件原本没有的能力：
 *
 * 1. 可拖拽：用 Pointer Events（鼠标 / 触摸 / 触控笔同一套）拖动整颗按钮，位置限制在视口内；
 * 2. 防误触：按下后位移超过 dragThreshold 才判定为拖拽，拖拽结束会吞掉随之而来的 click，
 *    所以「拖动」不会顺手把菜单打开；只有真正点一下（位移小于阈值）才切换菜单。
 *
 * 另外两处细节：
 * - 菜单在屏幕边缘会被「整体内移」（ringOffset），保证 7 个方向都能点到；
 * - 展开后点空白处或按 Esc 收起；位置是视口坐标，窗口缩放时会重新夹回边界内。
 */
type WheelItem = {
  key?: string
  label?: string
  icon?: string
}

type Point = { x: number; y: number }

const props = defineProps({
  /**
   * @description 子菜单项，icon 可以放 emoji，label 是说明文字
   */
  items: {
    type: Array as () => WheelItem[],
    default: () => [
      { key: 'schedule', icon: '📅', label: '日程' },
      { key: 'contact', icon: '📞', label: '联系' },
      { key: 'docs', icon: '📚', label: '文档' },
      { key: 'settings', icon: '⚙️', label: '设置' },
      { key: 'boost', icon: '🚀', label: '加速' },
      { key: 'feedback', icon: '💡', label: '反馈' },
      { key: 'stats', icon: '📊', label: '统计' },
    ],
  },
  /**
   * @description 主按钮直径，单位 px
   */
  size: {
    type: Number,
    default: 80,
  },
  /**
   * @description 子按钮直径，单位 px
   */
  itemSize: {
    type: Number,
    default: 60,
  },
  /**
   * @description 子按钮分布半径，单位 px
   */
  radius: {
    type: Number,
    default: 120,
  },
  /**
   * @description 主按钮渐变的起始色
   */
  color: {
    type: String,
    default: '#1a237e',
  },
  /**
   * @description 主按钮渐变的结束色
   */
  color2: {
    type: String,
    default: '#3949ab',
  },
  /**
   * @description 子按钮底色
   */
  itemColor: {
    type: String,
    default: '#424242',
  },
  /**
   * @description 子按钮 hover 时的强调色
   */
  accent: {
    type: String,
    default: '#ffb300',
  },
  /**
   * @description 收起状态下主按钮的文字
   */
  openText: {
    type: String,
    default: '展开',
  },
  /**
   * @description 展开状态下主按钮的文字
   */
  closeText: {
    type: String,
    default: '收起',
  },
  /**
   * @description 菜单是否展开（可用 v-model:open 双向绑定）
   */
  open: {
    type: Boolean,
    default: false,
  },
  /**
   * @description 是否允许拖拽主按钮
   */
  draggable: {
    type: Boolean,
    default: true,
  },
  /**
   * @description 判定为拖拽的最小位移，小于它才当成点击，单位 px
   */
  dragThreshold: {
    type: Number,
    default: 4,
  },
  /**
   * @description 距视口边缘的最小留白，单位 px
   */
  edgeMargin: {
    type: Number,
    default: 16,
  },
  /**
   * @description 初始位置（视口坐标，按钮中心）；传 -1 表示自动放到右下角
   */
  initialX: {
    type: Number,
    default: -1,
  },
  /**
   * @description 初始位置的 Y 坐标；传 -1 表示自动放到右下角
   */
  initialY: {
    type: Number,
    default: -1,
  },
  /**
   * @description 展开动画时长，单位毫秒
   */
  duration: {
    type: Number,
    default: 500,
  },
  /**
   * @description 层级，浮在其他内容之上
   */
  zIndex: {
    type: Number,
    default: 1000,
  },
})

const emit = defineEmits<{
  'update:open': [open: boolean]
  /** 点了某个子项 */
  select: [item: WheelItem]
  /** 拖拽结束，带回新的中心坐标 */
  'drag-end': [position: Point]
}>()

const buttonEl = ref<HTMLButtonElement | null>(null)
const opened = ref(props.open)
const dragging = ref(false)
// 视口尺寸和位置在 setup 阶段就先算一次，避免首帧闪在左上角
const viewport = ref(
  typeof window === 'undefined'
    ? { w: 1024, h: 768 }
    : { w: window.innerWidth, h: window.innerHeight },
)
const position = ref<Point>((() => {
  const half = props.size / 2
  const margin = props.edgeMargin
  return {
    x: Math.max(half + margin, viewport.value.w - margin - half),
    y: Math.max(half + margin, viewport.value.h - margin - half),
  }
})())

let suppressClick = false
let suppressTimer: ReturnType<typeof setTimeout> | null = null
let drag: { id: number; startX: number; startY: number; origin: Point; moved: boolean } | null = null

function viewportSize() {
  if (typeof window === 'undefined') return { w: 1024, h: 768 }
  return { w: window.innerWidth, h: window.innerHeight }
}

/** 夹取用到的视口：拿到 0 或非法值时回退，避免按钮被夹到左上角 */
function safeViewport() {
  const fresh = viewportSize()
  const w = viewport.value.w > 0 ? viewport.value.w : fresh.w
  const h = viewport.value.h > 0 ? viewport.value.h : fresh.h
  return { w: w > 0 ? w : 1024, h: h > 0 ? h : 768 }
}

/** 把按钮中心夹在视口内：除了按钮自身，还要给展开的圆环留出位置，保证菜单不会被屏幕边缘裁掉 */
function clampToViewport(point: Point): Point {
  const { w, h } = safeViewport()
  const half = props.size / 2
  const itemHalf = props.itemSize / 2
  // 视口很小时退回「至少放得下按钮」，避免 min > max 把位置算成 NaN
  const reachX = Math.min(props.radius + itemHalf, Math.max(half, w / 2 - props.edgeMargin))
  const reachY = Math.min(props.radius + itemHalf, Math.max(half, h / 2 - props.edgeMargin))
  const minX = reachX + props.edgeMargin
  const minY = reachY + props.edgeMargin
  const maxX = Math.max(minX, w - reachX - props.edgeMargin)
  const maxY = Math.max(minY, h - reachY - props.edgeMargin)
  return {
    x: Math.min(maxX, Math.max(minX, point.x)),
    y: Math.min(maxY, Math.max(minY, point.y)),
  }
}

/** 菜单展开时如果会出屏，就把整个圆环往内挪，主按钮本身不动 */
const ringOffset = computed(() => {
  const reach = props.radius + props.itemSize / 2 + props.edgeMargin
  const { w, h } = safeViewport()
  const { x, y } = position.value
  let dx = 0
  let dy = 0
  if (x - reach < 0) dx = reach - x
  else if (x + reach > w) dx = w - reach - x
  if (y - reach < 0) dy = reach - y
  else if (y + reach > h) dy = h - reach - y
  return { dx, dy }
})

const rootStyle = computed(() => ({
  '--wheel-size': `${props.size}px`,
  '--wheel-item-size': `${props.itemSize}px`,
  '--wheel-radius': `${props.radius}px`,
  '--wheel-duration': `${props.duration}ms`,
  '--wheel-c1': props.color,
  '--wheel-c2': props.color2,
  '--wheel-item': props.itemColor,
  '--wheel-accent': props.accent,
  zIndex: String(props.zIndex),
}))

const buttonStyle = computed(() => ({
  left: `${position.value.x}px`,
  top: `${position.value.y}px`,
  cursor: props.draggable ? (dragging.value ? 'grabbing' : 'grab') : 'pointer',
}))

const ringStyle = computed(() => ({
  left: `${position.value.x + ringOffset.value.dx}px`,
  top: `${position.value.y + ringOffset.value.dy}px`,
}))

/** 子按钮按等角分布在圆周上，角度从正右方开始 */
function itemStyle(index: number) {
  const count = Math.max(1, props.items.length)
  const angle = ((Math.PI * 2) / count) * index
  const dx = Math.cos(angle) * props.radius
  const dy = Math.sin(angle) * props.radius
  return {
    left: `${dx}px`,
    top: `${dy}px`,
    transitionDelay: opened.value ? `${index * 30}ms` : '0ms',
  }
}

function setOpen(next: boolean) {
  if (opened.value === next) return
  opened.value = next
  emit('update:open', next)
}

function toggle() {
  setOpen(!opened.value)
}

function close() {
  setOpen(false)
}

function pick(item: WheelItem) {
  emit('select', item)
  close()
}

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0 && event.pointerType === 'mouse') return

  // 拖拽起点：记录指针与当前位置，先不判定是拖动还是点击
  if (props.draggable) {
    drag = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: { ...position.value },
      moved: false,
    }
    try {
      buttonEl.value?.setPointerCapture?.(event.pointerId)
    } catch {
      // 合成事件或指针已释放时会抛 NotFoundError，忽略即可（没有 capture 也能用）
    }
  }
}

function onPointerMove(event: PointerEvent) {
  if (!drag || drag.id !== event.pointerId) return

  const dx = event.clientX - drag.startX
  const dy = event.clientY - drag.startY

  // 超过阈值才算拖拽：这样轻微抖动仍然是一次点击
  if (!drag.moved && Math.hypot(dx, dy) >= props.dragThreshold) {
    drag.moved = true
    dragging.value = true
  }
  if (!drag.moved) return

  position.value = clampToViewport({
    x: drag.origin.x + dx,
    y: drag.origin.y + dy,
  })
}

function onPointerUp(event: PointerEvent) {
  if (!drag || drag.id !== event.pointerId) return

  const wasDragging = drag.moved
  drag = null
  dragging.value = false
  try {
    buttonEl.value?.releasePointerCapture?.(event.pointerId)
  } catch {
    // 同上：指针已经不在捕获里时忽略
  }

  if (wasDragging) {
    // 拖完会紧跟一个 click，这里先标记吞掉；触摸端可能没有 click，超时后自动复位
    suppressClick = true
    if (suppressTimer) clearTimeout(suppressTimer)
    suppressTimer = setTimeout(() => {
      suppressClick = false
    }, 350)
    emit('drag-end', { ...position.value })
  }
}

function onClick() {
  if (suppressClick) {
    suppressClick = false
    if (suppressTimer) clearTimeout(suppressTimer)
    return
  }
  toggle()
}

/** 展开时点空白处收起 */
function onDocumentPointerDown(event: PointerEvent) {
  if (!opened.value) return
  const target = event.target as Node | null
  if (!target) return
  if (buttonEl.value?.contains(target)) return
  if ((target as HTMLElement).closest?.('.wheel__ring.is-open')) return
  close()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') close()
}

function onResize() {
  viewport.value = viewportSize()
  position.value = clampToViewport(position.value)
}

watch(
  () => props.open,
  (next) => {
    if (next !== opened.value) opened.value = next
  },
)

onMounted(() => {
  viewport.value = viewportSize()
  const { w, h } = viewport.value
  position.value = clampToViewport({
    x: props.initialX >= 0 ? props.initialX : w - props.edgeMargin - props.size / 2,
    y: props.initialY >= 0 ? props.initialY : h - props.edgeMargin - props.size / 2,
  })

  document.addEventListener('pointerdown', onDocumentPointerDown, true)
  document.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown, true)
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', onResize)
  if (suppressTimer) clearTimeout(suppressTimer)
})

/** 供宿主主动移动 / 重置位置 */
function moveTo(x: number, y: number) {
  position.value = clampToViewport({ x, y })
  emit('drag-end', { ...position.value })
}

defineExpose({ moveTo, close, open: () => setOpen(true), toggle, position })
</script>

<style scoped>
/* 满屏的定位层只负责坐标系，本身不吃事件 */
.wheel {
  position: fixed;
  inset: 0;
  pointer-events: none;
}

.wheel__btn {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--wheel-size);
  height: var(--wheel-size);
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  background: linear-gradient(135deg, var(--wheel-c1), var(--wheel-c2));
  color: #fff;
  font-family: inherit;
  font-size: calc(var(--wheel-size) * 0.2);
  pointer-events: auto;
  /* 拖拽时不要触发页面滚动 / 文本选择 */
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  transform: translate(-50%, -50%);
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.15),
    0 8px 24px rgba(0, 0, 0, 0.1);
  transition:
    transform var(--wheel-duration) cubic-bezier(0.175, 0.885, 0.32, 1.275),
    box-shadow 0.3s ease,
    background 0.3s ease;
}

.wheel__btn:hover {
  box-shadow:
    0 6px 18px rgba(0, 0, 0, 0.18),
    0 12px 32px rgba(0, 0, 0, 0.12);
}

/* 展开时主按钮自转一圈，和原 demo 一致 */
.wheel__btn.is-open {
  transform: translate(-50%, -50%) rotate(360deg);
  background: linear-gradient(135deg, var(--wheel-c2), var(--wheel-c1));
}

.wheel__btn.is-dragging {
  transform: translate(-50%, -50%) scale(1.06);
  box-shadow:
    0 10px 26px rgba(0, 0, 0, 0.24),
    0 16px 42px rgba(0, 0, 0, 0.16);
}

.wheel__label {
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  transition: opacity 0.25s ease;
}

/* 圆环：一个 0×0 的定位点，子按钮相对它排布 */
.wheel__ring {
  position: absolute;
  width: 0;
  height: 0;
  pointer-events: none;
}

.wheel__item {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: var(--wheel-item-size);
  height: var(--wheel-item-size);
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 50%;
  background: linear-gradient(135deg, color-mix(in srgb, var(--wheel-item) 80%, #fff), var(--wheel-item));
  color: #fff;
  font-family: inherit;
  font-size: calc(var(--wheel-item-size) * 0.2);
  cursor: pointer;
  pointer-events: none;
  opacity: 0;
  transform: translate(-50%, -50%) scale(0);
  transition:
    transform var(--wheel-duration) cubic-bezier(0.34, 1.56, 0.64, 1),
    opacity calc(var(--wheel-duration) * 0.6) ease,
    background 0.2s ease,
    box-shadow 0.2s ease;
  box-shadow:
    0 3px 8px rgba(0, 0, 0, 0.15),
    0 6px 16px rgba(0, 0, 0, 0.1);
}

.wheel__ring.is-open .wheel__item {
  opacity: 1;
  pointer-events: auto;
  transform: translate(-50%, -50%) scale(1);
}

.wheel__item:hover,
.wheel__item:focus-visible {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--wheel-accent) 85%, #fff),
    var(--wheel-accent)
  );
  outline: none;
  box-shadow:
    0 5px 15px color-mix(in srgb, var(--wheel-accent) 25%, transparent),
    0 10px 25px color-mix(in srgb, var(--wheel-accent) 18%, transparent);
}

.wheel__item-icon {
  line-height: 1;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.wheel__item-text {
  line-height: 1;
  opacity: 0.9;
}

@media (prefers-reduced-motion: reduce) {
  .wheel__btn,
  .wheel__item {
    transition-duration: 0.01ms;
  }
}
</style>

<template>
  <div ref="rootEl" class="sp" :style="rootStyle">
    <!-- 左：渲染出来的界面 -->
    <div class="sp__preview">
      <div class="sp__glow" aria-hidden="true" />
      <div ref="mountEl" class="sp__mount" />
      <div class="sp__scan" :style="{ opacity: String(0.18 + glitch * 0.35) }" aria-hidden="true" />
    </div>

    <!-- 右：代码。半透明底 + 和左侧的重叠区，形成「界面慢慢变成代码」的过渡 -->
    <div class="sp__editor">
      <textarea
        v-if="editable"
        v-model="draft"
        class="sp__textarea"
        spellcheck="false"
        aria-label="预览面板代码"
        @input="onInput"
      />
      <pre v-else class="sp__code"><code>{{ code }}</code></pre>
    </div>

    <!-- 分割线：可拖动 / 可用方向键微调 -->
    <div
      class="sp__divider"
      role="slider"
      tabindex="0"
      aria-label="拖动分割线切换界面与代码"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="Math.round(currentSplit)"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @keydown="onKeydown"
    >
      <span class="sp__handle" aria-hidden="true">
        <i /><i />
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

/*
 * 由 video-code / 交互效果/分割线切换界面和代码/index.html 提取而来。
 *
 * 原 demo 是一个「融合面板」：左边把一段 HTML/CSS 用 Shadow DOM 实时渲染成界面，右边是同一段代码的
 * 编辑器，中间一条会发光的竖线可以左右拖；拖动时界面被裁掉一半、代码从右边浮上来，
 * 交界处还有一点扫描线 / 色差的味道（原 demo 里的 glitch 参数）。
 *
 * 组件化后：
 * - 代码由 code 传入、编辑后通过 update:code 抛回，渲染进 Shadow DOM（宿主样式不会串进去）；
 * - split 可用 v-model:split 双向绑定，分割线支持拖拽 + 方向键（Home / End 直接贴边）；
 * - 只渲染 HTML / CSS，`<script>` 不会执行（innerHTML 本来也不执行，这里明确说明免得踩坑）；
 * - 扫描线强度、圆角、主色都可调，editable 关掉就退化成「只读代码对照」。
 */
const props = defineProps({
  /**
   * @description 预览用的 HTML/CSS 代码（会渲染进 Shadow DOM，脚本不执行）
   */
  code: {
    type: String,
    default: `<style>
.card {
  width: 240px;
  padding: 26px;
  border-radius: 18px;
  color: #eaf6ff;
  font-family: system-ui, sans-serif;
  background: linear-gradient(150deg, #0a2a4a, #061726);
  box-shadow: 0 20px 40px rgba(4, 16, 30, .45);
  border: 1px solid rgba(120, 200, 255, .25);
  text-align: center;
}
.dot {
  width: 46px; height: 46px; margin: 0 auto 14px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #7fe8ff, #0f7bb3 70%);
  box-shadow: 0 0 24px rgba(0, 180, 255, .55);
}
h3 { margin: 0 0 6px; font-size: 16px; }
p { margin: 0; font-size: 12px; color: rgba(200, 230, 255, .6); }
</style>
<div class="card">
  <div class="dot"></div>
  <h3>可编辑的界面</h3>
  <p>拖动分割线看它的代码</p>
</div>`,
  },
  /**
   * @description 分割线位置 0~100，可用 v-model:split 双向绑定
   */
  split: {
    type: Number,
    default: 57,
  },
  /**
   * @description 是否允许编辑右侧代码
   */
  editable: {
    type: Boolean,
    default: true,
  },
  /**
   * @description 交界处扫描线 / 色差的强度 0~1
   */
  glitch: {
    type: Number,
    default: 0.45,
  },
  /**
   * @description 面板圆角，单位 px
   */
  radius: {
    type: Number,
    default: 20,
  },
  /**
   * @description 主色（分割线光晕 / 焦点圈）
   */
  accent: {
    type: String,
    default: '#00b3ff',
  },
  /**
   * @description 分割线能拖到的最小百分比
   */
  minSplit: {
    type: Number,
    default: 8,
  },
  /**
   * @description 分割线能拖到的最大百分比
   */
  maxSplit: {
    type: Number,
    default: 92,
  },
})

const emit = defineEmits<{
  'update:split': [split: number]
  'update:code': [code: string]
  /** 代码改动并重新渲染后触发 */
  change: [code: string]
}>()

const rootEl = ref<HTMLElement | null>(null)
const mountEl = ref<HTMLElement | null>(null)
const draft = ref(props.code)
const currentSplit = ref(clamp(props.split))

let shadow: ShadowRoot | null = null
let renderTimer: ReturnType<typeof setTimeout> | null = null
let drag: { id: number; startX: number; startSplit: number } | null = null

const rootStyle = computed(() => ({
  '--sp-split': `${currentSplit.value}%`,
  '--sp-radius': `${props.radius}px`,
  '--sp-accent': props.accent,
  '--sp-glitch': String(Math.min(1, Math.max(0, props.glitch))),
}))

function clamp(value: number) {
  return Math.min(props.maxSplit, Math.max(props.minSplit, value))
}

function render() {
  if (!shadow) return
  // Shadow DOM + innerHTML：样式不会泄漏到宿主，`<script>` 也不会执行
  shadow.innerHTML = draft.value
}

function scheduleRender() {
  if (renderTimer) clearTimeout(renderTimer)
  renderTimer = setTimeout(() => {
    render()
    emit('change', draft.value)
  }, 180)
}

function onInput() {
  emit('update:code', draft.value)
  scheduleRender()
}

function setSplit(next: number, notify = true) {
  const clamped = clamp(next)
  if (clamped === currentSplit.value) return
  currentSplit.value = clamped
  if (notify) emit('update:split', clamped)
}

function updateFromPointer(clientX: number) {
  const rect = rootEl.value?.getBoundingClientRect()
  if (!rect || !rect.width) return
  setSplit(((clientX - rect.left) / rect.width) * 100)
}

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0 && event.pointerType === 'mouse') return
  drag = { id: event.pointerId, startX: event.clientX, startSplit: currentSplit.value }
  try {
    ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
  } catch {
    // 合成事件下会抛 NotFoundError，忽略
  }
  updateFromPointer(event.clientX)
}

function onPointerMove(event: PointerEvent) {
  if (!drag || drag.id !== event.pointerId) return
  updateFromPointer(event.clientX)
}

function onPointerUp(event: PointerEvent) {
  if (!drag || drag.id !== event.pointerId) return
  drag = null
  try {
    ;(event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId)
  } catch {
    // 忽略：指针已经释放
  }
}

function onKeydown(event: KeyboardEvent) {
  const step = event.shiftKey ? 10 : 2
  if (event.key === 'ArrowLeft') {
    setSplit(currentSplit.value - step)
  } else if (event.key === 'ArrowRight') {
    setSplit(currentSplit.value + step)
  } else if (event.key === 'Home') {
    setSplit(props.minSplit)
  } else if (event.key === 'End') {
    setSplit(props.maxSplit)
  } else {
    return
  }
  event.preventDefault()
}

watch(
  () => props.split,
  (next) => {
    if (!drag) currentSplit.value = clamp(next)
  },
)

watch(
  () => props.code,
  (next) => {
    if (next === draft.value) return
    draft.value = next
    scheduleRender()
  },
)

watch(
  () => [props.minSplit, props.maxSplit] as const,
  () => setSplit(currentSplit.value, false),
)

onMounted(() => {
  if (mountEl.value) {
    shadow = mountEl.value.attachShadow({ mode: 'open' })
    render()
  }
})

onBeforeUnmount(() => {
  if (renderTimer) clearTimeout(renderTimer)
  shadow = null
})

defineExpose({
  render,
  setSplit,
})
</script>

<style scoped>
.sp {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 240px;
  overflow: hidden;
  border: 1px solid rgba(117, 158, 196, 0.4);
  border-radius: var(--sp-radius);
  background: #fff;
  isolation: isolate;
}

/* ── 左：界面 ── */
.sp__preview {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: grid;
  place-items: center;
  padding: 28px;
  clip-path: polygon(0 0, var(--sp-split) 0, var(--sp-split) 100%, 0 100%);
  background:
    radial-gradient(circle at 22% 18%, color-mix(in srgb, var(--sp-accent) 22%, transparent), transparent 42%),
    radial-gradient(circle at 65% 70%, rgba(255, 130, 82, 0.16), transparent 40%),
    linear-gradient(145deg, #eaf4ff 0%, #f4f9ff 52%, #edf8f4 100%);
}

.sp__glow {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.45) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.45) 1px, transparent 1px);
  background-size: 30px 30px;
  opacity: 0.5;
  pointer-events: none;
}

.sp__mount {
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  max-width: 100%;
  max-height: 100%;
  overflow: auto;
}

/* 交界处的扫描线，强度跟 glitch 走 */
.sp__scan {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    to bottom,
    rgba(17, 44, 72, 0.06) 0,
    rgba(17, 44, 72, 0.06) 1px,
    transparent 1px,
    transparent 5px
  );
  mix-blend-mode: multiply;
  pointer-events: none;
}

/* ── 右：代码 ── */
.sp__editor {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: var(--sp-split);
  z-index: 2;
  padding: 18px 20px;
  /* 用 left 让出左侧区域，而不是 clip-path：Chrome 下对 textarea 这类
     自成合成层的表单控件做 clip-path 裁剪，里面的文字会整个不画出来 */
  background: color-mix(in srgb, #061726 calc(84% + var(--sp-glitch) * 8%), transparent);
  color: #bfe3ff;
}

.sp__textarea,
.sp__code {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  font-family: 'JetBrains Mono', 'Courier New', Consolas, monospace;
  font-size: 12px;
  line-height: 1.7;
  white-space: pre;
  overflow: auto;
  outline: none;
  tab-size: 2;
}

.sp__textarea {
  resize: none;
  caret-color: var(--sp-accent);
}

.sp__textarea::selection {
  background: color-mix(in srgb, var(--sp-accent) 45%, transparent);
}

.sp__code code {
  font: inherit;
}

/* ── 分割线 ── */
.sp__divider {
  position: absolute;
  top: 0;
  bottom: 0;
  left: var(--sp-split);
  z-index: 3;
  width: 2px;
  margin-left: -1px;
  background: linear-gradient(
    to bottom,
    transparent,
    color-mix(in srgb, var(--sp-accent) 70%, transparent) 18%,
    color-mix(in srgb, var(--sp-accent) 70%, transparent) 82%,
    transparent
  );
  box-shadow: 0 0 18px color-mix(in srgb, var(--sp-accent) calc(var(--sp-glitch) * 60%), transparent);
  cursor: col-resize;
  touch-action: none;
  outline: none;
}

/* 交界处的一点色差，强度跟 glitch 走 */
.sp__divider::before,
.sp__divider::after {
  content: '';
  position: absolute;
  top: 12%;
  bottom: 12%;
  width: 2px;
  opacity: calc(var(--sp-glitch) * 0.75);
}

.sp__divider::before {
  left: -3px;
  background: rgba(0, 179, 255, 0.5);
}

.sp__divider::after {
  left: 3px;
  background: rgba(255, 110, 66, 0.45);
}

.sp__divider:focus-visible .sp__handle {
  box-shadow:
    0 0 0 3px color-mix(in srgb, var(--sp-accent) 35%, transparent),
    0 6px 18px rgba(6, 23, 38, 0.35);
}

.sp__handle {
  position: absolute;
  top: 50%;
  left: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 6px 18px rgba(6, 23, 38, 0.28);
  transform: translate(-50%, -50%);
  transition: box-shadow 0.2s ease;
}

.sp__handle i {
  width: 2px;
  height: 10px;
  border-radius: 1px;
  background: color-mix(in srgb, var(--sp-accent) 70%, #061726);
}

@media (max-width: 520px) {
  .sp__editor {
    padding: 12px;
  }

  .sp__textarea {
    font-size: 11px;
  }
}
</style>

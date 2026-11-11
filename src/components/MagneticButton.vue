<template>
  <button
    ref="rootEl"
    type="button"
    class="mb"
    :class="{ 'is-tracking': tracking }"
    :style="rootStyle"
    @mousemove="onMove"
    @mouseleave="onLeave"
    @click="emit('click', $event)"
  >
    <span class="mb__label"><slot>{{ label }}</slot></span>
    <span v-if="cursorDot" class="mb__dot" :style="dotStyle" aria-hidden="true" />
  </button>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

/*
 * 由 video-code / UI组件/炫酷按钮集合/磁吸按钮.html 提取而来。
 *
 * 原 demo 把按钮写死在页面中心，磁吸强度和配色都写在 CSS / JS 常量里；
 * 这里把三件事拆成 props：文案（label）、磁吸强度（strength）、主色（color），
 * 光点也改成按需开关（cursorDot）。四个角上的方向偏移沿用原实现的 0.42 系数，
 * 手感一致：指针在按钮内的偏移按比例放大成位移，离开时用更长的缓动回弹。
 *
 * 组件自身不设固定尺寸和外边距，写法和普通按钮一致，宿主用 class / style 调整。
 */
const props = defineProps({
  /**
   * @description 按钮文案，留空时显示默认插槽内容
   */
  label: {
    type: String,
    default: '',
  },
  /**
   * @description 磁吸强度：指针偏移量放大成按钮位移的比例，0 表示关闭磁吸
   */
  strength: {
    type: Number,
    default: 0.42,
  },
  /**
   * @description 主色，用于文字、描边和跟随光点
   */
  color: {
    type: String,
    default: '#4ade80',
  },
  /**
   * @description 是否显示跟随指针的光点
   */
  cursorDot: {
    type: Boolean,
    default: true,
  },
})

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

const rootEl = ref<HTMLButtonElement | null>(null)
const tracking = ref(false)
const offset = ref({ x: 0, y: 0 })
const dot = ref({ x: 0, y: 0 })

/** 位移和光点都写成内联样式，随指针实时更新；颜色只走 CSS 变量 */
const rootStyle = computed(() => ({
  '--mb-color': props.color,
  transform: `translate3d(${offset.value.x}px, ${offset.value.y}px, 0)`,
}))

const dotStyle = computed(() => ({
  left: `${dot.value.x}px`,
  top: `${dot.value.y}px`,
}))

function onMove(event: MouseEvent) {
  const root = rootEl.value
  if (!root) return
  const rect = root.getBoundingClientRect()
  const dx = event.clientX - rect.left - rect.width / 2
  const dy = event.clientY - rect.top - rect.height / 2

  tracking.value = true
  dot.value = { x: event.clientX - rect.left, y: event.clientY - rect.top }
  if (props.strength > 0) {
    offset.value = { x: dx * props.strength, y: dy * props.strength }
  }
}

function onLeave() {
  tracking.value = false
  offset.value = { x: 0, y: 0 }
}
</script>

<style scoped>
.mb {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 18px 48px;
  border: 1px solid var(--mb-color);
  border-radius: 2px;
  background: transparent;
  color: var(--mb-color);
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.28em;
  line-height: 1;
  text-transform: uppercase;
  cursor: pointer;
  outline: none;
  will-change: transform;
  /* 离开时慢速回弹，指针移入后由 .is-tracking 换成快速跟手 */
  transition:
    transform 0.65s cubic-bezier(0.23, 1, 0.32, 1),
    box-shadow 0.35s ease;
}

.mb.is-tracking {
  transition:
    transform 0.1s cubic-bezier(0.23, 1, 0.32, 1),
    box-shadow 0.35s ease;
}

/* 指针进入后浮现一圈虚线外框，放大磁吸的范围感 */
.mb::before {
  content: '';
  position: absolute;
  inset: -6px;
  border: 1px dashed color-mix(in srgb, var(--mb-color) 15%, transparent);
  border-radius: 3px;
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.mb:hover::before,
.mb:focus-visible::before {
  opacity: 1;
}

.mb:hover,
.mb:focus-visible {
  box-shadow:
    0 0 30px color-mix(in srgb, var(--mb-color) 22%, transparent),
    0 10px 40px color-mix(in srgb, var(--mb-color) 10%, transparent);
}

.mb:active {
  box-shadow:
    0 0 18px color-mix(in srgb, var(--mb-color) 30%, transparent),
    0 4px 16px color-mix(in srgb, var(--mb-color) 12%, transparent);
}

.mb__label {
  position: relative;
  display: inline-block;
}

/* 跟随指针的光点：绝对定位在按钮坐标系里，避免像原 demo 那样 fixed 到视口 */
.mb__dot {
  position: absolute;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--mb-color);
  box-shadow: 0 0 12px var(--mb-color);
  opacity: 0;
  transform: translate(-50%, -50%);
  transition: opacity 0.25s ease;
  pointer-events: none;
}

.mb.is-tracking .mb__dot {
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .mb,
  .mb.is-tracking {
    transition: box-shadow 0.35s ease;
  }

  .mb__dot {
    display: none;
  }
}
</style>

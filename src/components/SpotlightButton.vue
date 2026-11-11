<template>
  <button
    ref="rootEl"
    type="button"
    class="sb"
    :style="rootStyle"
    @mousemove="onMove"
    @mouseleave="onLeave"
    @click="emit('click', $event)"
  >
    <span class="sb__label"><slot>{{ label }}</slot></span>
  </button>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

/*
 * 由 video-code / UI组件/炫酷按钮集合/聚光灯按钮.html 提取而来。
 *
 * 原 demo 用两层光：按钮内部跟随指针的聚光（background 里一段 radial-gradient）
 * 和整页 600px 的环境光。后者属于页面而不是按钮，组件化后不再带 —— 需要环境光
 * 时在宿主里自己加一个 fixed 光斑即可。这里保留「指针进到按钮后，光斑跟着走」
 * 这个核心手感，光斑半径（radius）和主色（color）改成 props。
 *
 * 光斑用内联 background 而不是伪元素，鼠标离开后落回透明，和原实现一致。
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
   * @description 主色，用于文字、描边和聚光光斑
   */
  color: {
    type: String,
    default: '#a3e635',
  },
  /**
   * @description 聚光半径，单位 px，越大光斑铺得越开
   */
  radius: {
    type: Number,
    default: 140,
  },
})

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

const rootEl = ref<HTMLButtonElement | null>(null)
const light = ref({ x: 0, y: 0, active: false })

const rootStyle = computed(() => {
  const style: Record<string, string> = { '--sb-color': props.color }
  if (!light.value.active) return style

  const { x, y } = light.value
  const { radius } = props
  style.backgroundImage = [
    `radial-gradient(circle ${radius}px at ${x}px ${y}px,`,
    `color-mix(in srgb, ${props.color} 30%, transparent) 0%,`,
    `color-mix(in srgb, ${props.color} 12%, transparent) 40%,`,
    'transparent 72%)',
  ].join(' ')
  return style
})

function onMove(event: MouseEvent) {
  const root = rootEl.value
  if (!root) return
  const rect = root.getBoundingClientRect()
  light.value = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
    active: true,
  }
}

function onLeave() {
  light.value = { ...light.value, active: false }
}
</script>

<style scoped>
.sb {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 18px 48px;
  border: 1px solid color-mix(in srgb, var(--sb-color) 55%, transparent);
  border-radius: 2px;
  background-color: transparent;
  background-repeat: no-repeat;
  color: var(--sb-color);
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.28em;
  line-height: 1;
  text-transform: uppercase;
  cursor: pointer;
  outline: none;
  transition:
    border-color 0.3s ease,
    color 0.3s ease,
    box-shadow 0.3s ease;
}

.sb:hover,
.sb:focus-visible {
  border-color: color-mix(in srgb, var(--sb-color) 80%, #fff);
  color: color-mix(in srgb, var(--sb-color) 70%, #fff);
}

/* 内发光：和光斑叠加，让被照亮的一侧更亮 */
.sb::after {
  content: '';
  position: absolute;
  inset: 0;
  border: 1px solid transparent;
  transition: box-shadow 0.3s ease;
  pointer-events: none;
}

.sb:hover::after,
.sb:focus-visible::after {
  box-shadow: inset 0 0 40px color-mix(in srgb, var(--sb-color) 8%, transparent);
}

.sb__label {
  position: relative;
  z-index: 1;
}
</style>

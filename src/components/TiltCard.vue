<template>
  <div
    class="tc"
    :style="rootStyle"
    @mousemove="onMove"
    @mouseleave="onLeave"
    @blur="onLeave"
  >
    <div class="tc__inner" :style="innerStyle">
      <img v-if="src" class="tc__img" :src="src" :alt="alt" draggable="false" />
      <slot />
      <span v-if="glare" class="tc__glare" :style="glareStyle" aria-hidden="true" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

/*
 * 由 video-code / 图片和SVG/图片特效/图片跟随鼠标倾斜.html 提取而来。
 *
 * 原 demo 只支持一张写死的图片，最大倾斜角 8deg 是脚本里的常量，没有反光也没有回弹。
 * 组件化后：
 * - src 给了就渲染 img，不给就用默认插槽（所以卡片里放视频、文字都可以）；
 * - maxTilt / scale / radius / shadow 可调，倾斜角按指针在卡片内的相对位置线性插值；
 * - glare 打开后叠加一层跟随指针的高光，模拟卡片表面的反光。
 *
 * 透视放在外层的 perspective 上，旋转只作用在内层，避免和外层的圆角、阴影打架。
 */
const props = defineProps({
  /**
   * @description 图片地址，留空时用默认插槽内容
   */
  src: {
    type: String,
    default: '',
  },
  /**
   * @description 图片的 alt 文本
   */
  alt: {
    type: String,
    default: '',
  },
  /**
   * @description 最大倾斜角度（deg），0 表示不倾斜
   */
  maxTilt: {
    type: Number,
    default: 8,
  },
  /**
   * @description 指针进入后的放大倍数，1 表示不放大
   */
  scale: {
    type: Number,
    default: 1,
  },
  /**
   * @description 圆角，单位 px
   */
  radius: {
    type: Number,
    default: 16,
  },
  /**
   * @description 是否显示跟随指针的高光反光
   */
  glare: {
    type: Boolean,
    default: false,
  },
  /**
   * @description 是否显示静态投影
   */
  shadow: {
    type: Boolean,
    default: true,
  },
})

const hovering = ref(false)
const tilt = ref({ x: 0, y: 0 })
const pointer = ref({ x: 50, y: 50 })

const rootStyle = computed(() => ({
  '--tc-radius': `${props.radius}px`,
  '--tc-shadow': props.shadow ? '0 10px 50px rgba(0, 0, 0, 0.18)' : 'none',
}))

const innerStyle = computed(() => {
  const rotateX = -tilt.value.y
  const rotateY = tilt.value.x
  const activeScale = hovering.value ? props.scale : 1
  return {
    transform: `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(
      2,
    )}deg) scale(${activeScale})`,
    transition: hovering.value
      ? 'transform 0.15s ease-out'
      : 'transform 0.45s cubic-bezier(0.23, 1, 0.32, 1)',
  }
})

const glareStyle = computed(() => ({
  background: `radial-gradient(circle at ${pointer.value.x}% ${pointer.value.y}%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.12) 28%, transparent 62%)`,
  opacity: hovering.value ? 1 : 0,
}))

function onMove(event: MouseEvent) {
  const el = event.currentTarget as HTMLElement
  const rect = el.getBoundingClientRect()
  if (!rect.width || !rect.height) return

  // 指针在卡片内的归一化位置（0~1），中心为 0.5
  const xPos = (event.clientX - rect.left) / rect.width
  const yPos = (event.clientY - rect.top) / rect.height

  hovering.value = true
  pointer.value = { x: xPos * 100, y: yPos * 100 }
  tilt.value = {
    x: (xPos - 0.5) * props.maxTilt,
    y: (yPos - 0.5) * props.maxTilt,
  }
}

function onLeave() {
  hovering.value = false
  tilt.value = { x: 0, y: 0 }
}
</script>

<style scoped>
.tc {
  position: relative;
  /* 宽度由内容决定（图片固有宽度 / 插槽内容），宿主用 style 或 class 控制大小即可 */
  display: inline-block;
  max-width: 100%;
  vertical-align: middle;
  perspective: 1000px;
  cursor: pointer;
}

.tc__inner {
  position: relative;
  overflow: hidden;
  border-radius: var(--tc-radius);
  box-shadow: var(--tc-shadow);
  transform-style: preserve-3d;
  will-change: transform;
}

.tc__img {
  display: block;
  width: 100%;
  height: auto;
  user-select: none;
  -webkit-user-drag: none;
}

.tc__glare {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  mix-blend-mode: screen;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .tc__inner {
    transform: none !important;
    transition: none;
  }
}
</style>

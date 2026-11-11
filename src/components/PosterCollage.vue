<template>
  <div ref="rootEl" class="pc" :style="rootStyle">
    <div class="pc__stage" :style="stageStyle">
      <img v-if="background" class="pc__bg" :src="background" alt="" draggable="false" />

      <img
        v-for="(item, i) in items"
        :key="i"
        class="pc__layer"
        :class="{ 'is-hovered': hovered === i }"
        :src="item.src"
        :alt="item.alt || ''"
        :style="layerStyle(item, i)"
        draggable="false"
        @mouseenter="hovered = i"
        @mouseleave="onLeave(i)"
        @click="onClick(i, item)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

/*
 * 由 video-code / 其他/海报宣传页面/火影忍者人物海报页面.html 提取而来。
 *
 * 原 demo 是一张 1400×800 的「人物拼贴海报」：12 张人物抠图按设计稿坐标绝对定位、各带一个层级，
 * 鼠标移上去那张会放大 1.4 倍并被抬到所有图层之上，移开再落回原位；整张画布按窗口尺寸等比缩放。
 *
 * 组件化后：
 * - 图层由 items 传入（src / x / y / width / height / z），设计稿尺寸是 width × height；
 * - 缩放改由容器尺寸决定（ResizeObserver + transform: scale），不再依赖 window；
 * - 悬停放大倍数、置顶偏移、是否可点都能调，点击派发 select；
 * - 可选底图（background），整张海报可以带一层背景图。
 */
type PosterItem = {
  src: string
  x: number
  y: number
  width: number
  height: number
  z?: number
  alt?: string
}

const props = defineProps({
  /**
   * @description 拼贴图层（设计稿坐标，左上角为原点）
   */
  items: {
    type: Array as () => PosterItem[],
    default: () => [],
  },
  /**
   * @description 设计稿宽度，单位 px
   */
  width: {
    type: Number,
    default: 1400,
  },
  /**
   * @description 设计稿高度，单位 px
   */
  height: {
    type: Number,
    default: 800,
  },
  /**
   * @description 可选底图（铺满整张画布）
   */
  background: {
    type: String,
    default: '',
  },
  /**
   * @description 画布底色
   */
  paper: {
    type: String,
    default: 'transparent',
  },
  /**
   * @description 悬停时放大的倍数
   */
  hoverScale: {
    type: Number,
    default: 1.4,
  },
  /**
   * @description 悬停时临时抬高的层级（在原层级基础上加）
   */
  hoverLift: {
    type: Number,
    default: 1000,
  },
  /**
   * @description 缩放上限，避免大屏上放得过大
   */
  maxScale: {
    type: Number,
    default: 1.5,
  },
  /**
   * @description 是否允许点击图层
   */
  clickable: {
    type: Boolean,
    default: true,
  },
})

const emit = defineEmits<{
  /** 点中某个图层 */
  select: [index: number, item: PosterItem]
}>()

const rootEl = ref<HTMLElement | null>(null)
const hovered = ref(-1)
const scale = ref(1)

let observer: ResizeObserver | null = null

const rootStyle = computed(() => ({
  '--pc-paper': props.paper,
  '--pc-hover-scale': String(props.hoverScale),
}))

const stageStyle = computed(() => ({
  width: `${props.width}px`,
  height: `${props.height}px`,
  // 设计稿比容器大，用绝对定位 + translate 居中；只靠 grid 居中时溢出会把画布推向右边
  transform: `translate(-50%, -50%) scale(${scale.value})`,
}))

/** 层级：悬停那张抬到所有图层之上，其余回到各自的基准层级 */
const topZ = computed(() =>
  props.items.reduce((max, item, index) => Math.max(max, item.z ?? index + 1), 1),
)

function layerStyle(item: PosterItem, index: number) {
  const baseZ = item.z ?? index + 1
  return {
    left: `${item.x}px`,
    top: `${item.y}px`,
    width: `${item.width}px`,
    height: `${item.height}px`,
    zIndex: String(hovered.value === index ? topZ.value + props.hoverLift : baseZ),
  }
}

function onLeave(index: number) {
  if (hovered.value === index) hovered.value = -1
}

function onClick(index: number, item: PosterItem) {
  if (!props.clickable) return
  emit('select', index, item)
}

function resize() {
  const root = rootEl.value
  if (!root) return
  const w = root.clientWidth || 1
  const h = root.clientHeight || 1
  scale.value = Math.min(w / props.width, h / props.height, props.maxScale) || 0.2
}

onMounted(() => {
  resize()
  observer = new ResizeObserver(() => resize())
  if (rootEl.value) observer.observe(rootEl.value)
})

onBeforeUnmount(() => {
  observer?.disconnect()
})

defineExpose({
  /** 手动重算缩放 */
  fit: resize,
  scale,
})
</script>

<style scoped>
.pc {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 220px;
  overflow: hidden;
  background: var(--pc-paper);
  user-select: none;
}

/* 设计稿画布：固定 1400×800，整体 scale 到容器大小 */
.pc__stage {
  position: absolute;
  top: 50%;
  left: 50%;
  transform-origin: center center;
  transition: transform 0.12s ease-out;
}

.pc__bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: fill;
  z-index: 0;
  pointer-events: none;
}

.pc__layer {
  position: absolute;
  object-fit: fill;
  transform-origin: center center;
  transition: transform 0.16s ease;
  cursor: pointer;
  will-change: transform;
}

.pc__layer.is-hovered {
  transform: scale(var(--pc-hover-scale));
}

@media (prefers-reduced-motion: reduce) {
  .pc__layer,
  .pc__stage {
    transition: none;
  }
}
</style>

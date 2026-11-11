<template>
  <div
    ref="containerRef"
    class="bb"
    :style="rootStyle"
    @mouseenter="onMouseEnter"
    @mousemove="onMouseMove"
    @mouseleave="onMouseLeave"
    @touchstart="onTouchStart"
    @touchmove="onTouchMove"
    @touchend="onTouchEnd"
  >
    <div class="bb__stage">
      <div v-for="(layer, index) in layers" :key="index" class="bb__layer">
        <img
          v-if="layer.type === 'image'"
          class="bb__media"
          :src="baseSrc + layer.file"
          :style="mediaStyle(layer, index)"
          alt=""
          draggable="false"
        />
        <AutoPlayVideo
          v-else
          class="bb__media"
          :src="baseSrc + layer.file"
          :layer-style="mediaStyle(layer, index)"
        />
      </div>
    </div>

    <div
      v-if="logo"
      class="bb__logo"
      :title="isTouchDevice ? '点一下复位' : ''"
      @click="onLogoClick"
    >
      <img :src="baseSrc + 'logo.png'" alt="bilibili" draggable="false" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { CSSProperties, PropType } from 'vue'
import AutoPlayVideo from './AutoPlayVideo.vue'
import { CommonUtil } from './common-util'
import { createBilibiliBannerTheme } from './themes'
import { ResizeObserverWrap } from './resize-observer'
import type {
  BannerCurrentLayer,
  BannerMaxMove,
  BannerPositionLimit,
  OriDataType,
} from './types'

/**
 * 从 bilibili-banner-master 的 vue 版本迁移而来的 B 站节日 banner：
 * 多层图片 / 视频按不同 bench 系数跟随鼠标（或手指）横向错位，形成视差。
 *
 * 23 套主题的数据全部来自原仓库的 inst 组件；图层资源由本包 public/bilibili 下发，
 * 所以远程加载时图片、视频地址会自动指到本包的 unpkg / dev server 地址。
 */
const props = defineProps({
  /**
   * @description banner 主题，对应原仓库的 23 套节日 banner
   */
  theme: {
    type: String as PropType<'autumn-1' | 'autumn-2' | 'autumn-3' | 'autumn-4' | 'autumn-5' | 'spring-1' | 'spring-2' | 'spring-3' | 'spring-4' | 'spring-5' | 'spring-6' | 'summer-1' | 'summer-2' | 'summer-3' | 'summer-4' | 'summer-5' | 'summer-6' | 'summer-7' | 'winter-1' | 'winter-2' | 'winter-3' | 'winter-4' | 'winter-5'>,
    default: 'spring-1',
  },
  /**
   * @description banner 高度，单位 px（原版固定 150）
   */
  height: {
    type: Number,
    default: 150,
  },
  /**
   * @description 是否显示左上角的 bilibili logo
   */
  logo: {
    type: Boolean,
    default: true,
  },
  /**
   * @description 没有图层铺满时的底色
   */
  background: {
    type: String,
    default: '#f9f9f9',
  },
})

/** 本包资源前缀：dev 是 http://localhost:20020/，构建后是 unpkg 上 hel_dist 的地址 */
const assetBase = `${__BILIBILI_BANNER_ASSET_BASE__.replace(/\/?$/, '/')}bilibili/`

const isTouchDevice = CommonUtil.isPhonePointerEvent()

const containerRef = ref<HTMLDivElement | null>(null)
let resizeObserver: ResizeObserverWrap | null = null
let resetTimer: ReturnType<typeof setTimeout> | undefined

/** 主题展开后的图层（x / newX 已经加过 marginLeft） */
const layers = ref<OriDataType[]>([])
/** 每个图层当前插值出来的 translate / rotate / scale / opacity */
const current = ref<BannerCurrentLayer[]>([])
const transition = ref(0.75)
const moveX = ref(0)
const marginLeft = ref(0)
const containerWidth = ref(0)
const moveRate = ref(1)
const maxMove = ref<BannerMaxMove | undefined>(undefined)
const maxLeftPosition = ref<BannerPositionLimit | undefined>(undefined)
const maxRightPosition = ref<BannerPositionLimit | undefined>(undefined)
const startPoint = ref({ x: 0, y: 0 })
const isReseting = ref(false)
const isInResetingEnter = ref(false)

const baseSrc = computed(() => `${assetBase}${props.theme}/`)

const rootStyle = computed<CSSProperties>(() => ({
  height: `${props.height}px`,
  backgroundColor: props.background,
}))

/** 换主题 / 首次挂载时，重建图层数据 */
function buildTheme(): void {
  const themeConfig = createBilibiliBannerTheme(props.theme)
  const themeMarginLeft = themeConfig.marginLeft ?? 0
  marginLeft.value = themeMarginLeft

  layers.value = themeConfig.imgData.map((item) => ({
    ...item,
    x: item.x + themeMarginLeft,
    newX: item.newX + themeMarginLeft,
  }))
  current.value = layers.value.map((item) => ({
    x: item.x,
    y: item.y ?? 0,
    rotate: item.r ?? 0,
    scale: item.s ?? 0,
    opacity: item.o ?? 1,
  }))

  moveRate.value = themeConfig.moveRate ?? 1
  maxMove.value = themeConfig.maxMove
  maxLeftPosition.value = themeConfig.maxLeftPosition
  maxRightPosition.value = themeConfig.maxRightPosition
  transition.value = 0.75
  moveX.value = 0
  isReseting.value = false
  isInResetingEnter.value = false
  if (resetTimer) clearTimeout(resetTimer)
}

watch(() => props.theme, buildTheme, { immediate: true })

onMounted(() => {
  if (!containerRef.value) return
  containerWidth.value = containerRef.value.clientWidth
  resizeObserver = new ResizeObserverWrap(containerRef.value, (element) => {
    containerWidth.value = (element as HTMLElement).clientWidth
  })
})

onUnmounted(() => {
  resizeObserver?.unmount()
  resizeObserver = null
  if (resetTimer) clearTimeout(resetTimer)
})

/** 图层当前样式：translate 用 current.x / current.y，rotate / scale 只在原数据有值时才跟随 */
function mediaStyle(layer: OriDataType, index: number): CSSProperties {
  const cur = current.value[index]
  if (!cur) return {}
  return {
    width: `${layer.width}px`,
    height: `${layer.height}px`,
    transform:
      `translate(${layer.x == null ? 0 : cur.x}px, ${layer.y == null ? 0 : cur.y}px) ` +
      `rotate(${layer.r == null ? 0 : cur.rotate}deg) ` +
      `scale(${layer.s == null ? 1 : cur.scale})`,
    opacity: layer.o == null ? 1 : cur.opacity,
    filter: layer.filter ?? 'none',
    transition: `${transition.value}s`,
  }
}

/* -------------------------------------------------------------------------- */
/*  鼠标事件                                                                   */
/* -------------------------------------------------------------------------- */

function onMouseEnter(event: MouseEvent): void {
  if (isTouchDevice) return
  if (isReseting.value) {
    isInResetingEnter.value = true
    return
  }
  bilibiliStart(event.clientX, event.clientY)
}

function onMouseMove(event: MouseEvent): void {
  if (isTouchDevice) return
  if (isReseting.value) return

  if (isInResetingEnter.value) {
    bilibiliStart(event.clientX, event.clientY)
    isInResetingEnter.value = false
    return
  }
  bilibiliMove(event.clientX, event.clientY)
}

function onMouseLeave(): void {
  if (isTouchDevice) return
  bilibiliEnd()
  reset()
}

/* -------------------------------------------------------------------------- */
/*  触摸事件                                                                   */
/* -------------------------------------------------------------------------- */

function onTouchStart(event: TouchEvent): void {
  if (!isTouchDevice) return
  const touch = event.touches[0]
  if (touch) bilibiliStart(touch.clientX, touch.clientY)
}

function onTouchMove(event: TouchEvent): void {
  if (!isTouchDevice) return
  const touch = event.touches[0]
  if (touch) bilibiliMove(touch.clientX, touch.clientY)
}

function onTouchEnd(): void {
  if (!isTouchDevice) return
  bilibiliEnd()
}

/* -------------------------------------------------------------------------- */
/*  拖动计算                                                                   */
/* -------------------------------------------------------------------------- */

function bilibiliStart(x: number, y: number): void {
  startPoint.value = { x, y }
  transition.value = 0
}

function bilibiliMove(x: number, y: number): void {
  const rate = moveRate.value || 1
  const delta = (x - startPoint.value.x) / rate
  startPoint.value.x = x
  moveX.value += delta

  const limit = maxMove.value
  if (limit) {
    const offset = moveX.value * rate
    if (delta < 0 && offset * -1 > limit.left) return
    if (delta > 0 && offset > limit.right) return
  }

  if (moveX.value > 0) {
    if (Math.abs(moveX.value) > getLeftWidth()) {
      moveX.value -= delta
      return
    }
  } else if (Math.abs(moveX.value) > getRightWidth()) {
    moveX.value -= delta
    return
  }

  layers.value.forEach((_, index) => moveLayer(index))
}

function bilibiliEnd(): void {
  startPoint.value = { x: 0, y: 0 }
}

function getLeftWidth(): number {
  const limit = maxLeftPosition.value
  if (limit) {
    const layer = layers.value[limit.index]
    if (!layer) return containerWidth.value / 2
    const ratio = (layer.newX - layer.x) / layer.bench
    if (!ratio) return Number.POSITIVE_INFINITY
    const width = (layer.width - containerWidth.value) / 2 - layer.x - limit.cut
    return width / ratio
  }
  return containerWidth.value / 2 - marginLeft.value
}

function getRightWidth(): number {
  const limit = maxRightPosition.value
  if (limit) {
    const layer = layers.value[limit.index]
    if (!layer) return containerWidth.value / 2
    const ratio = (layer.newX - layer.x) / layer.bench
    if (!ratio) return Number.POSITIVE_INFINITY
    const width = (layer.width - containerWidth.value) / 2 + layer.x - limit.cut
    return width / ratio
  }
  return containerWidth.value / 2 + marginLeft.value
}

function moveLayer(index: number): void {
  const layer = layers.value[index]
  const cur = current.value[index]
  if (!layer || !cur) return

  // 移动量 - X
  if (layer.x != null && layer.newX != null && layer.x !== layer.newX) {
    cur.x = ((layer.newX - layer.x) / layer.bench) * moveX.value + layer.x
  }
  // 移动量 - Y
  if (layer.y != null && layer.newY != null && layer.y !== layer.newY) {
    cur.y = ((layer.newY - layer.y) / layer.bench) * moveX.value + layer.y
  }
  // 移动量 - Rotate
  if (layer.r != null && layer.newRotate != null && layer.r !== layer.newRotate) {
    cur.rotate = ((layer.newRotate - layer.r) / layer.bench) * moveX.value + layer.r
  }
  // 移动量 - Scale
  if (layer.s != null && layer.newScale != null && layer.s !== layer.newScale) {
    cur.scale = ((layer.newScale - layer.s) / layer.bench) * moveX.value + layer.s
  }
  // 移动量 - Opacity
  if (layer.o != null && layer.newOpacity != null && layer.o !== layer.newOpacity) {
    cur.opacity = ((layer.newOpacity - layer.o) / layer.bench) * moveX.value + layer.o
  }

  if (cur.opacity < 0) {
    cur.opacity = 0
  } else if (cur.opacity > 1) {
    cur.opacity = 1
  }
}

function reset(): void {
  transition.value = 0.75
  moveX.value = 0

  layers.value.forEach((layer, index) => {
    const cur = current.value[index]
    if (!cur) return
    cur.x = layer.x
    cur.y = layer.y ?? 0
    cur.rotate = layer.r ?? 0
    cur.scale = layer.s ?? 0
    cur.opacity = layer.o ?? 0
  })

  isReseting.value = true
  if (resetTimer) clearTimeout(resetTimer)
  resetTimer = setTimeout(() => {
    isReseting.value = false
  }, 750)
}

/** 触摸端没有 mouseleave，点 logo 手动复位 */
function onLogoClick(): void {
  if (isTouchDevice) reset()
}
</script>

<style scoped>
.bb {
  position: relative;
  width: 100%;
  height: 150px;
  background-color: #f9f9f9;
  background-repeat: no-repeat;
  background-position: center 0;
  background-size: cover;
  display: flex;
  justify-content: center;
  overflow: hidden;
  user-select: none;
}

.bb__stage {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.bb__layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bb__media {
  display: block;
  object-fit: contain;
  pointer-events: none;
}

.bb__logo {
  position: absolute;
  top: 0;
  left: 0;
  width: 220px;
  height: 105px;
  transform: scale(0.4) translate(-60%, -60%);
  cursor: default;
}

.bb__logo img {
  width: 100%;
  height: 100%;
  display: block;
}
</style>

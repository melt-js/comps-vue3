<template>
  <div class="bf" :style="rootStyle">
    <div class="bf__stage">
      <div class="bf__book">
        <div
          v-for="(leaf, index) in leaves"
          :key="leaf.key"
          class="bf__leaf"
          :class="{ 'is-turned': isTurned(index), 'is-flipping': flippingIndex === index }"
          :style="leafStyle(index)"
          @click="onLeafClick(index)"
        >
          <div class="bf__face bf__face--front">
            <img v-if="leaf.front.image" class="bf__image" :src="leaf.front.image" alt="" draggable="false" />
            <p v-if="leaf.front.title" class="bf__title">{{ leaf.front.title }}</p>
            <p v-if="leaf.front.text" class="bf__text">{{ leaf.front.text }}</p>
          </div>
          <div class="bf__face bf__face--back">
            <img v-if="leaf.back.image" class="bf__image" :src="leaf.back.image" alt="" draggable="false" />
            <p v-if="leaf.back.title" class="bf__title">{{ leaf.back.title }}</p>
            <p v-if="leaf.back.text" class="bf__text">{{ leaf.back.text }}</p>
          </div>
        </div>
      </div>

      <p v-if="!leaves.length" class="bf__empty">还没有内容，传 pages 进来吧</p>
    </div>

    <div v-if="controls" class="bf__controls">
      <button type="button" class="bf__btn" :disabled="turned === 0" @click="prev">上一页</button>
      <span class="bf__indicator">{{ turned }} / {{ leaves.length }}</span>
      <button type="button" class="bf__btn" :disabled="turned >= leaves.length" @click="next">
        下一页
      </button>
    </div>

    <p v-if="hint" class="bf__hint">点右半页向前翻 · 点左边已翻过的页往回翻 · ← → 也可以</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

/*
 * 由 video-code / 交互效果/书本翻页/index.html 提取而来。
 *
 * 原 demo 是一本「宫崎骏作品集」：书壳 + 一叠对开页，页面绕左边缘（transform-origin: 0 0）做
 * rotateY(-180deg) 翻过去，正反两面各自有标题 / 正文 / 底图，点下一页翻过去、点已经翻过的页翻回来，
 * 翻页过程中用 z-index + visibility 关键帧保证「正面转走、背面转来」。
 *
 * 组件化后：
 * - 页面内容改由 pages 传入（每张叶子有 front / back 两面），首尾封面单独给；
 * - 正反面改用 backface-visibility: hidden 实现，不再依赖 visibility 关键帧，逻辑简单很多；
 * - 尺寸 / 翻页时长 / 纸色 / 行距色都可调，额外补了上一页 / 下一页按钮、页码和键盘左右键；
 * - 可选的自动播放（翻到最后一页停下）。
 */
type Face = {
  title?: string
  text?: string
  image?: string
}

type Leaf = {
  key: string
  front: Face
  back: Face
}

const props = defineProps({
  /**
   * @description 内页：每张叶子有 front / back 两面（title / text / image）
   */
  pages: {
    type: Array as () => { front: Face; back: Face }[],
    default: () => [],
  },
  /**
   * @description 首封面（合上时看到的那一面）
   */
  cover: {
    type: Object as () => Face,
    default: () => ({ title: '封面', text: '' }),
  },
  /**
   * @description 尾封面（翻到最后看到的那一面）
   */
  endCover: {
    type: Object as () => Face,
    default: () => ({ title: '', text: '' }),
  },
  /**
   * @description 书页宽度，单位 px（单页宽 = 一半）
   */
  width: {
    type: Number,
    default: 560,
  },
  /**
   * @description 书页高度，单位 px
   */
  height: {
    type: Number,
    default: 380,
  },
  /**
   * @description 一次翻页的时长，单位毫秒
   */
  duration: {
    type: Number,
    default: 1200,
  },
  /**
   * @description 纸色
   */
  paper: {
    type: String,
    default: '#e9e6c4',
  },
  /**
   * @description 正文颜色
   */
  ink: {
    type: String,
    default: '#3f3b2f',
  },
  /**
   * @description 当前翻到第几张（可用 v-model 双向绑定）
   */
  modelValue: {
    type: Number,
    default: 0,
  },
  /**
   * @description 是否显示上一页 / 下一页按钮和页码
   */
  controls: {
    type: Boolean,
    default: true,
  },
  /**
   * @description 是否显示底部操作提示
   */
  hint: {
    type: Boolean,
    default: true,
  },
  /**
   * @description 是否自动往后翻（翻到最后一页停下）
   */
  autoplay: {
    type: Boolean,
    default: false,
  },
  /**
   * @description 自动翻页的间隔，单位毫秒
   */
  autoplayInterval: {
    type: Number,
    default: 2600,
  },
})

const emit = defineEmits<{
  'update:modelValue': [value: number]
  /** 翻页结束，value 是当前翻到第几张 */
  change: [value: number]
  /** 自动播放翻到最后一张 */
  end: []
}>()

const turned = ref(Math.max(0, props.modelValue))
const flippingIndex = ref(-1)

let lockTimer: ReturnType<typeof setTimeout> | null = null
let autoplayTimer: ReturnType<typeof setInterval> | null = null

/** 叶子的顺序和原 demo 一致：尾封面在最底下、内页倒序、首封面在最上面 */
const leaves = computed<Leaf[]>(() => {
  const list: Leaf[] = []
  list.push({ key: 'end-cover', front: props.endCover, back: {} })
  // 页面要倒着放：从最上面那张往下翻，翻完正好露出下一页的正面
  ;[...props.pages].reverse().forEach((page, index) => {
    list.push({ key: `page-${props.pages.length - 1 - index}`, front: page.front || {}, back: page.back || {} })
  })
  list.push({ key: 'cover', front: props.cover, back: {} })
  return list
})

const rootStyle = computed(() => ({
  '--bf-w': `${props.width}px`,
  '--bf-h': `${props.height}px`,
  '--bf-half': `${props.width / 2}px`,
  '--bf-duration': `${props.duration}ms`,
  '--bf-paper': props.paper,
  '--bf-ink': props.ink,
}))

/**
 * 翻过去的叶子是数组末尾那几张（DOM 顺序：尾封面 → 内页 → 首封面，首封面在最上面）。
 * 所以「已翻过」= index >= 总数 - turned。
 */
function isTurned(index: number) {
  return index >= leaves.value.length - turned.value
}

/**
 * 层级：
 * - 没翻的都在右半边，越靠上（index 越大）层越高；
 * - 翻过去都在左半边，最近翻过去的那张（已翻集合里 index 最小的）层最高；
 * - 正在翻的那张临时抬到最上面。
 */
function leafStyle(index: number) {
  if (flippingIndex.value === index) return { zIndex: 2000 }
  if (isTurned(index)) return { zIndex: 500 + (leaves.value.length - index) }
  return { zIndex: 800 + index }
}

function clampTarget(value: number) {
  return Math.min(leaves.value.length, Math.max(0, value))
}

function setTurned(next: number, animateIndex?: number) {
  const target = clampTarget(next)
  if (target === turned.value) return

  // 只有一次翻一张时才做「抬高层级」的处理
  if (animateIndex !== undefined && Math.abs(target - turned.value) === 1) {
    flippingIndex.value = animateIndex
  } else {
    flippingIndex.value = -1
  }

  turned.value = target
  emit('update:modelValue', target)

  if (lockTimer) clearTimeout(lockTimer)
  lockTimer = setTimeout(() => {
    flippingIndex.value = -1
    emit('change', target)
  }, props.duration)
}

/** 点击某张叶子：点最上面那张（还没翻的）向前翻，点刚翻过去那张往回翻 */
function onLeafClick(index: number) {
  if (flippingIndex.value !== -1) return
  const total = leaves.value.length
  if (index === total - 1 - turned.value) {
    setTurned(turned.value + 1, index)
  } else if (index === total - turned.value) {
    setTurned(turned.value - 1, index)
  }
}

function next() {
  if (flippingIndex.value !== -1 || turned.value >= leaves.value.length) return
  setTurned(turned.value + 1, turned.value)
}

function prev() {
  if (flippingIndex.value !== -1 || turned.value <= 0) return
  setTurned(turned.value - 1, turned.value - 1)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowRight') next()
  else if (event.key === 'ArrowLeft') prev()
}

function startAutoplay() {
  stopAutoplay()
  if (!props.autoplay) return
  autoplayTimer = setInterval(() => {
    if (turned.value >= leaves.value.length) {
      stopAutoplay()
      emit('end')
      return
    }
    next()
  }, Math.max(400, props.autoplayInterval))
}

function stopAutoplay() {
  if (autoplayTimer) clearInterval(autoplayTimer)
  autoplayTimer = null
}

watch(
  () => props.modelValue,
  (next) => {
    if (next !== turned.value) setTurned(next)
  },
)

watch(
  () => props.autoplay,
  (on) => {
    if (on) startAutoplay()
    else stopAutoplay()
  },
)

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  startAutoplay()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  if (lockTimer) clearTimeout(lockTimer)
  stopAutoplay()
})

defineExpose({ next, prev, goTo: (value: number) => setTurned(value), turned })
</script>

<style scoped>
.bf {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

.bf__stage {
  position: relative;
  width: var(--bf-w);
  height: var(--bf-h);
  perspective: 1400px;
}

/* 书脊中间的阴影，让对开页更像一本书 */
.bf__stage::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 24px;
  margin-left: -12px;
  background: linear-gradient(90deg, rgba(0, 0, 0, 0.16), rgba(0, 0, 0, 0.02) 45%, rgba(0, 0, 0, 0.02) 55%, rgba(0, 0, 0, 0.16));
  pointer-events: none;
  z-index: 1000;
  opacity: 0.55;
}

.bf__book {
  position: absolute;
  inset: 0;
  transform-style: preserve-3d;
}

/* 每张叶子：贴在右半页，绕左边缘翻转 */
.bf__leaf {
  position: absolute;
  top: 0;
  right: 0;
  width: calc(var(--bf-half) - 3px);
  height: calc(var(--bf-h) - 6px);
  transform-origin: 0 0;
  transform-style: preserve-3d;
  transform: rotateY(0deg);
  transition: transform var(--bf-duration) cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
}

.bf__leaf.is-turned {
  transform: rotateY(-180deg);
}

.bf__face {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: 4px 0 0 4px;
  background: var(--bf-paper);
  box-shadow:
    inset 3px 0 20px rgba(0, 0, 0, 0.16),
    0 0 15px rgba(0, 0, 0, 0.1);
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

/* 背面翻过来才是正面朝外 */
.bf__face--back {
  transform: rotateY(180deg);
}

/* 横线纸：行距跟正文字号走 */
.bf__face::after {
  content: '';
  position: absolute;
  top: 54px;
  right: 16px;
  bottom: 16px;
  left: 16px;
  background-image: linear-gradient(to bottom, currentColor 1px, transparent 1px);
  background-size: 100% 26px;
  color: var(--bf-ink);
  opacity: 0.14;
  pointer-events: none;
}

.bf__image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.78;
  pointer-events: none;
}

.bf__title {
  position: relative;
  z-index: 1;
  margin: 0 0 14px;
  padding: 18px 18px 0;
  background: linear-gradient(45deg, #ff5a3c, #ff8a00, #ffd400);
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  font-size: 17px;
  font-weight: 800;
  line-height: 1.5;
  text-align: center;
}

.bf__text {
  position: relative;
  z-index: 1;
  margin: 0;
  padding: 0 18px;
  color: var(--bf-ink);
  font-size: 13px;
  line-height: 26px;
  text-align: justify;
  text-indent: 2em;
}

.bf__empty {
  position: absolute;
  top: 50%;
  left: 50%;
  margin: 0;
  color: rgba(255, 255, 255, 0.45);
  font-size: 13px;
  transform: translate(-50%, -50%);
}

.bf__controls {
  display: flex;
  align-items: center;
  gap: 14px;
}

.bf__btn {
  padding: 7px 16px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  color: #ece9dd;
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    opacity 0.2s ease;
}

.bf__btn:hover:not(:disabled) {
  border-color: rgba(255, 170, 90, 0.6);
  background: rgba(255, 170, 90, 0.16);
}

.bf__btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.bf__indicator {
  color: rgba(255, 255, 255, 0.55);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.bf__hint {
  margin: 0;
  color: rgba(255, 255, 255, 0.35);
  font-size: 12px;
}

@media (max-width: 640px) {
  .bf__stage {
    width: min(var(--bf-w), 94vw);
  }

  .bf__hint {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .bf__leaf {
    transition-duration: 0.01ms;
  }
}
</style>

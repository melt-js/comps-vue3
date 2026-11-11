<template>
  <div class="hg" :style="rootStyle" role="status" aria-label="加载中">
    <div class="hg__frame" :style="frameStyle">
      <div class="hg__scale" :style="scaleStyle">
        <div class="hg__hourglass">
          <span class="hg__border" />
          <span class="hg__glass" />
          <span class="hg__sand-top-stroke" />
          <span class="hg__sand-bottom-stroke" />
          <span class="hg__sand-top" />
          <span class="hg__sand-bottom" />
          <span class="hg__sand-flow" />
          <span class="hg__sand-drop" />
          <span class="hg__reflection" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

/*
 * 由 video-code / UI组件/loading效果/沙漏.html 提取而来。
 *
 * 原 demo 是一整套纯 CSS 动画：沙子从上半锥流向下半锥（两层 clip-path 三角），
 * 中间一条沙流 + 一串循环下落的沙点，一轮结束整个沙漏转 180° 接着来。
 *
 * 组件化只做了两件事：
 * - 尺寸按 120×200 的基准整体缩放（内部还是原来的像素值，keyframes 不用改）；
 * - 周期、沙色、木框色、暂停都是 props，另外尊重系统的「减少动态效果」。
 */
const props = defineProps({
  /**
   * @description 沙漏宽度，单位 px（高度按 5:3 自动算）
   */
  size: {
    type: Number,
    default: 120,
  },
  /**
   * @description 一轮流沙 + 翻转的时长，单位秒
   */
  speed: {
    type: Number,
    default: 10,
  },
  /**
   * @description 沙子颜色
   */
  sandColor: {
    type: String,
    default: '#f5d76e',
  },
  /**
   * @description 木框颜色
   */
  frameColor: {
    type: String,
    default: '#5d4037',
  },
  /**
   * @description 是否暂停
   */
  paused: {
    type: Boolean,
    default: false,
  },
})

const BASE_W = 120
const BASE_H = 200

const scale = computed(() => props.size / BASE_W)

const rootStyle = computed(() => ({
  '--hg-sand': props.sandColor,
  '--hg-frame': props.frameColor,
  '--hg-duration': `${props.speed}s`,
  '--hg-play': props.paused ? 'paused' : 'running',
}))

/** 外层按缩放后的尺寸占位，避免整块还占着 120×200 */
const frameStyle = computed(() => ({
  width: `${BASE_W * scale.value}px`,
  height: `${BASE_H * scale.value}px`,
}))

const scaleStyle = computed(() => ({
  transform: `scale(${scale.value})`,
  transformOrigin: 'top left',
}))
</script>

<style scoped>
.hg {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.hg__frame {
  position: relative;
}

/* 缩放层：120×200 的设计尺寸，靠 transform 缩到目标大小（动画在更内层，互不覆盖） */
.hg__scale {
  position: absolute;
  top: 0;
  left: 0;
  width: 120px;
  height: 200px;
}

.hg__hourglass {
  position: relative;
  width: 120px;
  height: 200px;
  animation: hg-rotate var(--hg-duration) linear infinite;
  transform-origin: center 100px;
  animation-play-state: var(--hg-play);
}

/* 木框 */
.hg__border {
  position: absolute;
  inset: 0;
  z-index: 10;
  box-sizing: border-box;
  border: 6px solid var(--hg-frame);
  border-radius: 10px;
}

/* 玻璃腔体 */
.hg__glass {
  position: absolute;
  top: 6px;
  right: 6px;
  bottom: 6px;
  left: 6px;
  z-index: 5;
  overflow: hidden;
  border-radius: 4px;
}

/* 上半锥的沙子：从满（90px）流到 0 */
.hg__sand-top {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 90px;
  background: var(--hg-sand);
  border-top-left-radius: 10px;
  border-top-right-radius: 10px;
  clip-path: polygon(0 0, 100% 0, 51% 100%, 49% 100%);
  animation: hg-sand-top var(--hg-duration) linear infinite;
  animation-play-state: var(--hg-play);
}

/* 上层玻璃高光 */
.hg__sand-top-stroke {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 90px;
  border-top-left-radius: 10px;
  border-top-right-radius: 10px;
  clip-path: polygon(0 0, 100% 0, 51% 100%, 49% 100%);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.3) 100%);
  box-shadow: inset 0 0 10px rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(2px);
  pointer-events: none;
}

/* 下半锥的沙子：从 0 涨到 90px */
.hg__sand-bottom {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 0;
  background: var(--hg-sand);
  border-bottom-left-radius: 10px;
  border-bottom-right-radius: 10px;
  clip-path: polygon(49% 0, 51% 0, 100% 100%, 0 100%);
  animation: hg-sand-bottom var(--hg-duration) linear infinite;
  animation-play-state: var(--hg-play);
}

.hg__sand-bottom-stroke {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 90px;
  border-bottom-left-radius: 10px;
  border-bottom-right-radius: 10px;
  clip-path: polygon(49% 0, 51% 0, 100% 100%, 0 100%);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.3) 100%);
  box-shadow: inset 0 0 10px rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(2px);
  pointer-events: none;
}

/* 中间那条沙流 */
.hg__sand-flow {
  position: absolute;
  top: 89px;
  left: 50%;
  z-index: 5;
  width: 5px;
  height: 22px;
  background: var(--hg-sand);
  transform: translateX(-50%);
  animation: hg-flow var(--hg-duration) linear infinite;
  animation-play-state: var(--hg-play);
}

/* 循环下落的沙点 */
.hg__sand-drop {
  position: absolute;
  top: 105px;
  left: 50%;
  z-index: 5;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--hg-sand);
  transform: translateX(-50%);
  opacity: 0;
  animation: hg-drop var(--hg-duration) linear infinite;
  animation-play-state: var(--hg-play);
}

/* 玻璃反光 */
.hg__reflection {
  position: absolute;
  inset: 0;
  z-index: 15;
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0) 0%,
    rgba(255, 255, 255, 0.15) 50%,
    rgba(255, 255, 255, 0) 100%
  );
  pointer-events: none;
}

@keyframes hg-rotate {
  0%,
  45% {
    transform: rotate(0deg);
  }
  50%,
  99% {
    transform: rotate(180deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@keyframes hg-sand-top {
  0% {
    top: 0;
    left: 0;
    width: 100%;
    height: 90px;
  }
  49% {
    top: 90px;
    left: 50%;
    width: 0;
    height: 0;
  }
  50% {
    top: 0;
    left: 0;
    width: 100%;
    height: 0;
  }
  99%,
  100% {
    width: 100%;
    height: 90px;
  }
}

@keyframes hg-sand-bottom {
  0% {
    bottom: 0;
    left: 0;
    width: 100%;
    height: 0;
  }
  50%,
  51% {
    bottom: 0;
    left: 0;
    width: 100%;
    height: 90px;
  }
  99%,
  100% {
    bottom: 90px;
    left: 50%;
    width: 0;
    height: 0;
  }
}

@keyframes hg-flow {
  0%,
  45% {
    height: 20px;
  }
  50%,
  95% {
    height: 0;
  }
  100% {
    height: 20px;
  }
}

/* 沙点：每 5% 落一颗，落到一半再被下半锥「吃掉」 */
@keyframes hg-drop {
  0% {
    opacity: 1;
    transform: translate(-50%, 0);
  }
  4.9%,
  9.9%,
  14.9%,
  19.9%,
  24.9%,
  29.9%,
  34.9%,
  39.9%,
  44.9%,
  49.9%,
  50%,
  55%,
  60%,
  65%,
  70%,
  75%,
  80%,
  85%,
  90%,
  95%,
  100% {
    opacity: 0;
    transform: translate(-50%, 15px);
  }
  5%,
  10%,
  15%,
  20%,
  25%,
  30%,
  35%,
  40%,
  45% {
    opacity: 0;
    transform: translate(-50%, 0);
  }
  5.1%,
  10.1%,
  15.1%,
  20.1%,
  25.1%,
  30.1%,
  35.1%,
  40.1%,
  45.1%,
  50.1%,
  55.1%,
  60.1%,
  65.1%,
  70.1%,
  75.1%,
  80.1%,
  85.1%,
  90.1%,
  95.1% {
    opacity: 1;
  }
  54.9%,
  59.9%,
  64.9%,
  69.9%,
  74.9%,
  79.9%,
  84.9%,
  89.9%,
  94.9%,
  99.9% {
    opacity: 0;
    transform: translate(-50%, -30px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .hg__hourglass,
  .hg__sand-top,
  .hg__sand-bottom,
  .hg__sand-flow,
  .hg__sand-drop {
    animation: none;
  }

  .hg__sand-top {
    height: 45px;
  }

  .hg__sand-bottom {
    height: 45px;
  }
}
</style>

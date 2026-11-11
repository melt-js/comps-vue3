<template>
  <div
    class="nr"
    :style="rootStyle"
    role="status"
    :aria-label="showPercent ? `加载中 ${displayPercent}%` : '加载中'"
  >
    <span
      v-for="index in 3"
      :key="`wave-${index}`"
      class="nr__wave"
      :style="{ animationDelay: `${(index - 1) * 1}s` }"
    />

    <span v-for="index in 4" :key="`ring-${index}`" class="nr__ring" :class="`nr__ring--${index}`" />
    <span
      v-for="index in 4"
      :key="`particle-${index}`"
      class="nr__particle"
      :class="`nr__particle--${index}`"
    />

    <span class="nr__dot" />

    <span v-if="showPercent" class="nr__percent" :style="{ color: percentColor }">
      {{ displayPercent }}%
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

/*
 * 由 video-code / UI组件/loading效果/霓虹呼吸环loading.html 提取而来。
 *
 * 原 demo 是四层同心环（顺时针 / 逆时针交替 + 呼吸亮度）、四条轨道粒子、三圈脉冲波纹、
 * 一个中心光点，再配一段「每 50~150ms 随机涨一点」的假进度。组件化后：
 * - 尺寸全部改成百分比 / 相对 --nr-size 的比例，改成任意大小都不变形；
 * - 四枚霓虹色、脉冲圈数之外还用 speed 统一乘一个倍率（calc(数字 * 秒)）；
 * - 假进度改成可选：progress >= 0 时用受控值（做真实进度条），-1 时保持原来的随机自增；
 * - 进度数字的颜色沿用原 demo 的色相插值（青 → 紫 → 粉 → 白）。
 */
const props = defineProps({
  /**
   * @description 整体直径，单位 px
   */
  size: {
    type: Number,
    default: 250,
  },
  /**
   * @description 最外环颜色
   */
  color: {
    type: String,
    default: '#00fff2',
  },
  /**
   * @description 第二环颜色
   */
  color2: {
    type: String,
    default: '#bf00ff',
  },
  /**
   * @description 第三环颜色
   */
  color3: {
    type: String,
    default: '#ff006e',
  },
  /**
   * @description 最内环颜色
   */
  color4: {
    type: String,
    default: '#ff8c00',
  },
  /**
   * @description 速度倍率，1 为原始速度，越大转得越快
   */
  speed: {
    type: Number,
    default: 1,
  },
  /**
   * @description 是否用「随机自增」的假进度（关掉则用 progress 的受控值）
   */
  auto: {
    type: Boolean,
    default: true,
  },
  /**
   * @description 受控进度 0~100，auto 为 false 时生效
   */
  progress: {
    type: Number,
    default: 0,
  },
  /**
   * @description 是否显示底部百分比
   */
  showPercent: {
    type: Boolean,
    default: true,
  },
  /**
   * @description 是否暂停动画
   */
  paused: {
    type: Boolean,
    default: false,
  },
})

const autoProgress = ref(0)
let timer: ReturnType<typeof setTimeout> | null = null

const isAuto = computed(() => props.auto)
const displayPercent = computed(() =>
  Math.round(isAuto.value ? autoProgress.value : Math.min(100, Math.max(0, props.progress))),
)

/** 沿用原 demo 的色相插值：0% 偏青，100% 偏白 */
const percentColor = computed(() => {
  const ratio = displayPercent.value / 100
  return `hsl(${180 - ratio * 180}, 80%, ${50 + ratio * 30}%)`
})

const rootStyle = computed(() => ({
  '--nr-size': `${props.size}px`,
  '--nr-speed': String(Math.max(0.1, props.speed)),
  '--nr-c1': props.color,
  '--nr-c2': props.color2,
  '--nr-c3': props.color3,
  '--nr-c4': props.color4,
  '--nr-play': props.paused ? 'paused' : 'running',
}))

function tick() {
  if (!isAuto.value || props.paused) return
  autoProgress.value += Math.random() * 3
  if (autoProgress.value > 100) autoProgress.value = 0
  timer = setTimeout(tick, 50 + Math.random() * 100)
}

watch(
  [isAuto, () => props.paused],
  ([auto, paused]) => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    if (auto && !paused) tick()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})
</script>

<style scoped>
.nr {
  position: relative;
  width: var(--nr-size);
  height: var(--nr-size);
  animation-play-state: var(--nr-play);
}

/* 四层同心环：位置全部相对 --nr-size，顺时针 / 逆时针交替，并且各自呼吸发光 */
.nr__ring {
  position: absolute;
  top: 50%;
  left: 50%;
  border: 2px solid transparent;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  animation-name: nr-spin, nr-breathe;
  animation-timing-function: linear, ease-in-out;
  animation-iteration-count: infinite;
  animation-play-state: var(--nr-play);
}

.nr__ring--1 {
  width: 88%;
  height: 88%;
  border-top-color: var(--nr-c1);
  border-right-color: color-mix(in srgb, var(--nr-c1) 30%, transparent);
  box-shadow:
    0 0 15px color-mix(in srgb, var(--nr-c1) 30%, transparent),
    inset 0 0 15px color-mix(in srgb, var(--nr-c1) 10%, transparent);
  animation-duration: calc(var(--nr-speed) * 3s), calc(var(--nr-speed) * 2s);
}

.nr__ring--2 {
  width: 72%;
  height: 72%;
  border-top-color: var(--nr-c2);
  border-left-color: color-mix(in srgb, var(--nr-c2) 30%, transparent);
  box-shadow:
    0 0 15px color-mix(in srgb, var(--nr-c2) 30%, transparent),
    inset 0 0 15px color-mix(in srgb, var(--nr-c2) 10%, transparent);
  animation-duration: calc(var(--nr-speed) * 2.5s), calc(var(--nr-speed) * 2.5s);
  animation-direction: reverse;
}

.nr__ring--3 {
  width: 56%;
  height: 56%;
  border-bottom-color: var(--nr-c3);
  border-right-color: color-mix(in srgb, var(--nr-c3) 30%, transparent);
  box-shadow:
    0 0 15px color-mix(in srgb, var(--nr-c3) 30%, transparent),
    inset 0 0 15px color-mix(in srgb, var(--nr-c3) 10%, transparent);
  animation-duration: calc(var(--nr-speed) * 2s), calc(var(--nr-speed) * 3s);
}

.nr__ring--4 {
  width: 40%;
  height: 40%;
  border-bottom-color: var(--nr-c4);
  border-left-color: color-mix(in srgb, var(--nr-c4) 30%, transparent);
  box-shadow:
    0 0 15px color-mix(in srgb, var(--nr-c4) 30%, transparent),
    inset 0 0 15px color-mix(in srgb, var(--nr-c4) 10%, transparent);
  animation-duration: calc(var(--nr-speed) * 1.5s), calc(var(--nr-speed) * 2s);
  animation-direction: reverse;
}

/* 轨道粒子：先转到起始角，再按半径推出去 */
.nr__particle {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 6px;
  height: 6px;
  margin: -3px 0 0 -3px;
  border-radius: 50%;
  animation-name: nr-orbit;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
  animation-play-state: var(--nr-play);
}

.nr__particle--1 {
  background: var(--nr-c1);
  box-shadow: 0 0 10px var(--nr-c1), 0 0 20px var(--nr-c1);
  --nr-orbit: 44%;
  animation-duration: calc(var(--nr-speed) * 3s);
}

.nr__particle--2 {
  background: var(--nr-c2);
  box-shadow: 0 0 10px var(--nr-c2), 0 0 20px var(--nr-c2);
  --nr-orbit: 36%;
  animation-duration: calc(var(--nr-speed) * 2.5s);
  animation-direction: reverse;
}

.nr__particle--3 {
  background: var(--nr-c3);
  box-shadow: 0 0 10px var(--nr-c3), 0 0 20px var(--nr-c3);
  --nr-orbit: 28%;
  animation-duration: calc(var(--nr-speed) * 2s);
}

.nr__particle--4 {
  background: var(--nr-c4);
  box-shadow: 0 0 10px var(--nr-c4), 0 0 20px var(--nr-c4);
  --nr-orbit: 20%;
  animation-duration: calc(var(--nr-speed) * 1.5s);
  animation-direction: reverse;
}

/* 中心光点 + 外层辉光 */
.nr__dot {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 12px;
  height: 12px;
  margin: -6px 0 0 -6px;
  border-radius: 50%;
  background: #fff;
  animation: nr-dot calc(var(--nr-speed) * 1.5s) ease-in-out infinite;
  animation-play-state: var(--nr-play);
}

.nr__dot::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 40px;
  height: 40px;
  margin: -20px 0 0 -20px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.15), transparent 70%);
}

/* 三圈向外扩散的脉冲波纹 */
.nr__wave {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 24%;
  height: 24%;
  margin: -12% 0 0 -12%;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  animation: nr-wave calc(var(--nr-speed) * 3s) ease-out infinite;
  animation-play-state: var(--nr-play);
}

.nr__percent {
  position: absolute;
  bottom: -46px;
  left: 50%;
  font-family: 'Courier New', monospace;
  font-size: 18px;
  font-weight: 700;
  transform: translateX(-50%);
}

@keyframes nr-spin {
  to {
    transform: translate(-50%, -50%) rotate(360deg);
  }
}

/* 环本身的呼吸：亮度起伏，和旋转叠在一起 */
@keyframes nr-breathe {
  0%,
  100% {
    filter: brightness(0.8);
  }
  50% {
    filter: brightness(1.5);
  }
}

@keyframes nr-orbit {
  from {
    transform: rotate(0deg) translateX(calc(var(--nr-size) * var(--nr-orbit))) rotate(0deg);
  }
  to {
    transform: rotate(360deg) translateX(calc(var(--nr-size) * var(--nr-orbit))) rotate(-360deg);
  }
}

@keyframes nr-dot {
  0%,
  100% {
    box-shadow:
      0 0 10px rgba(255, 255, 255, 0.5),
      0 0 30px rgba(255, 255, 255, 0.2);
    transform: scale(1);
  }
  50% {
    box-shadow:
      0 0 20px rgba(255, 255, 255, 0.8),
      0 0 60px rgba(255, 255, 255, 0.3);
    transform: scale(1.3);
  }
}

@keyframes nr-wave {
  0% {
    width: 24%;
    height: 24%;
    margin: -12% 0 0 -12%;
    opacity: 0.5;
  }
  100% {
    width: 112%;
    height: 112%;
    margin: -56% 0 0 -56%;
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .nr__ring,
  .nr__particle,
  .nr__dot,
  .nr__wave {
    animation: none;
  }
}
</style>

<template>
  <div class="cw" :style="rootStyle" role="status" :aria-label="text || '加载中'">
    <span class="cw__halo" aria-hidden="true" />
    <div class="cw__scene">
      <div class="cw__grid" :style="gridStyle">
        <div
          v-for="cube in cubes"
          :key="cube.key"
          class="cw__cube"
          :style="cube.style"
        >
          <span class="cw__face cw__face--top" />
          <span class="cw__face cw__face--left" />
          <span class="cw__face cw__face--right" />
        </div>
      </div>
    </div>
    <p v-if="text" class="cw__text">{{ text }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

/*
 * 由 video-code / UI组件/loading效果/盒子波场loading.html 提取而来。
 *
 * 原 demo 是一个 5×5 的 3D 方块阵：整个网格先 rotateX(68deg) rotateZ(45deg) 变成俯视等距视角，
 * 每块再按「到中心的距离」错峰上下浮动（translateZ），同时色相缓慢偏移，外加一圈呼吸光晕。
 *
 * 组件化后：行列数、边长、色相基准、速度、暂停都是 props，方块尺寸和间距由 size 等比推出，
 * 所以从 120 到 800 都是同一套视角；标注文案可选。
 */
const props = defineProps({
  /**
   * @description 方块阵的边长（5×5 整体宽度），单位 px
   */
  size: {
    type: Number,
    default: 360,
  },
  /**
   * @description 行列数（N×N 个方块）
   */
  gridSize: {
    type: Number,
    default: 5,
  },
  /**
   * @description 色相基准，190 偏青、240 偏蓝、300 偏紫
   */
  hue: {
    type: Number,
    default: 205,
  },
  /**
   * @description 速度倍率，1 为原始节奏
   */
  speed: {
    type: Number,
    default: 1,
  },
  /**
   * @description 是否暂停
   */
  paused: {
    type: Boolean,
    default: false,
  },
  /**
   * @description 底部标记文字，留空则不显示
   */
  text: {
    type: String,
    default: '',
  },
})

/** 方块之间的间隙占边长的比例（原 demo 是 10/42） */
const GAP_RATIO = 10 / 42
/** 最高点的抬升量占方块边长的比例（原 demo 是 32/42） */
const LIFT_RATIO = 32 / 42

const count = computed(() => Math.max(2, Math.round(props.gridSize)))
const cubeSize = computed(() => {
  const n = count.value
  return props.size / (n + (n - 1) * GAP_RATIO)
})

const rootStyle = computed(() => ({
  '--cw-n': String(count.value),
  '--cw-size': `${props.size}px`,
  '--cw-cube': `${cubeSize.value}px`,
  '--cw-gap': `${cubeSize.value * GAP_RATIO}px`,
  '--cw-lift': `${cubeSize.value * LIFT_RATIO}px`,
  '--cw-speed': String(Math.max(0.1, props.speed)),
  '--cw-play': props.paused ? 'paused' : 'running',
}))

const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${count.value}, ${cubeSize.value}px)`,
  gridTemplateRows: `repeat(${count.value}, ${cubeSize.value}px)`,
}))

/** 每块方块：到中心的距离决定错峰延迟与抬升高度，行列决定色相偏移 */
const cubes = computed(() => {
  const n = count.value
  const center = (n - 1) / 2
  const maxDistance = Math.hypot(center, center) || 1
  const list: { key: string; style: Record<string, string> }[] = []

  for (let row = 0; row < n; row += 1) {
    for (let col = 0; col < n; col += 1) {
      const distance = Math.hypot(row - center, col - center)
      const ratio = 1 - distance / maxDistance
      list.push({
        key: `${row}-${col}`,
        style: {
          '--cw-delay': `${(distance / maxDistance) * 0.9}s`,
          '--cw-h': String(Math.round(props.hue + ((row + col) / Math.max(1, n * 2 - 2)) * 60)),
          '--cw-raise': `${cubeSize.value * LIFT_RATIO * (0.4 + ratio * 0.6)}px`,
        },
      })
    }
  }

  return list
})
</script>

<style scoped>
.cw {
  position: relative;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: var(--cw-size);
  height: var(--cw-size);
  perspective: 1000px;
}

/* 背后的呼吸光晕 */
.cw__halo {
  position: absolute;
  width: 72%;
  height: 72%;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    color-mix(in srgb, #75c1ff 22%, transparent) 0%,
    color-mix(in srgb, #537aff 14%, transparent) 30%,
    transparent 72%
  );
  filter: blur(10px);
  animation: cw-halo calc(var(--cw-speed) * 3.2s) ease-in-out infinite;
  animation-play-state: var(--cw-play);
}

.cw__scene {
  position: relative;
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  perspective: 1000px;
}

/* 网格：先压成等距俯视，再绕 Z 微幅摆动 */
.cw__grid {
  display: grid;
  gap: var(--cw-gap);
  transform-style: preserve-3d;
  transform: rotateX(68deg) rotateZ(45deg);
  animation: cw-orbit calc(var(--cw-speed) * 5s) ease-in-out infinite;
  animation-play-state: var(--cw-play);
}

.cw__cube {
  position: relative;
  width: var(--cw-cube);
  height: var(--cw-cube);
  transform-style: preserve-3d;
  will-change: transform, filter;
  animation: cw-wave calc(var(--cw-speed) * 1.85s) cubic-bezier(0.4, 0, 0.2, 1) infinite;
  animation-delay: var(--cw-delay, 0s);
  animation-play-state: var(--cw-play);
}

.cw__face {
  position: absolute;
  inset: 0;
  border: 1px solid rgba(209, 238, 255, 0.18);
}

.cw__face--top {
  transform: rotateX(90deg) translateZ(calc(var(--cw-cube) / 2));
  background: linear-gradient(
    145deg,
    hsl(var(--cw-h, 205), 100%, 74%),
    hsl(calc(var(--cw-h, 205) + 18), 92%, 58%)
  );
}

.cw__face--left {
  transform: rotateY(-90deg) translateZ(calc(var(--cw-cube) / 2));
  background: linear-gradient(
    180deg,
    hsl(var(--cw-h, 205), 85%, 58%),
    hsl(calc(var(--cw-h, 205) - 12), 72%, 36%)
  );
}

.cw__face--right {
  transform: rotateY(0deg) translateZ(calc(var(--cw-cube) / 2));
  background: linear-gradient(
    180deg,
    hsl(calc(var(--cw-h, 205) + 8), 90%, 64%),
    hsl(calc(var(--cw-h, 205) + 10), 80%, 44%)
  );
}

.cw__text {
  position: absolute;
  bottom: 0;
  margin: 0;
  color: #7de7ff;
  font-size: 12px;
  letter-spacing: 0.32em;
  text-transform: uppercase;
  text-shadow: 0 0 12px rgba(125, 231, 255, 0.6);
}

@keyframes cw-wave {
  0%,
  100% {
    transform: translateZ(0) scale(0.98);
    filter: saturate(1) brightness(0.88);
  }
  32% {
    transform: translateZ(var(--cw-raise, 20px)) scale(1);
    filter: saturate(1.2) brightness(1.08);
  }
  56% {
    transform: translateZ(calc(var(--cw-raise, 20px) * 0.42)) scale(0.99);
    filter: saturate(1.05) brightness(0.98);
  }
}

@keyframes cw-orbit {
  0%,
  100% {
    transform: rotateX(68deg) rotateZ(45deg);
  }
  50% {
    transform: rotateX(68deg) rotateZ(50deg);
  }
}

@keyframes cw-halo {
  0%,
  100% {
    opacity: 0.56;
    transform: scale(0.92);
  }
  50% {
    opacity: 0.9;
    transform: scale(1.05);
  }
}

@media (prefers-reduced-motion: reduce) {
  .cw__grid,
  .cw__cube,
  .cw__halo {
    animation: none;
  }
}
</style>

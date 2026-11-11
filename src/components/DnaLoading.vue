<template>
  <div class="dna" :style="rootStyle" role="status" :aria-label="text || '加载中'">
    <div class="dna__strand">
      <div
        v-for="index in nodeCount"
        :key="index"
        class="dna__pair"
        :style="{ '--dna-phase': `-${((index - 1) * speed) / nodeCount}s` }"
      >
        <span class="dna__dot dna__dot--left" />
        <span class="dna__bridge" />
        <span class="dna__dot dna__dot--right" />
      </div>
    </div>

    <p v-if="text" class="dna__text">
      <span
        v-for="(char, index) in textChars"
        :key="index"
        :style="{ animationDelay: `${index * 0.15}s` }"
      >{{ char }}</span>
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

/*
 * 由 video-code / UI组件/loading效果/DNA双螺旋loading.html 提取而来。
 *
 * 原 demo 用 requestAnimationFrame 每帧给每个节点算 cos/sin，再直接改 transform / opacity / scale。
 * 这里把那套三角函数换成了「一条 keyframes + 每行一个负延迟」：
 * - 左右两列点沿 X 轴来回摆，同时用 scale / opacity 模拟纵深（对应原来的 Z 轴位移）；
 * - 第 i 行的相位 = i / 行数，用负的 animation-delay 表达，所以一挂载就是「已经在转」的状态；
 * - 右列比左列多半圈，桥的透明度跟左列同相。
 *
 * 换成纯 CSS 之后不再有每帧的 JS 开销，行数 / 摆幅 / 周期 / 配色都能用 props 调；
 * 原 demo 里满屏飘的背景粒子属于页面氛围，没有放进组件。
 */
const props = defineProps({
  /**
   * @description 排列总高度，单位 px
   */
  height: {
    type: Number,
    default: 300,
  },
  /**
   * @description 螺旋宽度（左右摆动的总幅度），单位 px
   */
  width: {
    type: Number,
    default: 200,
  },
  /**
   * @description 节点对数（每一行是一对碱基）
   */
  nodeCount: {
    type: Number,
    default: 12,
  },
  /**
   * @description 单侧最大摆动幅度，单位 px
   */
  amplitude: {
    type: Number,
    default: 40,
  },
  /**
   * @description 节点直径，单位 px
   */
  dotSize: {
    type: Number,
    default: 16,
  },
  /**
   * @description 左列颜色
   */
  color: {
    type: String,
    default: '#00d4ff',
  },
  /**
   * @description 右列颜色
   */
  color2: {
    type: String,
    default: '#ff006e',
  },
  /**
   * @description 转一圈的时长，单位秒
   */
  speed: {
    type: Number,
    default: 3,
  },
  /**
   * @description 是否暂停动画
   */
  paused: {
    type: Boolean,
    default: false,
  },
  /**
   * @description 底部文字，留空则不显示
   */
  text: {
    type: String,
    default: 'LOADING...',
  },
})

const textChars = computed(() => props.text.split(''))

const rootStyle = computed(() => ({
  '--dna-w': `${props.width}px`,
  '--dna-h': `${props.height}px`,
  '--dna-amp': `${props.amplitude}px`,
  '--dna-dot': `${props.dotSize}px`,
  '--dna-c1': props.color,
  '--dna-c2': props.color2,
  '--dna-duration': `${props.speed}s`,
  '--dna-half': `${props.speed / 2}s`,
  '--dna-play': props.paused ? 'paused' : 'running',
}))
</script>

<style scoped>
.dna {
  position: relative;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  padding-bottom: 40px;
}

.dna__strand {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: var(--dna-w);
  height: var(--dna-h);
}

.dna__pair {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 0;
}

/* 桥：两列之间那条渐变连线，随深度变淡 */
.dna__bridge {
  position: absolute;
  top: 0;
  left: calc(var(--dna-dot) / 2);
  right: calc(var(--dna-dot) / 2);
  height: 2px;
  transform: translateY(-50%);
  background: linear-gradient(
    90deg,
    var(--dna-c1),
    rgba(255, 255, 255, 0.18) 45%,
    rgba(255, 255, 255, 0.18) 55%,
    var(--dna-c2)
  );
  opacity: 0.2;
  animation: dna-bridge var(--dna-duration) linear infinite;
  animation-delay: var(--dna-phase);
  animation-play-state: var(--dna-play);
}

.dna__dot {
  position: relative;
  z-index: 1;
  width: var(--dna-dot);
  height: var(--dna-dot);
  border-radius: 50%;
  animation: dna-swing var(--dna-duration) linear infinite;
  animation-play-state: var(--dna-play);
}

.dna__dot--left {
  background: var(--dna-c1);
  box-shadow: 0 0 10px var(--dna-c1), 0 0 20px var(--dna-c1);
  animation-delay: var(--dna-phase);
}

.dna__dot--right {
  background: var(--dna-c2);
  box-shadow: 0 0 10px var(--dna-c2), 0 0 20px var(--dna-c2);
  /* 右列比左列多半圈 */
  animation-delay: calc(var(--dna-phase) - var(--dna-half));
}

.dna__text {
  position: absolute;
  bottom: 0;
  left: 50%;
  display: flex;
  margin: 0;
  color: #fff;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  letter-spacing: 8px;
  text-transform: uppercase;
  transform: translateX(-50%);
}

.dna__text span {
  display: inline-block;
  animation: dna-text 1.5s ease-in-out infinite;
  animation-play-state: var(--dna-play);
}

/* 左右摆动 + 用缩放/透明度冒充纵深（cos 走 X、sin 走深度） */
@keyframes dna-swing {
  0% {
    transform: translateX(calc(var(--dna-amp) * -1)) scale(0.7);
    opacity: 0.4;
  }
  25% {
    transform: translateX(0) scale(1.1);
    opacity: 1;
  }
  50% {
    transform: translateX(var(--dna-amp)) scale(0.7);
    opacity: 0.4;
  }
  75% {
    transform: translateX(0) scale(1.1);
    opacity: 1;
  }
  100% {
    transform: translateX(calc(var(--dna-amp) * -1)) scale(0.7);
    opacity: 0.4;
  }
}

@keyframes dna-bridge {
  0%,
  100% {
    opacity: 0.15;
  }
  25%,
  75% {
    opacity: 0.6;
  }
}

@keyframes dna-text {
  0%,
  100% {
    opacity: 0.3;
  }
  50% {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .dna__dot,
  .dna__bridge,
  .dna__text span {
    animation: none;
  }

  .dna__dot {
    opacity: 0.9;
  }
}
</style>

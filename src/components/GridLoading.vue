<template>
  <div class="gl" :style="rootStyle" role="status" :aria-label="text || '加载中'">
    <div class="gl__grid" :style="gridStyle">
      <span
        v-for="index in 9"
        :key="index"
        class="gl__cell"
        :style="{ animationDelay: `${(index - 1) * stagger}s` }"
      />
    </div>
    <p v-if="text" class="gl__text">{{ text }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

/*
 * 由 video-code / UI组件/loading效果/九宫格加载效果.html 提取而来。
 *
 * 原 demo 用 JS 建 9 个 div 再逐个写 animation-delay，尺寸 / 颜色 / 周期全是 CSS 常量。
 * 组件里 9 个格子交给 v-for，延迟由 stagger 推出来，边长、色、周期、圆角和间距都成了 props；
 * 再加一个通用的 paused 开关（loading 组件在等接口时经常要「停住」）。
 */
const props = defineProps({
  /**
   * @description 九宫格边长，单位 px
   */
  size: {
    type: Number,
    default: 90,
  },
  /**
   * @description 格子颜色
   */
  color: {
    type: String,
    default: '#487df9',
  },
  /**
   * @description 一轮动画时长，单位秒
   */
  speed: {
    type: Number,
    default: 1.8,
  },
  /**
   * @description 相邻格子的动画延迟差，单位秒
   */
  stagger: {
    type: Number,
    default: 0.1,
  },
  /**
   * @description 格子间距，单位 px
   */
  gap: {
    type: Number,
    default: 6,
  },
  /**
   * @description 格子圆角，单位 px
   */
  radius: {
    type: Number,
    default: 4,
  },
  /**
   * @description 是否暂停动画
   */
  paused: {
    type: Boolean,
    default: false,
  },
  /**
   * @description 加载文案，留空则不显示
   */
  text: {
    type: String,
    default: '',
  },
})

const rootStyle = computed(() => ({
  '--gl-color': props.color,
  '--gl-duration': `${props.speed}s`,
  '--gl-radius': `${props.radius}px`,
  '--gl-play': props.paused ? 'paused' : 'running',
}))

const gridStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  gap: `${props.gap}px`,
}))
</script>

<style scoped>
.gl {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}

.gl__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
}

.gl__cell {
  border-radius: var(--gl-radius);
  background: var(--gl-color);
  opacity: 0.3;
  transform: scale(0.6);
  animation: gl-pulse var(--gl-duration) cubic-bezier(0.4, 0, 0.2, 1) infinite;
  animation-play-state: var(--gl-play);
}

.gl__text {
  margin: 0;
  color: #6b7280;
  font-size: 13px;
  letter-spacing: 0.08em;
}

@keyframes gl-pulse {
  0%,
  100% {
    transform: scale(0.6);
    opacity: 0.3;
  }
  50% {
    transform: scale(1);
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .gl__cell {
    animation: none;
    opacity: 0.85;
    transform: scale(0.9);
  }
}
</style>

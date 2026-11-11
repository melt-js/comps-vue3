<template>
  <div class="gbl" :style="rootStyle" role="status" :aria-label="text || '加载中'">
    <!-- gooey 滤镜的 defs：每个实例一个唯一 id，多个 loading 同时出现也互不影响 -->
    <svg class="gbl__defs" aria-hidden="true" focusable="false">
      <defs>
        <filter :id="filterId" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" :stdDeviation="blur" result="blur" />
          <feColorMatrix in="blur" mode="matrix" :values="MATRIX" />
        </filter>
      </defs>
    </svg>

    <div class="gbl__balls" :style="ballsStyle">
      <span
        v-for="index in ballCount"
        :key="index"
        class="gbl__ball"
        :style="ballStyle(index - 1)"
      />
    </div>

    <p v-if="text" class="gbl__text">{{ text }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'

/*
 * 由 video-code / UI组件/loading效果/元素交融loading动画.html 提取而来。
 *
 * 原 demo 靠一个 SVG gooey 滤镜（高斯模糊 + alpha 对比度矩阵）+ 8 个沿圆周转圈的小球，
 * 相邻小球被滤衬托开时会「融」在一起，形成流体接龙的效果。
 *
 * 组件化后：
 * - 滤镜 id 用 useId() 生成，页面上放多个也不会互相抢同一个 filter；
 * - 小球颜色改成 colors 数组（不传就按 color 铺纯色），数量、球径、轨道直径、转一圈的时长、
 *   相邻球的错开时间都能调；
 * - 模糊半径按尺寸推导（约为边长的 1/30），放大缩小时融合处的观感基本一致。
 */
const props = defineProps({
  /**
   * @description 轨道直径（小球绕圈的中心直径），单位 px
   */
  size: {
    type: Number,
    default: 300,
  },
  /**
   * @description 单个小球直径，单位 px
   */
  ballSize: {
    type: Number,
    default: 60,
  },
  /**
   * @description 小球数量
   */
  ballCount: {
    type: Number,
    default: 8,
  },
  /**
   * @description 小球颜色列表，长度不够时循环取用
   */
  colors: {
    type: Array as () => string[],
    default: () => [
      '#165dff',
      '#722ed1',
      '#0fc6c2',
      '#7bc616',
      '#f53f3f',
      '#ff7d00',
      '#ff007d',
      '#ff7d00',
    ],
  },
  /**
   * @description 单色模式的颜色；留空则用 colors 数组里的多种颜色
   */
  color: {
    type: String,
    default: '',
  },
  /**
   * @description 转一圈的时长，单位秒
   */
  speed: {
    type: Number,
    default: 5,
  },
  /**
   * @description 相邻小球的动画错开时间，单位秒
   */
  stagger: {
    type: Number,
    default: 0.1,
  },
  /**
   * @description 是否开启流体融合滤镜（关掉就是普通的一串圆点绕圈）
   */
  gooey: {
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
  /**
   * @description 加载文案，留空则不显示
   */
  text: {
    type: String,
    default: '',
  },
})

/** 高斯模糊 + 把半透明像素的 alpha 拉满，小球之间就会「黏」起来 */
const MATRIX = '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -10'

const uid = useId()
const filterId = `gbl-gooey-${uid.replace(/[^\w-]/g, '')}`

const blur = computed(() => Math.max(2, Math.round(props.size / 30)))

const rootStyle = computed(() => ({
  '--gbl-track': `${props.size}px`,
  '--gbl-ball': `${props.ballSize}px`,
  '--gbl-duration': `${props.speed}s`,
  '--gbl-play': props.paused ? 'paused' : 'running',
}))

const ballsStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  filter: props.gooey ? `url(#${filterId})` : 'none',
}))

/** 小球配色：给了 color 就铺单色，否则循环用 colors 里的多色 */
const palette = computed(() => {
  if (props.color) return [props.color]
  return props.colors?.length ? props.colors : ['#165dff']
})

function ballStyle(index: number) {
  return {
    backgroundColor: palette.value[index % palette.value.length],
    animationDelay: `${index * props.stagger}s`,
  }
}
</script>

<style scoped>
.gbl {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.gbl__defs {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
}

.gbl__balls {
  position: relative;
  display: block;
}

.gbl__ball {
  position: absolute;
  top: 50%;
  left: 50%;
  width: var(--gbl-ball);
  height: var(--gbl-ball);
  border-radius: 50%;
  transform: translate(-50%, -50%) rotate(0deg) translateX(calc(var(--gbl-track) / 2));
  animation: gbl-orbit var(--gbl-duration) cubic-bezier(0.18, 0.89, 0.32, 1.28) infinite;
  animation-play-state: var(--gbl-play);
}

.gbl__text {
  margin: 0;
  color: #6b7280;
  font-size: 13px;
  letter-spacing: 0.08em;
}

@keyframes gbl-orbit {
  from {
    transform: translate(-50%, -50%) rotate(0deg) translateX(calc(var(--gbl-track) / 2));
  }
  to {
    transform: translate(-50%, -50%) rotate(360deg) translateX(calc(var(--gbl-track) / 2));
  }
}

@media (prefers-reduced-motion: reduce) {
  .gbl__ball {
    animation: none;
    transform: translate(-50%, -50%) rotate(0deg) translateX(calc(var(--gbl-track) / 2));
  }
}
</style>

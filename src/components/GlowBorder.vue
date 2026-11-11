<template>
  <div class="gb" :style="rootStyle">
    <div class="gb__box" :style="boxStyle">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

/*
 * 由 video-code / 动画特效/流光边框/index.html 提取而来。
 *
 * 原 demo 是一个写死 200x200 的方块：边框厚度、流光块尺寸、动画时长、两个渐变色
 * 全都是 CSS 常量。这里把它们提成 props，并用 CSS 变量喂给 keyframes，所以同一套
 * 动画能适配任意尺寸 / 厚度（keyframes 里用 calc 百分比 + 变量，不依赖固定像素）。
 *
 * 包一层的作用没变：外边一圈发光描边，中间是内容区，默认插槽放什么都行。
 */
const props = defineProps({
  /**
   * @description 外框边长，单位 px；内容超出的高度不会被裁掉
   */
  size: {
    type: Number,
    default: 200,
  },
  /**
   * @description 圆角，单位 px
   */
  radius: {
    type: Number,
    default: 12,
  },
  /**
   * @description 边框厚度，单位 px，流光块的粗细跟着它走
   */
  thickness: {
    type: Number,
    default: 4,
  },
  /**
   * @description 流光起始色
   */
  color: {
    type: String,
    default: '#00f5ff',
  },
  /**
   * @description 流光结束色，和起始色一起组成 135deg 渐变
   */
  color2: {
    type: String,
    default: '#6e00ff',
  },
  /**
   * @description 流光绕一圈的时长，单位秒
   */
  duration: {
    type: Number,
    default: 3,
  },
  /**
   * @description 是否显示外圈呼吸光晕
   */
  glow: {
    type: Boolean,
    default: true,
  },
  /**
   * @description 内容区背景色，留空则透明（方便宿主自己用 CSS 上色）
   */
  background: {
    type: String,
    default: '',
  },
})

/** 几何量都从 thickness 推出来，改厚度时流光块和圆角自动跟着变 */
const rootStyle = computed(() => ({
  '--gb-size': `${props.size}px`,
  '--gb-r': `${props.radius}px`,
  '--gb-t': `${props.thickness}px`,
  '--gb-beam': `calc(${props.thickness}px * 2)`,
  '--gb-nav': `calc(${props.thickness}px * -1)`,
  '--gb-span': `calc(100% + ${props.thickness}px * 2)`,
  '--gb-c1': props.color,
  '--gb-c2': props.color2,
  '--gb-d': `${props.duration}s`,
  '--gb-glow': props.glow ? '1' : '0',
}))

const boxStyle = computed(() => ({
  background: props.background || 'transparent',
}))
</script>

<style scoped>
.gb {
  position: relative;
  width: var(--gb-size);
  height: var(--gb-size);
  border-radius: var(--gb-r);
  /* 呼吸光晕：强度由 --gb-glow 控制，关闭时不占位也不闪 */
  box-shadow: 0 0 calc(30px * var(--gb-glow)) color-mix(in srgb, var(--gb-c1) 30%, transparent);
}

/* 流光块：沿四条边跑一圈，长度按边拉伸成条状，拐角处收缩成方块 */
.gb::before {
  content: '';
  position: absolute;
  z-index: 1;
  left: var(--gb-nav);
  top: var(--gb-nav);
  width: var(--gb-beam);
  height: var(--gb-beam);
  border-radius: var(--gb-r);
  background: linear-gradient(135deg, var(--gb-c1) 0%, var(--gb-c2) 50%, var(--gb-c1) 100%);
  box-shadow:
    0 0 15px color-mix(in srgb, var(--gb-c1) 50%, transparent),
    0 0 30px color-mix(in srgb, var(--gb-c2) 30%, transparent);
  animation:
    gb-travel var(--gb-d) linear infinite,
    gb-pulse var(--gb-d) linear infinite alternate;
  pointer-events: none;
}

.gb__box {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  border: var(--gb-t) solid color-mix(in srgb, var(--gb-c1) 10%, transparent);
  border-radius: var(--gb-r);
  color: #e7f6ff;
  font-size: 14px;
  overflow: hidden;
}

@keyframes gb-travel {
  0% {
    left: var(--gb-nav);
    top: var(--gb-nav);
    width: var(--gb-beam);
    height: var(--gb-beam);
  }
  20% {
    left: var(--gb-nav);
    top: var(--gb-nav);
    width: var(--gb-span);
    height: var(--gb-beam);
  }
  40% {
    left: calc(100% - var(--gb-t));
    top: var(--gb-nav);
    width: var(--gb-beam);
    height: var(--gb-span);
  }
  60% {
    left: var(--gb-nav);
    top: calc(100% - var(--gb-t));
    width: var(--gb-span);
    height: var(--gb-beam);
  }
  80% {
    left: var(--gb-nav);
    top: var(--gb-nav);
    width: var(--gb-beam);
    height: var(--gb-span);
  }
  100% {
    left: var(--gb-nav);
    top: var(--gb-nav);
    width: var(--gb-beam);
    height: var(--gb-beam);
  }
}

@keyframes gb-pulse {
  from {
    box-shadow:
      0 0 10px color-mix(in srgb, var(--gb-c1) 40%, transparent),
      0 0 20px color-mix(in srgb, var(--gb-c2) 20%, transparent);
  }
  to {
    box-shadow:
      0 0 40px color-mix(in srgb, var(--gb-c1) 70%, transparent),
      0 0 80px color-mix(in srgb, var(--gb-c2) 45%, transparent);
  }
}

@media (prefers-reduced-motion: reduce) {
  .gb::before {
    animation: none;
  }
}
</style>

<template>
  <div
    class="lc"
    :class="{ 'is-active': isActive }"
    :style="rootStyle"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
  >
    <div class="lc__stage">
      <div class="lc__bg">
        <img v-if="reflection" class="lc__reflect" :src="image" alt="" aria-hidden="true" draggable="false" />
      </div>

      <!-- 给普通矩形照片补一层柔和投影，透明 PNG 则会叠加到轮廓阴影上 -->
      <div class="lc__shadow" aria-hidden="true" />

      <div class="lc__figure">
        <img class="lc__img" :src="image" :alt="alt" draggable="false" />
        <div v-if="title || subtitle" class="lc__caption">
          <p v-if="title" class="lc__title">{{ title }}</p>
          <p v-if="subtitle" class="lc__subtitle">{{ subtitle }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

/*
 * 由 video-code / 图片和 SVG/立体卡片展示/index.html 提取而来。
 *
 * 原 demo 是一张 600×600 的「立体展示卡」：鼠标移上去时，底层的蓝色底板先绕 X 轴仰起 35° 并抬高，
 * 前景照片顺着 translateZ 往观众方向弹出 120px、同时放大一点、往上挪；底板后面还会浮出一张
 * 模糊过的「倒影图」增加层次。整个过程是两条不同的缓动曲线，弹一下再落定。
 *
 * 组件化后：
 * - 尺寸、仰角、弹出距离、悬停抬高、圆角、底板渐变、倒影开关都能调；
 * - 纯 CSS 驱动（保留原 demo 的 hover 手感），另外给了 active 开关用来在属性面板 / 移动端强制展开；
 * - 可选标题 / 副标题压在图下方，不影响原本的 3D 关系。
 */
const props = defineProps({
  /**
   * @description 卡片图片地址
   */
  image: {
    type: String,
    default: '',
  },
  /**
   * @description 图片替代文字
   */
  alt: {
    type: String,
    default: '',
  },
  /**
   * @description 卡片宽度，单位 px
   */
  width: {
    type: Number,
    default: 420,
  },
  /**
   * @description 卡片高度，单位 px
   */
  height: {
    type: Number,
    default: 420,
  },
  /**
   * @description 图片缩放比例，以卡片图片中心为缩放原点
   */
  scale: {
    type: Number,
    default: 1,
  },
  /**
   * @description 悬停时底板仰起的角度（度）
   */
  tilt: {
    type: Number,
    default: 35,
  },
  /**
   * @description 悬停时照片往观众方向弹出的距离（px）
   */
  liftZ: {
    type: Number,
    default: 120,
  },
  /**
   * @description 悬停时整张卡向上抬起的距离（px）
   */
  hoverLift: {
    type: Number,
    default: 15,
  },
  /**
   * @description 圆角，单位 px
   */
  radius: {
    type: Number,
    default: 16,
  },
  /**
   * @description 底板渐变起始色
   */
  from: {
    type: String,
    default: '#4a6cf7',
  },
  /**
   * @description 底板渐变结束色
   */
  to: {
    type: String,
    default: '#3a5ae7',
  },
  /**
   * @description 是否显示底板后面那张模糊倒影
   */
  reflection: {
    type: Boolean,
    default: true,
  },
  /**
   * @description 图下方的标题，留空则不显示
   */
  title: {
    type: String,
    default: '',
  },
  /**
   * @description 图下方的副标题
   */
  subtitle: {
    type: String,
    default: '',
  },
  /**
   * @description 强制展开（不依赖 hover，移动端 / 属性面板里用）
   */
  active: {
    type: Boolean,
    default: false,
  },
})

const hovered = ref(false)

const isActive = computed(() => props.active || hovered.value)

const rootStyle = computed(() => ({
  '--lc-w': `${props.width}px`,
  '--lc-h': `${props.height}px`,
  '--lc-image-scale': `${Math.max(0.1, props.scale)}`,
  '--lc-tilt': `${props.tilt}deg`,
  '--lc-lift-z': `${props.liftZ}px`,
  '--lc-hover-lift': `${props.hoverLift}px`,
  '--lc-radius': `${props.radius}px`,
  '--lc-from': props.from,
  '--lc-to': props.to,
}))

defineExpose({
  /** 手动展开 / 收起 */
  setActive: (value: boolean) => {
    hovered.value = value
  },
})
</script>

<style scoped>
.lc {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  perspective: 1000px;
  perspective-origin: 50% 50%;
}

/* 3D 容器：整张卡在 hover 时往上抬 */
.lc__stage {
  position: relative;
  width: var(--lc-w);
  height: var(--lc-h);
  transform-style: preserve-3d;
  transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
  will-change: transform;
}

.lc.is-active .lc__stage {
  transform: translateY(calc(var(--lc-hover-lift) * -1));
}

/* 底板：仰起 + 抬高 + 阴影加深 */
.lc__bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: var(--lc-radius);
  background: linear-gradient(135deg, var(--lc-from) 0%, var(--lc-to) 100%);
  box-shadow: 0 15px 35px rgba(0, 0, 0, 0.15);
  transform-style: preserve-3d;
  transform: translateZ(0);
  transition:
    transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1),
    box-shadow 0.8s cubic-bezier(0.34, 1.56, 0.64, 1),
    filter 0.8s ease;
}

.lc.is-active .lc__bg {
  transform: rotateX(var(--lc-tilt)) translateZ(0) translateY(-30px);
  box-shadow: 0 40px 50px rgba(0, 0, 0, 0.25);
  filter: brightness(0.92);
}

/* 底板里那张模糊倒影：hover 时淡入 */
.lc__reflect {
  position: absolute;
  top: 8%;
  left: 22%;
  height: 75%;
  visibility: hidden;
  opacity: 0;
  filter: grayscale(100%) blur(15px);
  transform: skewX(328deg);
  transition:
    opacity 0.25s ease 0.2s,
    visibility 0.25s ease 0.2s;
  pointer-events: none;
}

.lc.is-active .lc__reflect {
  visibility: visible;
  opacity: 0.5;
}

/* 投影层：让不带透明通道的普通照片也有明确的离板距离 */
.lc__shadow {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 1;
  width: 82%;
  height: 64%;
  border-radius: calc(var(--lc-radius) * 0.8);
  background: rgba(8, 14, 30, 0.38);
  opacity: 0.22;
  filter: blur(18px);
  transform: translate(-50%, -42%) translateZ(18px) scale(0.94);
  transition:
    opacity 0.8s cubic-bezier(0.34, 1.56, 0.64, 1),
    transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1),
    filter 0.8s ease;
  pointer-events: none;
}

.lc.is-active .lc__shadow {
  opacity: 0.48;
  filter: blur(22px);
  transform: translate(-50%, -30%) translateZ(35px) scale(1.02);
}

/* 前景照片：往观众方向弹出来 */
.lc__figure {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 2;
  width: 90%;
  height: 75%;
  overflow: hidden;
  border-radius: calc(var(--lc-radius) * 0.75);
  transform: translate(-50%, -50%) translateZ(40px);
  transform-style: preserve-3d;
  transition: transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow: 0 18px 24px -16px rgba(5, 12, 28, 0.72);
  will-change: transform;
}

.lc.is-active .lc__figure {
  transform: translate(-50%, -65%) translateZ(var(--lc-lift-z)) scale(1.08);
  box-shadow: 0 34px 34px -18px rgba(5, 12, 28, 0.88);
}

.lc__img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scale(var(--lc-image-scale));
  transform-origin: center center;
  filter: drop-shadow(0 10px 10px rgba(5, 12, 28, 0.12));
  transition: transform 0.3s ease, filter 0.3s ease;
}

/* 图下方的标题 */
.lc__caption {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  padding: 26px 18px 14px;
  background: linear-gradient(transparent, rgba(8, 12, 24, 0.72));
  color: #fff;
  pointer-events: none;
}

.lc__title {
  margin: 0 0 2px;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.lc__subtitle {
  margin: 0;
  color: rgba(255, 255, 255, 0.72);
  font-size: 12px;
}

@media (prefers-reduced-motion: reduce) {
  .lc__stage,
  .lc__bg,
  .lc__figure {
    transition-duration: 0.01ms;
  }
}
</style>

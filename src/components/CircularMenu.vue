<template>
  <div
    class="cm"
    :class="[`cm--${variant}`, { 'is-open': open, 'is-flipped': flipped }]"
    :style="rootStyle"
  >
    <button
      type="button"
      class="cm__toggle"
      :aria-expanded="open"
      aria-haspopup="true"
      :aria-label="open ? '关闭菜单' : '打开菜单'"
      @click="open = !open"
    >
      {{ toggleLabel }}
    </button>

    <div class="cm__wheel">
      <ul class="cm__list">
        <li
          v-for="(item, index) in items"
          :key="`${item.label}-${index}`"
          class="cm__item"
          :style="itemStyle(index)"
        >
          <a
            class="cm__link"
            :class="{ 'is-active': item.active }"
            :href="item.href || '#'"
            @click="pick($event, item, index)"
          >
            <span class="cm__text">{{ item.label }}</span>
          </a>
        </li>
      </ul>
    </div>

    <div v-if="overlay" class="cm__overlay" :class="{ 'is-open': open }" @click="open = false" />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, type CSSProperties, type PropType } from 'vue'

/*
 * 由 _corner/底部菜单 的两个 jQuery demo 提取而来：
 * - wheel：原 demo1，展开半个圆环（扇形），可带遮罩
 * - fan：原 demo2，展开整个圆环，扇区依次散开
 *
 * 定位模型（本次重构的核心）：
 * 原实现把定位写死在形态里 —— wheel 是 position: fixed（只认视口），
 * fan 是 position: absolute（只认最近的定位祖先，组件自身不建定位上下文）。
 * 于是"组件在页面哪个位置"由宿主 DOM 的偶然结构决定，不能随页面滚动，也没法切 sticky。
 *
 * 现在 root 自己就是「按钮中心」这个锚点盒子：root 的 width/height 等于按钮尺寸，
 * 按钮居中、圆环盒子也以 root 中心为圆心（wheel 再裁掉下半圆，得到原来被视口裁掉的效果）。
 * 所以只要给 root 换 position / inset，整个菜单就跟着走：
 * - relative（默认）：留在文档流里，随页面滚动
 * - sticky：在滚动容器里吸顶/吸底
 * - fixed：贴视口（原 wheel 的行为）
 * - absolute：贴最近的定位祖先
 *
 * 扇区半径、字体级联都沿用原 demo 的 em 数值，角度由 items.length 均分，
 * 所以入口数量不再局限于原来的 5 个 / 7 个。
 */
type CircularMenuItem = {
  label: string
  href?: string
  active?: boolean
}

/**
 * props 用对象形式声明：vue3-leva-gen-schema 靠 props 上方的 /** @description *\/ 生成面板 schema，
 * 类型用 PropType 保留 TS 类型（defineProps<{...}>() 只能拿到描述、拿不到默认值）。
 */
const props = defineProps({
  /**
   * @description 菜单项，label 是文案，href 给了就走链接，active 是高亮态
   */
  items: {
    type: Array as PropType<CircularMenuItem[]>,
    required: true,
  },
  /**
   * @description 形态：wheel 是半圆扇环，fan 是整圆扇环
   */
  variant: {
    type: String as PropType<'wheel' | 'fan'>,
    default: 'wheel',
  },
  /**
   * @description 定位方式：relative 随文档流滚动，sticky 吸附，fixed 贴视口，absolute 贴定位祖先
   */
  position: {
    type: String as PropType<'relative' | 'absolute' | 'sticky' | 'fixed'>,
    default: 'relative',
  },
  /**
   * @description 锚点：非 relative 时按钮中心贴在哪条边，left/right 会在另一轴上居中
   */
  anchor: {
    type: String as PropType<
      | 'center'
      | 'top'
      | 'bottom'
      | 'left'
      | 'right'
      | 'top-left'
      | 'top-right'
      | 'bottom-left'
      | 'bottom-right'
    >,
    default: 'bottom',
  },
  /**
   * @description 距锚点边的距离，单位 px
   */
  offset: {
    type: Number,
    default: 0,
  },
  /**
   * @description 展开方向：up 向上展开，down 向下展开，auto 按锚点推断（贴顶时向下）
   */
  direction: {
    type: String as PropType<'up' | 'down' | 'auto'>,
    default: 'auto',
  },
  /**
   * @description 是否显示半透明遮罩（一般配 fixed/absolute 使用）
   */
  overlay: {
    type: Boolean,
    default: false,
  },
  /**
   * @description 展开时的按钮文案，不传则按形态用默认符号
   */
  openText: {
    type: String,
  },
  /**
   * @description 收起时的按钮文案，不传则按形态用默认符号
   */
  closeText: {
    type: String,
  },
})

const emit = defineEmits<{ select: [item: CircularMenuItem, index: number] }>()

const open = ref(false)

// 原 demo1 的 5 项落在 -10°~150°，原 demo2 的 7 项落在 -20°~172°
const GEOMETRY = {
  wheel: { center: 70, span: 160, skew: 50, rotate: -70 },
  fan: { center: 76, span: 192, skew: 60, rotate: -75 },
}

const geometry = computed(() => GEOMETRY[props.variant])

// auto：贴顶的锚点向下展开，其余向上（wheel 的扇形默认朝上）
const direction = computed<'up' | 'down'>(() => {
  if (props.direction !== 'auto') return props.direction
  return props.anchor.startsWith('top') ? 'down' : 'up'
})

// 只有半圆的 wheel 需要翻转；fan 是整圆，翻转没有意义
const flipped = computed(() => props.variant === 'wheel' && direction.value === 'down')

/**
 * 非 relative 时把 root 推到锚点边上：
 * - 单边锚点（top/bottom/left/right）在另一条轴上居中，用 auto 外边距实现，不引入 transform
 *   （root 上的 transform 会让它成为 fixed 后代（遮罩）的包含块，遮罩就盖不住整页了）
 * - sticky 只负责纵向吸附（默认吸顶，锚点是 bottom 时吸底），横向位置还给文档流，
 *   避免左右偏移把吸顶元素顶到边上；需要居中时给宿主元素加 margin-inline: auto 即可
 */
const anchorStyle = computed<CSSProperties>(() => {
  if (props.position === 'relative') return {}

  const gap = `${props.offset}px`

  if (props.position === 'sticky') {
    return props.anchor.startsWith('bottom') ? { bottom: gap } : { top: gap }
  }

  switch (props.anchor) {
    case 'top':
      return { top: gap, left: '0', right: '0', marginLeft: 'auto', marginRight: 'auto' }
    case 'bottom':
      return { bottom: gap, left: '0', right: '0', marginLeft: 'auto', marginRight: 'auto' }
    case 'left':
      return { left: gap, top: '0', bottom: '0', marginTop: 'auto', marginBottom: 'auto' }
    case 'right':
      return { right: gap, top: '0', bottom: '0', marginTop: 'auto', marginBottom: 'auto' }
    case 'top-left':
      return { top: gap, left: gap }
    case 'top-right':
      return { top: gap, right: gap }
    case 'bottom-left':
      return { bottom: gap, left: gap }
    case 'bottom-right':
      return { bottom: gap, right: gap }
    default:
      // center：宽高固定 + auto 外边距，在视口/定位祖先里双向居中
      return { inset: '0', margin: 'auto' }
  }
})

const rootStyle = computed<CSSProperties>(() => ({
  '--cm-skew': `${geometry.value.skew}deg`,
  '--cm-rot': `${geometry.value.rotate}deg`,
  position: props.position,
  ...anchorStyle.value,
}))

function itemStyle(index: number) {
  const { center, span, skew } = geometry.value
  const count = props.items.length
  const step = count > 1 ? span / (count - 1) : 0
  const start = center - span / 2
  // 收起时 fan 的所有扇区叠在正中间，展开后才散开（对应原 demo2 的 rotate(76deg)）
  // 翻转时角度顺序反向：圆环整体转了 180°，这样入口的左右顺序不变
  const angle =
    props.variant === 'fan' && !open.value
      ? center
      : flipped.value
        ? center + span / 2 - index * step
        : start + index * step

  return { transform: `rotate(${angle}deg) skew(${skew}deg)` }
}

const toggleLabel = computed(() => {
  const fallback = props.variant === 'fan' ? ['Menu', 'Close'] : ['+', '−']
  return open.value ? props.closeText ?? fallback[1] : props.openText ?? fallback[0]
})

function pick(event: MouseEvent, item: CircularMenuItem, index: number) {
  // 没给 href 时只抛事件，别让 href="#" 改掉宿主的 hash 路由
  if (!item.href) event.preventDefault()
  open.value = false
  emit('select', item, index)
}

// 原 demo 靠 document 点击关闭，这里只收 Esc，避免给宿主页面挂全局监听
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') open.value = false
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<style scoped>
/* ------------------------------------------------------------------ 基础 */

/*
 * root 就是「按钮中心」锚点：宽高等于按钮尺寸、字号固定 16px 基准，
 * 里面全部用 em 排版，所以宿主换字号、换布局都不会让几何走样。
 * 定位方式（relative / sticky / fixed / absolute）由 position prop 写在行内，
 * 这里只给默认值和层叠上下文：遮罩、扇环、按钮都在同一个 z-index 里排队。
 */
.cm {
  --cm-hub: 6.3em;

  position: relative;
  z-index: var(--cm-z-index, 41);
  display: grid;
  place-items: center;
  width: var(--cm-hub);
  height: var(--cm-hub);
  font-size: 16px;
  line-height: 1;
}

.cm,
.cm * {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* 圆环盒子：以 root 中心为圆心，与 root 的定位方式完全解耦 */
.cm__wheel {
  --cm-scale: 0.1;
  --cm-turn: 0deg;

  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 1;
  border-radius: 50%;
  overflow: hidden;
  /* transform-origin 在按钮中心：收/开都绕同一圆心缩放，向下展开时再整体转 180° */
  transform: rotate(var(--cm-turn)) scale(var(--cm-scale));
  transform-origin: 50% 50%;
  pointer-events: none;
}

.cm.is-open .cm__wheel {
  --cm-scale: 1;
  pointer-events: auto;
}

/* 按钮压在圆环之上，收起时是整个组件唯一可点的部分 */
.cm__toggle {
  position: relative;
  z-index: 2;
  border: 0;
  border-radius: 50%;
  background-color: #fff;
  font-family: inherit;
  display: grid;
  place-items: center;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

/*
 * ul 必须是定位元素：它高度为 0，扇区的 top: 50% 因此落在 0 上、再被 margin 顶上，
 * 圆心才是 li 的右下角。原 demo 靠全局 * { position: relative } 得到这个结果。
 */
.cm__list {
  position: relative;
}

.cm__item {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 10em;
  height: 10em;
  margin: -1.3em 0 0 -10em;
  font-size: 1.5em;
  transform-origin: 100% 100%;
  overflow: hidden;
}

.cm__link {
  position: absolute;
  right: -7.25em;
  bottom: -7.25em;
  display: block;
  width: 14.5em;
  height: 14.5em;
  border-radius: 50%;
  color: #fff;
  text-align: center;
  text-decoration: none;
  /* 文字跟着扇区转 */
  transform: skew(calc(var(--cm-skew) * -1)) rotate(var(--cm-rot));
  backface-visibility: hidden;
}

/* ------------------------------------------------------------------ wheel */

.cm--wheel {
  --cm-accent: #f06060;
  --cm-hub: 6.3em;
}

.cm--wheel .cm__wheel {
  width: 26em;
  height: 26em;
  margin: -13em 0 0 -13em;
  /* 只留上半圆：原来是被视口下边缘裁掉的，现在自己裁，离开视口也能保持同样的半环外形 */
  clip-path: inset(0 0 50% 0);
  transition: transform 0.3s ease;
}

.cm--wheel .cm__link {
  padding-top: 1.8em;
  font-size: 1.18em;
  background-color: hsla(0, 88%, 63%, 1);
  transition: background-color 0.3s ease;
}

.cm--wheel .cm__item:nth-child(even) .cm__link {
  background-color: hsla(0, 88%, 65%, 1);
}

.cm--wheel .cm__link:hover,
.cm--wheel .cm__link:focus,
.cm--wheel .cm__link:active,
.cm--wheel .cm__link.is-active {
  background-color: hsla(0, 88%, 70%, 1);
}

.cm--wheel .cm__text {
  /* inline-block 才吃 transform：向下展开时要把文字绕自身中心转回来 */
  display: inline-block;
  /* 扇区内只留一条紧凑的文字轨道，避免长标签压到相邻扇区 */
  max-width: 8em;
  overflow: hidden;
  font-size: 0.82em;
  line-height: 1.1;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.7;
}

.cm--wheel .cm__toggle {
  width: 3.5em;
  height: 3.5em;
  padding: 0;
  color: var(--cm-accent);
  font-size: 1.8em;
  text-align: center;
}

/*
 * 向下展开：圆环盒子整体转 180°（底部按钮的环形菜单朝下打开）。
 * clip-path 作用在元素自身坐标系、跟着 transform 一起转，
 * 所以裁剪规则不用改：本地留下的上半圆转完正好落在按钮下方。
 * 文字跟着转了 180°，绕自身中心转回来即可，位置仍留在扇区外沿。
 */
.cm--wheel.is-flipped .cm__wheel {
  --cm-turn: 180deg;
}

.cm--wheel.is-flipped .cm__text {
  transform: rotate(180deg);
}

/* -------------------------------------------------------------------- fan */

.cm--fan {
  --cm-accent: #52be7f;
  --cm-hub: 6.75em;
}

.cm--fan .cm__wheel {
  width: 27em;
  height: 27em;
  margin: -13.5em 0 0 -13.5em;
  opacity: 0;
  transition: all 0.3s ease 0.3s;
}

.cm--fan.is-open .cm__wheel {
  opacity: 1;
  transition: all 0.3s ease;
}

/* 盖住中间的空白，避免点到扇区多出来的部分 */
.cm--fan .cm__wheel::after {
  content: "";
  position: absolute;
  z-index: 10;
  left: 50%;
  top: 50%;
  width: 6.2em;
  height: 6.2em;
  margin: -3.1em 0 0 -3.1em;
  border-radius: 50%;
  font-size: 2em;
}

.cm--fan .cm__item {
  transition: transform 0.3s ease;
}

.cm--fan.is-open .cm__item {
  transition: transform 0.3s ease 0.3s;
}

.cm--fan .cm__link {
  font-size: 1.2em;
  line-height: 2;
  background: radial-gradient(transparent 35%, #429a67 35%);
  pointer-events: auto;
}

.cm--fan .cm__link:hover,
.cm--fan .cm__link:focus,
.cm--fan .cm__link:active {
  background: radial-gradient(transparent 35%, #449e6a 35%);
}

.cm--fan .cm__text {
  position: relative;
  top: 1.3em;
  display: block;
  max-height: 4.5em;
  overflow: hidden;
  font-size: 0.32em;
  writing-mode: vertical-rl;
  text-orientation: mixed;
  line-height: 1;
  font-weight: 700;
  text-transform: uppercase;
  white-space: nowrap;
}

.cm--fan .cm__toggle {
  width: 4.5em;
  height: 4.5em;
  color: var(--cm-accent);
  font-size: 1.5em;
  font-weight: 700;
  text-align: center;
  text-transform: uppercase;
}

/* ---------------------------------------------------------------- overlay */

/* 遮罩压在页面内容之上、环形菜单之下，开启时整页变暗（含宿主导航栏） */
.cm__overlay {
  position: fixed;
  z-index: 0;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.6);
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.3s ease, visibility 0.3s ease;
}

.cm__overlay.is-open {
  opacity: 1;
  visibility: visible;
}

@media screen and (max-width: 480px) {
  .cm {
    font-size: 11px;
  }
}

/* 尊重系统的减少动效偏好：只保留状态切换，不做位移/缩放动画 */
@media (prefers-reduced-motion: reduce) {
  .cm__wheel,
  .cm__item,
  .cm__link,
  .cm__overlay {
    transition-duration: 0.01ms !important;
    transition-delay: 0s !important;
  }
}
</style>

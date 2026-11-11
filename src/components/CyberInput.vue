<template>
  <div class="cy" :style="rootStyle">
    <div class="cy__head">
      <span class="cy__label">{{ label }}</span>
      <span class="cy__status">
        <i class="cy__dot" aria-hidden="true" />
        <span>{{ statusText }}</span>
        <span class="cy__ver">{{ version }}</span>
      </span>
    </div>

    <div
      ref="wrapperEl"
      class="cy__wrapper"
      :class="{ 'is-focused': focused, 'is-bursting': bursting }"
      :style="wrapperStyle"
    >
      <i class="cy__corner cy__corner--tl" aria-hidden="true" />
      <i class="cy__corner cy__corner--tr" aria-hidden="true" />
      <i class="cy__corner cy__corner--bl" aria-hidden="true" />
      <i class="cy__corner cy__corner--br" aria-hidden="true" />

      <input
        ref="inputEl"
        class="cy__input"
        type="text"
        :value="text"
        :placeholder="placeholder"
        :disabled="disabled"
        autocomplete="off"
        spellcheck="false"
        @input="onInput"
        @focus="onFocus"
        @blur="onBlur"
        @keydown.enter="onEnter"
      />

      <span class="cy__scanline" aria-hidden="true" />
      <span class="cy__clone cy__clone--red" aria-hidden="true" />
      <span class="cy__clone cy__clone--blue" aria-hidden="true" />

      <span class="cy__bar cy__bar--pink" aria-hidden="true" />
      <span class="cy__bar cy__bar--cyan" aria-hidden="true" />

      <span
        v-for="fragment in fragments"
        :key="fragment.id"
        class="cy__fragment"
        :class="`cy__fragment--${fragment.tone}`"
        :style="fragment.style"
        aria-hidden="true"
        @animationend="removeFragment(fragment.id)"
      >
        {{ fragment.text }}
      </span>

      <span v-if="flashing" class="cy__flash" aria-hidden="true" />
    </div>

    <div class="cy__foot">
      <span class="cy__enc">{{ footerLeft }}</span>
      <span class="cy__count" :class="{ 'is-active': text.length > 0 }">{{ charCount }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

/*
 * 由 video-code / UI组件/输入框/赛博朋克故障输入框.html 提取而来（原文件 1095 行）。
 *
 * 原 demo 的一半代码在画「整页背景」：全屏矩阵雨 canvas、全局扫描线、全屏闪光层。
 * 那些是页面效果，组件化后不再打包进来，只保留输入框本身的那套故障语言：
 * - 空闲时随机小幅抖动（微故障），聚焦时抖动更大并带 skew，打字时整块瞬时错位（burst）；
 * - 打字 / 回车时飞出随机十六进制数据碎片，碎片用 Vue 列表渲染 + animationend 回收；
 * - 聚焦后出现扫描线、红/蓝通道色差克隆层、两条随机闪烁的故障条纹；
 * - 右下角把字符数显示成十六进制（0x0A 这种）。
 *
 * 组件根节点是透明背景，宿主放在深色页面上即可；边框、文字的霓虹色都可以换。
 */
type Fragment = {
  id: number
  text: string
  tone: 'pink' | 'cyan' | 'yellow'
  style: Record<string, string>
}

const props = defineProps({
  /**
   * @description 终端风格标签文案
   */
  label: {
    type: String,
    default: 'NEURAL_LINK',
  },
  /**
   * @description 输入值，配合 v-model 使用
   */
  modelValue: {
    type: String,
    default: '',
  },
  /**
   * @description 占位文字
   */
  placeholder: {
    type: String,
    default: 'ENTER_COMMAND...',
  },
  /**
   * @description 状态行文案
   */
  statusText: {
    type: String,
    default: 'SYS.ONLINE',
  },
  /**
   * @description 状态行右侧的版本号
   */
  version: {
    type: String,
    default: 'v2.077',
  },
  /**
   * @description 底部左侧的说明文案
   */
  footerLeft: {
    type: String,
    default: 'AES-256 ENCRYPTED',
  },
  /**
   * @description 霓虹粉色（故障主色）
   */
  pink: {
    type: String,
    default: '#ff2a6d',
  },
  /**
   * @description 霓虹青色（扫描线、次要色）
   */
  cyan: {
    type: String,
    default: '#05d9e8',
  },
  /**
   * @description 是否启用故障抖动（关掉就是普通的霓虹输入框）
   */
  glitch: {
    type: Boolean,
    default: true,
  },
  /**
   * @description 是否在打字 / 回车时飞出数据碎片
   */
  fragment: {
    type: Boolean,
    default: true,
  },
  /**
   * @description 是否保留故障时的闪光
   */
  flash: {
    type: Boolean,
    default: true,
  },
  /**
   * @description 是否禁用
   */
  disabled: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  enter: [value: string]
  focus: [event: FocusEvent]
  blur: [event: FocusEvent]
}>()

const wrapperEl = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLInputElement | null>(null)
const text = ref(props.modelValue)
const focused = ref(false)
const bursting = ref(false)
const flashing = ref(false)
const offset = ref({ x: 0, y: 0, skew: 0 })
const fragments = ref<Fragment[]>([])

let fragmentSeed = 0
let resetTimer: ReturnType<typeof setTimeout> | null = null
let burstTimer: ReturnType<typeof setTimeout> | null = null
let flashTimer: ReturnType<typeof setTimeout> | null = null
let idleTimer: ReturnType<typeof setInterval> | null = null
let focusTimer: ReturnType<typeof setInterval> | null = null

const rootStyle = computed(() => ({
  '--cy-pink': props.pink,
  '--cy-cyan': props.cyan,
}))

const wrapperStyle = computed(() => ({
  transform: `translate(${offset.value.x.toFixed(2)}px, ${offset.value.y.toFixed(
    2,
  )}px) skewX(${offset.value.skew.toFixed(2)}deg)`,
}))

/** 字符数显示成十六进制，和原 demo 的终端味道一致 */
const charCount = computed(() => `0x${text.value.length.toString(16).toUpperCase().padStart(2, '0')}`)

watch(
  () => props.modelValue,
  (value) => {
    if (value !== text.value) text.value = value
  },
)

const HEX = '0123456789ABCDEF'
const reducedMotion =
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false

function randomHex(length: number) {
  let out = ''
  for (let i = 0; i < length; i += 1) out += HEX[Math.floor(Math.random() * HEX.length)]
  return out
}

function randomRange(min: number, max: number) {
  return Math.random() * (max - min) + min
}

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)]
}

function spawnFragment() {
  const host = wrapperEl.value
  if (!host) return

  const tones: Fragment['tone'][] = ['pink', 'cyan', 'yellow']
  const width = host.clientWidth || 320
  const height = host.clientHeight || 52
  const side = Math.random() > 0.5 ? 1 : -1
  const startX = width / 2 + side * randomRange(20, width / 2 + 30)
  const startY = randomRange(-20, height + 20)

  fragments.value.push({
    id: (fragmentSeed += 1),
    text: pick([
      `0x${randomHex(4)}`,
      `${randomHex(2)}:${randomHex(2)}`,
      `[${randomHex(3)}]`,
      `#${randomHex(6)}`,
      `ERR_${randomHex(2)}`,
      randomHex(8),
    ]),
    tone: pick(tones),
    style: {
      left: `${startX}px`,
      top: `${startY}px`,
      '--cy-fx': `${side * randomRange(10, 50)}px`,
      '--cy-fy': `${randomRange(-30, 30)}px`,
    },
  })
}

function burstFragments(count: number) {
  if (!props.fragment) return
  for (let i = 0; i < count; i += 1) setTimeout(spawnFragment, i * 40)
}

function removeFragment(id: number) {
  fragments.value = fragments.value.filter((item) => item.id !== id)
}

function resetOffsetLater(delay: number) {
  if (resetTimer) clearTimeout(resetTimer)
  resetTimer = setTimeout(() => {
    offset.value = { x: 0, y: 0, skew: 0 }
  }, delay)
}

function microGlitch() {
  offset.value = { x: randomRange(-2, 2), y: randomRange(-1, 1), skew: 0 }
  resetOffsetLater(50 + Math.random() * 80)
}

function heavyGlitch() {
  offset.value = { x: randomRange(-5, 5), y: randomRange(-2, 2), skew: randomRange(-0.5, 0.5) }
  if (Math.random() > 0.4) spawnFragment()
  resetOffsetLater(60 + Math.random() * 100)
}

function triggerFlash() {
  if (!props.flash) return
  flashing.value = true
  if (flashTimer) clearTimeout(flashTimer)
  flashTimer = setTimeout(() => {
    flashing.value = false
  }, 120)
}

function typingGlitch() {
  if (!props.glitch) return
  bursting.value = true
  if (burstTimer) clearTimeout(burstTimer)
  burstTimer = setTimeout(() => {
    bursting.value = false
  }, 160)
  burstFragments(1 + Math.floor(randomRange(0, 3)))
  if (Math.random() > 0.75) triggerFlash()
}

function startIdle() {
  if (idleTimer || reducedMotion || !props.glitch) return
  idleTimer = setInterval(() => {
    if (Math.random() > 0.6) microGlitch()
    if (Math.random() > 0.85 && props.fragment) spawnFragment()
  }, 2000)
}

function stopIdle() {
  if (idleTimer) {
    clearInterval(idleTimer)
    idleTimer = null
  }
}

function startFocusGlitch() {
  if (focusTimer || reducedMotion || !props.glitch) return
  focusTimer = setInterval(() => {
    if (Math.random() > 0.3) heavyGlitch()
  }, 300 + Math.random() * 400)
}

function stopFocusGlitch() {
  if (focusTimer) {
    clearInterval(focusTimer)
    focusTimer = null
  }
}

function onInput(event: Event) {
  text.value = (event.target as HTMLInputElement).value
  emit('update:modelValue', text.value)
  typingGlitch()
}

function onFocus(event: FocusEvent) {
  focused.value = true
  startFocusGlitch()
  triggerFlash()
  burstFragments(3)
  emit('focus', event)
}

function onBlur(event: FocusEvent) {
  focused.value = false
  stopFocusGlitch()
  offset.value = { x: 0, y: 0, skew: 0 }
  emit('blur', event)
}

function onEnter() {
  triggerFlash()
  burstFragments(6)
  if (props.glitch) {
    for (let i = 0; i < 3; i += 1) setTimeout(heavyGlitch, i * 80)
  }
  emit('enter', text.value)
}

onMounted(() => {
  startIdle()
  // 切到后台时停掉定时器，别让空闲故障一直空转
  document.addEventListener('visibilitychange', onVisibilityChange)
})

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibilityChange)
  ;[resetTimer, burstTimer, flashTimer].forEach((timer) => timer && clearTimeout(timer))
  stopIdle()
  stopFocusGlitch()
})

function onVisibilityChange() {
  if (document.hidden) {
    stopIdle()
    stopFocusGlitch()
  } else {
    startIdle()
    if (focused.value) startFocusGlitch()
  }
}

defineExpose({ focus: () => inputEl.value?.focus(), burst: () => burstFragments(4) })
</script>

<style scoped>
.cy {
  --cy-text: #e0e0e0;
  --cy-dim: #4a4a5a;
  --cy-panel: #0a0a12;

  width: 100%;
  color: var(--cy-text);
  font-family: 'Courier New', Consolas, monospace;
}

.cy__head {
  margin-bottom: 16px;
}

/* 终端风格标签：`>>` 前缀 + `//` 后缀，带轻微闪烁 */
.cy__label {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--cy-cyan);
  font-size: 13px;
  letter-spacing: 3px;
  text-transform: uppercase;
  text-shadow:
    0 0 5px var(--cy-cyan),
    0 0 15px color-mix(in srgb, var(--cy-cyan) 30%, transparent);
  animation: cy-flicker 4s infinite;
}

.cy__label::before {
  content: '>>';
  color: var(--cy-pink);
  text-shadow: 0 0 5px var(--cy-pink);
}

.cy__label::after {
  content: '//';
  margin-left: auto;
  color: var(--cy-dim);
}

.cy__status {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  color: var(--cy-dim);
  font-size: 10px;
  letter-spacing: 2px;
}

.cy__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--cy-cyan);
  box-shadow: 0 0 6px var(--cy-cyan);
  animation: cy-dot 2s ease-in-out infinite;
}

.cy__ver {
  margin-left: auto;
  opacity: 0.7;
}

.cy__wrapper {
  position: relative;
  transition: transform 0.05s linear;
}

/* 上下两条扫过的装饰线 */
.cy__wrapper::before,
.cy__wrapper::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  opacity: 0.6;
  animation: cy-sweep 3s linear infinite;
}

.cy__wrapper::before {
  top: -2px;
  background: linear-gradient(90deg, transparent, var(--cy-pink), var(--cy-cyan), transparent);
}

.cy__wrapper::after {
  bottom: -2px;
  background: linear-gradient(90deg, transparent, var(--cy-cyan), var(--cy-pink), transparent);
  animation-direction: reverse;
}

.cy__input {
  position: relative;
  z-index: 1;
  width: 100%;
  box-sizing: border-box;
  padding: 16px 20px;
  border: 1px solid color-mix(in srgb, var(--cy-cyan) 20%, transparent);
  background: var(--cy-panel);
  color: var(--cy-text);
  font-family: inherit;
  font-size: 16px;
  letter-spacing: 1.5px;
  caret-color: var(--cy-pink);
  outline: none;
  transition:
    border-color 0.3s ease,
    box-shadow 0.3s ease;
  animation: cy-breath 4s ease-in-out infinite;
}

.cy__input::placeholder {
  color: var(--cy-dim);
  font-size: 13px;
  letter-spacing: 2px;
}

.cy__input:focus {
  border-color: var(--cy-pink);
  animation: cy-focus-breath 1.5s ease-in-out infinite;
}

.cy__input:disabled {
  color: var(--cy-dim);
  cursor: not-allowed;
  animation: none;
}

/* 扫描线：聚焦才出现 */
.cy__scanline {
  position: absolute;
  z-index: 2;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 1px,
    color-mix(in srgb, var(--cy-cyan) 3%, transparent) 1px,
    color-mix(in srgb, var(--cy-cyan) 3%, transparent) 2px
  );
  opacity: 0;
  mix-blend-mode: screen;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.cy__input:focus ~ .cy__scanline {
  opacity: 1;
  animation: cy-scanline 8s linear infinite;
}

/* 红/蓝通道克隆层：聚焦后随机错位闪一下 */
.cy__clone {
  position: absolute;
  z-index: 3;
  inset: 0;
  overflow: hidden;
  opacity: 0;
  mix-blend-mode: screen;
  pointer-events: none;
}

.cy__clone::before {
  content: '';
  position: absolute;
  inset: 0;
  border: 1px solid;
}

.cy__clone--red::before {
  left: 2px;
  border-color: color-mix(in srgb, var(--cy-pink) 40%, transparent);
}

.cy__clone--blue::before {
  left: -2px;
  border-color: color-mix(in srgb, var(--cy-cyan) 40%, transparent);
}

.cy__wrapper.is-focused .cy__clone--red {
  animation: cy-glitch-red 0.3s step-end infinite;
}

.cy__wrapper.is-focused .cy__clone--blue {
  animation: cy-glitch-blue 0.3s step-end infinite;
}

/* 随机故障条纹 */
.cy__bar {
  position: absolute;
  z-index: 4;
  left: 0;
  width: 100%;
  opacity: 0;
  pointer-events: none;
}

.cy__bar--pink {
  top: 30%;
  height: 2px;
  background: var(--cy-pink);
}

.cy__bar--cyan {
  top: 70%;
  height: 1px;
  background: var(--cy-cyan);
  animation-delay: 1.5s;
}

.cy__wrapper.is-focused .cy__bar {
  animation: cy-bar 4s step-end infinite;
}

/* 角落装饰 */
.cy__corner {
  position: absolute;
  width: 8px;
  height: 8px;
  border-color: var(--cy-cyan);
  opacity: 0.4;
  transition:
    opacity 0.3s ease,
    border-color 0.3s ease;
  pointer-events: none;
}

.cy__corner--tl {
  top: -1px;
  left: -1px;
  border-top: 1px solid;
  border-left: 1px solid;
}

.cy__corner--tr {
  top: -1px;
  right: -1px;
  border-top: 1px solid;
  border-right: 1px solid;
}

.cy__corner--bl {
  bottom: -1px;
  left: -1px;
  border-bottom: 1px solid;
  border-left: 1px solid;
}

.cy__corner--br {
  bottom: -1px;
  right: -1px;
  border-bottom: 1px solid;
  border-right: 1px solid;
}

.cy__wrapper.is-focused .cy__corner {
  border-color: var(--cy-pink);
  animation: cy-corner 1.5s ease-in-out infinite;
}

/* 打字时的整块错位 */
.cy__wrapper.is-bursting {
  animation: cy-burst 0.15s steps(2) forwards;
}

/* 数据碎片 */
.cy__fragment {
  position: absolute;
  z-index: 20;
  padding: 2px 5px;
  border: 1px solid;
  font-family: inherit;
  font-size: 9px;
  letter-spacing: 1px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  animation: cy-fragment 1.2s ease-out forwards;
}

.cy__fragment--pink {
  border-color: color-mix(in srgb, var(--cy-pink) 30%, transparent);
  background: color-mix(in srgb, var(--cy-pink) 5%, transparent);
  color: var(--cy-pink);
  text-shadow: 0 0 4px var(--cy-pink);
}

.cy__fragment--cyan {
  border-color: color-mix(in srgb, var(--cy-cyan) 30%, transparent);
  background: color-mix(in srgb, var(--cy-cyan) 5%, transparent);
  color: var(--cy-cyan);
  text-shadow: 0 0 4px var(--cy-cyan);
}

.cy__fragment--yellow {
  border-color: rgba(245, 245, 32, 0.3);
  background: rgba(245, 245, 32, 0.05);
  color: #f5f520;
  text-shadow: 0 0 4px #f5f520;
}

/* 局部闪光（原 demo 是全屏闪光，组件里收敛到输入框这一块） */
.cy__flash {
  position: absolute;
  z-index: 21;
  inset: -6px;
  background: var(--cy-cyan);
  mix-blend-mode: overlay;
  opacity: 0;
  pointer-events: none;
  animation: cy-flash 0.12s ease-out forwards;
}

.cy__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
  color: var(--cy-dim);
  font-size: 9px;
  letter-spacing: 2px;
}

.cy__enc {
  color: var(--cy-pink);
  opacity: 0.5;
}

.cy__count {
  color: var(--cy-cyan);
  opacity: 0.6;
  transition: opacity 0.3s ease;
}

.cy__count.is-active {
  opacity: 1;
  text-shadow: 0 0 5px color-mix(in srgb, var(--cy-cyan) 30%, transparent);
}

@keyframes cy-flicker {
  0%,
  92%,
  94%,
  97%,
  100% {
    opacity: 1;
  }
  93% {
    opacity: 0.3;
  }
  96% {
    opacity: 0.5;
  }
}

@keyframes cy-dot {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.4;
    transform: scale(0.7);
  }
}

@keyframes cy-sweep {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

@keyframes cy-breath {
  0%,
  100% {
    box-shadow:
      0 0 5px color-mix(in srgb, var(--cy-cyan) 10%, transparent),
      0 0 15px color-mix(in srgb, var(--cy-cyan) 5%, transparent),
      inset 0 0 10px color-mix(in srgb, var(--cy-cyan) 2%, transparent);
  }
  50% {
    box-shadow:
      0 0 8px color-mix(in srgb, var(--cy-cyan) 20%, transparent),
      0 0 25px color-mix(in srgb, var(--cy-cyan) 10%, transparent),
      inset 0 0 15px color-mix(in srgb, var(--cy-cyan) 3%, transparent);
  }
}

@keyframes cy-focus-breath {
  0%,
  100% {
    box-shadow:
      0 0 5px color-mix(in srgb, var(--cy-pink) 30%, transparent),
      0 0 20px color-mix(in srgb, var(--cy-pink) 15%, transparent),
      0 0 40px color-mix(in srgb, var(--cy-pink) 5%, transparent),
      0 0 10px color-mix(in srgb, var(--cy-cyan) 15%, transparent),
      inset 0 0 15px color-mix(in srgb, var(--cy-pink) 3%, transparent);
  }
  50% {
    box-shadow:
      0 0 10px color-mix(in srgb, var(--cy-pink) 50%, transparent),
      0 0 30px color-mix(in srgb, var(--cy-pink) 25%, transparent),
      0 0 60px color-mix(in srgb, var(--cy-pink) 10%, transparent),
      0 0 15px color-mix(in srgb, var(--cy-cyan) 25%, transparent),
      inset 0 0 20px color-mix(in srgb, var(--cy-pink) 5%, transparent);
  }
}

@keyframes cy-scanline {
  0% {
    background-position: 0 0;
  }
  100% {
    background-position: 0 200px;
  }
}

@keyframes cy-glitch-red {
  0%,
  20%,
  60%,
  100% {
    opacity: 0;
    transform: translate(0, 0);
  }
  10% {
    opacity: 0.6;
    transform: translate(2px, -1px);
    clip-path: inset(20% 0 60% 0);
  }
  50% {
    opacity: 0.4;
    transform: translate(-1px, 1px);
    clip-path: inset(50% 0 20% 0);
  }
  80% {
    opacity: 0.5;
    transform: translate(3px, 0);
    clip-path: inset(10% 0 70% 0);
  }
}

@keyframes cy-glitch-blue {
  0%,
  25%,
  65%,
  100% {
    opacity: 0;
    transform: translate(0, 0);
  }
  15% {
    opacity: 0.5;
    transform: translate(-2px, 1px);
    clip-path: inset(40% 0 30% 0);
  }
  55% {
    opacity: 0.4;
    transform: translate(1px, -1px);
    clip-path: inset(60% 0 10% 0);
  }
  85% {
    opacity: 0.5;
    transform: translate(-3px, 0);
    clip-path: inset(30% 0 50% 0);
  }
}

@keyframes cy-bar {
  0%,
  100%,
  6%,
  45%,
  48% {
    opacity: 0;
    transform: scaleX(1);
  }
  5% {
    opacity: 0.6;
    transform: scaleX(0.8);
    clip-path: inset(0 20% 0 10%);
  }
  46% {
    opacity: 0.4;
    transform: scaleX(1.1);
    clip-path: inset(0 5% 0 30%);
  }
}

@keyframes cy-corner {
  0%,
  100% {
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
}

@keyframes cy-burst {
  0% {
    transform: translate(0, 0);
    filter: none;
  }
  25% {
    transform: translate(-3px, 1px);
    filter: hue-rotate(30deg);
  }
  50% {
    transform: translate(2px, -1px);
    filter: hue-rotate(-20deg) brightness(1.2);
  }
  75% {
    transform: translate(-1px, -2px);
    filter: hue-rotate(10deg);
  }
  100% {
    transform: translate(0, 0);
    filter: none;
  }
}

@keyframes cy-fragment {
  0% {
    opacity: 0;
    transform: translate(0, 0) scale(0.5);
  }
  15% {
    opacity: 0.9;
    transform: translate(var(--cy-fx), var(--cy-fy)) scale(1);
  }
  70% {
    opacity: 0.6;
  }
  100% {
    opacity: 0;
    transform: translate(calc(var(--cy-fx) * 2.5), calc(var(--cy-fy) * 2.5)) scale(0.3);
  }
}

@keyframes cy-flash {
  0% {
    opacity: 0.15;
  }
  100% {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cy__label,
  .cy__dot,
  .cy__input,
  .cy__wrapper::before,
  .cy__wrapper::after,
  .cy__wrapper.is-focused .cy__bar,
  .cy__wrapper.is-focused .cy__corner,
  .cy__wrapper.is-focused .cy__clone--red,
  .cy__wrapper.is-focused .cy__clone--blue {
    animation: none;
  }
}
</style>

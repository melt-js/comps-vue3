<template>
  <div
    class="sa"
    :class="{ 'is-signup': isSignup, 'is-busy': busy }"
    :style="rootStyle"
    @keydown.enter="onEnter"
  >
    <!-- 移动端顶部 Tab（窄屏才显示） -->
    <div class="sa__tabs" role="tablist">
      <button
        type="button"
        class="sa__tab"
        role="tab"
        :aria-selected="!isSignup"
        @click="setMode('signin')"
      >
        {{ signInAction }}
      </button>
      <button
        type="button"
        class="sa__tab"
        role="tab"
        :aria-selected="isSignup"
        @click="setMode('signup')"
      >
        {{ signUpAction }}
      </button>
    </div>

    <!-- 表单面板：登录 / 注册 -->
    <section class="sa__panel sa__panel--form">
      <div v-show="contentMode === 'signin'" class="sa__form">
        <h2 class="sa__title">{{ signInTitle }}</h2>

        <div v-if="social" class="sa__social">
          <button
            v-for="provider in SOCIALS"
            :key="provider.key"
            type="button"
            class="sa__social-btn"
            :class="{ 'is-active': provider.key === 'card' }"
            :title="provider.label"
            :aria-label="provider.label"
            @click="emit('social', provider.key)"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path v-for="(path, index) in provider.paths" :key="index" :d="path" />
              <rect
                v-if="provider.rect"
                :x="provider.rect.x"
                :y="provider.rect.y"
                :width="provider.rect.w"
                :height="provider.rect.h"
                :rx="provider.rect.r"
              />
            </svg>
          </button>
        </div>
        <p v-if="social" class="sa__hint">选择登录方式 或 电子邮箱登录</p>

        <div class="sa__field">
          <input
            v-model="signIn.username"
            type="text"
            :placeholder="usernamePlaceholder"
            autocomplete="username"
          />
        </div>
        <div class="sa__field">
          <input
            v-model="signIn.password"
            type="password"
            :placeholder="passwordPlaceholder"
            autocomplete="current-password"
          />
        </div>

        <button v-if="forgot" type="button" class="sa__forgot" @click="emit('forgot')">
          {{ forgotText }}
        </button>

        <button type="button" class="sa__submit" @click="submit('signin')">
          {{ signInAction }}
        </button>
      </div>

      <div v-show="contentMode === 'signup'" class="sa__form">
        <h2 class="sa__title">{{ signUpTitle }}</h2>

        <div v-if="social" class="sa__social">
          <button
            v-for="provider in SOCIALS"
            :key="provider.key"
            type="button"
            class="sa__social-btn"
            :title="provider.label"
            :aria-label="provider.label"
            @click="emit('social', provider.key)"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path v-for="(path, index) in provider.paths" :key="index" :d="path" />
              <rect
                v-if="provider.rect"
                :x="provider.rect.x"
                :y="provider.rect.y"
                :width="provider.rect.w"
                :height="provider.rect.h"
                :rx="provider.rect.r"
              />
            </svg>
          </button>
        </div>
        <p v-if="social" class="sa__hint">选择注册方式 或 电子邮箱注册</p>

        <div class="sa__field">
          <input
            v-model="signUp.username"
            type="text"
            :placeholder="usernamePlaceholder"
            autocomplete="username"
          />
        </div>
        <div class="sa__field">
          <input v-model="signUp.email" type="email" placeholder="Email" autocomplete="email" />
        </div>
        <div class="sa__field">
          <input
            v-model="signUp.password"
            type="password"
            :placeholder="passwordPlaceholder"
            autocomplete="new-password"
          />
        </div>

        <button type="button" class="sa__submit" @click="submit('signup')">
          {{ signUpAction }}
        </button>
      </div>
    </section>

    <!-- 覆盖层：Hello / Welcome -->
    <section class="sa__panel sa__panel--overlay">
      <span class="sa__deco sa__deco--tr" aria-hidden="true" />
      <span class="sa__deco sa__deco--bl" aria-hidden="true" />

      <div v-show="contentMode === 'signin'" class="sa__promo">
        <h2 class="sa__promo-title">{{ helloTitle }}</h2>
        <p class="sa__promo-text">{{ helloText }}</p>
        <button type="button" class="sa__submit" @click="setMode('signup')">
          {{ signUpAction }}
        </button>
      </div>

      <div v-show="contentMode === 'signup'" class="sa__promo">
        <h2 class="sa__promo-title">{{ welcomeTitle }}</h2>
        <p class="sa__promo-text">{{ welcomeText }}</p>
        <button type="button" class="sa__submit" @click="setMode('signin')">
          {{ signInAction }}
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'

/*
 * 由 video-code / UI组件/登录面板/拟态滑动登录注册页面.html 提取而来。
 *
 * 原 demo 是一整页 880×560 的拟态（neumorphism）登录/注册卡片：登录时表单占左边 60%、右侧是
 * 「Hello Friend」引导，切到注册时两块面板左右互换位置，分割线跟着滑动，表单内容的切换发生在
 * 动画中点（避免内容在半路被看见）。
 *
 * 组件化后：
 * - 卡片宽度自适应宿主（max-width 880）、高度由 height 决定，窄屏自动降级成「顶部 Tab + 单表单」；
 * - 模式由 mode 控制（配合 v-model:mode），内容交换仍保持原来的「半程切换」节奏，duration 可调；
 * - 主色、两套标题/文案、社交按钮与「忘记密码」开关都是 props，表单值收集后通过 submit 事件抛出。
 */
type Mode = 'signin' | 'signup'

const props = defineProps({
  /**
   * @description 当前模式：signin 登录 / signup 注册，可用 v-model:mode 双向绑定
   */
  mode: {
    type: String as () => Mode,
    default: 'signin',
  },
  /**
   * @description 主色（按钮、聚焦描边、链接 hover）
   */
  accent: {
    type: String,
    default: '#5b7af7',
  },
  /**
   * @description 卡片高度，单位 px
   */
  height: {
    type: Number,
    default: 480,
  },
  /**
   * @description 登录 / 注册切换动画的时长，单位毫秒
   */
  duration: {
    type: Number,
    default: 720,
  },
  /**
   * @description 登录表单标题
   */
  signInTitle: {
    type: String,
    default: '登 入 账 号',
  },
  /**
   * @description 注册表单标题
   */
  signUpTitle: {
    type: String,
    default: '创 建 账 号',
  },
  /**
   * @description 登录按钮文案
   */
  signInAction: {
    type: String,
    default: 'SIGN IN',
  },
  /**
   * @description 注册按钮文案
   */
  signUpAction: {
    type: String,
    default: 'SIGN UP',
  },
  /**
   * @description 覆盖层（登录态）的大标题
   */
  helloTitle: {
    type: String,
    default: 'Hello Friend！',
  },
  /**
   * @description 覆盖层（登录态）的说明文字
   */
  helloText: {
    type: String,
    default: '去注册一个账号，成为尊贵的粉丝会员，让我们踏入奇妙的旅途！',
  },
  /**
   * @description 覆盖层（注册态）的大标题
   */
  welcomeTitle: {
    type: String,
    default: 'Welcome Back！',
  },
  /**
   * @description 覆盖层（注册态）的说明文字
   */
  welcomeText: {
    type: String,
    default: '已经有账号了嘛，去登入账号来进入奇妙世界吧！！！',
  },
  /**
   * @description 用户名 / 邮箱输入框的占位文字
   */
  usernamePlaceholder: {
    type: String,
    default: 'Username / Email',
  },
  /**
   * @description 密码输入框的占位文字
   */
  passwordPlaceholder: {
    type: String,
    default: 'Password',
  },
  /**
   * @description 「忘记密码」的文案
   */
  forgotText: {
    type: String,
    default: '忘记密码?',
  },
  /**
   * @description 是否显示社交登录按钮
   */
  social: {
    type: Boolean,
    default: true,
  },
  /**
   * @description 是否显示「忘记密码」
   */
  forgot: {
    type: Boolean,
    default: true,
  },
})

const emit = defineEmits<{
  'update:mode': [mode: Mode]
  /** 点击登录 / 注册提交，带回表单值 */
  submit: [payload: { mode: Mode; username: string; password: string; email?: string }]
  /** 点击社交登录，provider 是 provider key */
  social: [provider: string]
  /** 点击忘记密码 */
  forgot: []
}>()

const SOCIALS = [
  {
    key: 'notify',
    label: '通知登录',
    paths: ['M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9', 'M13.73 21a2 2 0 0 1-3.46 0'],
  },
  {
    key: 'chat',
    label: '聊天登录',
    paths: ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'],
  },
  {
    key: 'card',
    label: '卡片登录',
    paths: ['M8 12h4M10 10v4M15 12h.01M17 12h.01'],
    rect: { x: 2, y: 6, w: 20, h: 12, r: 4 },
  },
]

const isSignup = computed(() => props.mode === 'signup')
const busy = ref(false)
const contentMode = ref<Mode>(props.mode)

const signIn = reactive({ username: '', password: '' })
const signUp = reactive({ username: '', email: '', password: '' })

let switchTimer: ReturnType<typeof setTimeout> | null = null
let busyTimer: ReturnType<typeof setTimeout> | null = null

const rootStyle = computed(() => ({
  '--sa-accent': props.accent,
  '--sa-height': `${props.height}px`,
  '--sa-duration': `${props.duration}ms`,
}))

/** 内容在动画半程切换，和原 demo 的 setTimeout(DURATION / 2) 一致 */
watch(
  () => props.mode,
  (next, prev) => {
    if (next === prev || next === contentMode.value) return
    busy.value = true
    if (switchTimer) clearTimeout(switchTimer)
    switchTimer = setTimeout(() => {
      contentMode.value = next
    }, props.duration / 2)
    if (busyTimer) clearTimeout(busyTimer)
    busyTimer = setTimeout(() => {
      busy.value = false
    }, props.duration)
  },
)

function setMode(next: Mode) {
  if (busy.value || next === props.mode) return
  emit('update:mode', next)
}

function submit(mode: Mode) {
  const payload =
    mode === 'signin'
      ? { mode, username: signIn.username, password: signIn.password }
      : { mode, username: signUp.username, password: signUp.password, email: signUp.email }
  emit('submit', payload)
}

function onEnter(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  if (target?.tagName !== 'INPUT') return
  submit(contentMode.value)
}

onBeforeUnmount(() => {
  if (switchTimer) clearTimeout(switchTimer)
  if (busyTimer) clearTimeout(busyTimer)
})

defineExpose({
  reset() {
    signIn.username = ''
    signIn.password = ''
    signUp.username = ''
    signUp.email = ''
    signUp.password = ''
  },
})
</script>

<style scoped>
.sa {
  --sa-bg: #e8edf4;
  --sa-ink: #1e2545;
  --sa-muted: #9ba4bb;

  position: relative;
  display: block;
  width: 100%;
  max-width: 880px;
  height: var(--sa-height);
  overflow: hidden;
  border-radius: 24px;
  background: var(--sa-bg);
  box-shadow:
    18px 18px 40px rgba(155, 172, 205, 0.78),
    -12px -12px 30px rgba(255, 255, 255, 0.98),
    0 4px 16px rgba(140, 158, 198, 0.3);
  font-family:
    'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif;
}

/* 两块面板：表单 60% + 覆盖 40%，切换时左右互换 */
.sa__panel {
  position: absolute;
  top: 0;
  height: 100%;
  transition: left var(--sa-duration) cubic-bezier(0.65, 0, 0.35, 1);
}

.sa__panel--form {
  left: 0;
  width: 60%;
  background: rgba(255, 255, 255, 0.07);
  box-shadow: inset -8px 0 24px rgba(140, 158, 198, 0.08);
  z-index: 1;
}

.sa__panel--overlay {
  left: 60%;
  width: 40%;
  background: var(--sa-bg);
  z-index: 3;
  overflow: hidden;
}

.sa.is-signup .sa__panel--form {
  left: 40%;
}

.sa.is-signup .sa__panel--overlay {
  left: 0;
}

/* 中间那条拟态分割线，跟着面板边界滑动 */
.sa::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 60%;
  width: 1px;
  box-shadow:
    -1px 0 0 rgba(148, 165, 198, 0.28),
    1px 0 0 rgba(255, 255, 255, 0.88);
  z-index: 10;
  pointer-events: none;
  transition: left var(--sa-duration) cubic-bezier(0.65, 0, 0.35, 1);
}

.sa.is-signup::after {
  left: 40%;
}

/* 覆盖层角落的拟态装饰圆 */
.sa__deco {
  position: absolute;
  border-radius: 50%;
  background: var(--sa-bg);
  pointer-events: none;
}

.sa__deco--tr {
  top: -95px;
  right: -85px;
  width: 230px;
  height: 230px;
  box-shadow:
    9px 9px 20px rgba(168, 182, 208, 0.65),
    -7px -7px 16px rgba(255, 255, 255, 0.92);
}

.sa__deco--bl {
  bottom: -85px;
  left: -75px;
  width: 210px;
  height: 210px;
  box-shadow:
    8px 8px 18px rgba(168, 182, 208, 0.6),
    -6px -6px 14px rgba(255, 255, 255, 0.9);
}

/* 表单区 */
.sa__form,
.sa__promo {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 5% 7%;
  text-align: center;
}

.sa__title {
  margin: 0 0 18px;
  color: var(--sa-ink);
  font-size: clamp(17px, 2.2vw, 24px);
  font-weight: 700;
  letter-spacing: 0.18em;
  white-space: nowrap;
}

.sa__social {
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
}

.sa__social-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: var(--sa-bg);
  color: #6878c0;
  cursor: pointer;
  box-shadow:
    7px 7px 14px rgba(155, 172, 205, 0.72),
    -6px -6px 12px rgba(255, 255, 255, 0.96);
  transition:
    box-shadow 0.22s ease,
    transform 0.22s ease;
}

.sa__social-btn svg {
  width: 19px;
  height: 19px;
  opacity: 0.45;
  transition: opacity 0.22s ease;
}

.sa__social-btn:hover {
  box-shadow:
    9px 9px 18px rgba(155, 172, 205, 0.76),
    -7px -7px 15px rgba(255, 255, 255, 0.98);
  transform: translateY(-2px);
}

.sa__social-btn:hover svg {
  opacity: 0.75;
}

.sa__social-btn.is-active {
  box-shadow:
    inset 5px 5px 10px rgba(155, 172, 205, 0.68),
    inset -4px -4px 8px rgba(255, 255, 255, 0.9);
}

.sa__social-btn.is-active svg {
  opacity: 1;
}

.sa__hint {
  margin: 0 0 16px;
  color: var(--sa-muted);
  font-size: 11px;
  letter-spacing: 0.05em;
}

.sa__field {
  width: 100%;
  margin-bottom: 10px;
}

.sa__field input {
  width: 100%;
  box-sizing: border-box;
  padding: 12px 16px;
  border: 1.5px solid #dde3ed;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.88);
  color: #2a3054;
  font-family: inherit;
  font-size: 13px;
  outline: none;
  box-shadow:
    inset 2px 2px 5px rgba(155, 172, 205, 0.22),
    inset -1px -1px 4px rgba(255, 255, 255, 0.7);
  transition:
    border-color 0.25s ease,
    background 0.25s ease,
    box-shadow 0.25s ease;
}

.sa__field input::placeholder {
  color: #b8c2d8;
}

.sa__field input:focus {
  border-color: color-mix(in srgb, var(--sa-accent) 60%, transparent);
  background: #fff;
  box-shadow:
    0 0 0 3px color-mix(in srgb, var(--sa-accent) 12%, transparent),
    inset 2px 2px 5px color-mix(in srgb, var(--sa-accent) 8%, transparent);
}

.sa__forgot {
  align-self: center;
  margin: 2px 0 16px;
  padding: 0;
  border: none;
  background: none;
  color: var(--sa-muted);
  font-family: inherit;
  font-size: 12px;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
  transition: color 0.2s ease;
}

.sa__forgot:hover {
  color: var(--sa-accent);
}

.sa__submit {
  padding: 12px 40px;
  border: none;
  border-radius: 100px;
  background: var(--sa-accent);
  color: #fff;
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  cursor: pointer;
  box-shadow: 0 6px 22px color-mix(in srgb, var(--sa-accent) 45%, transparent);
  transition:
    box-shadow 0.25s ease,
    transform 0.2s ease,
    background 0.2s ease;
}

.sa__form > .sa__submit {
  width: 100%;
}

.sa__submit:hover {
  background: color-mix(in srgb, var(--sa-accent) 88%, #000);
  box-shadow: 0 10px 30px color-mix(in srgb, var(--sa-accent) 55%, transparent);
  transform: translateY(-1px);
}

.sa__submit:active {
  transform: translateY(0);
}

/* 覆盖层文案 */
.sa__promo-title {
  position: relative;
  z-index: 1;
  margin: 0 0 12px;
  color: var(--sa-ink);
  font-size: clamp(17px, 2.2vw, 24px);
  font-weight: 700;
  letter-spacing: 0.02em;
}

.sa__promo-text {
  position: relative;
  z-index: 1;
  max-width: 210px;
  margin: 0 0 28px;
  color: var(--sa-muted);
  font-size: clamp(11px, 1.3vw, 13px);
  line-height: 1.85;
}

/* 窄屏：覆盖层收起，换顶部 Tab + 单表单 */
.sa__tabs {
  display: none;
}

@media (max-width: 640px) {
  .sa {
    height: auto;
    min-height: 0;
  }

  .sa__tabs {
    display: flex;
    border-bottom: 1px solid rgba(200, 212, 232, 0.6);
  }

  .sa__tab {
    flex: 1;
    padding: 14px;
    border: none;
    border-bottom: 2px solid transparent;
    background: none;
    color: var(--sa-muted);
    font-family: inherit;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;
  }

  .sa__tab[aria-selected='true'] {
    border-bottom-color: var(--sa-accent);
    color: var(--sa-accent);
  }

  .sa__panel {
    position: relative;
    left: 0 !important;
    width: 100% !important;
    height: auto;
    transition: none;
    background: transparent !important;
    box-shadow: none !important;
  }

  .sa__panel--overlay,
  .sa::after {
    display: none;
  }

  .sa__form {
    position: relative;
    inset: auto;
    padding: 28px 22px;
  }

  .sa__title {
    white-space: normal;
  }
}
</style>

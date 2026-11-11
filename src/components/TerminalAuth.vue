<template>
  <div class="ta" :class="{ 'is-switching': switching }" :style="rootStyle">
    <span v-if="scanline" class="ta__scanline" aria-hidden="true" />

    <div class="ta__flipper" :class="flipClass">
      <!-- ── 登录 ── -->
      <section v-show="contentMode === 'login'" class="ta__panel" @keydown.enter="submit('login')">
        <p class="ta__sys">{{ sysTag }}</p>
        <h2 class="ta__title">{{ loginTitle }}</h2>
        <div class="ta__status">
          <i class="ta__dot" aria-hidden="true" />
          <span>{{ loginStatusText }}</span>
        </div>

        <label class="ta__field">
          <span class="ta__label">{{ loginUserLabel }}</span>
          <span class="ta__row">
            <span class="ta__prompt">{{ loginUserPrompt }}</span>
            <input v-model="loginForm.username" class="ta__input" type="text" :placeholder="loginUserPlaceholder" autocomplete="username" />
          </span>
        </label>

        <label class="ta__field">
          <span class="ta__label">{{ passwordLabel }}</span>
          <span class="ta__row">
            <span class="ta__prompt">{{ passwordPrompt }}</span>
            <input v-model="loginForm.password" class="ta__input" type="password" placeholder="••••••••" autocomplete="current-password" />
          </span>
        </label>

        <button type="button" class="ta__action" :class="{ 'is-executing': executing }" @click="submit('login')">
          {{ loginAction }}
        </button>

        <div class="ta__footer">
          <button type="button" class="ta__link" @click="emit('forgot')">{{ forgotText }}</button>
          <button type="button" class="ta__switch" @click="setMode('register')">{{ switchToRegister }}</button>
        </div>

        <div v-if="logs" class="ta__log">
          <p class="ta__log-line is-ok">{{ loginLogBase[0] }}</p>
          <p class="ta__log-line">{{ loginLogBase[1] }}</p>
          <p class="ta__log-line" :class="loginLogToneClass">{{ loginStatusMessage }}</p>
        </div>
      </section>

      <!-- ── 注册 ── -->
      <section v-show="contentMode === 'register'" class="ta__panel" @keydown.enter="submit('register')">
        <p class="ta__sys">{{ sysTagRegister }}</p>
        <h2 class="ta__title">{{ registerTitle }}</h2>
        <div class="ta__status">
          <i class="ta__dot" aria-hidden="true" />
          <span>{{ registerStatusText }}</span>
        </div>

        <label class="ta__field">
          <span class="ta__label">{{ registerUserLabel }}</span>
          <span class="ta__row">
            <span class="ta__prompt">{{ registerUserPrompt }}</span>
            <input v-model="registerForm.username" class="ta__input" type="text" :placeholder="registerUserPlaceholder" autocomplete="username" />
          </span>
        </label>

        <label class="ta__field">
          <span class="ta__label">邮箱</span>
          <span class="ta__row">
            <span class="ta__prompt">mail:&nbsp;&nbsp;&nbsp;</span>
            <input v-model="registerForm.email" class="ta__input" type="email" placeholder="user@example.com" autocomplete="email" />
          </span>
        </label>

        <label class="ta__field">
          <span class="ta__label">{{ passwordLabel }}</span>
          <span class="ta__row">
            <span class="ta__prompt">{{ passwordPrompt }}</span>
            <input v-model="registerForm.password" class="ta__input" type="password" placeholder="••••••••" autocomplete="new-password" />
          </span>
          <span v-if="strength" class="ta__strength"><i :class="strengthClass" /></span>
        </label>

        <label class="ta__field">
          <span class="ta__label">确认密码</span>
          <span class="ta__row">
            <span class="ta__prompt">verify: &nbsp;</span>
            <input v-model="registerForm.confirm" class="ta__input" type="password" placeholder="••••••••" autocomplete="new-password" />
          </span>
        </label>

        <button type="button" class="ta__action" :class="{ 'is-executing': executing }" @click="submit('register')">
          {{ registerAction }}
        </button>

        <div class="ta__footer">
          <button type="button" class="ta__switch" @click="setMode('login')">{{ switchToLogin }}</button>
          <button type="button" class="ta__link" @click="emit('info')">{{ infoText }}</button>
        </div>

        <div v-if="logs" class="ta__log">
          <p class="ta__log-line is-ok">{{ registerLogBase[0] }}</p>
          <p class="ta__log-line">{{ registerLogBase[1] }}</p>
          <p class="ta__log-line" :class="registerLogToneClass">{{ registerStatusMessage }}</p>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'

/*
 * 由 video-code / UI组件/登录面板/终端极客风登录面板.html 提取而来。
 *
 * 原 demo 是一块终端风格的登录卡：等宽字体 + 绿色荧光 + 四角描边，字段左侧带 shell 提示符
 * （root@sys:~$ / passwd:），登录 / 注册之间用 3D 翻转 + 一次辉光闪烁切换，底部三行日志式状态，
 * 注册表单还有密码强度条和两次密码一致性校验。
 *
 * 组件化后：
 * - 模式用 mode + v-model:mode 控制，翻转（0.32s×2）和辉光都保留；
 * - 提示符、标题、按钮文案、系统标识都是 props；字段值通过 submit 事件抛出；
 * - 日志默认按原 demo 的「每次提交推进一格」模拟，也可用 logs 关掉，交给宿主自己展示；
 * - 原 demo 全屏的矩阵雨 / 扫描线属于页面氛围，这里只保留一个可选的「局部扫描线」。
 */
type Mode = 'login' | 'register'

const props = defineProps({
  /**
   * @description 当前模式：login / register，可用 v-model:mode 双向绑定
   */
  mode: {
    type: String as () => Mode,
    default: 'login',
  },
  /**
   * @description 荧光主色
   */
  accent: {
    type: String,
    default: '#00ff50',
  },
  /**
   * @description 登录面板左上角的系统标识
   */
  sysTag: {
    type: String,
    default: '系统/认证 v2.1.4 · 安全通道 · AES-256',
  },
  /**
   * @description 登录面板标题
   */
  loginTitle: {
    type: String,
    default: '身份认证',
  },
  /**
   * @description 注册面板标题
   */
  registerTitle: {
    type: String,
    default: '注册新账号',
  },
  /**
   * @description 登录按钮文案
   */
  loginAction: {
    type: String,
    default: '[ 执行认证 ]',
  },
  /**
   * @description 注册按钮文案
   */
  registerAction: {
    type: String,
    default: '[ 执行注册 ]',
  },
  /**
   * @description 「去注册」链接文案
   */
  switchToRegister: {
    type: String,
    default: '> 注册账号',
  },
  /**
   * @description 「返回登录」链接文案
   */
  switchToLogin: {
    type: String,
    default: '< 返回登录',
  },
  /**
   * @description 「忘记密码」链接文案
   */
  forgotText: {
    type: String,
    default: '找回密码',
  },
  /**
   * @description 注册面板右下角的次要链接文案
   */
  infoText: {
    type: String,
    default: '系统信息',
  },
  /**
   * @description 登录时用户名输入框的 shell 提示符
   */
  loginUserPrompt: {
    type: String,
    default: 'root@sys:~$',
  },
  /**
   * @description 注册时用户名输入框的 shell 提示符
   */
  registerUserPrompt: {
    type: String,
    default: 'new@sys:~$',
  },
  /**
   * @description 密码输入框的提示符
   */
  passwordPrompt: {
    type: String,
    default: 'passwd: ',
  },
  /**
   * @description 用户名输入框的占位文字
   */
  loginUserPlaceholder: {
    type: String,
    default: '请输入用户名',
  },
  /**
   * @description 注册时用户名输入框的占位文字
   */
  registerUserPlaceholder: {
    type: String,
    default: '请设置用户名',
  },
  /**
   * @description 是否显示密码强度条（注册表单）
   */
  strength: {
    type: Boolean,
    default: true,
  },
  /**
   * @description 是否显示底部日志行
   */
  logs: {
    type: Boolean,
    default: true,
  },
  /**
   * @description 是否在面板上显示一条循环扫描线
   */
  scanline: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits<{
  'update:mode': [mode: Mode]
  /** 提交登录 / 注册 */
  submit: [payload: { mode: Mode; username: string; password: string; email?: string }]
  /** 两次密码不一致 */
  mismatch: []
  forgot: []
  info: []
}>()

const LOGIN_STEPS: { text: string; tone: '' | 'warn' | 'ok' }[] = [
  { text: '[等待] 等待输入凭证...', tone: 'warn' },
  { text: '[认证] 正在发送凭证...', tone: '' },
  { text: '[认证] 正在验证哈希...', tone: '' },
  { text: '[认证] 正在检查权限...', tone: '' },
  { text: '[完成] 认证成功 ✓', tone: 'ok' },
]

const REGISTER_STEPS: { text: string; tone: '' | 'warn' | 'ok' }[] = [
  { text: '[等待] 等待输入注册信息...', tone: 'warn' },
  { text: '[注册] 正在验证用户名...', tone: '' },
  { text: '[注册] 正在生成密钥对...', tone: '' },
  { text: '[注册] 正在写入注册表...', tone: '' },
  { text: '[完成] 注册成功 ✓', tone: 'ok' },
]

const sysTagRegister = computed(() =>
  props.sysTag.replace('认证', '注册').replace('等待输入', '注册模式'),
)

const flipping = ref(false)
const switching = ref(false)
const executing = ref(false)
const contentMode = ref<Mode>(props.mode)
const flipPhase = ref<'idle' | 'out' | 'reset' | 'in'>('idle')
const loginStep = ref(0)
const registerStep = ref(0)
const loginError = ref('')
const registerError = ref('')

const loginForm = reactive({ username: '', password: '' })
const registerForm = reactive({ username: '', email: '', password: '', confirm: '' })

const loginUserLabel = '用户名'
const registerUserLabel = '用户名'
const passwordLabel = '密码'
const loginLogBase = ['[完成] TLS 1.3 连接已建立', '[信息] RSA-4096 验证就绪']
const registerLogBase = ['[完成] 安全通道已建立', '[信息] 注册模块已加载']

let phaseTimer: ReturnType<typeof setTimeout> | null = null
let execTimer: ReturnType<typeof setTimeout> | null = null

const rootStyle = computed(() => ({ '--ta-accent': props.accent }))

const flipClass = computed(() => ({
  'is-out': flipPhase.value === 'out',
  'is-reset': flipPhase.value === 'reset',
  'is-in': flipPhase.value === 'in',
}))

const loginStatusMessage = computed(
  () => loginError.value || LOGIN_STEPS[loginStep.value].text,
)
const loginLogToneClass = computed(() => {
  if (loginError.value) return 'is-err'
  const tone = LOGIN_STEPS[loginStep.value].tone
  return tone ? `is-${tone}` : ''
})
const registerStatusMessage = computed(
  () => registerError.value || REGISTER_STEPS[registerStep.value].text,
)
const registerLogToneClass = computed(() => {
  if (registerError.value) return 'is-err'
  const tone = REGISTER_STEPS[registerStep.value].tone
  return tone ? `is-${tone}` : ''
})

const loginStatusText = '系统在线 · 已加密 · 等待输入'
const registerStatusText = '系统在线 · 已加密 · 注册模式'

/** 密码强度：长度 / 大小写 / 数字 / 符号 各记一分 */
const strengthScore = computed(() => {
  const value = registerForm.password
  let score = 0
  if (value.length >= 6) score += 1
  if (value.length >= 10) score += 1
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1
  if (/\d/.test(value)) score += 1
  if (/[^A-Za-z0-9]/.test(value)) score += 1
  return score
})

const strengthClass = computed(() => {
  if (!registerForm.password) return ''
  if (strengthScore.value <= 2) return 'is-weak'
  if (strengthScore.value <= 3) return 'is-medium'
  return 'is-strong'
})

function clearTimers() {
  if (phaseTimer) clearTimeout(phaseTimer)
  if (execTimer) clearTimeout(execTimer)
  phaseTimer = null
  execTimer = null
}

/** 内容在翻到 90°（看不见时）切换，然后从 -90° 翻回来 */
watch(
  () => props.mode,
  (next, prev) => {
    if (next === prev || next === contentMode.value || flipping.value) return
    flipping.value = true
    switching.value = true
    flipPhase.value = 'out'

    if (phaseTimer) clearTimeout(phaseTimer)
    phaseTimer = setTimeout(() => {
      contentMode.value = next
      flipPhase.value = 'reset'
      // 先无动画地停在 -90°，再切回动画翻正
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          flipPhase.value = 'in'
          phaseTimer = setTimeout(() => {
            flipPhase.value = 'idle'
            flipping.value = false
            switching.value = false
          }, 320)
        })
      })
    }, 320)
  },
)

function setMode(next: Mode) {
  if (next === props.mode || flipping.value) return
  emit('update:mode', next)
}

function submit(mode: Mode) {
  if (executing.value) return

  executing.value = true
  if (execTimer) clearTimeout(execTimer)
  execTimer = setTimeout(() => {
    executing.value = false
  }, 600)

  if (mode === 'login') {
    loginError.value = ''
    loginStep.value = (loginStep.value + 1) % LOGIN_STEPS.length
    emit('submit', {
      mode,
      username: loginForm.username,
      password: loginForm.password,
    })
    return
  }

  // 注册：先校验两次密码
  if (registerForm.password && registerForm.confirm && registerForm.password !== registerForm.confirm) {
    registerError.value = '[错误] 两次密码不一致 — 请重新输入'
    emit('mismatch')
    return
  }

  registerError.value = ''
  registerStep.value = (registerStep.value + 1) % REGISTER_STEPS.length
  emit('submit', {
    mode,
    username: registerForm.username,
    password: registerForm.password,
    email: registerForm.email,
  })
}

onBeforeUnmount(clearTimers)

defineExpose({
  reset() {
    loginForm.username = ''
    loginForm.password = ''
    registerForm.username = ''
    registerForm.email = ''
    registerForm.password = ''
    registerForm.confirm = ''
    loginStep.value = 0
    registerStep.value = 0
    loginError.value = ''
    registerError.value = ''
  },
})
</script>

<style scoped>
.ta {
  position: relative;
  width: 100%;
  max-width: 480px;
  perspective: 1200px;
  font-family: 'JetBrains Mono', 'Courier New', Consolas, monospace;
}

/* 3D 翻转：out 翻到 90°，reset 无动画停在 -90°，in 翻回 0° */
.ta__flipper {
  position: relative;
  width: 100%;
  transform-style: preserve-3d;
}

.ta__flipper.is-out {
  transform: rotateY(90deg);
  transition: transform 0.32s cubic-bezier(0.4, 0, 1, 1);
}

.ta__flipper.is-reset {
  transform: rotateY(-90deg);
  transition: none;
}

.ta__flipper.is-in {
  transform: rotateY(0deg);
  transition: transform 0.32s cubic-bezier(0, 0, 0.2, 1);
}

/* 切换瞬间整块闪一下（原 demo 的 glitchFlash） */
.ta.is-switching .ta__flipper {
  animation: ta-glitch 0.7s ease;
}

.ta__panel {
  position: relative;
  width: 100%;
  box-sizing: border-box;
  padding: 40px 40px 32px;
  border: 1px solid color-mix(in srgb, var(--ta-accent) 18%, transparent);
  background: rgba(2, 13, 6, 0.95);
}

/* 左上 / 右下两个直角装饰 */
.ta__panel::before,
.ta__panel::after {
  content: '';
  position: absolute;
  width: 18px;
  height: 18px;
  border: 2px solid var(--ta-accent);
  pointer-events: none;
}

.ta__panel::before {
  top: -1px;
  left: -1px;
  border-right: none;
  border-bottom: none;
}

.ta__panel::after {
  right: -1px;
  bottom: -1px;
  border-top: none;
  border-left: none;
}

.ta__scanline {
  position: absolute;
  left: -8px;
  right: -8px;
  height: 2px;
  background: linear-gradient(to right, transparent, var(--ta-accent), transparent);
  opacity: 0.5;
  animation: ta-scan 4s linear infinite;
  pointer-events: none;
}

.ta__sys {
  margin: 0 0 10px;
  color: color-mix(in srgb, var(--ta-accent) 35%, transparent);
  font-size: 8px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
}

.ta__title {
  margin: 0;
  color: var(--ta-accent);
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-shadow: 0 0 18px color-mix(in srgb, var(--ta-accent) 50%, transparent);
}

.ta__status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 0 32px;
  color: color-mix(in srgb, var(--ta-accent) 40%, transparent);
  font-size: 8px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}

.ta__dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--ta-accent);
  box-shadow: 0 0 8px var(--ta-accent);
  animation: ta-blink 1.4s ease-in-out infinite;
}

.ta__field {
  display: block;
  margin-bottom: 20px;
}

.ta__label {
  display: block;
  margin-bottom: 8px;
  color: color-mix(in srgb, var(--ta-accent) 35%, transparent);
  font-size: 8px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
}

.ta__row {
  display: flex;
  align-items: center;
  padding-bottom: 8px;
  border-bottom: 1px solid color-mix(in srgb, var(--ta-accent) 18%, transparent);
  transition: border-color 0.25s ease;
}

.ta__row:focus-within {
  border-bottom-color: color-mix(in srgb, var(--ta-accent) 60%, transparent);
}

.ta__prompt {
  margin-right: 10px;
  color: color-mix(in srgb, var(--ta-accent) 40%, transparent);
  font-size: 12px;
  white-space: nowrap;
  user-select: none;
}

.ta__input {
  flex: 1;
  min-width: 0;
  border: none;
  background: none;
  color: var(--ta-accent);
  font-family: inherit;
  font-size: 14px;
  outline: none;
  caret-color: var(--ta-accent);
}

.ta__input::placeholder {
  color: color-mix(in srgb, var(--ta-accent) 18%, transparent);
}

/* 密码强度条 */
.ta__strength {
  display: block;
  height: 2px;
  margin-top: 6px;
  overflow: hidden;
  background: color-mix(in srgb, var(--ta-accent) 8%, transparent);
}

.ta__strength i {
  display: block;
  height: 100%;
  width: 0;
  transition:
    width 0.3s ease,
    background 0.3s ease;
}

.ta__strength .is-weak {
  width: 33%;
  background: rgba(255, 60, 60, 0.6);
}

.ta__strength .is-medium {
  width: 66%;
  background: rgba(255, 200, 0, 0.6);
}

.ta__strength .is-strong {
  width: 100%;
  background: color-mix(in srgb, var(--ta-accent) 60%, transparent);
}

.ta__action {
  position: relative;
  width: 100%;
  margin-top: 28px;
  padding: 13px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--ta-accent) 35%, transparent);
  background: transparent;
  color: var(--ta-accent);
  font-family: inherit;
  font-size: 11px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.25s ease;
}

.ta__action::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(to right, transparent, color-mix(in srgb, var(--ta-accent) 8%, transparent), transparent);
  transition: left 0.45s ease;
}

.ta__action:hover::before {
  left: 100%;
}

.ta__action:hover {
  border-color: color-mix(in srgb, var(--ta-accent) 70%, transparent);
  box-shadow:
    0 0 20px color-mix(in srgb, var(--ta-accent) 10%, transparent),
    inset 0 0 16px color-mix(in srgb, var(--ta-accent) 4%, transparent);
  text-shadow: 0 0 8px color-mix(in srgb, var(--ta-accent) 60%, transparent);
}

.ta__action.is-executing {
  animation: ta-exec 0.6s ease;
}

.ta__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 18px;
}

.ta__link,
.ta__switch {
  padding: 0;
  border: none;
  background: none;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s ease;
}

.ta__link {
  color: color-mix(in srgb, var(--ta-accent) 25%, transparent);
  font-size: 8px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.ta__link:hover {
  color: color-mix(in srgb, var(--ta-accent) 60%, transparent);
}

.ta__switch {
  position: relative;
  padding: 6px 14px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--ta-accent) 30%, transparent);
  background: color-mix(in srgb, var(--ta-accent) 4%, transparent);
  color: var(--ta-accent);
  font-size: 9px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.ta__switch::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(to right, transparent, color-mix(in srgb, var(--ta-accent) 10%, transparent), transparent);
  transition: left 0.4s ease;
}

.ta__switch:hover::before {
  left: 100%;
}

.ta__switch:hover {
  border-color: color-mix(in srgb, var(--ta-accent) 65%, transparent);
  text-shadow: 0 0 8px color-mix(in srgb, var(--ta-accent) 50%, transparent);
}

/* 日志区 */
.ta__log {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 26px;
  padding-top: 14px;
  border-top: 1px solid color-mix(in srgb, var(--ta-accent) 8%, transparent);
}

.ta__log-line {
  margin: 0;
  color: color-mix(in srgb, var(--ta-accent) 25%, transparent);
  font-size: 8px;
  letter-spacing: 0.1em;
  line-height: 1.7;
}

.ta__log-line.is-ok {
  color: color-mix(in srgb, var(--ta-accent) 50%, transparent);
}

.ta__log-line.is-warn {
  color: rgba(255, 200, 0, 0.45);
}

.ta__log-line.is-err {
  color: rgba(255, 60, 60, 0.5);
}

@keyframes ta-blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.15;
  }
}

@keyframes ta-exec {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

@keyframes ta-glitch {
  0% {
    filter: brightness(1);
  }
  15% {
    filter: brightness(2.5) hue-rotate(20deg);
  }
  30% {
    filter: brightness(0.6);
  }
  50% {
    filter: brightness(1.8) hue-rotate(-10deg);
  }
  100% {
    filter: brightness(1);
  }
}

@keyframes ta-scan {
  from {
    top: -2px;
  }
  to {
    top: 100%;
  }
}

@media (max-width: 520px) {
  .ta__panel {
    padding: 28px 22px 24px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ta__dot,
  .ta__action.is-executing,
  .ta.is-switching .ta__flipper,
  .ta__scanline {
    animation: none;
  }

  .ta__flipper.is-out,
  .ta__flipper.is-in {
    transition-duration: 0.01ms;
  }
}
</style>

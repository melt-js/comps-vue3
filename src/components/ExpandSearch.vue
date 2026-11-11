<template>
  <div class="es" :class="{ 'is-open': open }" :style="rootStyle">
    <input
      ref="inputEl"
      class="es__field"
      type="text"
      :value="text"
      :placeholder="placeholder"
      :disabled="disabled"
      @input="onInput"
      @focus="onFocus"
      @blur="onBlur"
      @keydown.enter="emit('search', text)"
      @keydown.esc="onEscape"
    />

    <span class="es__icon" aria-hidden="true">
      <slot name="icon">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </slot>
    </span>

    <button
      v-if="clearable && text"
      type="button"
      class="es__clear"
      aria-label="清空"
      title="清空"
      @click="clear"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

/*
 * 由 video-code / UI组件/搜索框动画效果/可收缩展开的动态搜索框.html 提取而来。
 *
 * 原 demo 是一个「找不到就缩成圆、聚焦就摊成胶囊」的搜索框，JS 里手动改 width / borderRadius，
 * 图标用 🔍 emoji、清除按钮用 ×。组件化后：
 * - 展开状态由 `open`（= 聚焦 || 有内容）统一控制，CSS 变量管宽度和圆角，样式不再由 JS 逐个改；
 * - 图标换成内联 SVG（也可以用 icon 插槽传自己的），聚焦时旋转一圈移到右侧；
 * - 值走 v-model，额外派发 search（回车）/ clear 事件，Esc 收起并失焦；
 * - 清除按钮改用 SVG 叉号，按需渲染（有内容才出现）。
 */
const props = defineProps({
  /**
   * @description 搜索关键字，配合 v-model 使用
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
    default: '搜索...',
  },
  /**
   * @description 主色，描边、图标、阴影都用它
   */
  color: {
    type: String,
    default: '#667eea',
  },
  /**
   * @description 收起时的宽度（圆形状态），单位 px
   */
  collapsedWidth: {
    type: Number,
    default: 60,
  },
  /**
   * @description 展开后的圆角，单位 px
   */
  radius: {
    type: Number,
    default: 30,
  },
  /**
   * @description 输入框高度，单位 px
   */
  height: {
    type: Number,
    default: 60,
  },
  /**
   * @description 是否显示清除按钮
   */
  clearable: {
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
  search: [value: string]
  clear: []
  focus: [event: FocusEvent]
  blur: [event: FocusEvent]
}>()

const inputEl = ref<HTMLInputElement | null>(null)
const text = ref(props.modelValue)
const focused = ref(false)

/** 聚焦或有内容时展开；失焦后只要还有内容也保持展开 */
const open = computed(() => focused.value || Boolean(text.value))

const rootStyle = computed(() => ({
  '--es-color': props.color,
  '--es-collapsed': `${props.collapsedWidth}px`,
  '--es-radius': `${props.radius}px`,
  '--es-h': `${props.height}px`,
}))

watch(
  () => props.modelValue,
  (value) => {
    if (value !== text.value) text.value = value
  },
)

function onInput(event: Event) {
  text.value = (event.target as HTMLInputElement).value
  emit('update:modelValue', text.value)
}

function onFocus(event: FocusEvent) {
  focused.value = true
  emit('focus', event)
}

function onBlur(event: FocusEvent) {
  focused.value = false
  emit('blur', event)
}

function clear() {
  text.value = ''
  emit('update:modelValue', '')
  emit('clear')
  inputEl.value?.focus()
}

function onEscape() {
  inputEl.value?.blur()
}

defineExpose({ focus: () => inputEl.value?.focus(), clear })
</script>

<style scoped>
.es {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: var(--es-h);
}

/* 收起时是圆，展开时是胶囊；宽度用 CSS 变量 + 100% 平滑过渡 */
.es__field {
  width: var(--es-collapsed);
  height: var(--es-h);
  box-sizing: border-box;
  padding: 0 25px;
  border: 3px solid var(--es-color);
  border-radius: 50%;
  background: #fff;
  color: #1f2937;
  font-family: inherit;
  font-size: 17px;
  outline: none;
  box-shadow: 0 8px 25px color-mix(in srgb, var(--es-color) 30%, transparent);
  transition:
    width 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94),
    border-radius 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94),
    box-shadow 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94),
    transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.es__field::placeholder {
  color: #9ca3af;
  opacity: 0.7;
  transition: opacity 0.6s ease;
}

.es__field:focus::placeholder {
  opacity: 1;
}

.es.is-open .es__field {
  width: 100%;
  border-radius: var(--es-radius);
}

/* 聚焦时轻微放大，松手（或失焦但有内容）回到原尺寸 */
.es.is-open .es__field:focus {
  box-shadow: 0 15px 40px color-mix(in srgb, var(--es-color) 40%, transparent);
  transform: scale(1.03);
}

.es__field:disabled {
  background: #f3f4f6;
  border-color: #d1d5db;
  box-shadow: none;
  cursor: not-allowed;
}

/* 图标：收起时压在圆心，展开后旋转到右侧 */
.es__icon {
  position: absolute;
  right: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--es-color);
  pointer-events: none;
  transform: translate(50%, 0);
  transition:
    right 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94),
    transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94),
    color 0.6s ease;
}

.es__icon svg {
  width: 22px;
  height: 22px;
}

.es.is-open .es__icon {
  right: 22px;
  transform: translateY(0) rotate(360deg);
  color: color-mix(in srgb, var(--es-color) 70%, #764ba2);
}

.es__clear {
  position: absolute;
  right: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: none;
  color: #9ca3af;
  cursor: pointer;
  transition:
    color 0.2s ease,
    background-color 0.2s ease;
}

.es__clear svg {
  width: 15px;
  height: 15px;
}

.es__clear:hover,
.es__clear:focus-visible {
  background: rgba(0, 0, 0, 0.08);
  color: #4b5563;
  outline: none;
}

/* 有内容时图标让位给清除按钮 */
.es:has(.es__clear) .es__icon {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .es__field,
  .es__icon {
    transition-duration: 0.01ms;
  }
}
</style>

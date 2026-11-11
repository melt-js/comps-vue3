<template>
  <label class="fl-input" :style="rootStyle">
    <input
      ref="inputEl"
      class="fl-input__field"
      :type="type"
      :value="text"
      :disabled="disabled"
      :autocomplete="autocomplete"
      :aria-label="label"
      placeholder=" "
      @input="onInput"
      @focus="emit('focus', $event)"
      @blur="emit('blur', $event)"
      @keydown.enter="emit('enter', $event)"
    />
    <span class="fl-input__label">{{ label }}</span>
  </label>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

/*
 * 由 video-code / UI组件/输入框/浮动标签输入框.html 提取而来。
 *
 * 原来的实现靠 `:focus + .form-label` 和 `:not(:placeholder-shown) + .form-label` 两个
 * 纯 CSS 选择器驱动：聚焦或已有内容时，标签从输入框里浮到框上方、放大变粗、换成主色，
 * 同时框外浮出一圈缓慢流动的渐变光边。组件化后保留这套纯 CSS 逻辑（所以输入框始终带
 * 一个空格的 placeholder，`placeholder-shown` 才有意义），只是把文案、类型、主色提成 props，
 * 并用 v-model 双向绑定值。
 *
 * 注意：标签浮起后位于输入框上方（和原 demo 一样），宿主在它上面留出约 30px 空间。
 */
const props = defineProps({
  /**
   * @description 浮动标签文案
   */
  label: {
    type: String,
    default: '用户名',
  },
  /**
   * @description 输入值，配合 v-model 使用
   */
  modelValue: {
    type: String,
    default: '',
  },
  /**
   * @description 输入框类型，text / password / email 等原生类型
   */
  type: {
    type: String,
    default: 'text',
  },
  /**
   * @description 主色，聚焦时标签和流动光边都用它
   */
  color: {
    type: String,
    default: '#165dff',
  },
  /**
   * @description 输入框高度，单位 px
   */
  height: {
    type: Number,
    default: 50,
  },
  /**
   * @description 是否禁用
   */
  disabled: {
    type: Boolean,
    default: false,
  },
  /**
   * @description 原生 autocomplete 属性
   */
  autocomplete: {
    type: String,
    default: 'off',
  },
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  focus: [event: FocusEvent]
  blur: [event: FocusEvent]
  enter: [event: KeyboardEvent]
}>()

const inputEl = ref<HTMLInputElement | null>(null)
// 内部先存一份，组件既能走 v-model（受控），也能不传 modelValue 直接用（非受控）
const text = ref(props.modelValue)

watch(
  () => props.modelValue,
  (value) => {
    if (value !== text.value) text.value = value
  },
)

const rootStyle = computed(() => ({
  '--fl-color': props.color,
  '--fl-h': `${props.height}px`,
}))

function onInput(event: Event) {
  text.value = (event.target as HTMLInputElement).value
  emit('update:modelValue', text.value)
}

defineExpose({ focus: () => inputEl.value?.focus() })
</script>

<style scoped>
.fl-input {
  --fl-font: 1rem;
  --fl-ease: 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  position: relative;
  display: block;
  width: 100%;
  height: var(--fl-h, 50px);
}

.fl-input__field {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 0 16px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  color: #1f2937;
  font-family: inherit;
  font-size: var(--fl-font);
  outline: none;
  transition:
    border-color var(--fl-ease),
    box-shadow var(--fl-ease);
}

.fl-input__field:focus {
  border-color: transparent;
  box-shadow: 0 8px 24px color-mix(in srgb, var(--fl-color) 18%, transparent);
}

.fl-input__field:disabled {
  background: #f3f4f6;
  color: #9ca3af;
  cursor: not-allowed;
}

/* 标签：默认当作占位文字压在输入框里 */
.fl-input__label {
  position: absolute;
  z-index: 2;
  top: 0;
  left: 0;
  height: var(--fl-h);
  padding-left: 16px;
  color: #6b7280;
  font-size: var(--fl-font);
  line-height: var(--fl-h);
  pointer-events: none;
  transition: all var(--fl-ease);
}

/* 聚焦或已有内容：标签浮到框上方，放大变粗换主色 */
.fl-input__field:focus + .fl-input__label,
.fl-input__field:not(:placeholder-shown) + .fl-input__label,
.fl-input__field:disabled + .fl-input__label {
  top: calc(var(--fl-h) * -1);
  padding-left: 0;
  color: var(--fl-color);
  font-size: calc(var(--fl-font) * 1.2);
  font-weight: 900;
}

/* 框外那圈流动的渐变光边：只做背景，`::before` 属于 label，落在输入框下层 */
.fl-input::before {
  content: '';
  position: absolute;
  z-index: 0;
  inset: -2px;
  border-radius: 10px;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--fl-color) 30%, transparent),
    rgba(92, 231, 255, 0.3),
    color-mix(in srgb, var(--fl-color) 30%, transparent)
  );
  background-size: 200% 100%;
  opacity: 0;
  transition: opacity var(--fl-ease);
  animation: fl-sweep 3s linear infinite;
}

.fl-input:focus-within::before {
  opacity: 1;
}

@keyframes fl-sweep {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .fl-input::before {
    animation: none;
  }
}
</style>

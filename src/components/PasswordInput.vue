<template>
  <div class="pw" :style="rootStyle">
    <label v-if="label" class="pw__label" :for="fieldId">{{ label }}</label>
    <div class="pw__box">
      <input
        :id="fieldId"
        ref="inputEl"
        class="pw__field"
        :type="revealed ? 'text' : 'password'"
        :value="text"
        :placeholder="placeholder"
        :disabled="disabled"
        :autocomplete="autocomplete"
        @input="onInput"
        @focus="emit('focus', $event)"
        @blur="emit('blur', $event)"
        @keydown.enter="emit('enter', $event)"
      />
      <button
        v-if="toggleable"
        type="button"
        class="pw__toggle"
        :aria-label="revealed ? '隐藏密码' : '显示密码'"
        :aria-pressed="revealed"
        :title="revealed ? '隐藏密码' : '显示密码'"
        @click="revealed = !revealed"
      >
        <svg
          v-if="!revealed"
          class="pw__icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        <svg
          v-else
          class="pw__icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
          <path d="M6.61 6.61A18.5 18.5 0 0 0 1 12s4 8 11 8a9.1 9.1 0 0 0 5.39-1.61" />
          <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
          <line x1="2" y1="2" x2="22" y2="22" />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'

/*
 * 由 video-code / UI组件/输入框/密码切换输入框.html 提取而来。
 *
 * 原 demo 只有一颗用 onclick 全局函数切换的 👁️ emoji。组件化时换了三处：
 * - 用两个内联 SVG（眼睛 / 划掉的眼睛）代替 emoji，避免各平台 emoji 字形不一致；
 * - 切换按钮补齐 aria-label / aria-pressed，键盘也能操作；
 * - 值走 v-model，另外把成功 / 回车等常用事件透出去。
 *
 * 切换只改 input 的 type，不做任何遮罩层，所以浏览器自带的密码管理仍然生效。
 */
const props = defineProps({
  /**
   * @description 标签文案，留空则不渲染标签
   */
  label: {
    type: String,
    default: '',
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
    default: '输入密码',
  },
  /**
   * @description 主色，聚焦时的描边和光晕用它
   */
  color: {
    type: String,
    default: '#3b82f6',
  },
  /**
   * @description 是否显示「显示 / 隐藏密码」按钮
   */
  toggleable: {
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
  /**
   * @description 原生 autocomplete 属性，默认按密码框语义给 current-password
   */
  autocomplete: {
    type: String,
    default: 'current-password',
  },
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  focus: [event: FocusEvent]
  blur: [event: FocusEvent]
  enter: [event: KeyboardEvent]
}>()

const inputEl = ref<HTMLInputElement | null>(null)
const revealed = ref(false)
const text = ref(props.modelValue)
// label 的 for 需要唯一 id，同一页面可能有多个密码框
const fieldId = `pw-${useId()}`

const rootStyle = computed(() => ({ '--pw-color': props.color }))

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

defineExpose({
  focus: () => inputEl.value?.focus(),
  reveal: () => (revealed.value = true),
  hide: () => (revealed.value = false),
})
</script>

<style scoped>
.pw {
  display: block;
  width: 100%;
}

.pw__label {
  display: block;
  margin-bottom: 6px;
  color: #4b5563;
  font-size: 13px;
  font-weight: 600;
}

.pw__box {
  position: relative;
  display: flex;
  align-items: center;
}

.pw__field {
  width: 100%;
  box-sizing: border-box;
  padding: 12px 44px 12px 14px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  color: #1f2937;
  font-family: inherit;
  font-size: 16px;
  letter-spacing: 0.02em;
  outline: none;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.pw__field::placeholder {
  color: #9ca3af;
  letter-spacing: normal;
}

.pw__field:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--pw-color) 45%, #d1d5db);
}

.pw__field:focus {
  border-color: var(--pw-color);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--pw-color) 30%, transparent);
}

.pw__field:disabled {
  background: #f3f4f6;
  color: #9ca3af;
  cursor: not-allowed;
}

.pw__toggle {
  position: absolute;
  right: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: none;
  color: #6b7280;
  cursor: pointer;
  transition:
    color 0.2s ease,
    background-color 0.2s ease;
}

.pw__toggle:hover,
.pw__toggle:focus-visible {
  background: color-mix(in srgb, var(--pw-color) 10%, transparent);
  color: var(--pw-color);
  outline: none;
}

.pw__icon {
  width: 18px;
  height: 18px;
}
</style>

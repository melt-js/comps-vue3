<template>
  <div class="tw">
    <span class="tw__text">{{ shown }}</span>
    <span v-if="cursor" class="tw__caret" aria-hidden="true">{{ cursorChar }}</span>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

/*
 * 由 video-code / 动画特效/逐字打印效果/index.html 提取而来。
 *
 * 原 demo 把两行文案和 150ms 的打字速度写死在脚本里，打完就停、不能重来。
 * 这里补上了组件该有的部分：
 * - 文案、速度、起始延迟、循环（以及循环间隔）都是 props，改文案会自动重打；
 * - 换行用 \n 表示（渲染时按 pre-wrap 处理），换行后多停一拍，读起来有分段感；
 * - 光标可以关掉，字符也能换；
 * - 打完一次派发 done 事件，外部可以接着做别的事；
 * - 通过 ref 暴露 restart() / finish()，方便按钮控制播放。
 *
 * 定时器统一走 timer 变量，卸载时清掉，重复启动前先 reset，避免两串计时器并行。
 */
const props = defineProps({
  /**
   * @description 要打印的文字，\n 表示换行
   */
  text: {
    type: String,
    default: 'HELLO，欢迎来到 comps-vue3 ✨',
  },
  /**
   * @description 每个字的间隔，单位毫秒
   */
  speed: {
    type: Number,
    default: 120,
  },
  /**
   * @description 首次开始前的延迟，单位毫秒
   */
  startDelay: {
    type: Number,
    default: 300,
  },
  /**
   * @description 打完后是否重新开始
   */
  loop: {
    type: Boolean,
    default: true,
  },
  /**
   * @description 循环时两轮之间的停顿，单位毫秒
   */
  loopDelay: {
    type: Number,
    default: 1600,
  },
  /**
   * @description 是否显示闪烁光标
   */
  cursor: {
    type: Boolean,
    default: true,
  },
  /**
   * @description 光标字符
   */
  cursorChar: {
    type: String,
    default: '|',
  },
})

const emit = defineEmits<{
  /** 一轮打印完成 */
  done: []
}>()

const shown = ref('')
let timer: ReturnType<typeof setTimeout> | null = null
let cursorIndex = 0
let finished = false

function stopTimer() {
  if (timer !== null) {
    clearTimeout(timer)
    timer = null
  }
}

function clear() {
  stopTimer()
  shown.value = ''
  cursorIndex = 0
  finished = false
}

function step() {
  const source = props.text || ''
  if (cursorIndex >= source.length) {
    if (finished) return
    finished = true
    emit('done')
    if (props.loop) {
      timer = setTimeout(() => {
        clear()
        timer = setTimeout(step, Math.max(0, props.startDelay))
      }, Math.max(0, props.loopDelay))
    }
    return
  }

  const char = source[cursorIndex]
  cursorIndex += 1
  shown.value += char
  // 换行后多停一拍（三个字的时间），让分段看起来像真的在换行
  const delay = char === '\n' ? Math.max(0, props.speed) * 3 : Math.max(0, props.speed)
  timer = setTimeout(step, delay)
}

/** 从头开始打 */
function restart() {
  clear()
  timer = setTimeout(step, Math.max(0, props.startDelay))
}

/** 立刻打完，不再继续 */
function finish() {
  clear()
  shown.value = props.text || ''
  cursorIndex = shown.value.length
  finished = true
  emit('done')
}

onMounted(restart)
onBeforeUnmount(stopTimer)

// 文案变了就重打；速度和延迟只在下一轮生效，避免打字途中突然变速
watch(
  () => props.text,
  () => restart(),
)

defineExpose({ restart, finish })
</script>

<style scoped>
.tw {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 2px;
  color: inherit;
  font-family: inherit;
  line-height: 1.8;
  text-align: center;
}

.tw__text {
  /* \n 直接生效，保留行首空格 */
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.tw__caret {
  color: currentColor;
  font-weight: 400;
  animation: tw-blink 0.7s steps(1, end) infinite;
}

@keyframes tw-blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tw__caret {
    animation: none;
  }
}
</style>

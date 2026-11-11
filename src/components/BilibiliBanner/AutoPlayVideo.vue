/*
|--------------------------------------------------------------------------
| bilibili-banner-master/vue 里用到的自动播放视频图层
|
| 静音 video 一般可以直接自动播放；被浏览器策略拦截时，等用户第一次交互
| （点击 / 触摸）后再补一次 play。换主题导致 src 变化时重新走一遍这套流程。
|--------------------------------------------------------------------------
*/
<template>
  <video
    ref="videoRef"
    class="bb-video"
    muted
    loop
    autoplay
    playsinline
    preload="metadata"
    :src="src"
    :style="layerStyle"
    @canplay="videoCanPlay = true"
    @playing="videoIsPlaying = true"
  />
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import type { CSSProperties } from 'vue'

const props = defineProps<{
  src: string
  layerStyle?: CSSProperties
}>()

const videoRef = ref<HTMLVideoElement | null>(null)
const videoCanPlay = ref(false)
const videoIsPlaying = ref(false)

let retryTimer: ReturnType<typeof setTimeout> | undefined
let retryCount = 0

function clearRetry(): void {
  if (retryTimer) clearTimeout(retryTimer)
  retryTimer = undefined
}

/** 等到 canplay 再 play；最多重试 80 次（约 4s），避免不可用资源死循环 */
function tryPlay(): void {
  clearRetry()
  if (!props.src) return

  if (!videoCanPlay.value) {
    if (retryCount < 80) {
      retryCount += 1
      retryTimer = setTimeout(tryPlay, 50)
    }
    return
  }
  if (videoIsPlaying.value) return

  videoRef.value?.play().catch(() => {
    // 浏览器策略拦截时等用户交互再试，不要报错打扰宿主
  })
}

function onFirstInteraction(): void {
  removeInteractionListeners()
  tryPlay()
}

function addInteractionListeners(): void {
  window.addEventListener('click', onFirstInteraction)
  window.addEventListener('touchstart', onFirstInteraction)
}

function removeInteractionListeners(): void {
  window.removeEventListener('click', onFirstInteraction)
  window.removeEventListener('touchstart', onFirstInteraction)
}

function restart(): void {
  clearRetry()
  retryCount = 0
  videoCanPlay.value = false
  videoIsPlaying.value = false
  tryPlay()
}

watch(() => props.src, restart)

onMounted(() => {
  // 静音 + autoplay 通常能直接播；先主动试一次，失败则等用户交互
  tryPlay()
  addInteractionListeners()
})

onUnmounted(() => {
  clearRetry()
  removeInteractionListeners()
})
</script>

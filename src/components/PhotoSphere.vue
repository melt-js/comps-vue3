<template>
  <div class="ps" :style="rootStyle">
    <div
      ref="stageEl"
      class="ps__stage"
      :class="{ 'is-dragging': dragging }"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @pointerleave="onPointerUp"
    >
      <div ref="sphereEl" class="ps__sphere">
        <div
          v-for="(item, index) in items"
          :key="item.key"
          class="ps__item"
          :class="{ 'is-back': backFlags[index] }"
          :style="{ transform: item.transform }"
        >
          <img
            :src="item.src"
            :alt="`照片 ${index + 1}`"
            draggable="false"
            @click="onItemClick($event, item.src)"
            @dragstart.prevent
          />
        </div>
      </div>

      <p v-if="!items.length" class="ps__empty">
        还没有照片，点下面的「上传图片」选几张吧
      </p>

      <div class="ps__hint">
        <span>{{ items.length }} 张</span>
        <span>拖动旋转 · 点击放大</span>
      </div>
    </div>

    <div v-if="upload" class="ps__controls">
      <input
        ref="fileEl"
        class="ps__file"
        type="file"
        accept="image/*"
        multiple
        @change="onFilesChange"
      />
      <button type="button" class="ps__btn" @click="pickFiles">上传图片</button>
      <button type="button" class="ps__btn ps__btn--ghost" :disabled="!items.length" @click="reset">
        恢复默认
      </button>
      <span class="ps__tip">多选会覆盖现有照片，最多 {{ maxItems }} 张</span>
    </div>

    <Teleport to="body">
      <div v-if="zoomed" class="ps__modal" role="dialog" aria-label="查看大图" @click="closeZoom">
        <button type="button" class="ps__modal-close" aria-label="关闭" @click.stop="closeZoom">
          ×
        </button>
        <img class="ps__modal-img" :src="zoomed" alt="放大的照片" @click.stop />
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

/*
 * 由 video-code / 3D/3D照片球（支持上传版）.html 提取而来。
 *
 * 原 demo 是一整页的黑底照片球：25 张图按 Fibonacci 球面均匀铺在球壳上，拖动可以旋转、松手有惯性，
 * 背面照片变半透明，点一张放大看大图；底部还有「上传图片」（多选、压缩后覆盖）、「导出 HTML」、
 * 「自动播放」和「全屏展示」。
 *
 * 组件化后：
 * - 图片由 images 传入（不再内置一堆外链），上传会压缩到 maxSize 后通过 update:images 抛给宿主；
 * - 球面半径、缩略图大小、拖拽灵敏度、摩擦、自动旋转都能调，尺寸按 size 自适应；
 * - 旋转用 rAF 直接写 transform（避免每帧触发响应式更新），只有正/背面状态变化时才回写 Vue；
 * - 「导出 HTML」和「全屏展示」是 demo 级功能（前者要拼一份独立 HTML，后者交给宿主的全屏），没有带进组件。
 */
type SphereItem = {
  key: string
  src: string
  unit: { x: number; y: number; z: number }
  transform: string
}

const props = defineProps({
  /**
   * @description 照片地址列表（可以是 URL 或 dataURL），最多取前 maxItems 张
   */
  images: {
    type: Array as () => string[],
    default: () => [],
  },
  /**
   * @description 球体舞台边长，单位 px
   */
  size: {
    type: Number,
    default: 520,
  },
  /**
   * @description 缩略图边长，单位 px
   */
  thumbSize: {
    type: Number,
    default: 80,
  },
  /**
   * @description 球面半径，单位 px；传 0 表示按 size 自动算
   */
  radius: {
    type: Number,
    default: 0,
  },
  /**
   * @description 最多展示多少张照片
   */
  maxItems: {
    type: Number,
    default: 36,
  },
  /**
   * @description 是否允许拖拽旋转
   */
  draggable: {
    type: Boolean,
    default: true,
  },
  /**
   * @description 空闲时是否缓慢自转
   */
  autoRotate: {
    type: Boolean,
    default: true,
  },
  /**
   * @description 自转速度，单位 度/帧
   */
  autoSpeed: {
    type: Number,
    default: 0.06,
  },
  /**
   * @description 拖拽灵敏度，屏幕像素换算成角度的系数
   */
  sensitivity: {
    type: Number,
    default: 0.08,
  },
  /**
   * @description 松手后的惯性摩擦，越接近 1 转得越久
   */
  friction: {
    type: Number,
    default: 0.98,
  },
  /**
   * @description 是否显示上传/恢复控制条
   */
  upload: {
    type: Boolean,
    default: true,
  },
  /**
   * @description 上传图片压缩后的最长边，单位 px
   */
  maxUploadSize: {
    type: Number,
    default: 1200,
  },
  /**
   * @description 是否允许点击缩略图查看大图
   */
  zoomable: {
    type: Boolean,
    default: true,
  },
})

const emit = defineEmits<{
  'update:images': [images: string[]]
  /** 上传了新照片（已压缩成 dataURL） */
  upload: [images: string[]]
  /** 点了某张照片 */
  pick: [image: string]
}>()

const stageEl = ref<HTMLElement | null>(null)
const sphereEl = ref<HTMLElement | null>(null)
const fileEl = ref<HTMLInputElement | null>(null)

const list = ref<string[]>([])
const backFlags = ref<boolean[]>([])
const dragging = ref(false)
const zoomed = ref('')

/** 球心角度与惯性速度（度 / 度每帧） */
const angle = { x: 0, y: 0 }
const velocity = { x: 0, y: 0 }

let rafId = 0
let drag: { id: number; startX: number; startY: number; lastX: number; lastY: number; moved: boolean } | null =
  null

const effectiveRadius = computed(() =>
  props.radius > 0 ? props.radius : Math.max(60, props.size / 2.4),
)

const rootStyle = computed(() => ({
  '--ps-size': `${props.size}px`,
  '--ps-thumb': `${props.thumbSize}px`,
}))

/** Fibonacci 球面：让照片在球壳上均匀铺开，并让每张脸的朝向背离球心 */
const items = computed<SphereItem[]>(() => {
  const total = list.value.length
  const radius = effectiveRadius.value
  const goldenAngle = Math.PI * (3 - Math.sqrt(5))

  return list.value.map((src, index) => {
    // 只有一张时直接摆到正前方（球壳的 +z 方向），不然会被算到赤道侧面、看起来像一条缝
    const y = total === 1 ? 0 : 1 - (2 * (index + 0.5)) / total
    const radiusAtY = Math.sqrt(Math.max(1 - y * y, 0.01))
    const theta = goldenAngle * index
    const x = total === 1 ? 0 : Math.cos(theta) * radiusAtY
    const z = total === 1 ? 1 : Math.sin(theta) * radiusAtY
    const yaw = (Math.atan2(x, z) * 180) / Math.PI
    const pitch = (Math.atan2(y, Math.sqrt(x * x + z * z)) * 180) / Math.PI

    return {
      key: `${index}-${src.slice(-24)}`,
      src,
      unit: { x, y, z },
      transform: `translate3d(${(x * radius).toFixed(2)}px, ${(y * radius).toFixed(2)}px, ${(
        z * radius
      ).toFixed(2)}px) rotateY(${yaw.toFixed(2)}deg) rotateX(${(-pitch).toFixed(2)}deg)`,
    }
  })
})

/** 正 / 背面：把每个单位向量按当前角度转一遍，viewZ < 0 就是背面 */
function updateBackface() {
  const ax = (-angle.x * Math.PI) / 180
  const ay = (angle.y * Math.PI) / 180
  const cosX = Math.cos(ax)
  const sinX = Math.sin(ax)
  const cosY = Math.cos(ay)
  const sinY = Math.sin(ay)

  let changed = false
  const next = items.value.map((item, index) => {
    const { x, y, z } = item.unit
    const zAfterX = y * sinX + z * cosX
    const viewZ = -x * sinY + zAfterX * cosY
    const isBack = viewZ < 0
    if (isBack !== backFlags.value[index]) changed = true
    return isBack
  })

  if (changed) backFlags.value = next
}

function frame() {
  const sphere = sphereEl.value
  if (!dragging.value) {
    angle.x += velocity.x
    angle.y += velocity.y
    velocity.x *= props.friction
    velocity.y *= props.friction

    // 惯性衰减完就恢复缓慢自转
    if (props.autoRotate && Math.abs(velocity.y) < 0.01) {
      velocity.y = props.autoSpeed
    }
    if (Math.abs(velocity.x) < 0.005) velocity.x = 0
  }

  // 先居中再旋转，保证球心永远在舞台中心
  if (sphere) {
    sphere.style.transform = `translate(-50%, -50%) rotateX(${-angle.x}deg) rotateY(${angle.y}deg)`
  }
  updateBackface()

  rafId = requestAnimationFrame(frame)
}

function onPointerDown(event: PointerEvent) {
  if (!props.draggable) return
  if (event.button !== 0 && event.pointerType === 'mouse') return
  drag = {
    id: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    lastX: event.clientX,
    lastY: event.clientY,
    moved: false,
  }
  dragging.value = false
  velocity.x = 0
  velocity.y = 0
  try {
    stageEl.value?.setPointerCapture?.(event.pointerId)
  } catch {
    // 合成事件下会抛 NotFoundError，忽略
  }
}

function onPointerMove(event: PointerEvent) {
  if (!drag || drag.id !== event.pointerId) return

  // 判定「算拖拽还是算点击」用起点距离，避免一点点挪动就误判
  if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 4) {
    drag.moved = true
    dragging.value = true
  }
  if (!drag.moved) return

  // 真正旋转用相邻两次之间的增量，手感更跟手
  const dx = event.clientX - drag.lastX
  const dy = event.clientY - drag.lastY
  drag.lastX = event.clientX
  drag.lastY = event.clientY

  // 背面时上下方向翻转，鼠标往下拖，球也往下转
  const ay = (angle.y * Math.PI) / 180
  const signY = Math.cos(ay) >= 0 ? 1 : -1
  const dAngleX = dy * props.sensitivity * signY
  const dAngleY = dx * props.sensitivity

  angle.x += dAngleX
  angle.y += dAngleY
  velocity.x = dAngleX * 0.6
  velocity.y = dAngleY * 0.6
}

function onPointerUp(event: PointerEvent) {
  if (!drag || drag.id !== event.pointerId) return
  try {
    stageEl.value?.releasePointerCapture?.(event.pointerId)
  } catch {
    // 同上
  }
  const wasDrag = drag.moved
  drag = null
  dragging.value = false

  if (wasDrag) return

  // 指针捕获会把 click 重定向到舞台，所以「轻点缩略图」这里自己判定
  if (!props.zoomable) return
  const hit = document.elementFromPoint(event.clientX, event.clientY)
  const img = hit?.closest?.('.ps__item img') as HTMLImageElement | null
  if (img && stageEl.value?.contains(img)) {
    zoomed.value = img.src
    emit('pick', img.src)
  }
}

/** 键盘（Enter / 空格）触发的 click：detail 为 0，指针点击走 pointerup 那条路 */
function onItemClick(event: MouseEvent, src: string) {
  if (event.detail !== 0 || !props.zoomable) return
  zoomed.value = src
  emit('pick', src)
}

function closeZoom() {
  zoomed.value = ''
}

function pickFiles() {
  fileEl.value?.click()
}

async function onFilesChange(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || []).filter((file) => file.type.startsWith('image/'))
  if (!files.length) {
    input.value = ''
    return
  }

  const compressed = await Promise.all(
    files.slice(0, props.maxItems).map((file) => compressImage(file, props.maxUploadSize)),
  )
  const next = compressed.filter(Boolean).slice(0, props.maxItems)
  list.value = next
  emit('update:images', next)
  emit('upload', next)
  input.value = ''
}

/** 用 canvas 把上传图压到 maxSize 以内（JPEG 0.85），避免 base64 撑爆页面 */
function compressImage(file: File, maxSize = 1200, quality = 0.85): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result || '')
      const image = new Image()
      image.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height))
        const width = Math.max(1, Math.round(image.width * scale))
        const height = Math.max(1, Math.round(image.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(dataUrl)
          return
        }
        ctx.drawImage(image, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      image.onerror = () => resolve(dataUrl)
      image.src = dataUrl
    }
    reader.onerror = () => resolve('')
    reader.readAsDataURL(file)
  })
}

/** 恢复成外部传入的 images */
function reset() {
  list.value = props.images.slice(0, props.maxItems)
  angle.x = 0
  angle.y = 0
  velocity.x = 0
  velocity.y = props.autoRotate ? props.autoSpeed : 0
  emit('update:images', [...list.value])
}

watch(
  () => props.images,
  (next) => {
    list.value = (next || []).slice(0, props.maxItems)
  },
  { immediate: true, deep: true },
)

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') closeZoom()
}

function onVisibilityChange() {
  if (document.hidden) {
    if (rafId) cancelAnimationFrame(rafId)
    rafId = 0
  } else if (!rafId) {
    rafId = requestAnimationFrame(frame)
  }
}

onMounted(() => {
  velocity.y = props.autoRotate ? props.autoSpeed : 0
  rafId = requestAnimationFrame(frame)
  document.addEventListener('keydown', onKeydown)
  document.addEventListener('visibilitychange', onVisibilityChange)
})

onBeforeUnmount(() => {
  if (rafId) cancelAnimationFrame(rafId)
  document.removeEventListener('keydown', onKeydown)
  document.removeEventListener('visibilitychange', onVisibilityChange)
})

defineExpose({
  reset,
  openZoom: (src: string) => {
    zoomed.value = src
  },
  closeZoom,
  images: list,
})
</script>

<style scoped>
.ps {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

.ps__stage {
  position: relative;
  width: var(--ps-size);
  height: var(--ps-size);
  overflow: hidden;
  border-radius: 20px;
  background: radial-gradient(circle at 50% 45%, #22304a 0%, #0e1420 62%, #070a10 100%);
  perspective: 1000px;
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.ps__stage.is-dragging {
  cursor: grabbing;
}

/* 球壳：中心固定在舞台中心，旋转只作用在这一层 */
.ps__sphere {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  transform-style: preserve-3d;
  will-change: transform;
}

/* 每张图都是一个「点」，位置完全靠 translate3d 摆到球面上 */
.ps__item {
  position: absolute;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
  transform-style: preserve-3d;
  transform-origin: 0 0;
  transition: opacity 0.2s ease;
}

/* 背面照片压暗，避免和正面抢注意力 */
.ps__item.is-back {
  opacity: 0.35;
  pointer-events: none;
}

.ps__item img {
  display: block;
  width: var(--ps-thumb);
  height: var(--ps-thumb);
  /* 宿主常见 reset 里有 img { max-width: 100% }，而这里的包含块是 0×0 的定位点，
     不显式关掉会把缩略图压成一条缝 */
  max-width: none;
  max-height: none;
  border: 2px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  object-fit: cover;
  cursor: pointer;
  transform: translate(-50%, -50%);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.35);
  transition:
    transform 0.25s ease,
    box-shadow 0.25s ease,
    border-color 0.25s ease;
  -webkit-user-drag: none;
}

.ps__item:hover {
  z-index: 100;
}

.ps__item:hover img {
  border-color: #3498db;
  box-shadow: 0 8px 25px rgba(52, 152, 219, 0.45);
  transform: translate(-50%, -50%) scale(1.18);
}

.ps__empty {
  position: absolute;
  top: 50%;
  left: 50%;
  margin: 0;
  padding: 0 24px;
  color: rgba(255, 255, 255, 0.45);
  font-size: 13px;
  line-height: 1.8;
  text-align: center;
  transform: translate(-50%, -50%);
}

.ps__hint {
  position: absolute;
  right: 14px;
  bottom: 12px;
  display: flex;
  gap: 10px;
  color: rgba(255, 255, 255, 0.35);
  font-size: 11px;
  letter-spacing: 0.06em;
  pointer-events: none;
}

.ps__controls {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  justify-content: center;
}

.ps__file {
  display: none;
}

.ps__btn {
  padding: 7px 16px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: #2c3e50;
  color: #ecf0f1;
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
  transition:
    background 0.2s ease,
    color 0.2s ease,
    opacity 0.2s ease;
}

.ps__btn:hover:not(:disabled) {
  background: #3498db;
  color: #fff;
}

.ps__btn--ghost {
  border-color: rgba(255, 255, 255, 0.16);
  background: transparent;
  color: rgba(255, 255, 255, 0.6);
}

.ps__btn--ghost:hover:not(:disabled) {
  background: rgba(52, 152, 219, 0.16);
  color: #fff;
}

.ps__btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.ps__tip {
  color: rgba(255, 255, 255, 0.35);
  font-size: 11px;
}

/* 大图查看：挂到 body 上，避免被舞台的 overflow 裁掉 */
.ps__modal {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.88);
  animation: ps-fade 0.25s ease;
}

.ps__modal-img {
  max-width: 90vw;
  max-height: 88vh;
  border-radius: 10px;
  box-shadow: 0 12px 44px rgba(0, 0, 0, 0.55);
  animation: ps-zoom 0.25s ease;
}

.ps__modal-close {
  position: absolute;
  top: 18px;
  right: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 26px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.2s ease;
}

.ps__modal-close:hover {
  background: rgba(255, 255, 255, 0.22);
}

@keyframes ps-fade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes ps-zoom {
  from {
    opacity: 0;
    transform: scale(0.85);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@media (max-width: 520px) {
  .ps__stage {
    width: min(var(--ps-size), 92vw);
    height: min(var(--ps-size), 92vw);
  }

  .ps__tip {
    display: none;
  }
}
</style>

/*
|--------------------------------------------------------------------------
| banner 用到的公共类型（与 bilibili-banner-master/vue 的 base 类型保持一致）
|--------------------------------------------------------------------------
*/

export type BannerLayerType = 'image' | 'video'

/** 原始图层数据：x / newX 是移动前的坐标，*Move* 字段是鼠标划到边界时的目标值 */
export type OriDataType = {
  type: BannerLayerType
  file: string
  width: number
  height: number
  x: number
  y?: number
  r?: number
  s?: number
  o?: number
  newX: number
  newY?: number
  newRotate?: number
  newScale?: number
  newOpacity?: number
  bench: number
  filter?: string
}

/** 左右拖动上限：left / right 是相对原始位置的像素距离 */
export type BannerMaxMove = {
  left: number
  right: number
}

/** 用某个图层的宽度反推拖动上限：index 是图层下标，cut 是额外让出的像素 */
export type BannerPositionLimit = {
  index: number
  cut: number
}

export type BilibiliBannerThemeConfig = {
  marginLeft?: number
  moveRate?: number
  maxMove?: BannerMaxMove
  maxLeftPosition?: BannerPositionLimit
  maxRightPosition?: BannerPositionLimit
  imgData: OriDataType[]
}

/** 每个图层当前插值出来的样式数据 */
export type BannerCurrentLayer = {
  x: number
  y: number
  rotate: number
  scale: number
  opacity: number
}

export type BilibiliBannerTheme =
  | 'autumn-1'
  | 'autumn-2'
  | 'autumn-3'
  | 'autumn-4'
  | 'autumn-5'
  | 'spring-1'
  | 'spring-2'
  | 'spring-3'
  | 'spring-4'
  | 'spring-5'
  | 'spring-6'
  | 'summer-1'
  | 'summer-2'
  | 'summer-3'
  | 'summer-4'
  | 'summer-5'
  | 'summer-6'
  | 'summer-7'
  | 'winter-1'
  | 'winter-2'
  | 'winter-3'
  | 'winter-4'
  | 'winter-5'

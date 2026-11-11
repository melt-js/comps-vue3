/*
|--------------------------------------------------------------------------
| 23 套 B 站 banner 的数据（原仓库 bilibili-banner-master/vue 的 inst 组件）
|
| 每个主题一个工厂函数：每次调用都返回一份新的 imgData，避免多个实例互相污染。
|--------------------------------------------------------------------------
*/
import { createAutumn1 } from './themes/autumn-1'
import { createAutumn2 } from './themes/autumn-2'
import { createAutumn3 } from './themes/autumn-3'
import { createAutumn4 } from './themes/autumn-4'
import { createAutumn5 } from './themes/autumn-5'
import { createSpring1 } from './themes/spring-1'
import { createSpring2 } from './themes/spring-2'
import { createSpring3 } from './themes/spring-3'
import { createSpring4 } from './themes/spring-4'
import { createSpring5 } from './themes/spring-5'
import { createSpring6 } from './themes/spring-6'
import { createSummer1 } from './themes/summer-1'
import { createSummer2 } from './themes/summer-2'
import { createSummer3 } from './themes/summer-3'
import { createSummer4 } from './themes/summer-4'
import { createSummer5 } from './themes/summer-5'
import { createSummer6 } from './themes/summer-6'
import { createSummer7 } from './themes/summer-7'
import { createWinter1 } from './themes/winter-1'
import { createWinter2 } from './themes/winter-2'
import { createWinter3 } from './themes/winter-3'
import { createWinter4 } from './themes/winter-4'
import { createWinter5 } from './themes/winter-5'
import type { BilibiliBannerThemeConfig, BilibiliBannerTheme } from './types'

export const BILIBILI_BANNER_THEMES = ['autumn-1', 'autumn-2', 'autumn-3', 'autumn-4', 'autumn-5', 'spring-1', 'spring-2', 'spring-3', 'spring-4', 'spring-5', 'spring-6', 'summer-1', 'summer-2', 'summer-3', 'summer-4', 'summer-5', 'summer-6', 'summer-7', 'winter-1', 'winter-2', 'winter-3', 'winter-4', 'winter-5'] as const

const themeFactories: Record<BilibiliBannerTheme, () => BilibiliBannerThemeConfig> = {
  'autumn-1': createAutumn1,
  'autumn-2': createAutumn2,
  'autumn-3': createAutumn3,
  'autumn-4': createAutumn4,
  'autumn-5': createAutumn5,
  'spring-1': createSpring1,
  'spring-2': createSpring2,
  'spring-3': createSpring3,
  'spring-4': createSpring4,
  'spring-5': createSpring5,
  'spring-6': createSpring6,
  'summer-1': createSummer1,
  'summer-2': createSummer2,
  'summer-3': createSummer3,
  'summer-4': createSummer4,
  'summer-5': createSummer5,
  'summer-6': createSummer6,
  'summer-7': createSummer7,
  'winter-1': createWinter1,
  'winter-2': createWinter2,
  'winter-3': createWinter3,
  'winter-4': createWinter4,
  'winter-5': createWinter5,
}

/** 按主题名取一份新的 banner 配置 */
export function createBilibiliBannerTheme(theme: BilibiliBannerTheme): BilibiliBannerThemeConfig {
  return (themeFactories[theme] || themeFactories['spring-1'])()
}

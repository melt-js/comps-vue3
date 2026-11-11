/*
|--------------------------------------------------------------------------
| 从 bilibili-banner-master/vue 的 bilibili-spring-3-banner.component.vue 迁移而来
|--------------------------------------------------------------------------
*/
import type { BilibiliBannerThemeConfig, OriDataType } from '../types'
export function createSpring3(): BilibiliBannerThemeConfig {

const moveRate: number = -2;
const imgData: Array<OriDataType> = [
	{ type: 'image', file: 'c3c807eb2f5bcc333a3bf3189634e3f9867c6a85.webp', width: 1920 * 0.9, height: 180 * 0.9, x: 0, newX: 1, bench: 1 },
];

  return {
    moveRate,
    imgData,
  }
}

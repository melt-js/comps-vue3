/*
|--------------------------------------------------------------------------
| 从 bilibili-banner-master/vue 的 bilibili-winter-2-banner.component.vue 迁移而来
|--------------------------------------------------------------------------
*/
import type { BilibiliBannerThemeConfig, OriDataType } from '../types'
export function createWinter2(): BilibiliBannerThemeConfig {

const marginLeft: number = -45;
const moveRate: number = -2;
const imgData: Array<OriDataType> = [
	{ type: 'image', file: 'f97330ca7905307f539b2af1f64fa2a2fdb4eaed.webp', width: 1920 * 0.9, height: 180 * 0.9, x: 0, newX: 1, bench: 1 },
];

  return {
    marginLeft,
    moveRate,
    imgData,
  }
}

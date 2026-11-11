/*
|--------------------------------------------------------------------------
| 从 bilibili-banner-master/vue 的 bilibili-autumn-2-banner.component.vue 迁移而来
|--------------------------------------------------------------------------
*/
import type { BilibiliBannerThemeConfig, OriDataType } from '../types'
export function createAutumn2(): BilibiliBannerThemeConfig {

const marginLeft: number = -90;
const moveRate: number = -2;
const imgData: Array<OriDataType> = [
	{ type: 'image', file: 'a10dc06f92ff2cf438244d0ed13dba27be88d73f.webp', width: 1920 * 0.9, height: 180 * 0.9, x: 0, newX: 1, bench: 1 },
];

  return {
    marginLeft,
    moveRate,
    imgData,
  }
}

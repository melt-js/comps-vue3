/*
|--------------------------------------------------------------------------
| 从 bilibili-banner-master/vue 的 bilibili-summer-3-banner.component.vue 迁移而来
|--------------------------------------------------------------------------
*/
import type { BilibiliBannerThemeConfig, OriDataType } from '../types'
export function createSummer3(): BilibiliBannerThemeConfig {

const marginLeft: number = 112;
const moveRate: number = -2;
const imgData: Array<OriDataType> = [
	{ type: 'image', file: 'fba0c9bac0fad743e9befa9305f197a919561580.png@3840w_360h_1c_90q.webp', width: 1920 * 0.9, height: 180 * 0.9, x: 0, newX: 1, bench: 1 },
];

  return {
    marginLeft,
    moveRate,
    imgData,
  }
}

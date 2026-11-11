/*
|--------------------------------------------------------------------------
| 从 bilibili-banner-master/vue 的 bilibili-summer-2-banner.component.vue 迁移而来
|--------------------------------------------------------------------------
*/
import type { BilibiliBannerThemeConfig, OriDataType } from '../types'
export function createSummer2(): BilibiliBannerThemeConfig {

const marginLeft: number = 0;
const moveRate: number = -2;
const maxLeftPosition = { index: 0, cut: 0 };
const maxRightPosition = { index: 0, cut: 0 };
const imgData: Array<OriDataType> = [
	{ type: 'image', file: 'background.png', width: 960 * 0.9, height: 180 * 0.9, x: 0, newX: 1, bench: 1 },
	{ type: 'image', file: 'cover.png', width: 960 * 0.9, height: 180 * 0.9, x: 0, newX: 1, bench: 1 },
];

  return {
    marginLeft,
    moveRate,
    maxLeftPosition,
    maxRightPosition,
    imgData,
  }
}

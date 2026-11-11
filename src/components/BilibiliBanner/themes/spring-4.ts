/*
|--------------------------------------------------------------------------
| 从 bilibili-banner-master/vue 的 bilibili-spring-4-banner.component.vue 迁移而来
|--------------------------------------------------------------------------
*/
import type { BilibiliBannerThemeConfig, OriDataType } from '../types'
export function createSpring4(): BilibiliBannerThemeConfig {

const marginLeft: number = -40;
const moveRate: number = -2;
const imgData: Array<OriDataType> = [
	{ type: 'image', file: '2e81e0644044fafd5e72de3e595d7db6f65122ef.png@3840w_360h_1c_90q.webp', width: 1920 * 0.9, height: 180 * 0.9, x: 0, newX: 1, bench: 1 },
];

  return {
    marginLeft,
    moveRate,
    imgData,
  }
}

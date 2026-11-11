/*
|--------------------------------------------------------------------------
| 从 bilibili-banner-master/vue 的 bilibili-spring-2-banner.component.vue 迁移而来
|--------------------------------------------------------------------------
*/
import type { BilibiliBannerThemeConfig, OriDataType } from '../types'
export function createSpring2(): BilibiliBannerThemeConfig {

const marginLeft: number = -20;
const moveRate: number = -2;
const maxLeftPosition = { index: 0, cut: 0 };
const maxRightPosition = { index: 0, cut: 0 };

function getFileType(type: string): string {
	switch (type) {
		case 'image':
			return 'gif';
		case 'video':
			return 'mp4';
		default:
			return 'gif';
	}
}

let type: 'image' | 'video' = 'video';

const imgData: Array<OriDataType> = [
	{ type: type, file: `kPbkWcX74M.${getFileType(type)}`, width: 960 * 0.9, height: 180 * 0.9, x: 0, newX: 1, bench: 1 },
];

  return {
    marginLeft,
    moveRate,
    maxLeftPosition,
    maxRightPosition,
    imgData,
  }
}

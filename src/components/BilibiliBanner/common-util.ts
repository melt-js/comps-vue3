/*
|--------------------------------------------------------------------------
| 和 bilibili-banner-master/vue 的 common-util 一致
|--------------------------------------------------------------------------
*/

export class CommonUtil {
  /** 当前环境是否是触摸设备（决定用 touch 事件还是 mouse 事件） */
  public static isPhonePointerEvent(): boolean {
    return 'ontouchmove' in window
  }

  /** 取 [minNum, maxNum] 之间的随机数，decimaNum 不传时取整数 */
  public static randomNum(minNum: number, maxNum: number, decimaNum?: number): number {
    let max = 0
    let min = 0
    if (minNum <= maxNum) {
      min = minNum
      max = maxNum
    } else {
      min = maxNum
      max = minNum
    }
    switch (arguments.length) {
      case 1:
        return Math.floor(Math.random() * (max + 1))
      case 2:
        return Math.floor(Math.random() * (max - min + 1) + min)
      case 3:
        return parseFloat((Math.random() * (max - min) + min).toFixed(decimaNum))
      default:
        return Math.random()
    }
  }
}

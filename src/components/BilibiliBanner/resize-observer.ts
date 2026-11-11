/*
|--------------------------------------------------------------------------
| 容器宽度监听（用来算左右拖动上限）
|--------------------------------------------------------------------------
*/

export class ResizeObserverWrap {
  private readonly observer: ResizeObserver

  private readonly dom: Element

  constructor(dom: Element, callback: (e: Element) => void) {
    this.dom = dom
    this.observer = new ResizeObserver((entries) => {
      if (!Array.isArray(entries) || !entries.length) {
        return
      }
      entries.forEach((entry) => {
        callback(entry.target)
      })
    })
    this.observer.observe(this.dom)
  }

  public unmount(): void {
    this.observer.unobserve(this.dom)
    this.observer.disconnect()
  }
}

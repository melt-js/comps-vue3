import { isMasterApp } from 'hel-iso'
import { libReady } from 'hel-lib-proxy'
import { LIB_NAME } from './configs/subApp'
// import { preFetchLib } from 'hel-micro'

(async function () {
  // 指定 chunk 名：产物里除了 vendors / app 之外的两块就是 libProperties（组件集合）和 loadApp（本地调试壳）
  const libProperties = await import(/* webpackChunkName: "libProperties" */ './entrance/libProperties')
  // 注意此处传递的是 default
  libReady(LIB_NAME, libProperties.default)

  // 非子应用时（即不是被别的模块触发载入的情况），自己挂载渲染节点，方便本地调试
  // 可根据项目实际情况控制是否载入 loadApp 文件
  if (isMasterApp()) {
    await import(/* webpackChunkName: "loadApp" */ './loadApp')
  }
}()).catch(console.error)

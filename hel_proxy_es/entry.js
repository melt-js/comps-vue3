import { exposeLib } from 'hel-lib-proxy';

/*
|--------------------------------------------------------------------------
|
| 对应 package.json/appGroupName
|
|--------------------------------------------------------------------------
*/
const LIB_NAME = 'comps-vue3';

/**
 * 将提供给用户的lib暴露出去（同时也暴露了类型）
 */
const dtlib = exposeLib(LIB_NAME);

export { dtlib as default, dtlib };

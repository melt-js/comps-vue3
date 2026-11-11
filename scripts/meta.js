/*
|--------------------------------------------------------------------------
|
| 生成 hel-meta.json（写入 hel_dist）
|
|--------------------------------------------------------------------------
*/
const fs = require('fs')
const path = require('path')
const helDevUtils = require('hel-dev-utils')
const packageJson = require('../package.json')
const appInfo = require('../appInfo')

const META_PATH = path.join(__dirname, '../hel_dist/hel-meta.json')

/**
 * hel-dev-utils 在 Windows 下会把 dist 扫描出来的资源路径拼成反斜杠形式，
 * 形如 https://unpkg.com/xxx/hel_dist/\js\app.js，CDN 上是无效地址。
 * 这里统一转成 / 并去重，保证发布的 hel-meta.json 在 Windows 构建也正确。
 */
function normalizePathSeparators(value) {
  if (typeof value === 'string') {
    return value
      .replace(/\\/g, '/')
      .replace(/([^:])\/{2,}/g, '$1/')
  }
  if (Array.isArray(value)) {
    return [...new Set(value.map(normalizePathSeparators))]
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, val]) => [key, normalizePathSeparators(val)]),
    )
  }
  return value
}

async function main() {
  const meta = await helDevUtils.extractHelMetaJson({
    appInfo,
    buildDirFullPath: path.join(__dirname, '../hel_dist'),
    packageJson,
  })

  const normalizedMeta = normalizePathSeparators(meta)
  fs.writeFileSync(META_PATH, JSON.stringify(normalizedMeta, null, 2))
  console.log('[comps-vue3] hel-meta.json 生成完成')
}

main().catch((err) => {
  console.error('[comps-vue3] hel-meta.json 生成失败:', err)
  process.exit(-1)
})

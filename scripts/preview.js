/*
|--------------------------------------------------------------------------
| 本地预览 hel_dist 构建产物（默认 20020，带 CORS）
|--------------------------------------------------------------------------
| 预览前请先执行 `pnpm run build:local`，让产物里的资源地址指向
| http://localhost:20020，否则 index.html 会引用 unpkg 上的线上地址。
*/
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')

// 端口写死，保证本包脱离 monorepo 也能独立运行（全局规则见根目录 ports.json）
const PORT = Number(process.env.PORT) || 20020
const ROOT = path.resolve(__dirname, '../hel_dist')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': '*',
    'Access-Control-Allow-Headers': '*',
    ...headers,
  })
  res.end(body)
}

http
  .createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0])
    const relativePath = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '')
    let filePath = path.resolve(ROOT, relativePath)

    // 防止路径穿越
    if (filePath !== ROOT && !filePath.startsWith(`${ROOT}${path.sep}`)) {
      send(res, 403, 'Forbidden')
      return
    }

    fs.stat(filePath, (statErr, stat) => {
      if (!statErr && stat.isDirectory()) {
        filePath = path.join(filePath, 'index.html')
      }

      fs.readFile(filePath, (readErr, content) => {
        if (readErr) {
          send(res, 404, 'Not Found')
          return
        }
        const contentType = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
        send(res, 200, content, { 'Content-Type': contentType })
      })
    })
  })
  .listen(PORT, () => {
    console.log(`[comps-vue3] preview: http://localhost:${PORT}`)
  })

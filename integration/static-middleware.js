/**
 * Minimal connect-style static file middleware.
 *
 * Vite's own static handling only covers `root` and `publicDir`; the mock's
 * assets live inside node_modules, so they get their own mount. Deliberately
 * dependency-free — it serves a fixed directory of pre-built files, nothing
 * more.
 */
import fs from 'node:fs'
import path from 'node:path'

const MIME_TYPES = {
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.css': 'text/css; charset=utf-8',
  '.eot': 'application/vnd.ms-fontobject',
  '.gif': 'image/gif',
  '.htm': 'text/html; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.otf': 'font/otf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.webm': 'video/webm',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
}

/**
 * @param {string} rootDir Absolute directory to serve from.
 * @param {object} [options]
 * @param {string} [options.cacheControl] `Cache-Control` header to send.
 * @returns {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse, next: Function) => void}
 */
export function createStaticMiddleware(rootDir, options = {}) {
  const { cacheControl = 'no-cache' } = options
  const resolvedRoot = path.resolve(rootDir)

  return function serveMockAsset(req, res, next) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()

    const filePath = resolveWithinRoot(resolvedRoot, req.url)
    if (!filePath) return next()

    let stats
    try {
      stats = fs.statSync(filePath)
    } catch {
      return next()
    }
    if (!stats.isFile()) return next()

    const etag = `W/"${stats.size.toString(16)}-${stats.mtimeMs.toString(16)}"`
    res.setHeader('Content-Type', mimeTypeOf(filePath))
    res.setHeader('Cache-Control', cacheControl)
    res.setHeader('ETag', etag)
    res.setHeader('Access-Control-Allow-Origin', '*') // fonts are fetched with crossorigin

    if (req.headers['if-none-match'] === etag) {
      res.statusCode = 304
      return res.end()
    }

    res.setHeader('Content-Length', String(stats.size))
    if (req.method === 'HEAD') {
      res.statusCode = 200
      return res.end()
    }

    res.statusCode = 200
    const stream = fs.createReadStream(filePath)
    stream.on('error', () => {
      res.statusCode = 500
      res.end()
    })
    stream.pipe(res)
  }
}

/**
 * Turns a request URL into an absolute path guaranteed to sit inside `root`,
 * or `null` if it escapes (`..`, encoded traversal, NUL bytes).
 */
function resolveWithinRoot(root, requestUrl = '/') {
  let pathname
  try {
    pathname = decodeURIComponent(requestUrl.split('?')[0].split('#')[0])
  } catch {
    return null // malformed percent-encoding
  }
  if (pathname.includes('\0')) return null

  const candidate = path.resolve(root, '.' + path.posix.resolve('/', pathname))
  if (candidate !== root && !candidate.startsWith(root + path.sep)) return null
  return candidate
}

function mimeTypeOf(filePath) {
  return (
    MIME_TYPES[path.extname(filePath).toLowerCase()] ||
    'application/octet-stream'
  )
}

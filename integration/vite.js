/**
 * Vite integration for 00_srf-news-platform-mock.
 *
 * Replaces the old postinstall-plus-absolute-symlink setup: a fork adds one
 * plugin to its `vite.config.js` and gets the platform chrome in dev without
 * anything being symlinked, copied into the repo, or reached into by path.
 *
 *   import platformMock from '00_srf-news-platform-mock/vite'
 *
 *   export default defineConfig({
 *     plugins: [platformMock({ brand: 'srf' }), react()],
 *   })
 */
import fs from 'node:fs'
import path from 'node:path'

import { resolveMock } from './index.js'
import { createStaticMiddleware } from './static-middleware.js'

const PLUGIN_NAME = 'srf-news-platform-mock'

/** Marker that identifies an `index.html` this plugin owns. */
const BANNER_ID = 'srf-news-platform-mock:generated'

/**
 * @typedef {object} PlatformMockOptions
 * @property {string} [brand]
 *   Brand to mock — `'srf' | 'rts' | 'rsi' | 'rtr' | 'swi'`. Falls back to
 *   `process.env.PLATFORM_MOCK_BRAND`, then `process.env.PLATFORM`, then
 *   `'srf'`.
 * @property {string|null} [entry]
 *   Module the mock should mount. When set, the mock's `<script type="module">`
 *   src is rewritten to it. Defaults to `null` — keep whatever the mock ships
 *   (`/src/index.jsx`).
 * @property {string|null} [mountId]
 *   Substitutes the mock's `<%= id %>` placeholder. Leave `null` to let
 *   `vite-plugin-html` fill it in, as the template forks already do.
 * @property {string|null} [title]
 *   Substitutes the mock's `<%= title %>` placeholder. Same defaulting as
 *   `mountId`.
 * @property {string} [htmlPath]
 *   Where the entry HTML is materialised. Defaults to `<root>/index.html`,
 *   which is what Vite expects and what forks already gitignore.
 * @property {'minimal'|'mock'} [buildHtml]
 *   Entry HTML used by `vite build`. `'minimal'` (default) builds a bare
 *   mount-point document: forks strip the mock chrome from `dist/` anyway, and
 *   skipping it avoids Vite warning about every unresolvable `/mock-assets`
 *   URL. `'mock'` builds the full platform page — pair it with
 *   `assets: 'copy'` if you want a self-contained static preview.
 * @property {'serve'|'copy'} [assets]
 *   `'serve'` (default) streams the assets straight out of node_modules via
 *   dev middleware — nothing lands in the fork's working tree. `'copy'`
 *   mirrors them into `<publicDir>/mock-assets`, which reproduces the old
 *   symlink behaviour and makes them part of the build output.
 * @property {boolean} [verbose]
 *   Log a one-line summary when the dev server starts. Defaults to `true`.
 */

/**
 * @param {PlatformMockOptions} [options]
 * @returns {import('vite').Plugin}
 */
export default function platformMock(options = {}) {
  const {
    brand = process.env.PLATFORM_MOCK_BRAND || process.env.PLATFORM || 'srf',
    entry = null,
    mountId = null,
    title = null,
    htmlPath = null,
    buildHtml = 'minimal',
    assets = 'serve',
    verbose = true,
  } = options

  assertOneOf('buildHtml', buildHtml, ['minimal', 'mock'])
  assertOneOf('assets', assets, ['serve', 'copy'])

  /** @type {import('./index.js').Mock} */
  let mock
  let resolvedHtmlPath
  let command

  return {
    name: PLUGIN_NAME,
    enforce: 'pre',

    configResolved(config) {
      command = config.command
      mock = resolveMock(brand)
      resolvedHtmlPath = htmlPath
        ? path.resolve(config.root, htmlPath)
        : path.join(config.root, 'index.html')

      const useFullMock = command === 'serve' || buildHtml === 'mock'
      const html = useFullMock
        ? transformMockHtml(fs.readFileSync(mock.htmlPath, 'utf8'), {
            entry,
            mountId,
            title,
          })
        : buildMinimalHtml(mock, { entry, mountId, title })

      writeGeneratedFile(resolvedHtmlPath, withBanner(html, mock, command))

      if (assets === 'copy') {
        mirrorAssets(mock, path.join(config.publicDir, 'mock-assets'))
      }
    },

    configureServer(server) {
      if (assets === 'serve') {
        const middleware = createStaticMiddleware(mock.assetsDir)
        // Two mounts, both load-bearing: Vite's dev HTML transform rewrites the
        // mock's root-relative asset URLs to `<base>/mock-assets/…`, so with
        // a non-root base that is where most requests land. The bare mount
        // still serves what the transform never sees — url() references inside
        // merged.css, and anything requested at runtime.
        for (const mountPath of assetMountPaths(server.config.base)) {
          server.middlewares.use(mountPath, middleware)
        }
      }

      if (!verbose) return
      server.httpServer?.once('listening', () => {
        const source =
          assets === 'serve'
            ? 'streamed from node_modules'
            : 'copied to public/'
        server.config.logger.info(
          `  \x1b[32m➜\x1b[0m  platform mock: \x1b[1m${mock.brand}\x1b[0m ` +
            `(lang ${mock.lang}, generated ${mock.manifest.generatedAt ?? 'unknown'}) — assets ${source}`,
        )
      })
    },
  }
}

/** URL prefixes the asset middleware is mounted on. */
function assetMountPaths(base) {
  const paths = new Set(['/mock-assets'])
  if (base && base !== '/') {
    paths.add(path.posix.join('/', base, 'mock-assets'))
  }
  return paths
}

/**
 * Applies the consumer's overrides to a mock's HTML. Every replacement is
 * opt-in so an untouched mock stays byte-identical to what was generated.
 */
function transformMockHtml(html, { entry, mountId, title }) {
  let out = html
  if (entry) {
    out = out.replace(
      /(<script\b[^>]*\btype=["']module["'][^>]*\bsrc=["'])([^"']+)(["'])/gi,
      (_match, before, _src, after) => `${before}${entry}${after}`,
    )
  }
  if (mountId) out = out.replaceAll('<%= id %>', mountId)
  if (title) out = out.replaceAll('<%= title %>', title)
  return out
}

/**
 * Bare entry document for `vite build`. Keeps exactly the parts the bundle
 * needs — language, title, mount point, entry module — and none of the
 * platform chrome, which forks delete from `dist/` regardless.
 */
function buildMinimalHtml(mock, { entry, mountId, title }) {
  const id = mountId ?? '<%= id %>'
  const pageTitle = title ?? '<%= title %>'
  const entryModule = entry ?? '/src/index.jsx'

  return `<!doctype html>
<html lang="${mock.lang}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
    <title>${pageTitle}</title>
  </head>
  <body data-bu="${mock.brand}">
    <div id="${id}"></div>
    <script type="module" src="${entryModule}"></script>
  </body>
</html>
`
}

/** Stamps the generated file so it is obvious it must not be edited. */
function withBanner(html, mock, command) {
  const banner =
    `<!-- ${BANNER_ID} -->\n` +
    `<!--\n` +
    `  GENERATED FILE — DO NOT EDIT, DO NOT COMMIT.\n` +
    `  Written by the "${PLUGIN_NAME}" Vite plugin on every dev/build run.\n` +
    `  brand: ${mock.brand} · mode: ${command} · source: ${mock.manifest.sourceUrl ?? 'n/a'}\n` +
    `  Change it in 00_srf-news-platform-mock, not here.\n` +
    `-->\n`

  // After the doctype, so the document never starts with a comment.
  const doctype = html.match(/^\s*<!doctype html>/i)
  return doctype
    ? html.replace(doctype[0], `${doctype[0].trim()}\n${banner}`)
    : banner + html
}

/**
 * Writes `content` to `filePath` unless it is already identical — an
 * unnecessary write would trigger a full dev-server reload on every restart.
 * Refuses to clobber a file this plugin does not own.
 */
function writeGeneratedFile(filePath, content) {
  if (fs.existsSync(filePath)) {
    const existing = fs.readFileSync(filePath, 'utf8')
    if (existing === content) return
    if (!existing.includes(BANNER_ID)) {
      throw new Error(
        `[platform-mock] Refusing to overwrite ${filePath}: it was not generated by this plugin.\n` +
          `  Delete or rename it (and add it to .gitignore), or point the plugin elsewhere with the \`htmlPath\` option.`,
      )
    }
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content, 'utf8')
}

/**
 * Mirrors a mock's assets into the consumer's `publicDir`. Skipped when the
 * stamp shows the same mock generation is already there — the tree is a few
 * thousand files.
 */
function mirrorAssets(mock, targetDir) {
  const stampPath = path.join(targetDir, '.platform-mock-stamp')
  const stamp = `${mock.brand}\n${mock.manifest.generatedAt ?? ''}\n`

  if (
    fs.existsSync(stampPath) &&
    fs.readFileSync(stampPath, 'utf8') === stamp
  ) {
    return
  }

  fs.rmSync(targetDir, { recursive: true, force: true })
  fs.mkdirSync(targetDir, { recursive: true })
  fs.cpSync(mock.assetsDir, targetDir, { recursive: true })
  fs.writeFileSync(stampPath, stamp, 'utf8')
  console.log(`[platform-mock] Mirrored ${mock.brand} assets to ${targetDir}`)
}

function assertOneOf(name, value, allowed) {
  if (!allowed.includes(value)) {
    throw new Error(
      `[platform-mock] Invalid \`${name}\`: ${JSON.stringify(value)}. Expected one of ${allowed
        .map((v) => `"${v}"`)
        .join(', ')}.`,
    )
  }
}

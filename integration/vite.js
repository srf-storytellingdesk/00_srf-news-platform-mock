/**
 * Vite integration for 00_srf-news-platform-mock.
 *
 *
 *   import platformMock from '00_srf-news-platform-mock/vite'
 *
 *   export default defineConfig({
 *     plugins: [platformMock({ brand: 'srf' }), react()],
 *   })
 *
 * Besides materialising the entry HTML, the plugin hands the brand's identity
 * to the bundle two ways — as the `__MOCK_*` compile-time constants, and as
 * the values behind `useMockVariables()`. Both come from the catalogue in
 * `mock-variables.js`; see "Variables" below.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { resolveMock } from './index.js'
import {
  mockDefines,
  mockVariables,
  runtimeValuesSource,
} from './mock-variables.js'
import { createStaticMiddleware } from './static-middleware.js'

const PLUGIN_NAME = 'srf-news-platform-mock'

/** Marker that identifies an `index.html` this plugin owns. */
const BANNER_ID = 'srf-news-platform-mock:generated'

/** Package name, as a fork imports it. */
const PACKAGE_NAME = '00_srf-news-platform-mock'

/*
 * Variables
 * ---------
 * The mock's identity reaches a fork's browser code through two channels, and
 * they are not interchangeable:
 *
 *   __MOCK_PLATFORM__ & co.  Vite `define`. Folded at compile time, which is
 *                            what makes `if (__MOCK_PLATFORM__ === 'srf')`
 *                            disappear from a production build — but only in
 *                            the fork's own sources. Vite deliberately does
 *                            not apply `define` to files under node_modules in
 *                            dev, so this package cannot read its own defines.
 *
 *   useMockVariables()       An importable hook. The plugin swaps the module
 *                            behind it for generated literals (RUNTIME_*
 *                            below), which is the only channel that works from
 *                            inside node_modules — and the only one that still
 *                            answers, with every variable `null`, in a build
 *                            this plugin is not part of.
 *
 * Both are generated from the same catalogue, so they cannot drift apart.
 */

/** The fallback module the generated values stand in for. */
const RUNTIME_VALUES_PATH = fileURLToPath(
  new URL('./runtime/values.js', import.meta.url),
)

/** Rollup id of the generated replacement. `\0` keeps other plugins off it. */
const RUNTIME_VALUES_ID = '\0platform-mock:values'

/**
 * Entry points that must not be pre-bundled: Vite would inline `values.js`
 * into an optimized chunk before `resolveId` ever sees it, and the fork would
 * silently get the inert fallback.
 */
const NO_PREBUNDLE = [PACKAGE_NAME, `${PACKAGE_NAME}/react`]

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
 * @property {'none'|'minimal'|'mock'} [buildHtml]
 *   What `vite build` leaves in `dist/`. `'none'` (default) emits no entry
 *   document at all: a fork deploys its bundle into a CMS article, so an
 *   `index.html` in the build output is dead weight that has to be deleted
 *   again before upload. Vite still needs an entry to build from, so the bare
 *   mount-point document is written to the project root as usual — it is just
 *   dropped from the output. `'minimal'` keeps that bare document in `dist/`
 *   (use it if you want `vite preview` to work). `'mock'` builds the full
 *   platform page — pair it with `assets: 'copy'` for a self-contained static
 *   preview.
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
    buildHtml = 'none',
    assets = 'serve',
    verbose = true,
  } = options

  assertOneOf('buildHtml', buildHtml, ['none', 'minimal', 'mock'])
  assertOneOf('assets', assets, ['serve', 'copy'])

  /** @type {import('./index.js').Mock} */
  let mock
  /** @type {Record<string, unknown>} */
  let variables
  let resolvedHtmlPath
  let entryHtmlKey
  let command

  return {
    name: PLUGIN_NAME,
    enforce: 'pre',

    // Runs before `configResolved`, which is the only window in which `define`
    // can still be contributed. A `define` in the fork's own config wins over
    // this one, so a fork can always override a value.
    config() {
      mock = resolveMock(brand)
      variables = mockVariables(mock)
      return {
        define: mockDefines(variables),
        optimizeDeps: { exclude: NO_PREBUNDLE },
      }
    },

    // Hands the hook its literals, by catching `react.js`'s own import of
    // `./values.js`.
    resolveId(source, importer) {
      if (!importer || !source.startsWith('.')) return null
      const resolved = path.resolve(
        path.dirname(stripQuery(importer)),
        stripQuery(source),
      )
      return resolved === RUNTIME_VALUES_PATH ? RUNTIME_VALUES_ID : null
    },

    load(id) {
      if (id !== RUNTIME_VALUES_ID) return null
      variables ??= mockVariables((mock ??= resolveMock(brand)))
      return runtimeValuesSource(variables)
    },

    configResolved(config) {
      command = config.command
      mock ??= resolveMock(brand)
      variables ??= mockVariables(mock)
      resolvedHtmlPath = htmlPath
        ? path.resolve(config.root, htmlPath)
        : path.join(config.root, 'index.html')
      entryHtmlKey = path
        .relative(config.root, resolvedHtmlPath)
        .split(path.sep)
        .join('/')

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

    // `order: 'post'` so this runs after Vite's own HTML plugin has emitted the
    // document — dropping it here means it never reaches disk, so `dist/` needs
    // no cleaning up afterwards.
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        if (buildHtml !== 'none') return

        for (const [fileName, output] of Object.entries(bundle)) {
          if (isEntryDocument(fileName, output, entryHtmlKey)) {
            delete bundle[fileName]
          }
        }
      },
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

/** Drops the `?v=…` and `?import` suffixes Vite hangs off module ids in dev. */
function stripQuery(id) {
  const cut = id.indexOf('?')
  return cut === -1 ? id : id.slice(0, cut)
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
 * platform chrome.
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

/**
 * Recognises the entry document this plugin materialised in a Rollup bundle.
 * Matches on the emitted file name, and falls back to the banner for an entry
 * that Vite renamed or wrote outside the project root.
 */
function isEntryDocument(fileName, output, entryHtmlKey) {
  if (output.type !== 'asset' || !fileName.endsWith('.html')) return false
  if (fileName === entryHtmlKey) return true
  return String(output.source).includes(BANNER_ID)
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

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
 * Besides materialising the entry HTML, the plugin writes the mock's identity
 * into that HTML as a JSON block, which is what `useMockVariables()` reads —
 * see `mock-variables.js`.
 */
import fs from 'node:fs'
import path from 'node:path'

import { resolveMock } from './index.js'
import { mockVariablesScript } from './mock-variables.js'
import { createStaticMiddleware } from './static-middleware.js'

const PLUGIN_NAME = 'srf-news-platform-mock'

/** Marker that identifies an `index.html` this plugin owns. */
const BANNER_ID = 'srf-news-platform-mock:generated'

/**
 * Filename `vite build` is pointed at, written next to the dev entry.
 *
 * A build must never write over the dev entry document: a dev server watching
 * that file picks up the bare build document and from then on serves the
 * widget with no platform chrome and no mock variables — the page looks broken
 * until the server is restarted. So the build gets an entry of its own. Same
 * directory as the dev entry, so relative asset URLs resolve identically;
 * dot-prefixed and deleted again once the bundle is written, so it stays out of
 * the fork's way.
 */
const BUILD_ENTRY_NAME = '.platform-mock-entry.html'

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
 *   Where the dev entry HTML is materialised. Defaults to `<root>/index.html`,
 *   which is what Vite expects and what forks already gitignore. A build never
 *   writes here — it gets an entry of its own, see `BUILD_ENTRY_NAME`.
 * @property {'none'|'minimal'|'mock'} [buildHtml]
 *   What `vite build` leaves in `dist/`. `'none'` (default) emits no entry
 *   document at all: a fork deploys its bundle into a CMS article, so an
 *   `index.html` in the build output is dead weight that has to be deleted
 *   again before upload. Vite still needs an entry to build from, so the bare
 *   mount-point document is written next to the dev entry — it is just dropped
 *   from the output again. `'minimal'` keeps that bare document in `dist/`
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
  /** The dev entry — written on `serve`, never touched by a build. */
  let resolvedHtmlPath
  /** Bundle key the entry document should be emitted under. */
  let entryHtmlKey
  /** The document a build reads, and the key rollup files it under. */
  let buildEntryPath = null
  let buildEntryKey = null
  /** Paths derived in `config()`, where the build input has to be set. */
  let planned = null
  let keepBuildEntry = false
  let command

  return {
    name: PLUGIN_NAME,
    enforce: 'pre',

    // Pointing the build at its own entry has to happen before Vite resolves
    // the config, which is why this cannot wait for `configResolved`.
    config(userConfig, env) {
      if (env.command !== 'build') return

      const root = path.resolve(userConfig.root ?? process.cwd())
      const htmlTarget = resolveEntryPath(root, htmlPath)
      planned = { root, buildEntry: buildEntryPathFor(htmlTarget) }

      const existing =
        userConfig.build?.rolldownOptions?.input ??
        userConfig.build?.rollupOptions?.input
      if (existing === undefined) {
        // Named, not bare: the entry chunk takes its name from its input, and
        // `.platform-mock-entry-<hash>.js` is not what a fork wants to upload.
        const name = path.basename(htmlTarget, path.extname(htmlTarget))
        return {
          build: { rollupOptions: { input: { [name]: planned.buildEntry } } },
        }
      }

      // The fork configured its own entries. Only the one naming our document
      // is redirected; everything else is theirs to build.
      const input = redirectInput(
        existing,
        root,
        htmlTarget,
        planned.buildEntry,
      )
      if (input === existing) {
        // Nothing of ours is being built — so write nothing.
        planned.buildEntry = null
        return
      }
      return { build: { rollupOptions: { input } } }
    },

    configResolved(config) {
      command = config.command
      mock = resolveMock(brand)
      resolvedHtmlPath = resolveEntryPath(config.root, htmlPath)
      entryHtmlKey = toBundleKey(config.root, resolvedHtmlPath)

      if (command === 'build') {
        // `planned` is authoritative: it holds the path `input` points at.
        buildEntryPath = planned
          ? planned.buildEntry
          : buildEntryPathFor(resolvedHtmlPath)
        buildEntryKey = buildEntryPath
          ? toBundleKey(config.root, buildEntryPath)
          : null
        // Watch mode re-reads the entry on every rebuild, so it has to stay.
        keepBuildEntry = Boolean(config.build?.watch)
      } else {
        // A build killed before it could tidy up leaves its entry behind; the
        // next dev server is the natural place to clear it.
        removeGeneratedFile(buildEntryPathFor(resolvedHtmlPath))
      }

      const target = command === 'build' ? buildEntryPath : resolvedHtmlPath
      const useFullMock = command === 'serve' || buildHtml === 'mock'
      const html = useFullMock
        ? transformMockHtml(fs.readFileSync(mock.htmlPath, 'utf8'), {
            entry,
            mountId,
            title,
          })
        : buildMinimalHtml(mock, { entry, mountId, title })

      if (target) {
        writeGeneratedFile(target, stampGenerated(html, mock, command))
      }

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
        for (const [fileName, output] of Object.entries(bundle)) {
          if (!isEntryDocument(fileName, output, [buildEntryKey, entryHtmlKey]))
            continue

          delete bundle[fileName]
          if (buildHtml === 'none') continue

          // It was built from `.platform-mock-entry.html`; ship it under the
          // name the fork configured. Re-emitting rather than renaming in
          // place: rolldown ignores writes to the bundle object.
          this.emitFile({
            type: 'asset',
            fileName: entryHtmlKey,
            source: output.source,
          })
        }
      },
    },

    // The build entry has done its job once the bundle is written.
    closeBundle() {
      if (command !== 'build' || keepBuildEntry) return
      removeGeneratedFile(buildEntryPath)
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
function isEntryDocument(fileName, output, keys) {
  if (output.type !== 'asset' || !fileName.endsWith('.html')) return false
  if (keys.includes(fileName)) return true
  return String(output.source).includes(BANNER_ID)
}

/** Where the entry document lives, given a root and the `htmlPath` option. */
function resolveEntryPath(root, htmlPath) {
  return htmlPath ? path.resolve(root, htmlPath) : path.join(root, 'index.html')
}

/** The build's own entry, alongside the dev entry it must not overwrite. */
function buildEntryPathFor(entryPath) {
  return path.join(path.dirname(entryPath), BUILD_ENTRY_NAME)
}

/** Rollup addresses bundle entries by root-relative POSIX path. */
function toBundleKey(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join('/')
}

/**
 * Swaps `from` for `to` in a fork-supplied rollup `input`, whatever shape it
 * has. Returns the value untouched when the fork builds documents of its own
 * only — redirecting those is none of this plugin's business.
 */
function redirectInput(input, root, from, to) {
  const swap = (value) =>
    typeof value === 'string' && path.resolve(root, value) === from ? to : value

  if (typeof input === 'string') return swap(input)

  if (Array.isArray(input)) {
    const next = input.map(swap)
    return next.some((value, i) => value !== input[i]) ? next : input
  }

  if (input && typeof input === 'object') {
    const entries = Object.entries(input).map(([key, value]) => [
      key,
      swap(value),
    ])
    return entries.some(([key, value]) => value !== input[key])
      ? Object.fromEntries(entries)
      : input
  }

  return input
}

/**
 * Everything the plugin adds to a document it generates: the do-not-edit
 * banner, and the variables block `useMockVariables()` reads back out.
 */
function stampGenerated(html, mock, command) {
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
  const stamped = doctype
    ? html.replace(doctype[0], `${doctype[0].trim()}\n${banner}`)
    : banner + html

  return withMockVariables(stamped, mock)
}

/**
 * Puts the variables block at the end of `<head>` — after the charset meta,
 * which has to come first, and long before the fork's deferred module script
 * runs.
 */
function withMockVariables(html, mock) {
  if (!/<\/head>/i.test(html)) {
    throw new Error(
      `[platform-mock] No </head> in the ${mock.brand} mock — nowhere to write ` +
        `the variables useMockVariables() reads. Regenerate it with ` +
        `\`pnpm mock ${mock.brand}\`.`,
    )
  }
  return html.replace(/<\/head>/i, `  ${mockVariablesScript(mock)}\n  </head>`)
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

/** Deletes a file this plugin generated, and only such a file. */
function removeGeneratedFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return
  if (!fs.readFileSync(filePath, 'utf8').includes(BANNER_ID)) return
  fs.rmSync(filePath, { force: true })
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

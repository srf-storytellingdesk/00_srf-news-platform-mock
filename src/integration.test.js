/**
 * Contract tests for the consumer-facing surface: what a template fork gets
 * out of the package, and what the Vite plugin writes into a fork's tree.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  ASSETS_URL,
  BRANDS,
  listBrands,
  readMockHtml,
  resolveMock,
} from '../integration/index.js'
import platformMock from '../integration/vite.js'

describe('resolveMock', () => {
  it('resolves every shipped brand to files that exist', () => {
    for (const brand of BRANDS) {
      const mock = resolveMock(brand)
      expect(fs.existsSync(mock.htmlPath), `${brand} html`).toBe(true)
      expect(fs.existsSync(mock.assetsDir), `${brand} assets`).toBe(true)
      expect(mock.assetsUrl).toBe(ASSETS_URL)
      expect(mock.lang).toMatch(/^[a-z]{2}$/)
      expect(mock.manifest.brand).toBe(brand)
    }
  })

  it('lists exactly the brands that are generated', () => {
    expect(listBrands()).toEqual(BRANDS)
  })

  it('throws a helpful error for an unknown brand', () => {
    expect(() => resolveMock('zdf')).toThrow(/Unknown or ungenerated brand/)
  })

  it('throws when no brand is given', () => {
    expect(() => resolveMock()).toThrow(/No brand given/)
  })

  it('serves its assets under the URL prefix baked into the mock HTML', () => {
    // If these ever drift apart, every asset in the mock 404s.
    expect(readMockHtml('srf')).toContain(`${ASSETS_URL}/merged.css`)
  })
})

describe('platformMock vite plugin', () => {
  let root

  beforeEach(() => {
    // realpath: on macOS os.tmpdir() is a symlink, and the plugin resolves
    // paths, so comparing raw temp paths would spuriously differ.
    root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'pm-test-'))
  })

  afterEach(() => {
    if (root) fs.rmSync(root, { recursive: true, force: true })
  })

  /** Minimal stand-in for the `ResolvedConfig` Vite hands to `configResolved`. */
  const fakeConfig = (command, build = {}) => ({
    command,
    root,
    base: '/widgets/demo/',
    publicDir: path.join(root, 'public'),
    build,
  })

  /** The document the build is pointed at — never the dev server's. */
  const BUILD_ENTRY = '.platform-mock-entry.html'

  const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8')
  const indexHtml = () => read('index.html')
  const buildEntryHtml = () => read(BUILD_ENTRY)

  /**
   * Runs the two hooks a build goes through before Rollup starts, in order.
   * @returns {import('vite').Plugin}
   */
  const startBuild = (plugin, userConfig = {}) => {
    plugin.config({ root, ...userConfig }, { command: 'build' })
    plugin.configResolved(fakeConfig('build', userConfig.build))
    return plugin
  }

  it('materialises the full mock as the dev entry', () => {
    platformMock({ brand: 'srf' }).configResolved(fakeConfig('serve'))

    const html = indexHtml()
    expect(html).toContain('srf-news-platform-mock:generated')
    expect(html).toContain('DO NOT EDIT')
    expect(html).toContain('data-bu="srf"')
    expect(html).toContain(`${ASSETS_URL}/merged.css`)
    expect(html).toMatch(/^<!doctype html>/i) // banner must not precede it
  })

  it('materialises a bare mount document for the build entry', () => {
    startBuild(platformMock({ brand: 'rts' }))

    const html = buildEntryHtml()
    expect(html).toContain('<html lang="fr">')
    expect(html).toContain('<script type="module" src="/src/index.jsx">')
    expect(html).not.toContain(`${ASSETS_URL}/merged.css`) // no platform chrome
  })

  it('points the build at its own entry, not at the dev one', () => {
    const plugin = platformMock({ brand: 'srf' })
    const patch = plugin.config({ root }, { command: 'build' })

    // Named input: the entry chunk is named after it, and nobody wants to
    // upload `.platform-mock-entry-<hash>.js`.
    expect(patch.build.rollupOptions.input).toEqual({
      index: path.join(root, BUILD_ENTRY),
    })
  })

  it("leaves a running dev server's entry document alone", () => {
    // The regression this guards: a build used to overwrite the dev entry with
    // the bare document, and the dev server then served a chrome-less page
    // until it was restarted.
    platformMock({ brand: 'srf' }).configResolved(fakeConfig('serve'))
    const served = indexHtml()

    startBuild(platformMock({ brand: 'srf' }))

    expect(indexHtml()).toBe(served)
    expect(buildEntryHtml()).not.toContain(`${ASSETS_URL}/merged.css`)
  })

  it('removes the build entry once the bundle is written', () => {
    const plugin = startBuild(platformMock({ brand: 'srf' }))
    expect(fs.existsSync(path.join(root, BUILD_ENTRY))).toBe(true)

    plugin.closeBundle()
    expect(fs.existsSync(path.join(root, BUILD_ENTRY))).toBe(false)
  })

  it('keeps the build entry in watch mode, where it is re-read', () => {
    const plugin = startBuild(platformMock({ brand: 'srf' }), {
      build: { watch: {} },
    })

    plugin.closeBundle()
    expect(fs.existsSync(path.join(root, BUILD_ENTRY))).toBe(true)
  })

  it('clears a build entry a killed build left behind', () => {
    startBuild(platformMock({ brand: 'srf' })) // never closes its bundle

    platformMock({ brand: 'srf' }).configResolved(fakeConfig('serve'))
    expect(fs.existsSync(path.join(root, BUILD_ENTRY))).toBe(false)
  })

  it('redirects a fork input that names the entry document', () => {
    const plugin = platformMock({ brand: 'srf' })
    const patch = plugin.config(
      { root, build: { rollupOptions: { input: { app: 'index.html' } } } },
      { command: 'build' },
    )

    expect(patch.build.rollupOptions.input).toEqual({
      app: path.join(root, BUILD_ENTRY),
    })
  })

  it('keeps out of a build that does not use the entry document', () => {
    const plugin = platformMock({ brand: 'srf' })
    const userConfig = {
      root,
      build: { rollupOptions: { input: path.join(root, 'admin.html') } },
    }

    expect(plugin.config(userConfig, { command: 'build' })).toBeUndefined()

    plugin.configResolved(fakeConfig('build', userConfig.build))
    expect(fs.readdirSync(root)).toEqual([]) // wrote nothing at all
  })

  /** Stand-in for the bundle Vite hands to `generateBundle`. */
  const fakeBundle = () => ({
    [BUILD_ENTRY]: { type: 'asset', source: buildEntryHtml() },
    'index.js': { type: 'chunk', code: '// bundle' },
    'other.html': { type: 'asset', source: '<h1>a fork of our own</h1>' },
  })

  /**
   * Stand-in for the Rollup plugin context. Rolldown ignores writes to the
   * bundle object, so a re-emitted document arrives through `emitFile`.
   */
  const fakeContext = () => ({
    emitted: [],
    emitFile(file) {
      this.emitted.push(file)
    },
  })

  it('drops the entry document from the build output by default', () => {
    const plugin = startBuild(platformMock({ brand: 'srf' }))

    const bundle = fakeBundle()
    const context = fakeContext()
    plugin.generateBundle.handler.call(context, {}, bundle)

    // Gone before it ever reaches dist/ — and only ours.
    expect(Object.keys(bundle)).toEqual(['index.js', 'other.html'])
    expect(context.emitted).toEqual([])
  })

  it('emits the entry document under its configured name on request', () => {
    const plugin = startBuild(
      platformMock({ brand: 'srf', buildHtml: 'minimal' }),
    )

    const bundle = fakeBundle()
    const context = fakeContext()
    plugin.generateBundle.handler.call(context, {}, bundle)

    // Built as `.platform-mock-entry.html`, shipped as `index.html`.
    expect(Object.keys(bundle)).not.toContain(BUILD_ENTRY)
    expect(context.emitted).toEqual([
      { type: 'asset', fileName: 'index.html', source: buildEntryHtml() },
    ])
  })

  it('drops a renamed entry document by its banner', () => {
    const plugin = startBuild(platformMock({ brand: 'srf' }))

    const bundle = {
      'nested/entry.html': { type: 'asset', source: buildEntryHtml() },
    }
    plugin.generateBundle.handler.call(fakeContext(), {}, bundle)

    expect(bundle).toEqual({})
  })

  it('keeps the full mock on build when asked to', () => {
    startBuild(platformMock({ brand: 'srf', buildHtml: 'mock' }))

    expect(buildEntryHtml()).toContain(`${ASSETS_URL}/merged.css`)
  })

  it('rewrites the entry module and fills the EJS placeholders', () => {
    platformMock({
      brand: 'srf',
      entry: '/preview/main.jsx',
      mountId: 'my-widget',
      title: 'My widget',
    }).configResolved(fakeConfig('serve'))

    const html = indexHtml()
    expect(html).toContain('src="/preview/main.jsx"')
    expect(html).not.toContain('/src/index.jsx')
    expect(html).toContain('<div id="my-widget">')
    expect(html).not.toContain('<%=')
  })

  it('leaves the EJS placeholders for vite-plugin-html by default', () => {
    platformMock({ brand: 'srf' }).configResolved(fakeConfig('serve'))

    const html = indexHtml()
    expect(html).toContain('<%= title %>')
    expect(html).toContain('<div id="<%= id %>">')
  })

  it('does not rewrite an unchanged entry file', () => {
    const plugin = platformMock({ brand: 'srf' })
    plugin.configResolved(fakeConfig('serve'))
    const firstWrite = fs.statSync(path.join(root, 'index.html')).mtimeMs

    plugin.configResolved(fakeConfig('serve'))
    expect(fs.statSync(path.join(root, 'index.html')).mtimeMs).toBe(firstWrite)
  })

  it('refuses to clobber an index.html it does not own', () => {
    fs.writeFileSync(path.join(root, 'index.html'), '<h1>hand written</h1>')

    expect(() =>
      platformMock({ brand: 'srf' }).configResolved(fakeConfig('serve')),
    ).toThrow(/Refusing to overwrite/)
  })

  it('honours a custom htmlPath', () => {
    platformMock({ brand: 'srf', htmlPath: 'mock/entry.html' }) //
      .configResolved(fakeConfig('serve'))

    expect(fs.existsSync(path.join(root, 'mock/entry.html'))).toBe(true)
    expect(fs.existsSync(path.join(root, 'index.html'))).toBe(false)
  })

  it('puts the build entry next to a custom htmlPath', () => {
    // Same directory, so relative asset URLs resolve the same either way.
    startBuild(platformMock({ brand: 'srf', htmlPath: 'mock/entry.html' }))

    expect(fs.existsSync(path.join(root, 'mock', BUILD_ENTRY))).toBe(true)
    expect(fs.existsSync(path.join(root, 'mock/entry.html'))).toBe(false)
  })

  it('mirrors assets into publicDir in copy mode, once', () => {
    const plugin = platformMock({ brand: 'rsi', assets: 'copy' })
    plugin.configResolved(fakeConfig('serve'))

    const mirrored = path.join(root, 'public', 'mock-assets')
    expect(fs.existsSync(path.join(mirrored, 'merged.css'))).toBe(true)

    const stamp = path.join(mirrored, '.platform-mock-stamp')
    const stampedAt = fs.statSync(stamp).mtimeMs
    plugin.configResolved(fakeConfig('serve'))
    expect(fs.statSync(stamp).mtimeMs).toBe(stampedAt) // skipped second time
  })

  it('copies nothing into the tree in the default serve mode', () => {
    platformMock({ brand: 'srf' }).configResolved(fakeConfig('serve'))
    expect(fs.existsSync(path.join(root, 'public'))).toBe(false)
  })

  it('rejects invalid options up front', () => {
    expect(() => platformMock({ brand: 'srf', assets: 'symlink' })) //
      .toThrow(/Invalid `assets`/)
    expect(() => platformMock({ brand: 'srf', buildHtml: 'full' })) //
      .toThrow(/Invalid `buildHtml`/)
  })
})

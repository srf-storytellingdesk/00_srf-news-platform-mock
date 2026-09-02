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
  const fakeConfig = (command) => ({
    command,
    root,
    base: '/widgets/demo/',
    publicDir: path.join(root, 'public'),
  })

  const indexHtml = () => fs.readFileSync(path.join(root, 'index.html'), 'utf8')

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
    platformMock({ brand: 'rts' }).configResolved(fakeConfig('build'))

    const html = indexHtml()
    expect(html).toContain('<html lang="fr">')
    expect(html).toContain('<script type="module" src="/src/index.jsx">')
    expect(html).not.toContain(`${ASSETS_URL}/merged.css`) // no platform chrome
  })

  /** Stand-in for the bundle Vite hands to `generateBundle`. */
  const fakeBundle = () => ({
    'index.html': {
      type: 'asset',
      source: fs.readFileSync(path.join(root, 'index.html'), 'utf8'),
    },
    'index.js': { type: 'chunk', code: '// bundle' },
    'other.html': { type: 'asset', source: '<h1>a fork of our own</h1>' },
  })

  it('drops the entry document from the build output by default', () => {
    const plugin = platformMock({ brand: 'srf' })
    plugin.configResolved(fakeConfig('build'))

    const bundle = fakeBundle()
    plugin.generateBundle.handler({}, bundle)

    // Gone before it ever reaches dist/ — and only ours.
    expect(Object.keys(bundle)).toEqual(['index.js', 'other.html'])
  })

  it('keeps the entry document in the build output on request', () => {
    const plugin = platformMock({ brand: 'srf', buildHtml: 'minimal' })
    plugin.configResolved(fakeConfig('build'))

    const bundle = fakeBundle()
    plugin.generateBundle.handler({}, bundle)

    expect(Object.keys(bundle)).toContain('index.html')
  })

  it('drops a renamed entry document by its banner', () => {
    const plugin = platformMock({ brand: 'srf' })
    plugin.configResolved(fakeConfig('build'))

    const bundle = {
      'nested/entry.html': {
        type: 'asset',
        source: fs.readFileSync(path.join(root, 'index.html'), 'utf8'),
      },
    }
    plugin.generateBundle.handler({}, bundle)

    expect(bundle).toEqual({})
  })

  it('keeps the full mock on build when asked to', () => {
    platformMock({ brand: 'srf', buildHtml: 'mock' }) //
      .configResolved(fakeConfig('build'))

    expect(indexHtml()).toContain(`${ASSETS_URL}/merged.css`)
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

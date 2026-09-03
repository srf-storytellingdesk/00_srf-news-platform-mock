/**
 * Public Node API of 00_srf-news-platform-mock.
 *
 * This module is the ONLY supported way to locate a mock. Consumers must never
 * reach into this repo's layout by hand (`node_modules/.../mocks/srf/...`) —
 * go through `resolveMock()` so the internal layout stays free to change.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url))

/** Absolute path of the directory holding all generated brand mocks. */
export const MOCKS_DIR = path.join(PACKAGE_ROOT, 'mocks')

/**
 * URL prefix the mock HTML and CSS reference their assets under. Baked into
 * every generated mock, so it is part of the contract rather than an option.
 */
export const ASSETS_URL = '/mock-assets'

/** Directory name the assets live in inside a mock directory. */
export const ASSETS_DIRNAME = 'mock-assets'

/** Brands shipped by this package, in the order they are usually listed. */
export const BRANDS = ['srf', 'rts', 'rsi', 'rtr', 'swi']

/**
 * @typedef {object} Mock
 * @property {string} brand        Brand key, e.g. `'srf'`.
 * @property {string} lang         `<html lang>` of the mock, e.g. `'de'`.
 * @property {string} dir          Absolute path of the mock directory.
 * @property {string} htmlPath     Absolute path of the mock's `index.html`.
 * @property {string} assetsDir    Absolute path of the mock's asset directory.
 * @property {string} assetsUrl    URL prefix the assets must be served under.
 * @property {object} manifest     Full contents of the mock's `mock.json`.
 */

/**
 * Lists the brands actually present on disk, newest generation first is not
 * guaranteed — the order follows {@link BRANDS}.
 * @returns {string[]}
 */
export function listBrands() {
  return BRANDS.filter((brand) =>
    fs.existsSync(path.join(MOCKS_DIR, brand, 'index.html')),
  )
}

/**
 * Resolves everything a consumer needs to serve one brand's mock.
 * @param {string} brand
 * @returns {Mock}
 */
export function resolveMock(brand) {
  if (typeof brand !== 'string' || brand.length === 0) {
    throw new Error(
      `[platform-mock] No brand given. Expected one of: ${BRANDS.join(', ')}.`,
    )
  }

  const dir = path.join(MOCKS_DIR, brand)
  const htmlPath = path.join(dir, 'index.html')

  if (!fs.existsSync(htmlPath)) {
    throw new Error(
      `[platform-mock] Unknown or ungenerated brand "${brand}". ` +
        `Available: ${listBrands().join(', ') || '(none)'}. ` +
        `Run \`pnpm mock ${brand}\` in 00_srf-news-platform-mock to generate it.`,
    )
  }

  const manifest = readManifest(dir)

  return {
    brand,
    lang: manifest.lang ?? 'de',
    dir,
    htmlPath,
    assetsDir: path.join(dir, ASSETS_DIRNAME),
    assetsUrl: ASSETS_URL,
    manifest,
  }
}

/** Reads a mock's `index.html` as UTF-8. */
export function readMockHtml(brand) {
  return fs.readFileSync(resolveMock(brand).htmlPath, 'utf8')
}

function readManifest(dir) {
  const manifestPath = path.join(dir, 'mock.json')
  if (!fs.existsSync(manifestPath)) return {}
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  } catch (error) {
    console.warn(
      `[platform-mock] Ignoring unreadable ${manifestPath}: ${error.message}`,
    )
    return {}
  }
}

/**
 * Mock generator.
 *
 * Loads a real SRG SSR article page in a headless browser, strips everything
 * that needs JavaScript or a network, splices in the placeholders a template
 * fork mounts into, and writes the result to `mocks/<brand>/` as a fully
 * offline copy of the platform chrome.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import prettier from 'prettier'
import puppeteer from 'puppeteer'

import { ASSETS_DIRNAME, MOCKS_DIR } from '../integration/index.js'
import {
  applyDomEdits,
  inlineSingleStylesheet,
  removeSelectors,
  scrollToBottom,
} from './browser/page-actions.js'
import {
  downloadFile,
  downloadMissingAssets,
  extractInlineStyles,
  getUsedClassesFromHtml,
  mergeAllCssFiles,
  parseAndDownloadFonts,
  pointSrcAndHrefUrlsToMock,
  stripOriginFromCssUrls,
} from './utils/file-helper.js'

const BRANDS_DIR = new URL('./brands/', import.meta.url)
const PARTIALS_DIR = new URL('./partials/', import.meta.url)

const CSS_FILE_NAME = 'merged.css'
const TIME_TO_WAIT_FOR_DYNAMIC_CONTENT = 5000
const TIME_TO_WAIT_AFTER_SCROLL = 5000

/**
 * Mount points a template fork needs, and the placeholder token each one's
 * partial is spliced in with. A brand config declares them by these keys in
 * `mounts` and never names a token itself.
 */
const MOUNT_TOKENS = {
  article: 'ARTICLE_CONTENT',
  topMedia: 'TOP_MEDIA_ELEMENT',
}

/** Asset classes worth saving off the wire, in match order. */
const ASSET_TYPES = [
  {
    test: (contentType, url) =>
      contentType.includes('css') || url.match(/\.css(\?|$)/),
    encoding: 'utf8',
    fallbackExt: '.css',
  },
  {
    test: (_contentType, url) =>
      url.match(/\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)(\?|$)/i),
  },
  {
    test: (contentType, url) =>
      contentType.startsWith('font/') ||
      contentType.includes('woff') ||
      contentType.includes('truetype') ||
      contentType.includes('opentype') ||
      url.match(/\.(woff2?|ttf|otf|eot)(\?|$)/i),
  },
]

/**
 * Generates one brand's mock into `mocks/<brand>/`.
 * @param {string} brand
 * @returns {Promise<{brand: string, outDir: string, htmlPath: string, manifest: object}>}
 */
export async function generateMock(brand) {
  const config = await loadBrandConfig(brand)

  const outDir = path.join(MOCKS_DIR, brand)
  const assetsDir = path.join(outDir, ASSETS_DIRNAME)
  const htmlPath = path.join(outDir, 'index.html')
  const fetchUrlOrigin = new URL(config.fetchUrl).origin

  console.log(`\n▶ ${brand}: ${config.fetchUrl}`)

  const placeholders = {
    ARTICLE_TITLE: '<%= title %>',
    ...(await readMountPartials(config)),
  }

  await fs.rm(assetsDir, { recursive: true, force: true })
  await fs.mkdir(assetsDir, { recursive: true })

  let html = await scrapePage(config, assetsDir, fetchUrlOrigin)

  // Rewrite same-origin URLs to the mock asset prefix, e.g.
  // /deeply/nested/srf-favicon-BRxTgjQQ.png -> /mock-assets/deeply/nested/…
  html = pointSrcAndHrefUrlsToMock(html, fetchUrlOrigin)

  // Pull <style> blocks out of the HTML so they end up in merged.css. Puppeteer
  // serialises relative URLs as absolute, so strip the origin again afterwards.
  const { html: htmlWithoutStyles, styles: rawInlineStyles } =
    extractInlineStyles(html)
  html = htmlWithoutStyles
  const inlineStyles = stripOriginFromCssUrls(rawInlineStyles, fetchUrlOrigin)

  const classSet = getUsedClassesFromHtml(html)

  for (const [name, replacement] of Object.entries(placeholders)) {
    html = html.replaceAll(`{{${name}}}`, replacement)
  }

  html = await formatHtml(html, htmlPath)
  await fs.writeFile(htmlPath, html, 'utf8')
  console.log(`  ✓ HTML  ${path.relative(process.cwd(), htmlPath)}`)

  // Assets Puppeteer never saw, e.g. SVG sprites behind <use href>.
  await downloadMissingAssets(html, assetsDir, fetchUrlOrigin)

  const css = await mergeAllCssFiles(
    assetsDir,
    CSS_FILE_NAME,
    classSet,
    true,
    inlineStyles,
  )
  await parseAndDownloadFonts(css, assetsDir, (src) =>
    src.replace(`../${ASSETS_DIRNAME}`, fetchUrlOrigin),
  )

  const manifest = await writeManifest(outDir, brand, config, assetsDir)

  return { brand, outDir, htmlPath, manifest }
}

/** Drives the headless browser and returns the cleaned-up serialised DOM. */
async function scrapePage(config, assetsDir, fetchUrlOrigin) {
  const browser = await puppeteer.launch()
  try {
    const page = await browser.newPage()
    const seen = new Set()

    page.on('response', (response) => {
      try {
        const url = response.url()
        const contentType = response.headers()['content-type'] || ''
        if (url.includes('base64,')) return
        if (!url.startsWith(fetchUrlOrigin)) return
        if (seen.has(url)) return

        const type = ASSET_TYPES.find((candidate) =>
          candidate.test(contentType, url),
        )
        if (!type) return

        seen.add(url)
        downloadFile(response, assetsDir, type.encoding, type.fallbackExt)
      } catch (error) {
        console.warn('  ! Error saving asset:', error.message)
      }
    })

    await page.goto(config.fetchUrl, { waitUntil: 'networkidle2' })
    await wait(TIME_TO_WAIT_FOR_DYNAMIC_CONTENT)

    await page.evaluate(scrollToBottom)
    await wait(TIME_TO_WAIT_AFTER_SCROLL) // let lazy images finish

    await page.evaluate(removeSelectors, config.deleteSelectors ?? [])
    await page.evaluate(applyDomEdits, buildDomEdits(config))
    await page.evaluate(
      inlineSingleStylesheet,
      `/${ASSETS_DIRNAME}/${CSS_FILE_NAME}`,
    )

    return await page.content()
  } finally {
    await browser.close()
  }
}

async function writeManifest(outDir, brand, config, assetsDir) {
  // The selector of the element a template fork mounts its article into, baked
  // into mock.json so a consumer never has to re-derive it from a brand config.
  const entryPointSelector = config.mounts?.article?.selector
  if (!entryPointSelector) {
    console.warn(
      '  ! No `mounts.article` in the brand config — ' +
        'mock.json gets no entryPointSelector',
    )
  }

  const manifest = {
    brand,
    label: config.label ?? brand.toUpperCase(),
    lang: config.lang ?? 'de',
    entryPointSelector,
    sourceUrl: config.fetchUrl,
    assetsUrl: `/${ASSETS_DIRNAME}`,
    assetCount: await countFiles(assetsDir),
    generatedAt: new Date().toISOString().slice(0, 10),
    generatedBy: '00_srf-news-platform-mock',
  }
  const manifestPath = path.join(outDir, 'mock.json')
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
  console.log(`  ✓ mock.json (${manifest.assetCount} assets)`)
  return manifest
}

/**
 * Flattens the brand config into one edit list for the browser: the fork's
 * mount points first, then the placeholder copy that replaces editorial text.
 * @param {import('./brands/_shared.js').BrandConfig} config
 * @returns {{selector: string, mode: string, text: string}[]}
 */
function buildDomEdits(config) {
  const mounts = eachMount(config).map(([, token, mount]) => ({
    selector: mount.selector,
    mode: mount.mode ?? 'replace',
    text: `{{${token}}}`,
  }))
  const replacements = Object.entries(config.textReplacements ?? {}).map(
    ([selector, text]) => ({ selector, mode: 'replace', text }),
  )
  return [...mounts, ...replacements]
}

/** `{ ARTICLE_CONTENT: '<partial markup>', … }` for every declared mount. */
async function readMountPartials(config) {
  const entries = await Promise.all(
    eachMount(config).map(async ([key, token, mount]) => {
      if (!mount.template) {
        throw new Error(`Brand config mount "${key}" is missing a template.`)
      }
      return [token, await readPartial(mount.template)]
    }),
  )
  return Object.fromEntries(entries)
}

/** The mounts a brand actually declares, as `[key, token, mount]` triples. */
function eachMount(config) {
  return Object.entries(MOUNT_TOKENS)
    .filter(([key]) => config.mounts?.[key])
    .map(([key, token]) => [key, token, config.mounts[key]])
}

async function loadBrandConfig(brand) {
  if (!/^[a-z0-9-]+$/.test(brand)) {
    throw new Error(`Invalid brand key: ${JSON.stringify(brand)}`)
  }
  try {
    const { default: config } = await import(
      new URL(`${brand}.js`, BRANDS_DIR).href
    )
    return config
  } catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND') {
      throw new Error(
        `No brand config at src/brands/${brand}.js — copy an existing one to add a brand.`,
        { cause: error },
      )
    }
    throw error
  }
}

function readPartial(name) {
  return fs.readFile(new URL(name, PARTIALS_DIR), 'utf8')
}

async function formatHtml(html, filePath) {
  try {
    const config = (await prettier.resolveConfig(filePath)) || {}
    return await prettier.format(html, { ...config, parser: 'html' })
  } catch (error) {
    console.warn('  ! Could not prettify HTML:', error.message)
    return html
  }
}

async function countFiles(dir) {
  let count = 0
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    count += entry.isDirectory()
      ? await countFiles(path.join(dir, entry.name))
      : 1
  }
  return count
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

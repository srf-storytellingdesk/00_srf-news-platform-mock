/**
 * Reference screenshots.
 *
 * Boots the local preview (the same Vite plugin forks use) against one brand's
 * mock and captures the full page to `screenshots/<brand>.png`. Diffing those
 * PNGs is the quickest way to see what a regeneration actually changed.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'

import { unlockPageScroll } from './browser/page-actions.js'

const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url))
const SCREENSHOTS_DIR = path.join(PACKAGE_ROOT, 'screenshots')
const VIEWPORT_WIDTH = 1280
const LOADING_SCREEN = '[data-news-landmark="news-loading-screen"]'

/**
 * @param {string} brand
 * @returns {Promise<string>} Absolute path of the written PNG.
 */
export async function takeScreenshot(brand) {
  // The preview's vite.config.js reads the brand from the environment.
  process.env.PLATFORM_MOCK_BRAND = brand

  const { createServer } = await import('vite')
  const server = await createServer({
    root: PACKAGE_ROOT,
    configFile: path.join(PACKAGE_ROOT, 'vite.config.js'),
    mode: 'development',
    logLevel: 'warn',
    server: { port: 0, open: false },
  })

  await server.listen()
  const url = server.resolvedUrls?.local?.[0]
  if (!url) {
    await server.close()
    throw new Error('Vite did not report a local dev URL.')
  }

  await fs.mkdir(SCREENSHOTS_DIR, { recursive: true })
  const outPath = path.join(SCREENSHOTS_DIR, `${brand}.png`)
  const browser = await puppeteer.launch()

  try {
    const page = await browser.newPage()
    await page.setViewport({
      width: VIEWPORT_WIDTH,
      height: 900,
      deviceScaleFactor: 1,
    })
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 })
    await page.waitForSelector(LOADING_SCREEN, { hidden: true, timeout: 30000 })

    const contentHeight = await page.evaluate(unlockPageScroll, LOADING_SCREEN)
    await page.setViewport({ width: VIEWPORT_WIDTH, height: contentHeight })
    await page.screenshot({ path: outPath })

    console.log(
      `  ✓ screenshots/${brand}.png (${VIEWPORT_WIDTH}×${contentHeight})`,
    )
    return outPath
  } finally {
    await browser.close()
    await server.close()
  }
}

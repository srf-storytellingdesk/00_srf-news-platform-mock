#!/usr/bin/env node
/**
 * `platform-mock` — maintenance CLI for this package.
 *
 * Nothing a consuming fork needs: forks only use the Vite plugin. This is for
 * regenerating the committed mocks when a platform redesigns its article page,
 * and for previewing them.
 */
import {
  BRANDS,
  DEFAULT_LAYOUT,
  listBrands,
  listLayouts,
  resolveMock,
} from '../integration/index.js'
import { brandLayouts, generateMock } from './generate.js'
import { takeScreenshot } from './screenshot.js'

const USAGE = `
platform-mock <command> [target]

Targets
  <brand>                 Every layout of that brand.
  <brand>:<layout>        One layout, e.g. rts:fullwidth.
  all                     Every layout of every brand.

Commands
  generate [target]       Re-scrape a platform and rewrite its mocks/ folder.
                          Defaults to "srf". Takes a screenshot afterwards
                          unless --no-screenshot is passed.
  screenshot [target]     Re-capture its screenshots/*.png only.
  dev [brand[:layout]]    Start the preview dev server on one mock. Defaults
                          to PLATFORM_MOCK_BRAND / PLATFORM_MOCK_LAYOUT, then
                          srf.
  list                    Show the mocks currently in this package.
  help                    Print this text.

Brands
  ${BRANDS.join(', ')}

Examples
  platform-mock generate srf
  platform-mock generate rts:fullwidth
  platform-mock generate all --no-screenshot
  platform-mock screenshot rts
  platform-mock dev rts:fullwidth
`

const [, , command = 'help', ...rest] = process.argv
const flags = new Set(rest.filter((arg) => arg.startsWith('-')))
const positional = rest.filter((arg) => !arg.startsWith('-'))

try {
  await run(command, positional, flags)
} catch (error) {
  console.error(`\n✖ ${error.message}\n`)
  process.exitCode = 1
}

async function run(command, positional, flags) {
  switch (command) {
    case 'generate': {
      const targets = await expandTargets(positional[0] ?? 'srf')
      const withScreenshot = !flags.has('--no-screenshot')
      for (const { brand, layout } of targets) {
        await generateMock(brand, layout)
        if (withScreenshot) await takeScreenshot(brand, layout)
      }
      console.log(`\n✓ Generated: ${targets.map(formatTarget).join(', ')}\n`)
      return
    }

    case 'screenshot': {
      const targets = await expandTargets(positional[0] ?? 'srf')
      for (const { brand, layout } of targets) {
        resolveMock(brand, { layout }) // fail fast on an ungenerated mock
        await takeScreenshot(brand, layout)
      }
      return
    }

    case 'dev': {
      if (positional[0]) {
        const [brand, layout = DEFAULT_LAYOUT] = positional[0].split(':')
        await expandTargets(`${brand}:${layout}`) // fail fast on a typo
        // Read by vite.config.js, which this server loads.
        process.env.PLATFORM_MOCK_BRAND = brand
        process.env.PLATFORM_MOCK_LAYOUT = layout
      }
      const { createServer } = await import('vite')
      const server = await createServer()
      await server.listen()
      server.printUrls()
      server.bindCLIShortcuts({ print: true })
      return
    }

    case 'list': {
      const present = listBrands()
      if (present.length === 0) {
        console.log('No mocks generated yet. Run `platform-mock generate all`.')
        return
      }
      for (const brand of present) {
        for (const layout of listLayouts(brand)) {
          const { lang, manifest } = resolveMock(brand, { layout })
          console.log(
            `${formatTarget({ brand, layout }).padEnd(15)} lang ${lang.padEnd(3)} ` +
              `${String(manifest.assetCount ?? '?').padStart(5)} assets  ` +
              `generated ${manifest.generatedAt ?? 'unknown'}  ${manifest.sourceUrl ?? ''}`,
          )
        }
      }
      return
    }

    case 'help':
    case '--help':
    case '-h':
      console.log(USAGE)
      return

    default:
      throw new Error(`Unknown command "${command}".\n${USAGE}`)
  }
}

/** `all`, `<brand>` or `<brand>:<layout>` as a list of brand layouts. */
async function expandTargets(arg) {
  const [brand, layout] = arg.split(':')
  if (arg === 'all') {
    const targets = []
    for (const each of BRANDS) targets.push(...(await expandTargets(each)))
    return targets
  }
  if (!BRANDS.includes(brand)) {
    throw new Error(
      `Unknown brand "${brand}". Expected one of: ${BRANDS.join(', ')}, or "all".`,
    )
  }

  const layouts = await brandLayouts(brand)
  if (layout === undefined)
    return layouts.map((each) => ({ brand, layout: each }))
  if (!layouts.includes(layout)) {
    throw new Error(
      `Unknown layout "${layout}" for ${brand}. Expected one of: ${layouts.join(', ')}.`,
    )
  }
  return [{ brand, layout }]
}

/** `srf`, or `rts:fullwidth` for anything but the default layout. */
function formatTarget({ brand, layout }) {
  return layout === DEFAULT_LAYOUT ? brand : `${brand}:${layout}`
}

#!/usr/bin/env node
/**
 * `platform-mock` — maintenance CLI for this package.
 *
 * Nothing a consuming fork needs: forks only use the Vite plugin. This is for
 * regenerating the committed mocks when a platform redesigns its article page.
 */
import { BRANDS, listBrands, resolveMock } from '../integration/index.js'
import { generateMock } from './generate.js'
import { takeScreenshot } from './screenshot.js'

const USAGE = `
platform-mock <command> [brand]

Commands
  generate [brand|all]    Re-scrape a platform and rewrite mocks/<brand>/.
                          Defaults to "srf". Takes a screenshot afterwards
                          unless --no-screenshot is passed.
  screenshot [brand|all]  Re-capture screenshots/<brand>.png only.
  list                    Show the mocks currently in this package.
  help                    Print this text.

Brands
  ${BRANDS.join(', ')}

Examples
  platform-mock generate srf
  platform-mock generate all --no-screenshot
  platform-mock screenshot rts
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
      const brands = expandBrands(positional[0] ?? 'srf')
      const withScreenshot = !flags.has('--no-screenshot')
      for (const brand of brands) {
        await generateMock(brand)
        if (withScreenshot) await takeScreenshot(brand)
      }
      console.log(`\n✓ Generated: ${brands.join(', ')}\n`)
      return
    }

    case 'screenshot': {
      const brands = expandBrands(positional[0] ?? 'srf')
      for (const brand of brands) {
        resolveMock(brand) // fail fast on an ungenerated brand
        await takeScreenshot(brand)
      }
      return
    }

    case 'list': {
      const present = listBrands()
      if (present.length === 0) {
        console.log('No mocks generated yet. Run `platform-mock generate all`.')
        return
      }
      for (const brand of present) {
        const { lang, manifest } = resolveMock(brand)
        console.log(
          `${brand.padEnd(5)} lang ${lang.padEnd(3)} ` +
            `${String(manifest.assetCount ?? '?').padStart(5)} assets  ` +
            `generated ${manifest.generatedAt ?? 'unknown'}  ${manifest.sourceUrl ?? ''}`,
        )
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

function expandBrands(arg) {
  if (arg === 'all') return [...BRANDS]
  if (!BRANDS.includes(arg)) {
    throw new Error(
      `Unknown brand "${arg}". Expected one of: ${BRANDS.join(', ')}, or "all".`,
    )
  }
  return [arg]
}

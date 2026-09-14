/**
 * Contract tests for the variables a fork reads — the catalogue, the module
 * the plugin swaps in behind `useMockVariables()`, the `__MOCK_*` defines, and
 * the docs and types that describe them. They exist to keep those in lockstep:
 * the point of the catalogue is that there is one list, so every other copy of
 * it is checked against that list here rather than maintained by hand.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { BRANDS, resolveMock } from '../integration/index.js'
import {
  MOCK_VARIABLES,
  MOCK_VARIABLE_KEYS,
  mockDefines,
  mockVariables,
  runtimeValuesSource,
} from '../integration/mock-variables.js'
import { useMockVariables } from '../integration/runtime/react.js'
import platformMock from '../integration/vite.js'

const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url))
const PACKAGE_NAME = '00_srf-news-platform-mock'

const read = (relativePath) =>
  fs.readFileSync(path.join(PACKAGE_ROOT, relativePath), 'utf8')

describe('mockVariables', () => {
  it('resolves the same keys for every brand', () => {
    for (const brand of BRANDS) {
      const variables = mockVariables(resolveMock(brand))
      expect(Object.keys(variables), brand).toEqual(MOCK_VARIABLE_KEYS)
      expect(variables.platform, brand).toBe(brand)
      expect(variables.label, brand).toBeTruthy()
      expect(variables.lang, brand).toMatch(/^[a-z]{2}$/)
      expect(variables.entryPoint, brand).toBe(
        resolveMock(brand).manifest.entryPointSelector,
      )
    }
  })

  it('defines only the documented subset, JSON-encoded', () => {
    const defines = mockDefines(mockVariables(resolveMock('rts')))
    expect(Object.keys(defines)).toEqual([
      '__MOCK_PLATFORM__',
      '__MOCK_LANG__',
      '__MOCK_ENTRY_POINT__',
    ])
    expect(defines.__MOCK_PLATFORM__).toBe('"rts"')
    expect(defines.__MOCK_LANG__).toBe('"fr"')
    expect(JSON.parse(defines.__MOCK_ENTRY_POINT__)).toBeTruthy()
  })
})

describe('the fallback behind the hook', () => {
  it('answers for every variable when no plugin swapped it in', () => {
    const variables = useMockVariables()
    expect(Object.keys(variables)).toEqual(MOCK_VARIABLE_KEYS)
    for (const key of MOCK_VARIABLE_KEYS) expect(variables[key], key).toBeNull()
    expect(Object.isFrozen(variables)).toBe(true)
  })

  it('generates a module with the same shape', () => {
    const source = runtimeValuesSource(mockVariables(resolveMock('swi')))
    expect(source).toContain('"platform": "swi"')
    for (const key of MOCK_VARIABLE_KEYS) expect(source).toContain(`"${key}"`)
  })
})

describe('what documents the variables', () => {
  it('lists every variable in the README table', () => {
    const readme = read('README.md')
    for (const { key, describe: text } of MOCK_VARIABLES) {
      expect(readme, `README row for ${key}`).toContain(`\`${key}\``)
      expect(readme, `README description of ${key}`).toContain(text)
    }
  })

  it('types every variable and every export', () => {
    const types = read('integration/runtime/react.d.ts')
    for (const key of MOCK_VARIABLE_KEYS) {
      expect(types, `type of ${key}`).toMatch(new RegExp(`^\\s*${key}:`, 'm'))
    }
    const hooks = read('integration/runtime/react.js')
    for (const [, name] of hooks.matchAll(/^export function (\w+)/gm)) {
      expect(types, `declaration of ${name}`).toContain(`function ${name}(`)
    }
  })
})

describe('the plugin handing the values over', () => {
  let root

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'pm-vars-'))
  })

  afterEach(() => {
    if (root) fs.rmSync(root, { recursive: true, force: true })
  })

  it('contributes the defines and keeps its own package unbundled', () => {
    const config = platformMock({ brand: 'rtr' }).config()

    expect(config.define.__MOCK_PLATFORM__).toBe('"rtr"')
    // Without this, Vite inlines the fallback values into an optimized chunk
    // in dev and the fork silently gets a mock-less answer.
    expect(config.optimizeDeps.exclude).toContain(`${PACKAGE_NAME}/react`)
  })

  it('substitutes the values module', () => {
    const plugin = platformMock({ brand: 'rtr' })
    plugin.config()

    const importer = path.join(PACKAGE_ROOT, 'integration/runtime/react.js')
    const id = plugin.resolveId('./values.js', `${importer}?v=abc123`)
    expect(id).toBeTruthy()

    const source = plugin.load(id)
    expect(source).toContain('"platform": "rtr"')
    expect(source).toContain('"lang": "rm"')
  })

  it('leaves every other module alone', () => {
    const plugin = platformMock({ brand: 'rtr' })
    plugin.config()

    expect(plugin.resolveId('./index.js', 'react')).toBeNull()
    expect(plugin.resolveId('react', '/some/fork/src/App.jsx')).toBeNull()
    expect(plugin.load('\0other-plugin:thing')).toBeNull()
  })

  /**
   * The one that matters. Everything above asserts the plugin's own hooks;
   * this runs Vite over a project that imports the package the way a fork
   * does — through node_modules, where `define` provably does not reach.
   */
  it('reaches a fork importing the hook out of node_modules', async () => {
    const { createServer } = await import('vite')

    fs.mkdirSync(path.join(root, 'node_modules'), { recursive: true })
    fs.symlinkSync(
      PACKAGE_ROOT,
      path.join(root, 'node_modules', PACKAGE_NAME),
      'dir',
    )
    fs.mkdirSync(path.join(root, 'src'), { recursive: true })
    fs.writeFileSync(
      path.join(root, 'src/main.js'),
      `import { useMockVariables } from '${PACKAGE_NAME}/react'\n` +
        `console.log(useMockVariables())\n`,
    )

    const server = await createServer({
      root,
      logLevel: 'silent',
      server: { middlewareMode: true, hmr: false },
      plugins: [platformMock({ brand: 'rsi', entry: '/src/main.js' })],
    })

    try {
      const entry = await server.transformRequest('/src/main.js')
      const hookUrl = entry.code.match(/from "([^"]*react\.js[^"]*)"/)[1]

      const hook = await server.transformRequest(hookUrl)
      const valuesUrl = hook.code.match(/from "([^"]*values[^"]*)"/)[1]
      // The browser asks for `/@id/__x00__…`; only the dev middleware turns
      // that back into the `\0` id, so do it by hand for the direct call.
      expect(valuesUrl).toContain('__x00__platform-mock:values')

      const values = await server.transformRequest(
        valuesUrl.replace('/@id/__x00__', '\0'),
      )
      expect(values.code).toContain('"platform": "rsi"')
    } finally {
      await server.close()
    }
  })
})

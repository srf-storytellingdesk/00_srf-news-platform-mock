/**
 * Contract tests for the variables a fork reads: the catalogue, the block the
 * plugin writes into the generated document, the hook that reads it back, and
 * the docs and types that describe it. The point of the catalogue is that
 * there is one list, so every other copy of it is checked against that list
 * here rather than maintained by hand.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { BRANDS, resolveMock } from '../integration/index.js'
import {
  MOCK_VARIABLES,
  MOCK_VARIABLES_SELECTOR,
  NO_MOCK_VARIABLES,
  mockVariables,
  mockVariablesScript,
} from '../integration/mock-variables.js'
import platformMock from '../integration/vite.js'

const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url))
const KEYS = MOCK_VARIABLES.map((variable) => variable.key)

const read = (relativePath) =>
  fs.readFileSync(path.join(PACKAGE_ROOT, relativePath), 'utf8')

/** Loads the hook against a stubbed document, with no memo from a prior test. */
async function loadHook(html) {
  vi.resetModules()
  vi.stubGlobal(
    'document',
    html === null
      ? { querySelector: () => null }
      : {
          querySelector: (selector) =>
            selector === MOCK_VARIABLES_SELECTOR ? { textContent: html } : null,
        },
  )
  const { useMockVariables } = await import('../integration/react.js')
  return useMockVariables
}

afterEach(() => vi.unstubAllGlobals())

describe('the catalogue', () => {
  it('resolves the same keys for every brand', () => {
    for (const brand of BRANDS) {
      const mock = resolveMock(brand)
      const variables = mockVariables(mock)

      expect(Object.keys(variables), brand).toEqual(KEYS)
      expect(variables.platform, brand).toBe(brand)
      expect(variables.label, brand).toBeTruthy()
      expect(variables.lang, brand).toMatch(/^[a-z]{2}$/)
      expect(variables.entryPoint, brand).toBe(mock.manifest.entryPointSelector)
    }
  })

  it('answers with the same keys when there is no mock', () => {
    // A fork destructures the same object either way, so a key that only
    // exists in one of the two would be a `undefined` at the call site.
    expect(Object.keys(NO_MOCK_VARIABLES)).toEqual(KEYS)
    for (const key of KEYS) expect(NO_MOCK_VARIABLES[key], key).toBeNull()
  })
})

describe('the block in the document', () => {
  it('carries the variables as parseable JSON', () => {
    const script = mockVariablesScript(resolveMock('rts'))
    const json = script.match(/>(.*)<\/script>/s)[1]

    expect(script).toContain('type="application/json"')
    expect(JSON.parse(json)).toEqual(mockVariables(resolveMock('rts')))
  })

  it('needs no escaping for a selector full of quotes', () => {
    // entryPoint is `[data-news-landmark="article-content"]`; in an attribute
    // that would need escaping, which is why it travels in a JSON block.
    const script = mockVariablesScript(resolveMock('srf'))
    expect(script).toContain('data-news-landmark=\\"article-content\\"')
    expect(script).not.toContain('&quot;')
  })
})

describe('the hook reading it back', () => {
  it('reports the mock the plugin wrote into the page', async () => {
    const useMockVariables = await loadHook(
      JSON.stringify(mockVariables(resolveMock('rtr'))),
    )
    expect(useMockVariables()).toEqual({
      platform: 'rtr',
      label: 'RTR',
      lang: 'rm',
      entryPoint: '[data-news-landmark="article-content"]',
    })
    expect(Object.isFrozen(useMockVariables())).toBe(true)
  })

  it('reports no mock when the page has no block', async () => {
    const useMockVariables = await loadHook(null)
    expect(useMockVariables()).toEqual(NO_MOCK_VARIABLES)
  })

  it('survives a block it cannot parse', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const useMockVariables = await loadHook('{ not json')

    expect(useMockVariables()).toEqual(NO_MOCK_VARIABLES)
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })

  it('fills in a variable an older mock did not write', async () => {
    const useMockVariables = await loadHook('{"platform":"srf"}')
    expect(useMockVariables()).toEqual({
      ...NO_MOCK_VARIABLES,
      platform: 'srf',
    })
  })
})

describe('what the plugin writes', () => {
  let root

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'pm-vars-'))
  })

  afterEach(() => {
    if (root) fs.rmSync(root, { recursive: true, force: true })
  })

  const generate = (options, command) => {
    platformMock({ brand: 'rsi', ...options }).configResolved({
      command,
      root,
      base: '/',
      publicDir: path.join(root, 'public'),
      build: {},
    })
    // A build writes its own entry document; the dev one stays put so a
    // running dev server keeps serving the full mock.
    const file =
      command === 'build' ? '.platform-mock-entry.html' : 'index.html'
    return fs.readFileSync(path.join(root, file), 'utf8')
  }

  it('puts the variables in the dev document, inside <head>', () => {
    const html = generate({}, 'serve')
    const head = html.slice(html.indexOf('<head'), html.indexOf('</head>'))

    expect(head).toContain('data-platform-mock')
    expect(head).toContain('"platform":"rsi"')
  })

  it('puts them in the build document too', () => {
    // The bare build entry is what a fork's `vite build` reads, so the hook
    // has to answer there as well.
    expect(generate({}, 'build')).toContain('"platform":"rsi"')
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
    const types = read('integration/react.d.ts')
    for (const key of KEYS) {
      expect(types, `type of ${key}`).toMatch(new RegExp(`^\\s*${key}:`, 'm'))
    }
    for (const [, name] of read('integration/react.js').matchAll(
      /^export function (\w+)/gm,
    )) {
      expect(types, `declaration of ${name}`).toContain(`function ${name}(`)
    }
  })
})

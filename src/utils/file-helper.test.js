import { describe, expect, it } from 'vitest'

import {
  extractInlineStyles,
  getDefinedClasses,
  getUsedClassesFromHtml,
  pointAssetUrlsToSandbox,
  pointSrcAndHrefUrlsToSandbox,
  removeUnusedClasses,
  resolveRelativeCssUrls,
  stripOriginFromCssUrls,
} from './file-helper.js'

describe('getDefinedClasses', () => {
  it('extracts class names from formatted CSS', () => {
    expect(getDefinedClasses('.foo { color: red; } .bar { color: blue; }')) //
      .toEqual(new Set(['foo', 'bar']))
  })

  it('extracts class names from minified CSS', () => {
    expect(getDefinedClasses('.foo{color:red;}.bar{color:blue;}')) //
      .toEqual(new Set(['foo', 'bar']))
  })

  it('extracts class names qualified by an element', () => {
    expect(getDefinedClasses('div.foo{color:red;} span.bar{color:blue;}')) //
      .toEqual(new Set(['foo', 'bar']))
  })

  it('handles empty CSS', () => {
    expect(getDefinedClasses('')).toEqual(new Set())
  })
})

describe('removeUnusedClasses', () => {
  it('removes unused class definitions', () => {
    const result = removeUnusedClasses(
      '.foo { color: red; } .bar { color: blue; }',
      new Set(['foo']),
    )
    expect(result).toContain('.foo')
    expect(result).not.toContain('.bar')
  })

  it('removes unused class definitions from minified CSS', () => {
    const result = removeUnusedClasses(
      '.foo{color:red;}.bar{color:blue;}',
      new Set(['bar']),
    )
    expect(result).toContain('.bar')
    expect(result).not.toContain('.foo')
  })

  it('removes element-qualified selectors', () => {
    const result = removeUnusedClasses(
      'div.foo{color:red;} span.bar{color:blue;}',
      new Set(['bar']),
    )
    expect(result).toContain('span.bar')
    expect(result).not.toContain('div.foo')
  })

  it('returns unchanged CSS when every class is used', () => {
    const css = '.foo { color: red; }'
    expect(removeUnusedClasses(css, new Set(['foo']))).toBe(css)
  })

  it('handles empty CSS', () => {
    expect(removeUnusedClasses('', new Set(['foo']))).toBe('')
  })
})

describe('getUsedClassesFromHtml', () => {
  it('collects every class on every element', () => {
    const html = '<div class="a b"><span class="c"></span></div>'
    expect(getUsedClassesFromHtml(html)).toEqual(new Set(['a', 'b', 'c']))
  })
})

describe('extractInlineStyles', () => {
  it('lifts <style> blocks out of the markup', () => {
    const { html, styles } = extractInlineStyles(
      '<head><style>.a{color:red}</style></head><body><style>.b{}</style></body>',
    )
    expect(html).toBe('<head></head><body></body>')
    expect(styles).toBe('.a{color:red}\n.b{}')
  })

  it('leaves markup without styles untouched', () => {
    const { html, styles } = extractInlineStyles('<p>hello</p>')
    expect(html).toBe('<p>hello</p>')
    expect(styles).toBe('')
  })
})

// The two rewriters are deliberately separate: the merged CSS lives inside the
// asset directory and needs URLs relative to it, while the HTML sits one level
// above and needs root-relative ones.
describe('pointAssetUrlsToSandbox (CSS)', () => {
  it('rewrites unquoted url()', () => {
    expect(pointAssetUrlsToSandbox('background: url(/foo/bar.png);')).toBe(
      'background: url(../sandbox-assets/foo/bar.png);',
    )
  })

  it('rewrites quoted url() and keeps the quote style', () => {
    expect(
      pointAssetUrlsToSandbox(
        `a{background:url('/foo/bar.png')}b{src:url("/f/x.woff2")}`,
      ),
    ).toBe(
      `a{background:url('../sandbox-assets/foo/bar.png')}b{src:url("../sandbox-assets/f/x.woff2")}`,
    )
  })

  it('leaves already-rewritten, protocol-relative and remote URLs alone', () => {
    const css =
      'a{background:url(/sandbox-assets/x.png)}' +
      'b{background:url(//cdn.example/x.png)}' +
      'c{background:url(https://example.com/x.png)}'
    expect(pointAssetUrlsToSandbox(css)).toBe(css)
  })

  it('does not touch src/href attributes — that is the HTML rewriter’s job', () => {
    const html = '<img src="/foo/bar.png" />'
    expect(pointAssetUrlsToSandbox(html)).toBe(html)
  })
})

describe('pointSrcAndHrefUrlsToSandbox (HTML)', () => {
  it('rewrites root-relative src and href attributes', () => {
    expect(
      pointSrcAndHrefUrlsToSandbox(
        '<img src="/foo/bar.png" /><link href="/a/b.css" />',
      ),
    ).toBe(
      '<img src="/sandbox-assets/foo/bar.png" />' +
        '<link href="/sandbox-assets/a/b.css" />',
    )
  })

  it('strips the scraped origin before rewriting', () => {
    expect(
      pointSrcAndHrefUrlsToSandbox(
        '<img src="https://www.srf.ch/foo/bar.png" />',
        'https://www.srf.ch',
      ),
    ).toBe('<img src="/sandbox-assets/foo/bar.png" />')
  })

  it('rewrites every candidate in a srcset, descriptors intact', () => {
    expect(
      pointSrcAndHrefUrlsToSandbox(
        '<img srcset="/a/1.webp 320w, /a/2.webp 640w" />',
      ),
    ).toBe(
      '<img srcset="/sandbox-assets/a/1.webp 320w, /sandbox-assets/a/2.webp 640w" />',
    )
  })

  it('leaves already-rewritten and cross-origin URLs alone', () => {
    const html =
      '<img src="/sandbox-assets/x.png" />' +
      '<img src="https://cdn.example/x.png" />' +
      '<img srcset="//cdn.example/x.png 1x" />'
    expect(pointSrcAndHrefUrlsToSandbox(html, 'https://www.srf.ch')).toBe(html)
  })
})

describe('stripOriginFromCssUrls', () => {
  it('turns same-origin absolute URLs back into root-relative ones', () => {
    expect(
      stripOriginFromCssUrls(
        'a{background:url("https://www.srf.ch/a/b.png")}',
        'https://www.srf.ch',
      ),
    ).toBe('a{background:url("/a/b.png")}')
  })

  it('leaves other origins untouched', () => {
    const css = 'a{background:url("https://cdn.example/a/b.png")}'
    expect(stripOriginFromCssUrls(css, 'https://www.srf.ch')).toBe(css)
  })
})

describe('resolveRelativeCssUrls', () => {
  it('resolves a relative url() against the stylesheet’s own directory', () => {
    expect(
      resolveRelativeCssUrls('a{background:url(img/x.png)}', 'build/main.css'),
    ).toBe('a{background:url(/build/img/x.png)}')
  })

  it('resolves parent-directory hops', () => {
    expect(
      resolveRelativeCssUrls(
        'a{background:url(../img/x.png)}',
        'build/css/main.css',
      ),
    ).toBe('a{background:url(/build/img/x.png)}')
  })

  it('leaves absolute, remote, data and fragment URLs alone', () => {
    const css =
      'a{background:url(/x.png)}b{background:url(https://e.com/x.png)}' +
      'c{background:url(data:image/png;base64,AA)}d{fill:url(#grad)}'
    expect(resolveRelativeCssUrls(css, 'build/main.css')).toBe(css)
  })
})

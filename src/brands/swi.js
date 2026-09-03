import { COMMON_DELETE_SELECTORS, PLACEHOLDER } from './_shared.js'

/** @type {import('./_shared.js').BrandConfig} */
export default {
  label: 'SWI swissinfo.ch',
  lang: 'en',

  fetchUrl:
    'https://www.swissinfo.ch/eng/global-trade/swiss-group-supports-gulf-oil-and-gas-repairs/91632308',

  mounts: {
    // No topMedia mount — SWI's article page has no top-media slot.
    article: {
      selector: 'main article .article-main',
      mode: 'append',
      template: 'embed_swi.html',
    },
  },

  deleteSelectors: [
    ...COMMON_DELETE_SELECTORS,
    // Drop the real article body but keep the meta rows around it.
    'main article .article-main > *:not(.article-meta-list):not(.article-meta-row)',
  ],

  textReplacements: {
    title: '{{ARTICLE_TITLE}}',
    '.article-title__overline': PLACEHOLDER.overline,
    'main article .article-header h1': PLACEHOLDER.title,
    '.article-authors .author__title': PLACEHOLDER.authors,
    'h2.lead-text__content': PLACEHOLDER.lead,
  },
}

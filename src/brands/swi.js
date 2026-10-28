import { COMMON_MODS, PLACEHOLDER } from './_shared.js'

/** @type {import('./_shared.js').BrandConfig} */
export default {
  label: 'SWI swissinfo.ch',
  lang: 'en',

  fetchUrl:
    'https://www.swissinfo.ch/eng/global-trade/swiss-group-supports-gulf-oil-and-gas-repairs/91632308',

  mount: {
    selector: 'main article .article-main',
    action: 'append',
    template: 'embed_swi.html',
  },

  mods: [
    ...COMMON_MODS,
    // Drop the real article body but keep the meta rows around it.
    {
      selector:
        'main article .article-main > *:not(.article-meta-list):not(.article-meta-row)',
      action: 'remove',
    },
    { selector: 'title', text: '{{ARTICLE_TITLE}}' },
    { selector: '.article-title__overline', text: PLACEHOLDER.overline },
    { selector: 'main article .article-header h1', text: PLACEHOLDER.title },
    { selector: '.article-authors .author__title', text: PLACEHOLDER.authors },
    { selector: 'h2.lead-text__content', text: PLACEHOLDER.lead },
  ],
}

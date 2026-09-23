import { COMMON_DELETE_SELECTORS, PLACEHOLDER } from './_shared.js'

/** @type {import('./_shared.js').BrandConfig} */
export default {
  label: 'RTR',
  lang: 'rm',

  fetchUrl:
    'https://www.rtr.ch/novitads/grischun/malauras-mesolcina-2024-tge-ha-mana-a-la-bova-e-co-pon-ins-evitar-donns-en-l-avegnir',

  mounts: {
    article: {
      selector: '[data-news-landmark="article-content"]',
      mode: 'replace',
      template: 'embed_default.html',
    },
    topMedia: {
      selector: 'main.articlepage article',
      mode: 'prepend',
      template: 'tme_default.html',
    },
  },

  deleteSelectors: [
    ...COMMON_DELETE_SELECTORS,
    // RTR's own top media is replaced by the topMedia mount above.
    '[data-news-landmark="topmedia"]',
  ],

  textReplacements: {
    title: '{{ARTICLE_TITLE}}',
    '.article-title__overline': PLACEHOLDER.overline,
    '.article-title__text': PLACEHOLDER.title,
    ".article-author__name span[itemprop='name']": PLACEHOLDER.authors,
    '.article-lead': PLACEHOLDER.lead,
  },
}

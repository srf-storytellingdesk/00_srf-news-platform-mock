import { COMMON_DELETE_SELECTORS, PLACEHOLDER } from './_shared.js'

/** @type {import('./_shared.js').BrandConfig} */
export default {
  label: 'RTR',
  lang: 'rm',

  fetchUrl:
    'https://www.rtr.ch/novitads/grischun/malauras-mesolcina-2024-tge-ha-mana-a-la-bova-e-co-pon-ins-evitar-donns-en-l-avegnir',

  embedTemplate: 'embed_default.html',
  tmeTemplate: 'tme_default.html',

  deleteSelectors: [
    ...COMMON_DELETE_SELECTORS,
    // RTR's own top media is replaced by the template's mount point below.
    '[data-news-landmark="topmedia"]',
  ],

  insertSelectors: {
    '^main.articlepage article': '{{TOP_MEDIA_ELEMENT}}',
  },

  textReplacements: {
    title: '{{ARTICLE_TITLE}}',
    '[data-news-landmark="article-content"]': '{{ARTICLE_CONTENT}}',
    '.article-title__overline': PLACEHOLDER.overline,
    '.article-title__text': PLACEHOLDER.title,
    ".article-author__name span[itemprop='name']": PLACEHOLDER.authors,
    '.article-lead': PLACEHOLDER.lead,
  },
}

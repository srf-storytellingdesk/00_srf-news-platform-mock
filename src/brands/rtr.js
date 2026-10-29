import { COMMON_REMOVAL_MODS, PLACEHOLDER } from './_shared.js'

/** @type {import('./_shared.js').BrandConfig} */
export default {
  label: 'RTR',
  lang: 'rm',

  fetchUrl:
    'https://www.rtr.ch/novitads/grischun/malauras-mesolcina-2024-tge-ha-mana-a-la-bova-e-co-pon-ins-evitar-donns-en-l-avegnir',

  mount: {
    selector: '[data-news-landmark="article-content"]',
    template: 'embed_default.html',
  },

  mods: [
    ...COMMON_REMOVAL_MODS,
    { selector: 'link[crossorigin="use-credentials"]', action: 'remove' },
    { selector: '[data-js-plugin="dynamic-promo-banner"]', action: 'remove' },
    { selector: '#config__js', action: 'remove' },
    { selector: '[data-news-landmark="topmedia"]', action: 'remove' },
    { selector: 'title', text: '{{ARTICLE_TITLE}}' },
    { selector: '.article-title__overline', text: PLACEHOLDER.overline },
    { selector: '.article-title__text', text: PLACEHOLDER.title },
    {
      selector: ".article-author__name span[itemprop='name']",
      text: PLACEHOLDER.authors,
    },
    { selector: '.article-lead', text: PLACEHOLDER.lead },
  ],
}

import { COMMON_REMOVAL_MODS } from './_shared.js'

/** @type {import('./_shared.js').BrandConfig} */
export default {
  label: 'RSI',
  lang: 'it',

  fetchUrl:
    'https://www.rsi.ch/info/natura-e-animali/Morso-di-vipera-quanto-%C3%A8-davvero-pericoloso-in-Svizzera--3837425.html',

  mount: {
    selector: '.c-article-body',
    action: 'append',
    template: 'embed_rsi.html',
  },

  header: {
    selector:
      'article.s-article header, article.s-article section .c-article-credits, article.s-article .container > *:not(:has(.c-article-body))',
    authorSelector: 'article.s-article section .c-article-credits',
    dateSelector: 'article.s-article .infobarElement > span',
  },

  mods: [
    ...COMMON_REMOVAL_MODS,
    {
      selector: '.c-article-body .c-article-body_item:not(.c-article-credits)',
      action: 'remove',
    },
    // Nuxt itself cannot run offline; this rebuilds just its header scroll.
    { selector: 'body', action: 'append', template: 'header_rsi.html' },
  ],

  layouts: {
    // A full-bleed embed with no article header of its own.
    fullwidth: {
      fetchUrl:
        'https://www.rsi.ch/info/svizzera/Alptransit-un-decennio-sfrecciando-in-treno-nel-tunnel-dei-record--3772900.html',
      mount: {
        selector: '.s-article-gran-formato',
        action: 'replace',
      },
      mods: [
        ...COMMON_REMOVAL_MODS,
        { selector: 'title', text: '{{ARTICLE_TITLE}}' },
        { selector: 'body', action: 'append', template: 'header_rsi.html' },
      ],
    },
  },
}

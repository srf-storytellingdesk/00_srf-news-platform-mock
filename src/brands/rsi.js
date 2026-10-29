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

  mods: [
    ...COMMON_REMOVAL_MODS,
    {
      selector: '.c-article-body .c-article-body_item:not(.c-article-credits)',
      action: 'remove',
    },
  ],

  // keepScripts: [/\/_nuxt\/[^/]*\.js$/],

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
      ],
    },
  },
}

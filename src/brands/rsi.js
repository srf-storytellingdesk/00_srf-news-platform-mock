import { COMMON_DELETE_SELECTORS, PLACEHOLDER } from './_shared.js'

/** @type {import('./_shared.js').BrandConfig} */
export default {
  label: 'RSI',
  lang: 'it',

  fetchUrl:
    'https://www.rsi.ch/info/natura-e-animali/Morso-di-vipera-quanto-%C3%A8-davvero-pericoloso-in-Svizzera--3837425.html',

  mounts: {
    // No topMedia mount — RSI's article page has no top-media slot.
    article: {
      selector: '.c-article-body',
      mode: 'append',
      template: 'embed_rsi.html',
    },
  },

  // keepScripts: [/\/_nuxt\/[^/]*\.js$/],

  deleteSelectors: [
    ...COMMON_DELETE_SELECTORS,
    // Drop the real article body but keep the credits line as a placeholder.
    '.c-article-body .c-article-body_item:not(.c-article-credits)',
  ],

  textReplacements: {
    title: '{{ARTICLE_TITLE}}',
    '.c-article-header h1': PLACEHOLDER.title,
    '.c-article-credits span span': PLACEHOLDER.authors,
    '.c-article-header h2': PLACEHOLDER.lead,
  },

  layouts: {
    // A full-bleed embed with no article header of its own.
    fullwidth: {
      fetchUrl:
        'https://www.rsi.ch/info/svizzera/Alptransit-un-decennio-sfrecciando-in-treno-nel-tunnel-dei-record--3772900.html',
      mounts: {
        article: {
          selector: '.s-article-gran-formato',
          mode: 'replace',
          template: 'embed_rsi.html',
        },
        topMedia: null,
      },
      textReplacements: {
        title: '{{ARTICLE_TITLE}}',
      },
    },
  },
}

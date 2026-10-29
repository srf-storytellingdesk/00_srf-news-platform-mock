/**
 * Functions serialised into the scraped page by `page.evaluate()`.
 *
 * They run in browser scope, not Node: they may only use their arguments and
 * browser globals — never a module-scope binding, which would not survive
 * serialisation.
 */

/** Scrolls to the bottom in steps so lazy-loaded media starts fetching. */
export async function scrollToBottom() {
  await new Promise((resolve) => {
    let scrolled = 0
    const distance = 500
    const timer = setInterval(() => {
      window.scrollBy(0, distance)
      scrolled += distance
      if (scrolled >= document.body.scrollHeight) {
        clearInterval(timer)
        resolve()
      }
    }, 300)
  })
}

/**
 * Applies the brand config's edits in order. Content goes in as text — a
 * partial arrives as a `{{TOKEN}}` the generator swaps for its markup after
 * serialisation.
 *
 * @param {{selector: string, action: 'remove'|'replace'|'append'|'prepend', text?: string}[]} edits
 */
export function applyEdits(edits) {
  for (const { selector, action, text } of edits) {
    if (action === 'remove') {
      document.querySelectorAll(selector).forEach((el) => el.remove())
      continue
    }
    const el = document.querySelector(selector)
    if (!el) continue
    if (action === 'replace') el.textContent = text
    else if (action === 'prepend') el.prepend(document.createTextNode(text))
    else el.append(document.createTextNode(text))
  }
}

/**
 * Drops every stylesheet link and points the page at the single merged
 * stylesheet instead, then neutralises all hyperlinks — the mock has nowhere
 * to navigate to.
 */
export function inlineSingleStylesheet(cssHref) {
  document
    .querySelectorAll("link[rel='stylesheet']")
    .forEach((el) => el.remove())

  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = cssHref
  document.head.appendChild(link)

  document
    .querySelectorAll('a[href]')
    .forEach((a) => a.setAttribute('href', '#'))
}

/**
 * Removes the loading screen and releases every page-level scroll container so
 * a full-height screenshot captures the whole article. Returns the resulting
 * document height.
 */
export function unlockPageScroll(loadingScreenSelector) {
  document.querySelectorAll(loadingScreenSelector).forEach((el) => el.remove())

  for (const el of [document.documentElement, document.body]) {
    el.style.overflow = 'visible'
    el.style.height = 'auto'
  }

  // Only unlock elements taller than the viewport — those are page-level scroll
  // containers (e.g. Nuxt's #__nuxt wrapper). Smaller ones like nav menus and
  // icon containers must keep their own overflow.
  for (const el of document.querySelectorAll('body *')) {
    const style = getComputedStyle(el)
    const scrolls = ['auto', 'scroll', 'hidden'].includes(style.overflowY)
    if (el.scrollHeight > window.innerHeight * 1.2 && scrolls) {
      el.style.overflow = 'visible'
      el.style.height = 'auto'
    }
  }

  return document.documentElement.scrollHeight
}

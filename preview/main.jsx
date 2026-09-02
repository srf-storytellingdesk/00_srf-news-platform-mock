/**
 * Stand-in for a template fork's own entry module.
 *
 * A fork mounts its article into the same slot; this renders a placeholder so
 * the mock can be inspected on its own. Keep it minimal — it is a harness, not
 * a component library.
 */
import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'

/** Must match `MOUNT_ID` in vite.config.js. */
const MOUNT_ID = 'platform-mock-preview'

const Placeholder = () => {
  useEffect(() => {
    // The mock ships a loading screen that a real fork removes once it mounts.
    document.querySelector('[data-news-landmark=news-loading-screen]')?.remove()
  }, [])

  return (
    <div style={{ padding: '2rem 0', textAlign: 'center' }}>
      <h2>Platform mock preview</h2>
      <p>
        A template fork renders its article here. Everything around this box is
        the mocked platform chrome.
      </p>
    </div>
  )
}

const mountNode = document.getElementById(MOUNT_ID)
if (!mountNode) {
  throw new Error(
    `No #${MOUNT_ID} in the mock — is \`mountId\` still in sync with vite.config.js?`,
  )
}

ReactDOM.createRoot(mountNode).render(
  <React.StrictMode>
    <Placeholder />
  </React.StrictMode>,
)

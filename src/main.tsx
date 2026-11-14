import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './fonts'
import './index.css'
import App from './App.tsx'
import { initNativeShell } from './utils/nativeShell'
import { wireHaptics } from './utils/haptics'
import { installTroubleHandlers, record } from './utils/trouble'
import { watchSunburst } from './utils/sunburst'
import { AppTrouble, TroubleBoundary } from './components/Trouble'

declare global {
  interface Window {
    /** Set once the app has taken over the page; the boot guard in index.html stands down. */
    __sfBooted?: boolean
    /** The boot guard's plain fallback, for the one failure no React screen can show. */
    __sfBootFail?: (reason: unknown) => void
  }
}

installTroubleHandlers()
watchSunburst()
void initNativeShell().catch(e => record(e, 'starting the Android shell'))
wireHaptics()

createRoot(document.getElementById('root')!, {
  // Caught by a boundary, which has already logged and explained it.
  onCaughtError: () => {},
  // Something React could recover from by itself (a hydration retry). Worth
  // keeping in the log, not worth interrupting anyone over.
  onRecoverableError: error => record(error, 'a recovered render'),
  // Past every boundary, including the full-page one: only the plain page in
  // index.html is left, so React steps aside and lets it draw.
  onUncaughtError: error => {
    record(error, 'the app, past every safeguard')
    window.__sfBooted = false
    document.getElementById('root')!.replaceChildren()
    window.__sfBootFail?.(error instanceof Error ? error.message : error)
  },
}).render(
  <StrictMode>
    <TroubleBoundary where="the app" fallback={error => <AppTrouble error={error} />}>
      <App />
    </TroubleBoundary>
  </StrictMode>,
)
window.__sfBooted = true

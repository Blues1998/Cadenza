import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './fonts'
import './index.css'
import App from './App.tsx'
import { initNativeShell } from './utils/nativeShell'
import { wireHaptics } from './utils/haptics'

void initNativeShell()
wireHaptics()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

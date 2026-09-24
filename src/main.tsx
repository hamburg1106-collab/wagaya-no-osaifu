import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { loadRoundedFontIfMissing } from './lib/font'
import { reloadOnServiceWorkerUpdate } from './lib/swUpdate'

reloadOnServiceWorkerUpdate()
loadRoundedFontIfMissing()

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

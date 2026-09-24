import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { loadRoundedFontIfMissing } from './lib/font'
import { reloadOnServiceWorkerUpdate } from './lib/swUpdate'
import { applyTheme, readTheme } from './lib/theme'

reloadOnServiceWorkerUpdate()
loadRoundedFontIfMissing()
// 描画より先に当てる。あとから切り替えると一瞬前の配色が見える
applyTheme(readTheme())

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

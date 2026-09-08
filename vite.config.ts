import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { alphaTab } from '@coderline/alphatab-vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // GitHub Pages serves the app from /Cadenza/, but that base is only correct
  // for the built site. In dev it made Vite rewrite the env import alphaTab's
  // worker relies on to "/Cadenza/@vite/env", which the dev server cannot
  // resolve — the Tab Player lab was covered by an error overlay every time it
  // was opened. Assets are addressed through import.meta.env.BASE_URL, so both
  // values are handled.
  base: command === 'build' ? '/Cadenza/' : '/',
  plugins: [react(), alphaTab()],
}))

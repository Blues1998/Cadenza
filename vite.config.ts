import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { alphaTab } from '@coderline/alphatab-vite'
import { SLUGS } from './src/utils/route.ts'

// Pages serves 404.html for any path it does not have a file for, with the
// address the visitor actually asked for still in the bar — which is enough
// for the page to hand a real destination back to the app instead of
// apologising for it. Written from a template here so the list of addresses it
// knows is the app's own list rather than a copy of it.
//
// Build only: the dev server answers every unmatched path with index.html and
// so never reaches a 404 at all.
const notFoundPage = (base: string): Plugin => ({
  name: 'cadenza-404',
  apply: 'build',
  generateBundle() {
    // Each slug title-cased is the word on the rail, so the way out of the
    // page is written from the routing table and cannot fall behind it.
    const ways = SLUGS.map(slug => {
      const label = slug === 'home'
        ? 'Back to Cadenza'
        : slug.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
      return `<a class="way${slug === 'home' ? ' is-home' : ''}" href="${base}#/${slug}">${label}</a>`
    }).join('\n        ')

    const template = readFileSync(new URL('./src/404.template.html', import.meta.url), 'utf8')
    this.emitFile({
      type: 'asset',
      fileName: '404.html',
      source: template
        .replaceAll('__BASE__', base)
        .replace('__SLUGS__', JSON.stringify(SLUGS))
        .replace('__WAYS__', ways)
    })
  }
})

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // GitHub Pages serves the app from /Cadenza/, but that base is only correct
  // for the built site. In dev it made Vite rewrite the env import alphaTab's
  // worker relies on to "/Cadenza/@vite/env", which the dev server cannot
  // resolve — the Tab Player lab was covered by an error overlay every time it
  // was opened. Assets are addressed through import.meta.env.BASE_URL, so both
  // values are handled.
  base: command === 'build' ? '/Cadenza/' : '/',
  plugins: [react(), alphaTab(), notFoundPage(command === 'build' ? '/Cadenza/' : '/')],
}))

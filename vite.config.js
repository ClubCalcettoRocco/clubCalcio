import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import buildSquads from './api/build-squads.js'

function localApi() {
  return {
    name: 'local-squad-builder-api',
    configureServer(server) {
      server.middlewares.use('/api/build-squads', async (req, res) => {
        const chunks = []
        for await (const chunk of req) chunks.push(chunk)
        try {
          req.body = chunks.length
            ? JSON.parse(Buffer.concat(chunks).toString('utf8'))
            : {}
        } catch {
          req.body = {}
        }

        const headers = {}
        const response = {
          statusCode: 200,
          status(code) { this.statusCode = code; return this },
          setHeader(name, value) { headers[name] = value; return this },
          send(body) {
            res.statusCode = this.statusCode
            for (const [name, value] of Object.entries(headers)) res.setHeader(name, value)
            res.end(typeof body === 'string' ? body : JSON.stringify(body))
          }
        }
        await buildSquads(req, response)
      })
    }
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  for (const key of ['GROQ_API_KEY', 'GROQ_MODEL', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']) {
    if (env[key]) process.env[key] = env[key]
  }

  return {
    plugins: [
      localApi(),
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png'],
        manifest: {
          name: 'Calcetto Club',
          short_name: 'Calcetto Club',
          description: 'Gestione privata delle partite di calcio del gruppo',
          start_url: '/',
          display: 'standalone',
          background_color: '#08111f',
          theme_color: '#0ea968',
          lang: 'it',
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
          ]
        }
      })
    ]
  }
})

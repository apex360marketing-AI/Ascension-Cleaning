// Local preview without the Netlify CLI: serves public/, runs the lead function
// at /.netlify/functions/lead, and (unless GHL_WEBHOOK_URL is set) points it at
// a fake GHL webhook on :8899 that prints every lead it receives.
//   node scripts/dev.mjs            → http://127.0.0.1:8888
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import handler from '../netlify/functions/lead.mjs'

const ROOT = path.resolve('public')
const PORT = Number(process.env.PORT || 8888)
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.css': 'text/css' }

if (!process.env.GHL_WEBHOOK_URL) {
  const leads = []
  http.createServer((req, res) => {
    let b = ''
    req.on('data', (c) => (b += c))
    req.on('end', () => {
      if (req.method === 'POST') {
        leads.push(JSON.parse(b))
        console.log('[fake GHL] lead received:', b)
        res.end('{"ok":true}')
      } else {
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(leads))
      }
    })
  }).listen(8899, '127.0.0.1')
  process.env.GHL_WEBHOOK_URL = 'http://127.0.0.1:8899/hook'
  console.log('fake GHL webhook on http://127.0.0.1:8899 (GET it to list leads)')
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  if (url.pathname === '/.netlify/functions/lead') {
    let body = ''
    for await (const c of req) body += c
    const r = await handler(new Request(url, { method: req.method, headers: req.headers, body: req.method === 'POST' ? body : undefined }))
    res.writeHead(r.status, Object.fromEntries(r.headers))
    res.end(await r.text())
    return
  }
  const file = path.join(ROOT, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname))
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404)
    res.end('not found')
    return
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' })
  fs.createReadStream(file).pipe(res)
}).listen(PORT, '127.0.0.1', () => console.log(`site on http://127.0.0.1:${PORT}`))

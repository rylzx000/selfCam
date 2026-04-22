const fs = require('fs')
const http = require('http')
const path = require('path')

const PORT = Number(process.env.SELFCAM_LOG_PORT || 8101)
const LOG_DIR = path.join(__dirname, '..', 'runtime-logs')
const LOG_FILE = path.join(LOG_DIR, 'device-capture-log.jsonl')

function ensureLogDir() {
  fs.mkdirSync(LOG_DIR, { recursive: true })
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  })
  res.end(JSON.stringify(payload))
}

function appendLogs(payload) {
  const logs = Array.isArray(payload?.logs) ? payload.logs : []
  if (logs.length === 0) {
    return 0
  }

  ensureLogDir()
  const lines = logs.map((item) => JSON.stringify(item)).join('\n') + '\n'
  fs.appendFileSync(LOG_FILE, lines, 'utf8')
  return logs.length
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, { ok: true })
    return
  }

  if (req.method === 'GET' && req.url === '/health') {
    sendJson(res, 200, { ok: true, file: LOG_FILE, port: PORT })
    return
  }

  if (req.method !== 'POST' || req.url !== '/capture-log') {
    sendJson(res, 404, { ok: false, message: 'not_found' })
    return
  }

  let body = ''
  req.on('data', (chunk) => {
    body += chunk
  })

  req.on('end', () => {
    try {
      const payload = body ? JSON.parse(body) : {}
      const saved = appendLogs(payload)
      sendJson(res, 200, { ok: true, saved })
    } catch (error) {
      sendJson(res, 400, { ok: false, message: error.message })
    }
  })
})

server.listen(PORT, '0.0.0.0', () => {
  ensureLogDir()
  console.log(`SelfCam 日志采集器已启动: http://0.0.0.0:${PORT}`)
  console.log(`日志文件: ${LOG_FILE}`)
})
